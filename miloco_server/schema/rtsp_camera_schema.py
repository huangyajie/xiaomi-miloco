# Copyright (C) 2025 Xiaomi Corporation
# This software may be used and distributed according to the terms of the Xiaomi Miloco License Agreement.
"""
RTSP camera schema definitions.
Used for loading and validating RTSP camera configuration from server_config.yaml.
"""

import re
from typing import Optional
from pydantic import BaseModel, Field

from miot.rtsp_camera import RtspCameraInfo
from miot.types import MIoTCameraCodec


class RtspCameraConfig(BaseModel):
    """RTSP camera configuration loaded from YAML."""

    did: str = Field(..., description="Camera unique id")
    name: str = Field(..., description="Camera display name")
    rtsp_url: str = Field(..., description="RTSP url with optional credential")
    codec: Optional[str] = Field(default=None, description="Codec hint, h264 | h265 | auto for autodetect")
    enable_audio: bool = Field(default=False, description="Enable audio decoding")
    transport: Optional[str] = Field(default=None, description="Transport protocol: tcp or udp")
    home_name: Optional[str] = Field(default=None, description="Home/area name")
    room_name: Optional[str] = Field(default=None, description="Room name")
    vendor: Optional[str] = Field(default=None, description="Vendor or brand name")
    model: Optional[str] = Field(default="rtsp_camera", description="Model name for display")
    icon: Optional[str] = Field(default=None, description="Icon url or path")

    def _parse_codec(self) -> Optional[MIoTCameraCodec]:
        """Parse codec hint; return None to allow runtime autodetect."""
        if self.codec is None:
            return None
        codec_lower = str(self.codec).strip().lower()
        if codec_lower in ("", "auto", "detect", "auto-detect", "autodetect"):
            return None
        if "265" in codec_lower or "hevc" in codec_lower:
            return MIoTCameraCodec.VIDEO_H265
        if "264" in codec_lower or "avc" in codec_lower:
            return MIoTCameraCodec.VIDEO_H264
        return None

    def to_rtsp_camera_info(self) -> RtspCameraInfo:
        """Convert to runtime RtspCameraInfo."""
        transport_lower = (self.transport or "").strip().lower()
        return RtspCameraInfo(
            did=self.did,
            name=self.name,
            rtsp_url=self.rtsp_url,
            codec=self._parse_codec(),
            channel_count=1,
            enable_audio=self.enable_audio,
            use_tcp=transport_lower == "tcp",
            home_name=self.home_name,
            room_name=self.room_name,
            vendor=self.vendor,
            model=self.model or "rtsp_camera",
            icon=self.icon,
        )


class RtspCameraCreateRequest(BaseModel):
    """RTSP camera create request for UI/API usage."""

    did: Optional[str] = Field(default=None, description="Optional camera unique id")
    name: str = Field(..., description="Camera display name")
    rtsp_url: str = Field(..., description="RTSP url with optional credentials")
    codec: Optional[str] = Field(default=None, description="Codec hint, h264 | h265 | auto")
    enable_audio: bool = Field(default=False, description="Enable audio decoding")
    transport: Optional[str] = Field(default="tcp", description="Transport protocol: tcp or udp")
    home_name: Optional[str] = Field(default="Third Party", description="Home/area name")
    room_name: Optional[str] = Field(default="RTSP Cameras", description="Room name")
    vendor: Optional[str] = Field(default=None, description="Vendor or brand name")
    model: Optional[str] = Field(default="rtsp_camera", description="Model name for display")
    icon: Optional[str] = Field(default=None, description="Icon url or path")

    def _generate_did(self) -> str:
        base = self.did or self.name or self.rtsp_url
        normalized = re.sub(r"[^a-zA-Z0-9]+", "_", base).strip("_").lower()
        normalized = normalized[:48] if normalized else "rtsp_camera"
        return normalized if normalized.startswith("rtsp_") else f"rtsp_{normalized}"

    def to_config(self, did_override: Optional[str] = None) -> RtspCameraConfig:
        return RtspCameraConfig(
            did=did_override or self._generate_did(),
            name=self.name,
            rtsp_url=self.rtsp_url,
            codec=self.codec,
            enable_audio=self.enable_audio,
            transport=self.transport,
            home_name=self.home_name,
            room_name=self.room_name,
            vendor=self.vendor,
            model=self.model,
            icon=self.icon,
        )
