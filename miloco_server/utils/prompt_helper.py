# Copyright (C) 2025 Xiaomi Corporation
# This software may be used and distributed according to the terms of the Xiaomi Miloco License Agreement.

"""
Prompt helper utilities for building chat messages and prompts.
Provides builders for trigger rule conditions and vision understanding prompts.
"""

from datetime import datetime, timezone
from typing import Optional, Dict, Any
import logging
from miloco_server.config.prompt_config import PromptConfig, PromptType, UserLanguage, CAMERA_IMG_FRAME_INTERVAL
from miloco_server.config.normal_config import TRIGGER_RULE_RUNNER_CONFIG
from miloco_server.schema.chat_history_schema import ChatHistoryMessages
from miloco_server.schema.miot_schema import CameraImgSeq

logger = logging.getLogger(name=__name__)

class TriggerRuleConditionPromptBuilder:
    """Trigger rule prompt builder"""

    @staticmethod
    def _s_to_time_str(timestamp: int) -> str:
        """Convert millisecond timestamp to YYYY-MM-DD HH:MM:SS format"""
        return datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d %H:%M:%S")

    @staticmethod
    def build_trigger_rule_prompt(
        img_seq: Optional[CameraImgSeq],
        condition: str,
        language: UserLanguage = UserLanguage.CHINESE,
        last_happened_img_seq: Optional[CameraImgSeq] = None,
        device_states: Optional[Dict[str, Any]] = None,
    ) -> ChatHistoryMessages:
        chat_history_messages = ChatHistoryMessages()

        # Get system prompt from config
        system_prompt = PromptConfig.get_prompt(PromptType.TRIGGER_RULE_CONDITION, language)
        chat_history_messages.add_content("system", system_prompt)

        # Get user content prefixes from config
        prefixes = PromptConfig.get_trigger_rule_condition_prefixes(language)

        user_content = []
        has_camera_input = img_seq is not None and bool(img_seq.img_list)

        # Explicitly constrain output format by mode to reduce model drift.
        if has_camera_input:
            mode_text = (
                "当前模式：摄像头模式。你必须只输出一个数字：0 或 1 或 2。"
                "禁止输出 JSON、Markdown、代码块或任何额外文本。"
                if language == UserLanguage.CHINESE else
                "Current mode: camera mode. You must output exactly one number: 0, 1, or 2. "
                "Do not output JSON, Markdown, code fences, or any extra text."
            )
            user_content.append({
                "type": "text",
                "text": mode_text
            })
        elif device_states:
            mode_text = (
                "当前模式：设备状态模式。你必须只输出 JSON 字符串："
                "{\"result\":\"yes\"} 或 {\"result\":\"no\"}，不要输出其他文本。"
                if language == UserLanguage.CHINESE else
                "Current mode: device-state mode. You must output only a JSON string: "
                "{\"result\":\"yes\"} or {\"result\":\"no\"}, and no extra text."
            )
            user_content.append({
                "type": "text",
                "text": mode_text
            })

        if has_camera_input:
            img_seq_base64 = img_seq.to_base64()

            # current_time
            current_time_str = TriggerRuleConditionPromptBuilder._s_to_time_str(
                img_seq.img_list[0].timestamp)
            user_content.append({
                "type": "text",
                "text": prefixes["current_time_prefix"].format(time=current_time_str)
            })

            # current_frames
            user_content.append({
                "type": "text",
                "text": prefixes["current_frames_prefix"].format(
                    vision_use_img_count=TRIGGER_RULE_RUNNER_CONFIG["vision_use_img_count"],
                    frame_interval=CAMERA_IMG_FRAME_INTERVAL
                )
            })
            for image_data in img_seq_base64.img_list:
                user_content.append({
                    "type": "image_url",
                    "image_url": {
                        "url": image_data.data
                    }
                })

        # last_happened_frames and last_happened_time
        if last_happened_img_seq is not None and last_happened_img_seq.img_list:
            logger.info("Last Image Detected")
            last_happened_base64 = last_happened_img_seq.to_base64()
            last_time_str = TriggerRuleConditionPromptBuilder._s_to_time_str(
                last_happened_img_seq.img_list[0].timestamp)
            user_content.append({
                "type": "text",
                "text": prefixes["last_happened_time_prefix"].format(time=last_time_str)
            })
            user_content.append({
                "type": "text",
                "text": prefixes["last_happened_frames_prefix"].format(
                    vision_use_img_count=TRIGGER_RULE_RUNNER_CONFIG["vision_use_img_count"],
                    frame_interval=CAMERA_IMG_FRAME_INTERVAL
                )
            })
            for image_data in last_happened_base64.img_list:
                user_content.append({
                    "type": "image_url",
                    "image_url": {
                        "url": image_data.data
                    }
                })

        # Add device states if available (preserve local HA rule context)
        if device_states:
            current_time_str = datetime.now(timezone.utc).isoformat()
            state_text = f"\nCurrent System Time: {current_time_str}\n\nCurrent Device States:\n"
            for entity_id, state_info in device_states.items():
                state_val = state_info.get("state", "unknown")
                attributes = state_info.get("attributes", {})
                friendly_name = attributes.get("friendly_name", entity_id)

                ignored_attrs = {"friendly_name", "icon", "entity_picture", "supported_features", "context"}
                attr_str = ", ".join([f"{k}={v}" for k, v in attributes.items() if k not in ignored_attrs])

                is_source = state_info.get("_is_trigger_source", False)
                source_tag = " [TRIGGER SOURCE]" if is_source else ""

                state_text += f"- {friendly_name} ({entity_id}){source_tag}: State={state_val}"
                if attr_str:
                    state_text += f", Attributes=[{attr_str}]"
                state_text += "\n"

            user_content.append({
                "type": "text",
                "text": state_text
            })

        # user_rule_content
        user_content.append({
            "type": "text",
            "text": prefixes["condition_question_template"].format(condition=condition)
        })

        chat_history_messages.add_content("user", user_content)

        temp_log_output = []
        for item in user_content:
            if item["type"] == "text":
                temp_log_output.append(item["text"])
        logger.debug("TriggerRuleConditionPromptBuilder: %s", temp_log_output)

        return chat_history_messages


class VisionUnderstandToolPromptBuilder:
    """Vision understand prompt builder"""

    @staticmethod
    def _get_system_prompt(language: UserLanguage = UserLanguage.CHINESE) -> str:
        return PromptConfig.get_prompt(PromptType.VISION_UNDERSTANDING, language)

    @staticmethod
    def build_prompt(
        camera_img_seqs: list[CameraImgSeq],
        query: str,
        language: UserLanguage = UserLanguage.CHINESE) -> ChatHistoryMessages:

        chat_history_messages = ChatHistoryMessages()
        chat_history_messages.add_content("system", VisionUnderstandToolPromptBuilder._get_system_prompt(language))

        # Get language-specific prefixes from config
        prefixes = PromptConfig.get_vision_understanding_prefixes(language)
        chat_history_messages.add_content("user", prefixes["user_content"])
        camera_prefix = prefixes["camera_prefix"]
        channel_prefix = prefixes["channel_prefix"]
        sequence_prefix = prefixes["sequence_prefix"]

        user_content = []

        for image_seq in camera_img_seqs:
            img_seq_base64 = image_seq.to_base64()
            user_content.append({
                "type": "text",
                "text": (f"\n{camera_prefix}{img_seq_base64.camera_info.name}"
                        f"{channel_prefix}{img_seq_base64.channel}{sequence_prefix}")
            })

            for image_data in img_seq_base64.img_list:
                user_content.append({
                    "type": "image_url",
                    "image_url": {
                        "url": image_data.data
                    }
                })

        user_content.append({
            "type": "text",
            "text": f"query: {query}。/no_think"
        })

        chat_history_messages.add_content("user", user_content)

        return chat_history_messages
