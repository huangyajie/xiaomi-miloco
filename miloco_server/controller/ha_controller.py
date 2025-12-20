# Copyright (C) 2025 Xiaomi Corporation
# This software may be used and distributed according to the terms of the Xiaomi Miloco License Agreement.

"""
Home Assistant controller
Handles Home Assistant configuration, automation, and action execution
Uses unified exception handling framework
"""
import logging
from fastapi import APIRouter, Depends

from miot.ha_api import HAAutomationInfo

from miloco_server.middleware import verify_token
from miloco_server.schema.common_schema import NormalResponse
from miloco_server.schema.miot_schema import HAConfig, HADeviceInfo, HAControlRequest
from miloco_server.service.manager import get_manager

logger = logging.getLogger(name=__name__)

router = APIRouter(prefix="/ha", tags=["Home Assistant"])

manager = get_manager()


@router.post(path="/set_config", summary="Set Home Assistant configuration", response_model=NormalResponse)
async def set_ha_config(ha_config: HAConfig, current_user: str = Depends(verify_token)):
    """Set Home Assistant configuration"""
    logger.info("Set HA config API called, user: %s, base_url: %s", current_user, ha_config.base_url)

    await manager.ha_service.set_ha_config(ha_config)

    logger.info("Home Assistant configuration set successfully")
    return NormalResponse(
        code=0,
        message="Home Assistant configuration set successfully",
        data=None
    )


@router.get(path="/get_config", summary="Get Home Assistant configuration", response_model=NormalResponse)
async def get_ha_config(current_user: str = Depends(verify_token)):
    """Get Home Assistant configuration"""
    logger.info("Get HA config API called, user: %s", current_user)

    ha_config = await manager.ha_service.get_ha_config()
    logger.info("Home Assistant configuration returned %s", ha_config)

    if ha_config:
        message="Home Assistant configuration retrieved successfully"
    else:
        message="Home Assistant configuration not set"

    return NormalResponse(
        code=0,
        message=message,
        data=ha_config
    )


@router.get(path="/automations", summary="Get Home Assistant automation list", response_model=NormalResponse)
async def get_ha_automations(current_user: str = Depends(verify_token)):
    """Get Home Assistant automation list"""
    logger.info("Get HA automations API called, user: %s", current_user)

    automations: list[HAAutomationInfo] = await manager.ha_service.get_ha_automations()

    logger.info(
        "Successfully retrieved Home Assistant automation list - Count: %s", len(automations))
    return NormalResponse(
        code=0,
        message="Home Assistant automation list retrieved successfully",
        data=automations
    )


@router.get(path="/automation_actions",
           summary="Get Home Assistant automation actions list", response_model=NormalResponse)
async def get_ha_automation_actions(current_user: str = Depends(verify_token)):
    """Get Home Assistant automation actions list"""
    logger.info("Get HA automation actions API called, user: %s", current_user)

    actions = await manager.ha_service.get_ha_automation_actions()
    return NormalResponse(
        code=0,
        message="Home Assistant automation actions list retrieved successfully",
        data=actions
    )


@router.get(path="/refresh_ha_automations",
           summary="Refresh Home Assistant automation information", response_model=NormalResponse)
async def refresh_ha_automations(current_user: str = Depends(verify_token)):
    """Refresh Home Assistant automation information"""
    logger.info("Refresh HA automations API called, user: %s", current_user)

    await manager.ha_service.refresh_ha_automations()

    logger.info("Successfully refreshed Home Assistant automation information")
    return NormalResponse(
        code=0,
        message="Home Assistant automation information refreshed successfully",
        data=None
    )


@router.get(path="/devices", summary="Get Home Assistant device list", response_model=NormalResponse)
async def get_ha_device_list(current_user: str = Depends(verify_token)):
    """Get Home Assistant device list"""
    logger.info("Get HA device list API called, user: %s", current_user)

    devices = await manager.ha_service.get_ha_device_list()
    
    logger.info("Successfully retrieved Home Assistant device list - Count: %s", len(devices))
    return NormalResponse(
        code=0,
        message="Home Assistant device list retrieved successfully",
        data=devices
    )


@router.post(path="/control", summary="Control Home Assistant device", response_model=NormalResponse)
async def control_ha_device(control_req: HAControlRequest, current_user: str = Depends(verify_token)):
    """Control Home Assistant device"""
    logger.info("Control HA device API called, user: %s, entity_id: %s", current_user, control_req.entity_id)

    await manager.ha_service.control_ha_device(control_req)

    logger.info("Successfully controlled Home Assistant device")
    return NormalResponse(
        code=0,
        message="Home Assistant device controlled successfully",
        data=None
    )