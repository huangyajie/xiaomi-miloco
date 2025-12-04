# Copyright (C) 2025 Xiaomi Corporation
# This software may be used and distributed according to the terms of the Xiaomi Miloco License Agreement.

"""
Camera vision handler utility for managing camera image streams.
Provides functionality to handle camera image queues and vision processing.
"""

import asyncio
import logging
import time
import threading
from collections import deque
from typing import Any, Callable, Coroutine, List

from miloco_server.schema.miot_schema import CameraImgInfo, CameraImgSeq, CameraInfo
from miot.camera import MIoTCameraInstance
from miot.types import MIoTCameraInfo
from miot.rtsp_camera import RTSPCameraInstance, RtspCameraInfo

logger = logging.getLogger(__name__)


class SizeLimitedQueue:
    """Size-limited queue that automatically removes oldest elements"""

    def __init__(self, max_size: int, ttl: int):
        if max_size <= 0:
            raise ValueError("max_size must be positive")
        if ttl <= 0:
            raise ValueError("ttl must be positive")
        self.max_size = max_size
        self.ttl = ttl
        self.queue = deque(maxlen=max_size)
        self._lock = threading.Lock()

    def _filter_old_items(self) -> None:
        """Filter old items"""
        current_time = time.time()
        while self.queue and current_time - self.queue[0][1] > self.ttl:
            self.queue.popleft()

    def clear(self) -> None:
        """Clear queue"""
        with self._lock:
            self.queue.clear()

    def put(self, item: Any) -> None:
        """Add element, automatically removes oldest element if queue is full"""
        with self._lock:
            self._filter_old_items()
            self.queue.append((item, time.time()))

    def get(self) -> Any:
        """Get and remove the oldest element"""
        with self._lock:
            if not self.queue:
                raise IndexError("Queue is empty")
            self._filter_old_items()
            if not self.queue:
                raise IndexError("Queue is empty after filtering")
            return self.queue.popleft()[0]

    def peek(self) -> Any:
        """View the oldest element without removing it"""
        with self._lock:
            if not self.queue:
                raise IndexError("Queue is empty")
            self._filter_old_items()
            if not self.queue:
                raise IndexError("Queue is empty after filtering")
            return self.queue[0][0]

    def size(self) -> int:
        """Return current queue size"""
        with self._lock:
            self._filter_old_items()
            return len(self.queue)

    def is_empty(self) -> bool:
        """Check if queue is empty"""
        with self._lock:
            self._filter_old_items()
            return len(self.queue) == 0

    def is_full(self) -> bool:
        """Check if queue is full"""
        with self._lock:
            self._filter_old_items()
            return len(self.queue) == self.max_size

    def to_list(self) -> List[Any]:
        """Convert to list, from oldest to newest"""
        with self._lock:
            self._filter_old_items()
            return [item[0] for item in self.queue]

    def get_recent(self, n: int) -> List[Any]:
        """Get the most recent n elements, sorted by time from old to new

        Args:
            n: Number of elements to get

        Returns:
            List of the most recent n elements, returns all elements if queue has fewer than n elements
        """
        if n <= 0:
            return []

        with self._lock:
            # Get the most recent n elements, starting from the tail of the queue
            self._filter_old_items()
            actual_n = min(n, len(self.queue))
            # Use negative indexing to get from the end of the queue, maintaining order from old to new
            recent_items = [item[0] for item in self.queue][-actual_n:]
            return recent_items


class BaseCameraVisionHandler:
    """Base camera vision handler strategy."""

    async def register_raw_stream(self, callback: Callable[[str, bytes, int, int, int], Coroutine], channel: int):
        raise NotImplementedError

    async def unregister_raw_stream(self, channel: int):
        raise NotImplementedError

    async def update_camera_info(self, camera_info: Any) -> None:
        raise NotImplementedError

    def get_recents_camera_img(self, channel: int, n: int) -> CameraImgSeq:
        raise NotImplementedError

    async def destroy(self) -> None:
        raise NotImplementedError


class CameraVisionHandler(BaseCameraVisionHandler):
    """Camera vision handler for managing camera image streams"""

    def __init__(self, camera_info: MIoTCameraInfo, miot_camera_instance: MIoTCameraInstance, max_size: int, ttl: int):
        # ttl seconds
        self.camera_info = camera_info
        self.miot_camera_instance = miot_camera_instance
        self.camera_img_queues: dict[int, SizeLimitedQueue] = {}

        for channel in range(self.camera_info.channel_count or 1):
            self.camera_img_queues[channel] = SizeLimitedQueue(max_size=max_size, ttl=ttl)
            asyncio.create_task(self.miot_camera_instance.register_decode_jpg_async(self.add_camera_img, channel))

        logger.info("CameraImgManager init success, camera did: %s", self.camera_info.did)

    async def register_raw_stream(self, callback: Callable[[str, bytes, int, int, int], Coroutine], channel: int):
        await self.miot_camera_instance.register_raw_video_async(callback, channel)

    async def unregister_raw_stream(self, channel: int):
        await self.miot_camera_instance.unregister_raw_video_async(channel)

    async def add_camera_img(self, did: str, data: bytes, ts: int, channel: int):
        logger.debug("add_camera_img camera_id: %s, camera timestamp: %d, image_size: %d", did, ts, len(data))
        self.camera_img_queues[channel].put(CameraImgInfo(data=data, timestamp=int(time.time())))

    async def update_camera_info(self, camera_info: MIoTCameraInfo) -> None:
        self.camera_info = camera_info
        if self.camera_info.online:
            for channel in range(self.camera_info.channel_count or 1):
                await self.miot_camera_instance.register_decode_jpg_async(self.add_camera_img, channel)
        else:
            for channel in range(self.camera_info.channel_count or 1):
                await self.miot_camera_instance.unregister_decode_jpg_async(channel)
                self.camera_img_queues[channel].clear()

    def get_recents_camera_img(self, channel: int, n: int) -> CameraImgSeq:
        if self.camera_info.online:
            return CameraImgSeq(
                camera_info=CameraInfo.model_validate(self.camera_info.model_dump()),
                channel=channel,
                img_list=self.camera_img_queues[channel].get_recent(n))
        else:
            return CameraImgSeq(
                camera_info=CameraInfo.model_validate(self.camera_info.model_dump()),
                channel=channel,
                img_list=[])

    async def destroy(self) -> None:
        for channel in range(self.camera_info.channel_count or 1):
            await self.miot_camera_instance.unregister_decode_jpg_async(channel=channel)
            await self.miot_camera_instance.unregister_raw_video_async(channel=channel)
            self.camera_img_queues[channel].clear()

        await self.miot_camera_instance.destroy_async()


class RtspCameraVisionHandler(BaseCameraVisionHandler):
    """RTSP camera vision handler using libcamera_rtsp."""

    def __init__(self, camera_info: RtspCameraInfo, rtsp_camera_instance: RTSPCameraInstance, max_size: int, ttl: int):
        self.camera_info = camera_info
        self.rtsp_camera_instance = rtsp_camera_instance
        self.camera_img_queues: dict[int, SizeLimitedQueue] = {}

        for channel in range(self.camera_info.channel_count or 1):
            self.camera_img_queues[channel] = SizeLimitedQueue(max_size=max_size, ttl=ttl)
            asyncio.create_task(self.rtsp_camera_instance.register_decode_jpg_async(self.add_camera_img, channel))

        logger.info("RtspCameraVisionHandler init success, camera did: %s", self.camera_info.did)

    async def register_raw_stream(self, callback: Callable[[str, bytes, int, int, int], Coroutine], channel: int):
        await self.rtsp_camera_instance.register_raw_video_async(callback, channel)

    async def unregister_raw_stream(self, channel: int):
        await self.rtsp_camera_instance.unregister_raw_video_async(channel)

    async def add_camera_img(self, did: str, data: bytes, ts: int, channel: int):
        logger.debug("rtsp add_camera_img camera_id: %s, camera timestamp: %d, image_size: %d", did, ts, len(data))
        self.camera_img_queues[channel].put(CameraImgInfo(data=data, timestamp=int(time.time())))

    async def update_camera_info(self, camera_info: RtspCameraInfo) -> None:
        self.camera_info = camera_info
        if self.camera_info.online:
            for channel in range(self.camera_info.channel_count or 1):
                await self.rtsp_camera_instance.register_decode_jpg_async(self.add_camera_img, channel)
        else:
            for channel in range(self.camera_info.channel_count or 1):
                await self.rtsp_camera_instance.unregister_decode_jpg_async(channel)
                self.camera_img_queues[channel].clear()

    def get_recents_camera_img(self, channel: int, n: int) -> CameraImgSeq:
        if self.camera_info.online:
            return CameraImgSeq(
                camera_info=CameraInfo.model_validate(self.camera_info.model_dump()),
                channel=channel,
                img_list=self.camera_img_queues[channel].get_recent(n))
        else:
            return CameraImgSeq(
                camera_info=CameraInfo.model_validate(self.camera_info.model_dump()),
                channel=channel,
                img_list=[])

    async def destroy(self) -> None:
        for channel in range(self.camera_info.channel_count or 1):
            await self.rtsp_camera_instance.unregister_decode_jpg_async(channel=channel)
            await self.rtsp_camera_instance.unregister_raw_video_async(channel=channel)
            self.camera_img_queues[channel].clear()

        await self.rtsp_camera_instance.destroy_async()
