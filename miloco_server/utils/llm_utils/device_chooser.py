# Copyright (C) 2025 Xiaomi Corporation
# This software may be used and distributed according to the terms of the Xiaomi Miloco License Agreement.

"""
Device chooser utility for device selection.
Currently supports camera selection with location-based filtering.
"""

import json
import logging
from typing import List, Optional

from miloco_server.utils.llm_utils.base_llm_util import BaseLLMUtil

from miloco_server.schema.miot_schema import CameraInfo, HADeviceInfo, DeviceInfo
from miloco_server.utils.normal_util import extract_json_from_content


logger = logging.getLogger(__name__)


class DeviceChooser(BaseLLMUtil):
    """For device selection, supports camera and HA device selection, singleton implementation"""

    def __init__(self,
                 request_id: str,
                 condition: Optional[str] = None,
                 location: Optional[str] = None,
                 choose_camera_device_ids: Optional[List[str]] = None,
                 choose_ha_device_ids: Optional[List[str]] = None):
        super().__init__(request_id=request_id, tools_meta=None)
        self._condition = condition
        self._location = location
        self._choose_camera_device_ids = choose_camera_device_ids
        self._choose_ha_device_ids = choose_ha_device_ids
        self._choosed_cameras = []
        self._all_cameras = []
        self._choosed_ha_devices = []
        self._all_ha_devices = []

    def _get_system_prompt(self) -> str:
        """Get system prompt"""
        return """
        Device selector, select devices based on condition and location.
        Next I will give you a set of device information, the condition the user wants, and the location. You need to select devices that match the condition and location, and return the device ids.
        You can only return in JSON format, JSON format is:
        {
            "camera_ids": ["did1", "did2"],
            "ha_device_ids": ["entity_id1", "entity_id2"]
        }
        """

    def _init_conversation(self) -> None:
        self._chat_history.add_content("system", self._get_system_prompt())
        device_info = {
            "cameras": [camera.model_dump() for camera in self._all_cameras],
            "ha_devices": [device.model_dump() for device in self._all_ha_devices]
        }
        user_msg = f"User condition: {self._condition}, "
        if self._location:
            user_msg += f"User desired location: {self._location}, "
        if self._choose_camera_device_ids:
            user_msg += f"Currently focused camera IDs: {self._choose_camera_device_ids}, "
        if self._choose_ha_device_ids:
            user_msg += f"Currently focused HA device IDs: {self._choose_ha_device_ids}, "

        user_msg += f"Available Device information: {json.dumps(device_info)}"
        self._chat_history.add_content("user", user_msg)

    async def _choose_devices(
            self) -> tuple[List[CameraInfo], List[CameraInfo], List[HADeviceInfo], List[HADeviceInfo]]:
        """Choose cameras and HA devices"""
        try:
            self._all_cameras = await self._manager.miot_service.get_miot_camera_list()

            ha_devices_grouped = {}
            try:
                ha_devices_grouped = await self._manager.ha_service.get_ha_devices_grouped()
                # Convert grouped devices to HADeviceInfo for all_ha_devices
                self._all_ha_devices = []
                for dev_id, info in ha_devices_grouped.items():
                    self._all_ha_devices.append(HADeviceInfo(
                        did=dev_id,
                        name=info["name"],
                        online=True,
                        model="ha_device",
                        entity_id=info["entities"][0] if info["entities"] else dev_id,
                        state="online",
                        room_name=info["area"]
                    ))
            except Exception as e: # pylint: disable=broad-exception-caught
                logger.error("[%s] Error fetching HA devices: %s", self._request_id, e)
                self._all_ha_devices = []

            if not self._all_cameras and not self._all_ha_devices:
                return [], [], [], []

            # If no condition and no location, use specific IDs or default to all cameras
            if not self._condition and not self._location:
                if self._choose_camera_device_ids or self._choose_ha_device_ids:
                    self._choosed_cameras = [
                        c for c in self._all_cameras
                        if c.did in (self._choose_camera_device_ids or [])]
                    self._choosed_ha_devices = [
                        d for d in self._all_ha_devices
                        if d.did in (self._choose_ha_device_ids or [])]
                    return self._choosed_cameras, self._all_cameras, self._choosed_ha_devices, self._all_ha_devices
                else:
                    return self._all_cameras, self._all_cameras, [], self._all_ha_devices

            self._init_conversation()
            content, _, _ = await self._call_llm()

            if not content:
                return [], self._all_cameras, [], self._all_ha_devices

            json_content = extract_json_from_content(content)
            if not json_content:
                logger.warning("[%s] No JSON in LLM response: %s", self._request_id, content)
                return [], self._all_cameras, [], self._all_ha_devices

            selected_ids = json.loads(json_content)
            camera_ids = selected_ids.get("camera_ids", [])
            ha_entity_ids = selected_ids.get("ha_device_ids", [])

            self._choosed_cameras = [c for c in self._all_cameras if c.did in camera_ids]

            # Map selected HA entity IDs back to device IDs (to match manual selection)
            entity_to_device_id = {}
            for dev_id, info in ha_devices_grouped.items():
                for entity_id in info.get("entities", []):
                    entity_to_device_id[entity_id] = dev_id

            selected_ha_device_ids = set()
            for eid in ha_entity_ids:
                if eid in entity_to_device_id:
                    selected_ha_device_ids.add(entity_to_device_id[eid])
                else:
                    # Fallback: if it's already a device_id or unknown
                    selected_ha_device_ids.add(eid)

            self._choosed_ha_devices = [d for d in self._all_ha_devices if d.did in selected_ha_device_ids]

            return self._choosed_cameras, self._all_cameras, self._choosed_ha_devices, self._all_ha_devices
        except Exception as e: # pylint: disable=broad-exception-caught
            logger.error("[%s] Error occurred during device chooser: %s",
                         self._request_id,
                         str(e),
                         exc_info=True)
            return [], self._all_cameras, [], self._all_ha_devices

    def _format_device_info(self, devices: List[DeviceInfo]) -> List[str]:
        """Format device information for logging"""
        return [
            f"{d.did}_{d.name}_{d.home_name}_{d.room_name}" for d in devices
        ]

    async def run(self) -> tuple[List[CameraInfo], List[CameraInfo], List[HADeviceInfo], List[HADeviceInfo]]:
        choosed_cameras, all_cameras, choosed_ha_devices, all_ha_devices = await self._choose_devices()
        logger.info("Choosed camera did with name: %s", self._format_device_info(choosed_cameras))
        logger.info("Choosed HA device did with name: %s", self._format_device_info(choosed_ha_devices))
        return choosed_cameras, all_cameras, choosed_ha_devices, all_ha_devices
