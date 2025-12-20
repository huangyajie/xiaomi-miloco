# Copyright (C) 2025 Xiaomi Corporation
# This software may be used and distributed according to the terms of the Xiaomi Miloco License Agreement.

"""Home Assistant proxy module for handling Home Assistant related operations."""

import json
import logging
from typing import Optional

from pydantic_core import to_jsonable_python
from miot.types import HAAutomationInfo, HAStateInfo
from miot.ha_api import HAHttpClient

from miloco_server.dao.kv_dao import AuthConfigKeys, KVDao, DeviceInfoKeys
from miloco_server.schema.miot_schema import HAConfig


logger = logging.getLogger(__name__)

class HAProxy:
    """Home Assistant proxy class responsible for handling Home Assistant related operations."""
    def __init__(self, kv_dao: KVDao):
        self._kv_dao = kv_dao
        self._ha_rest_api: Optional[HAHttpClient] = None
        self._automations: dict[str, HAAutomationInfo] = {}
        self.init_ha_info_dict()

    @property
    def ha_client(self) -> Optional[HAHttpClient]:
        return self._ha_rest_api

    def init_ha_info_dict(self):
        """Initialize HA related information dictionary"""
        miot_ha_base_url = self._kv_dao.get(AuthConfigKeys.MIOT_HA_BASE_URL_KEY)
        miot_ha_token = self._kv_dao.get(AuthConfigKeys.MIOT_HA_TOKEN_KEY)
        if miot_ha_base_url and miot_ha_token:
            self._ha_rest_api = HAHttpClient(miot_ha_base_url, miot_ha_token)
        else:
            self._ha_rest_api = None

        automations_str = self._kv_dao.get(DeviceInfoKeys.HA_AUTOMATIONS_KEY)
        if automations_str:
            self._automations: dict[str, HAAutomationInfo] = {
                automation_id: HAAutomationInfo.model_validate(automation_info)
                for automation_id, automation_info in json.loads(automations_str).items()}
        else:
            self._automations = {}

    async def set_ha_config(self, miot_ha_base_url: str, miot_ha_token: str):
        """Set Home Assistant configuration"""
        if not await HAHttpClient.validate_async(miot_ha_base_url, miot_ha_token):
            raise ValueError("Miot ha rest api is not valid, please check the base url and token")

        self._kv_dao.set(AuthConfigKeys.MIOT_HA_BASE_URL_KEY, miot_ha_base_url)
        self._kv_dao.set(AuthConfigKeys.MIOT_HA_TOKEN_KEY, miot_ha_token)
        self._ha_rest_api = HAHttpClient(miot_ha_base_url, miot_ha_token)
        await self.refresh_ha_automations()

    def get_ha_config(self) -> HAConfig | None:
        """Get Home Assistant configuration"""
        base_url = self._kv_dao.get(AuthConfigKeys.MIOT_HA_BASE_URL_KEY)
        token = self._kv_dao.get(AuthConfigKeys.MIOT_HA_TOKEN_KEY)
        if base_url and token:
            return HAConfig(
                base_url=base_url,
                token=token
            )
        else:
            return None

    async def _fetch_and_save_automations(self) -> dict[str, HAAutomationInfo] | None:
        """Fetch automation information from Home Assistant and save to cache and KV storage"""
        if not self._ha_rest_api:
            logger.warning("Miot ha rest api is not initialized")
            return None
        try:
            automations = await self._ha_rest_api.get_automations_async()
            self._automations = automations
            self._kv_dao.set(DeviceInfoKeys.HA_AUTOMATIONS_KEY, json.dumps(to_jsonable_python(automations)))
            return automations
        except (ConnectionError, TimeoutError, ValueError, RuntimeError) as e:
            logger.warning("Failed to fetch automations: %s", e)
            return None


    async def get_automations(self) -> dict[str, HAAutomationInfo] | None:
        """Get automation information, return from cache first, fetch from HA if cache is empty"""
        if self._automations:
            return self._automations
        return await self._fetch_and_save_automations()

    async def refresh_ha_automations(self) -> bool:
        """Force refresh Home Assistant automation information"""
        automations = await self._fetch_and_save_automations()
        if automations:
            logger.info("Successfully refreshed HA automations: %s", automations)
            return True
        else:
            logger.warning("Failed to refresh HA automations")
            return False

    async def trigger_automation(self, automation_id: str):
        """Trigger specified automation"""
        if self._ha_rest_api:
            try:
                return await self._ha_rest_api.trigger_automation_async(automation_id)
            except (ConnectionError, TimeoutError, ValueError, RuntimeError) as e:
                logger.warning("Failed to trigger automation %s: %s", automation_id, e)
                return None
        else:
            logger.warning("Miot ha rest api is not initialized")
            return None

    async def get_states(self) -> dict[str, HAStateInfo] | None:
        """Get all states from Home Assistant"""
        if not self._ha_rest_api:
            logger.warning("Miot ha rest api is not initialized")
            return None
        try:
            return await self._ha_rest_api.get_states_async()
        except Exception as e:  # pylint: disable=broad-except
            logger.warning("Failed to get states: %s", e)
            return None

    async def call_service(self, domain: str, service: str, entity_id: str) -> bool:
        """Call a service in Home Assistant"""
        if not self._ha_rest_api:
            logger.warning("Miot ha rest api is not initialized")
            return False
        try:
            return await self._ha_rest_api.call_service(domain, service, entity_id)
        except Exception as e:  # pylint: disable=broad-except
            logger.warning("Failed to call service: %s", e)
            return False

    async def get_all_areas(self) -> dict[str, str] | None:
        """Get area name for all entities"""
        if not self._ha_rest_api:
            return None
        template = """
        {
          {% for state in states %}
            "{{ state.entity_id }}": "{{ area_name(state.entity_id) or '' }}"{% if not loop.last %},{% endif %}
          {% endfor %}
        }
        """
        try:
            res = await self._ha_rest_api.render_template_async(template)
            return json.loads(res)
        except Exception as e:  # pylint: disable=broad-except
            logger.warning("Failed to get areas: %s", e)
            return None

    async def get_location_name(self) -> str | None:
        """Get Home Assistant location name"""
        if not self._ha_rest_api:
            return None
        try:
            config = await self._ha_rest_api.get_config_async()
            return config.get("location_name")
        except Exception as e:  # pylint: disable=broad-except
            logger.warning("Failed to get location name: %s", e)
            return None
