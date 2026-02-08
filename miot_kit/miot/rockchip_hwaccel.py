# -*- coding: utf-8 -*-
# Copyright (C) 2025 Xiaomi Corporation
# This software may be used and distributed according to the terms of the Xiaomi Miloco License Agreement.
"""
Rockchip hardware video pipeline helpers (MPP decode + RGA + MPP MJPEG encode).
"""
from __future__ import annotations

import ctypes
import logging
import platform
from pathlib import Path
from typing import Optional
from io import BytesIO

import numpy as np
from PIL import Image

_LOGGER = logging.getLogger(__name__)

# Cache the CDLL instance to avoid repeatedly loading the same .so.
lib_cache: Optional[ctypes.CDLL] = None

# MPP format constants (partial)
MPP_FMT_YUV420SP = 0x0    # NV12
MPP_FMT_YUV420SP_VU = 0x5  # NV21

# RGA format constants (RK_FORMAT_XX << 8)
RGA_FMT_RGB_888 = 0x2 << 8
RGA_FMT_YUV_420_SP = 0xA << 8   # NV12
RGA_FMT_YCRCB_420_SP = 0xE << 8  # NV21


class DecodedFrame(ctypes.Structure):
    """Decoded frame from MPP."""
    _fields_ = [
        ("width", ctypes.c_int),
        ("height", ctypes.c_int),
        ("hor_stride", ctypes.c_int),
        ("ver_stride", ctypes.c_int),
        ("format", ctypes.c_int),
        ("data", ctypes.c_void_p),
        ("fd", ctypes.c_int),
        ("size", ctypes.c_size_t),
    ]


def _default_lib_path() -> Path:
    return Path(__file__).parent / "libs" / "linux" / "arm64" / "librockchip_hwaccel.so"


def _load_library() -> Optional[ctypes.CDLL]:
    global lib_cache  # pylint: disable=global-statement

    if lib_cache is not None:
        return lib_cache

    system = platform.system().lower()
    machine = platform.machine().lower()
    if system != "linux" or machine not in ("aarch64", "arm64"):
        return None

    lib_path = _default_lib_path()
    if lib_path.exists():
        try:
            lib_cache = ctypes.CDLL(str(lib_path))
            _LOGGER.info("Loaded rockchip hwaccel library: %s", lib_path)
            return lib_cache
        except OSError as exc:  # pylint: disable=broad-exception-caught
            _LOGGER.warning("Failed to load rockchip hwaccel library %s: %s", lib_path, exc)

    return None


class RockchipHwDecoder:
    """Rockchip MPP + RGA decoder wrapper."""

    def __init__(self, coding_type: int) -> None:
        self._lib = _load_library()
        self._handle: Optional[ctypes.c_void_p] = None
        self._rga_ctx: Optional[ctypes.c_void_p] = None
        if not self._lib:
            return

        self._lib.mpp_decoder_init.argtypes = [ctypes.c_int]
        self._lib.mpp_decoder_init.restype = ctypes.c_void_p
        self._lib.mpp_decoder_decode.argtypes = [ctypes.c_void_p, ctypes.POINTER(ctypes.c_ubyte), ctypes.c_size_t]
        self._lib.mpp_decoder_decode.restype = ctypes.c_int
        self._lib.mpp_decoder_get_frame.argtypes = [ctypes.c_void_p, ctypes.POINTER(DecodedFrame)]
        self._lib.mpp_decoder_get_frame.restype = ctypes.c_int
        self._lib.mpp_decoder_destroy.argtypes = [ctypes.c_void_p]
        self._lib.mpp_decoder_destroy.restype = None

        try:
            self._lib.rga_init_ctx.restype = ctypes.c_void_p
            self._lib.rga_destroy_ctx.argtypes = [ctypes.c_void_p]
            self._lib.rga_alloc.argtypes = [ctypes.c_size_t]
            self._lib.rga_alloc.restype = ctypes.c_void_p
            self._lib.rga_free.argtypes = [ctypes.c_void_p]
            self._lib.rga_free.restype = None
            self._lib.rga_process.argtypes = [
                ctypes.c_void_p,
                ctypes.c_int, ctypes.c_size_t, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int,
                ctypes.c_void_p, ctypes.c_int, ctypes.c_int, ctypes.c_int,
            ]
            self._lib.rga_process.restype = ctypes.c_int
            self._rga_ctx = self._lib.rga_init_ctx()
        except AttributeError:
            self._rga_ctx = None

        self._jpeg_enc: Optional[ctypes.c_void_p] = None
        # MJPEG encode symbols may be absent depending on the native lib build.
        try:
            self._lib.mpp_jpeg_enc_init.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_int]
            self._lib.mpp_jpeg_enc_init.restype = ctypes.c_void_p
            self._lib.mpp_jpeg_enc_destroy.argtypes = [ctypes.c_void_p]
            self._lib.mpp_jpeg_enc_destroy.restype = None
            self._lib.mpp_jpeg_enc_encode_fd.argtypes = [
                ctypes.c_void_p,
                ctypes.c_int, ctypes.c_size_t,
                ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int,
                ctypes.POINTER(ctypes.c_void_p), ctypes.POINTER(ctypes.c_size_t),
            ]
            self._lib.mpp_jpeg_enc_encode_fd.restype = ctypes.c_int
            self._lib.mpp_buf_free.argtypes = [ctypes.c_void_p]
            self._lib.mpp_buf_free.restype = None
        except AttributeError:
            pass

        self._handle = self._lib.mpp_decoder_init(coding_type)
        if not self._handle:
            _LOGGER.warning("Failed to initialize rockchip MPP decoder")

    def is_available(self) -> bool:
        return bool(self._handle and self._rga_ctx)

    def close(self) -> None:
        if self._lib and self._handle:
            self._lib.mpp_decoder_destroy(self._handle)
            self._handle = None
        if self._lib and self._rga_ctx:
            self._lib.rga_destroy_ctx(self._rga_ctx)
            self._rga_ctx = None
        if self._lib and self._jpeg_enc:
            self._lib.mpp_jpeg_enc_destroy(self._jpeg_enc)
            self._jpeg_enc = None

    def decode(self, data: bytes) -> int:
        if not self._handle or not data:
            return -1
        data_ptr = (ctypes.c_ubyte * len(data)).from_buffer_copy(data)
        return self._lib.mpp_decoder_decode(self._handle, data_ptr, len(data))

    def drain(self) -> bool:
        """Drain one decoded frame without RGA conversion."""
        if not self._handle:
            return False
        frame_info = DecodedFrame()
        ret = self._lib.mpp_decoder_get_frame(self._handle, ctypes.byref(frame_info))
        return ret == 0

    def get_rgb_frame(self) -> Optional[np.ndarray]:
        if not self._handle or not self._rga_ctx:
            return None

        frame_info = DecodedFrame()
        ret = self._lib.mpp_decoder_get_frame(self._handle, ctypes.byref(frame_info))
        if ret != 0:
            return None

        if frame_info.fd < 0 or not frame_info.data or frame_info.size == 0:
            return None

        return self._rga_frame_to_rgb(frame_info)

    def _rga_frame_to_rgb(self, frame_info: DecodedFrame) -> Optional[np.ndarray]:
        if not self._lib or not self._rga_ctx:
            return None
        if frame_info.fd < 0 or frame_info.size == 0:
            return None

        if frame_info.format == MPP_FMT_YUV420SP:
            src_fmt = RGA_FMT_YUV_420_SP
        elif frame_info.format == MPP_FMT_YUV420SP_VU:
            src_fmt = RGA_FMT_YCRCB_420_SP
        else:
            _LOGGER.warning("Unsupported MPP format: %s", frame_info.format)
            return None

        dst_w = frame_info.width
        dst_h = frame_info.height
        dst_size = dst_w * dst_h * 3

        dst_ptr = self._lib.rga_alloc(dst_size)
        if not dst_ptr:
            _LOGGER.warning("RGA alloc failed")
            return None

        try:
            r_ret = self._lib.rga_process(
                self._rga_ctx,
                frame_info.fd, frame_info.size,
                frame_info.width, frame_info.height, frame_info.hor_stride, frame_info.ver_stride,
                src_fmt,
                dst_ptr, dst_w, dst_h, RGA_FMT_RGB_888,
            )
            if r_ret != 0:
                _LOGGER.warning("RGA process failed: %s", r_ret)
                return None

            c_byte_ptr = ctypes.cast(dst_ptr, ctypes.POINTER(ctypes.c_ubyte * dst_size))
            np_arr = np.frombuffer(c_byte_ptr.contents, dtype=np.uint8).reshape((dst_h, dst_w, 3))
            return np_arr.copy()
        finally:
            self._lib.rga_free(dst_ptr)

    def get_jpeg_frame(self, quality: int = 80) -> Optional[bytes]:
        """Return a JPEG-encoded frame (bytes) using Rockchip MPP MJPEG encoder.

        This drains one decoded frame from MPP internally, same as get_rgb_frame().
        """
        if not self._handle or not self._rga_ctx or not self._lib:
            return None

        frame_info = DecodedFrame()
        ret = self._lib.mpp_decoder_get_frame(self._handle, ctypes.byref(frame_info))
        if ret != 0:
            return None

        if frame_info.fd < 0 or frame_info.size == 0:
            return None

        q = int(max(1, min(99, quality)))

        try:
            if frame_info.format == MPP_FMT_YUV420SP:
                src_fmt = RGA_FMT_YUV_420_SP
            elif frame_info.format == MPP_FMT_YUV420SP_VU:
                src_fmt = RGA_FMT_YCRCB_420_SP
            else:
                src_fmt = None

            if src_fmt is not None:
                if not self._jpeg_enc:
                    self._jpeg_enc = self._lib.mpp_jpeg_enc_init(frame_info.width, frame_info.height, q)

                if self._jpeg_enc:
                    out_ptr = ctypes.c_void_p()
                    out_len = ctypes.c_size_t()
                    e_ret = self._lib.mpp_jpeg_enc_encode_fd(
                        self._jpeg_enc,
                        frame_info.fd, frame_info.size,
                        frame_info.width, frame_info.height, frame_info.hor_stride, frame_info.ver_stride,
                        src_fmt,
                        ctypes.byref(out_ptr), ctypes.byref(out_len),
                    )
                    if e_ret == 0 and out_ptr.value and out_len.value:
                        try:
                            return ctypes.string_at(out_ptr, out_len.value)
                        finally:
                            self._lib.mpp_buf_free(out_ptr)
                    # free(NULL) is a no-op; keep this unconditional to satisfy static analysis.
                    self._lib.mpp_buf_free(out_ptr)
        except AttributeError:
            pass
        except Exception as exc:  # pylint: disable=broad-except
            _LOGGER.debug("MPP MJPEG hw encode failed, fallback to sw jpeg: %s", exc)

        # Fallback: use the SAME decoded frame -> RGA RGB -> PIL JPEG.
        try:
            rgb = self._rga_frame_to_rgb(frame_info)
            if rgb is None:
                return None
            img: Image.Image = Image.fromarray(rgb, "RGB")
            buf = BytesIO()
            img.save(buf, format="JPEG", quality=q)
            return buf.getvalue()
        except Exception as exc:  # pylint: disable=broad-except
            _LOGGER.debug("rockchip sw jpeg fallback failed: %s", exc)
            return None
