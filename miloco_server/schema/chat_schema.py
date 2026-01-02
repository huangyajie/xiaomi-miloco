# Copyright (C) 2025 Xiaomi Corporation
# This software may be used and distributed according to the terms of the Xiaomi Miloco License Agreement.

"""
Chat schema module
Define chat-related data structures including events and instructions
"""

import time
from typing import List, Optional
from miloco_server.schema.miot_schema import CameraImgPathSeq, CameraInfo, HADeviceInfo
from miloco_server.schema.trigger_schema import Action, TriggerRule, TriggerRuleDetail
from pydantic import BaseModel, Field, ConfigDict
from thespian.actors import ActorAddress

class Header(BaseModel):
    """Header model for events and instructions"""
    type: str = Field(..., description="Type")
    namespace: str = Field(..., description="Namespace")
    name: str = Field(..., description="Name")
    timestamp: int = Field(..., description="Timestamp")
    request_id: str = Field(..., description="Request ID")
    session_id: Optional[str] = Field(None, description="Session ID, use new session if not provided")


class ChatSpec(BaseModel):
    """Base class for chat specifications"""
    @classmethod
    def get_spec_name_info(cls):
        full_class_name = cls.__qualname__
        class_parts = full_class_name.split(".")

        if len(class_parts) == 2:
            return class_parts[0], class_parts[1]
        else:
            raise ValueError(f"error structure: {full_class_name}")



    def build_header(self, msg_type: str, request_id: str, session_id: Optional[str] = None):
        namespace, name = self.get_spec_name_info()
        return Header(
            type=msg_type,
            namespace=namespace,
            name=name,
            request_id=request_id,
            timestamp=int(time.time() * 1000),
            session_id=session_id
        )


class EventPayload(ChatSpec):
    """Base class for event payloads"""
    pass


class InstructionPayload(ChatSpec):
    """Base class for instruction payloads"""
    pass

class Event(BaseModel):
    """Event model"""
    header: Header = Field(..., description="Event header")
    payload: str = Field(..., description="Event content in JSON format")

    @staticmethod
    def build_event(payload: EventPayload, request_id: str, session_id: Optional[str] = None):
        return Event(
            header=payload.build_header("event", request_id, session_id),
            payload=payload.model_dump_json())

    def judge_type(self, namespace: str, name: str) -> bool:
        """
        Judge Event type
        """
        if self.header.type != "event":
            raise ValueError(f"Invalid event type: {self.header.type}")

        if self.header.namespace == namespace and self.header.name == name:
            return True
        return False


class Instruction(BaseModel):
    """Instruction model"""
    header: Header = Field(..., description="Event header")
    payload: str = Field(..., description="Event content in JSON format")

    @staticmethod
    def build_instruction(payload: InstructionPayload, request_id: str, session_id: Optional[str] = None):
        return Instruction(
            header=payload.build_header("instruction", request_id, session_id),
            payload=payload.model_dump_json())

    def judge_type(self, namespace: str, name: str) -> bool:
        """
        Judge instruction type
        """
        if self.header.type != "instruction":
            raise ValueError(f"Invalid instruction type: {self.header.type}")

        if self.header.namespace == namespace and self.header.name == name:
            return True
        return False


class Nlp:
    """NLP related classes"""

    class Request(EventPayload):
        query: str = Field(..., description="Request content")
        mcp_list: Optional[List[str]] = Field(default_factory=list, description="List of MCP IDs to call")
        camera_ids: Optional[List[str]] = Field(None, description="Camera ID list")

    class ActionDescriptionDynamicExecute(EventPayload):
        action_descriptions: List[str] = Field(..., description="Action descriptions")
        mcp_list: Optional[List[str]] = Field(None, description="List of MCP IDs to call")
        camera_ids: Optional[List[str]] = Field(None, description="Camera ID list")


class Template:
    """Template related classes"""
    class ToastStream(InstructionPayload):
        stream: str = Field(..., description="Streaming content")

    class CallTool(InstructionPayload):
        id: str = Field(..., description="Tool call ID")
        service_name: str = Field(..., description="Service name")
        tool_name: str = Field(..., description="Tool name")
        tool_params: Optional[str] = Field(None, description="Tool parameters in JSON format")

    class CallToolResult(InstructionPayload):
        id: str = Field(..., description="Tool call ID")
        success: bool = Field(..., description="Whether successful")
        tool_response: Optional[str] = Field(None, description="Tool response result in JSON format")
        error_message: Optional[str] = Field(None, description="Error message")

    class CameraImages(InstructionPayload):
        image_path_seq_list: List[CameraImgPathSeq] = Field(..., description="Camera image sequence")


class Dialog:
    """Dialog related classes"""
    class Exception(InstructionPayload):
        message: str = Field(..., description="Exception information")

    class Finish(InstructionPayload):
        success: bool = Field(..., description="Whether successful")


class Confirmation:
    """Confirmation related classes"""
    class SaveRuleConfirm(InstructionPayload):
        rule: TriggerRuleDetail = Field(..., description="Trigger rule details")
        camera_options: List[CameraInfo] = Field(..., description="Camera option list")
        ha_device_options: Optional[List[HADeviceInfo]] = Field(default_factory=list, description="Home Assistant device option list")
        action_options: List[Action] = Field(..., description="Action option list")


    class SaveRuleConfirmResult(EventPayload):
        confirmed: bool = Field(..., description="Whether user confirmed")
        rule: Optional[TriggerRule] = Field(None, description="Trigger rule details")

    class AiGeneratedActions(InstructionPayload):
        actions: list[Action] = Field(..., description="AI generated actions")

class Internal:
    """Internal event related classes"""
    class Dispatcher(InstructionPayload):
        model_config = ConfigDict(arbitrary_types_allowed=True)
        next_event_handler: Optional[ActorAddress] = Field(None, description="Next event handler")
        current_query: Optional[str] = Field(None, description="Current query")
        need_storage_history: Optional[bool] = Field(None, description="Whether to storage history")
