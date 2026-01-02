# Copyright (C) 2025 Xiaomi Corporation
# This software may be used and distributed according to the terms of the Xiaomi Miloco License Agreement.

"""
Trigger log data models
Define trigger log-related data structures
"""
from typing import Optional, List

from pydantic import BaseModel, Field
from miloco_server.schema.chat_history_schema import ChatHistorySession

from miloco_server.schema.miot_schema import CameraImgInfoPath, CameraInfo
from miloco_server.schema.trigger_schema import Action, ExecuteType, Notify


class TriggerConditionResult(BaseModel):
    """Trigger condition result data model"""
    camera_info: Optional[CameraInfo] = Field(None, description="Camera information")
    channel: int = Field(..., description="Channel number")
    result: bool = Field(..., description="Result")
    images: Optional[list[CameraImgInfoPath]] = Field(None, description="Image sequence path")


class ActionExecuteResult(BaseModel):
    """Action execute result data model"""
    action: Action = Field(..., description="Action")
    result: bool = Field(..., description="Result")

class AiRecommendDynamicExecuteResult(BaseModel):
    """AI recommend dynamic execute result data model"""
    is_done: bool = Field(False, description="Whether the dynamic execute is done")
    ai_recommend_action_descriptions: Optional[list[str]] = Field(None, description="AI recommend action descriptions")
    chat_history_session: Optional[ChatHistorySession] = Field(None, description="Chat history session")

class NotifyResult(BaseModel):
    notify: Notify = Field(..., description="Mi Home send notification")
    result: bool = Field(..., description="Mi Home send notification result")


class ExecuteResult(BaseModel):
    """Execute result data model"""
    ai_recommend_execute_type: ExecuteType = Field(
        ExecuteType.STATIC, description="AI recommend execute type")
    ai_recommend_action_execute_results: Optional[list[ActionExecuteResult]] = Field(
        None, description="AI recommend action execute results")
    ai_recommend_dynamic_execute_result: Optional[AiRecommendDynamicExecuteResult] = Field(
        None, description="AI recommend dynamic execute result")
    automation_action_execute_results: Optional[list[ActionExecuteResult]] = Field(
        None, description="Action execute results")
    notify_result: Optional[NotifyResult] = Field(
        None, description="Mi Home send notification result")


class TriggerRuleLog(BaseModel):
    """Trigger rule execution log model"""
    id: Optional[str] = Field(None, description="Database primary key ID (UUID)")
    timestamp: int = Field(..., description="Trigger time")
    trigger_rule_id: str = Field(..., description="Trigger rule ID")
    trigger_rule_name: str = Field(..., description="Trigger rule name")
    trigger_rule_condition: str = Field(..., description="Trigger rule condition")
    condition_results: List[TriggerConditionResult] = Field(
        ..., description="Trigger condition result list"
    )
    execute_result: Optional[ExecuteResult] = Field(None, description="Trigger rule execute result")
