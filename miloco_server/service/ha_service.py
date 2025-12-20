# Copyright (C) 2025 Xiaomi Corporation
# This software may be used and distributed according to the terms of the Xiaomi Miloco License Agreement.

"""
Home Assistant service module
"""

import logging
from typing import List, Optional, Dict, Any

from miloco_server.mcp.mcp_client_manager import MCPClientManager
from miloco_server.middleware.exceptions import (
    HaServiceException,
    ValidationException,
    BusinessException
)
from miloco_server.proxy.ha_proxy import HAProxy
from miloco_server.schema.miot_schema import HAConfig, HADeviceInfo, HAControlRequest
from miloco_server.schema.trigger_schema import Action
from miloco_server.utils.default_action import DefaultPresetActionManager

from miot.types import HAAutomationInfo, HAStateInfo

logger = logging.getLogger(__name__)


class HaService:
    """Home Assistant service class"""

    # Mapping from HA domain to internal icon name
    _HA_DOMAIN_TO_INTERNAL_ICON = {
        "camera": "instantCameraOpen",
        "lock": "lock",
        "weather": "cloud",
        "media_player": "instantDevicePlay",
        "automation": "menuSmart",
        "script": "menuSmart",
        "scene": "menuSmart",
        # Fallbacks for common domains to ensures they have a valid internal icon
        "light": "menuDevice",
        "switch": "menuDevice",
        "fan": "menuDevice",
        "sensor": "menuDevice",
        "binary_sensor": "menuDevice",
        "climate": "menuDevice",
        "cover": "menuDevice",
        "vacuum": "menuDevice",
    }

    # Mapping from HA MDI icon string to internal icon name
    _HA_MDI_TO_INTERNAL_ICON = {
        "mdi:cctv": "instantCameraOpen",
        "mdi:camera": "instantCameraOpen",
        "mdi:lock": "lock",
        "mdi:lock-open": "lock",
        "mdi:cloud": "cloud",
        "mdi:weather-partly-cloudy": "cloud",
    }

    # Mapping from HA device_class to internal icon name
    _HA_DEVICE_CLASS_MAPPING = {
        "lock": "lock",
        "motion": "menuDevice", # Could use a motion icon if available
        "door": "menuDevice",   # Could use a door icon if available
    }

    def __init__(
        self,
        ha_proxy: HAProxy,
        mcp_client_manager: MCPClientManager,
        default_preset_action_manager: Optional[DefaultPresetActionManager] = None
    ):
        self._ha_proxy = ha_proxy
        self._mcp_client_manager = mcp_client_manager
        self._default_preset_action_manager = default_preset_action_manager

    @property
    def ha_client(self) -> Optional[object]:
        """Get the HAHttpClient instance."""
        return self._ha_proxy.ha_client

    async def initialize_ha_devices_mcp(self):
        """Initialize HA devices MCP client if HA is configured"""
        if not self.ha_client:
            return

        try:
            from miot.mcp import (
                HomeAssistantDeviceMcp,
                HomeAssistantDeviceMcpInterface,
                McpHADeviceInfo
            )
            from miloco_server.mcp.mcp_client import LocalMCPConfig, TransportType
            from miloco_server.schema.mcp_schema import LocalMcpClientId

            # Create HA device MCP client
            async def _get_devices() -> List[McpHADeviceInfo]:
                devices = await self.get_ha_device_list()
                return [
                    McpHADeviceInfo(
                        entity_id=d.entity_id,
                        name=d.name,
                        state=d.state,
                        area=d.room_name,
                        domain=d.model # domain is stored in model
                    ) for d in devices
                ]

            async def _control_device(entity_id: str, domain: str, service: str, service_data: Optional[Dict[str, Any]] = None) -> bool:
                try:
                    from miloco_server.schema.miot_schema import HAControlRequest
                    await self.control_ha_device(HAControlRequest(
                        entity_id=entity_id,
                        domain=domain,
                        service=service,
                        service_data=service_data
                    ))
                    return True
                except Exception:  # pylint: disable=broad-except
                    return False

            ha_devices_mcp = HomeAssistantDeviceMcp(
                interface=HomeAssistantDeviceMcpInterface(
                    translate_async=self._mcp_client_manager.miot_proxy.miot_client.i18n.translate_async,
                    get_devices_async=_get_devices,
                    control_device_async=_control_device
                )
            )
            await ha_devices_mcp.init_async()

            # Register the client with MCPClientManager
            await self._mcp_client_manager.add_client(
                transport_type=TransportType.LOCAL,
                config=LocalMCPConfig(
                    client_id=LocalMcpClientId.HA_DEVICES,
                    server_name="Home Assistant设备控制 (Home Assistant Device Control)",
                    mcp_server=ha_devices_mcp.mcp_instance
                )
            )

            logger.info("Successfully initialized Home Assistant Device MCP client")

        except Exception as e:  # pylint: disable=broad-except
            logger.error("Failed to initialize HA devices MCP: %s", e)

    async def refresh_ha_automations(self):
        """
        Refresh Home Assistant automation information
        """
        try:
            await self._ha_proxy.refresh_ha_automations()
        except Exception as e:
            logger.error("Failed to refresh Home Assistant automations: %s", e)
            raise HaServiceException(f"Failed to refresh Home Assistant automations: {str(e)}") from e

    async def set_ha_config(self, ha_config: HAConfig):
        try:
            if not ha_config.base_url or not ha_config.base_url.strip():
                raise ValidationException("Home Assistant base URL cannot be empty")
            if not ha_config.token or not ha_config.token.strip():
                raise ValidationException("Home Assistant access token cannot be empty")

            await self._ha_proxy.set_ha_config(ha_config.base_url,
                                                    ha_config.token.strip())

            await self._mcp_client_manager.init_ha_automations()
            # Initialize HA devices MCP client when HA is configured
            await self.initialize_ha_devices_mcp()
            logger.info("Home Assistant configuration saved successfully: base_url=%s", ha_config.base_url)

        except ValidationException:
            raise
        except Exception as e:
            logger.error("Exception occurred while saving Home Assistant configuration: %s", e)
            raise BusinessException(f"Failed to save Home Assistant configuration: {str(e)}") from e

    async def get_ha_config(self) -> HAConfig | None:
        try:
            ha_config = self._ha_proxy.get_ha_config()
            if not ha_config:
                logger.warning("Home Assistant configuration not set")
            return ha_config
        except Exception as e:
            logger.error("Exception occurred while getting Home Assistant configuration: %s", e)
            raise HaServiceException(f"Failed to get Home Assistant configuration: {str(e)}") from e

    async def get_ha_automations(self) -> list[HAAutomationInfo]:
        try:
            automations = await self._ha_proxy.get_automations()
            if automations is None:
                logger.warning("Failed to get Home Assistant automation list")
                raise HaServiceException("Failed to get Home Assistant automation list")
            logger.info(
                "Successfully retrieved Home Assistant automation list - count: %d", len(automations.values()))
            return list(automations.values())

        except Exception as e:
            logger.error("Failed to get Home Assistant automation list: %s", e)
            raise HaServiceException(
                f"Failed to get Home Assistant automation list: {str(e)}") from e

    async def get_ha_automation_actions(self) -> List[Action]:
        """
        Get Home Assistant automation action list

        Returns:
            List[Action]: Home Assistant automation action list

        Raises:
            HaServiceException: When getting automation actions fails
        """
        try:
            if not self._default_preset_action_manager:
                logger.error("DefaultPresetActionManager not initialized")
                raise HaServiceException("DefaultPresetActionManager not initialized")

            actions = await self._default_preset_action_manager.get_ha_automation_actions()

            return list(actions.values())
        except Exception as e:
            logger.error("Failed to get Home Assistant automation action list: %s", e)
            raise HaServiceException(f"Failed to get Home Assistant automation action list: {str(e)}") from e

    def _get_icon_for_ha_device(self, state_info: HAStateInfo, base_url: str) -> str:
        """
        Determine the icon for HA device.
        Prioritizes entity_picture, then specific mappings, then device class, then domain-based mappings.
        """
        # 1. Check for entity_picture
        entity_picture = state_info.attributes.get("entity_picture")
        if entity_picture and isinstance(entity_picture, str):
            if entity_picture.startswith("http"):
                return entity_picture
            # Ensure base_url doesn't end with slash and entity_picture starts with slash
            return f"{base_url.rstrip('/')}/{entity_picture.lstrip('/')}"

        # 2. Check specific MDI icon in attributes and map it
        ha_icon = state_info.attributes.get("icon")
        if ha_icon and isinstance(ha_icon, str):
            if ha_icon in self._HA_MDI_TO_INTERNAL_ICON:
                return self._HA_MDI_TO_INTERNAL_ICON[ha_icon]
            # If it's a URL, return it directly
            if ha_icon.startswith("http") or ha_icon.startswith("/"):
                return ha_icon

        # 3. Check device_class mapping
        device_class = state_info.attributes.get("device_class")
        if device_class:
            # Try domain.device_class first (e.g. binary_sensor.lock)
            key = f"{state_info.domain}.{device_class}"
            if key in self._HA_DEVICE_CLASS_MAPPING:
                return self._HA_DEVICE_CLASS_MAPPING[key]
            # Try just device_class
            if device_class in self._HA_DEVICE_CLASS_MAPPING:
                return self._HA_DEVICE_CLASS_MAPPING[device_class]

        # 4. Derive from domain
        if state_info.domain in self._HA_DOMAIN_TO_INTERNAL_ICON:
            return self._HA_DOMAIN_TO_INTERNAL_ICON[state_info.domain]
        
        # 5. Default generic icon
        return "menuDevice"

    async def get_ha_device_list(self) -> List[HADeviceInfo]:
        """Get Home Assistant device list"""
        try:
            states = await self._ha_proxy.get_states()
            if states is None:
                logger.warning("Failed to get Home Assistant device list")
                return []
            
            areas = await self._ha_proxy.get_all_areas() or {}
            location_name = await self._ha_proxy.get_location_name() or ""
            ha_config = self._ha_proxy.get_ha_config()
            base_url = ha_config.base_url if ha_config else ""
            
            device_list = []

            for entity_id, state_info in states.items():
                is_online = state_info.state not in ["unavailable", "unknown"]
                supported_features = state_info.attributes.get("supported_features", 0)
                
                device_info = HADeviceInfo(
                    did=entity_id,
                    name=state_info.attributes.get("friendly_name") or entity_id,
                    online=is_online,
                    model=state_info.domain,
                    icon=self._get_icon_for_ha_device(state_info, base_url), 
                    home_name=location_name,
                    room_name=areas.get(entity_id, ""),
                    entity_id=entity_id,
                    state=state_info.state,
                    attributes=state_info.attributes,
                    supported_features=supported_features
                )
                device_list.append(device_info)
            
            logger.info("Successfully retrieved Home Assistant device list - count: %d", len(device_list))
            return device_list
        except Exception as e:
            logger.error("Failed to get Home Assistant device list: %s", e)
            raise HaServiceException(f"Failed to get Home Assistant device list: {str(e)}") from e

    async def control_ha_device(self, control_req: HAControlRequest):
        """Control Home Assistant device"""
        try:
            result = await self._ha_proxy.call_service(
                domain=control_req.domain,
                service=control_req.service,
                entity_id=control_req.entity_id
            )
            if not result:
                raise HaServiceException("Failed to control Home Assistant device")
            logger.info("Successfully controlled Home Assistant device: %s", control_req.entity_id)
        except Exception as e:
            logger.error("Failed to control Home Assistant device: %s", e)
            raise HaServiceException(f"Failed to control Home Assistant device: {str(e)}") from e
