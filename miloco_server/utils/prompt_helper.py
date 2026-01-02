# Copyright (C) 2025 Xiaomi Corporation
# This software may be used and distributed according to the terms of the Xiaomi Miloco License Agreement.

"""
Prompt helper utilities for building chat messages and prompts.
Provides builders for trigger rule conditions and vision understanding prompts.
"""

from typing import Optional, Dict, Any
from datetime import datetime, timezone

from miloco_server.config.prompt_config import PromptConfig, PromptType, UserLanguage
from miloco_server.schema.chat_history_schema import ChatHistoryMessages
from miloco_server.schema.miot_schema import CameraImgSeq


class TriggerRuleConditionPromptBuilder:
    """Trigger rule prompt builder"""

    @staticmethod
    def build_trigger_rule_prompt(
        img_seq: Optional[CameraImgSeq],
        condition: str,
        language: UserLanguage = UserLanguage.CHINESE,
        device_states: Optional[Dict[str, Any]] = None
    ) -> ChatHistoryMessages:
        chat_history_messages = ChatHistoryMessages()

        # Get system prompt from config
        system_prompt = PromptConfig.get_prompt(PromptType.TRIGGER_RULE_CONDITION, language)
        chat_history_messages.add_content("system", system_prompt)

        # Get user content prefixes from config
        prefixes = PromptConfig.get_trigger_rule_condition_prefixes(language)

        user_content = []

        # Add image content if available
        if img_seq:
            img_seq_base64 = img_seq.to_base64()
            user_content.append({
                "type": "text",
                "text": prefixes["image_sequence_prefix"]
            })

            for image_data in img_seq_base64.img_list:
                user_content.append({
                    "type": "image_url",
                    "image_url": {
                        "url": image_data.data
                    }
                })

        # Add device states if available
        if device_states:
            current_time_str = datetime.now(timezone.utc).isoformat()
            state_text = f"\nCurrent System Time: {current_time_str}\n\nCurrent Device States:\n"
            for entity_id, state_info in device_states.items():
                state_val = state_info.get('state', 'unknown')
                attributes = state_info.get('attributes', {})
                friendly_name = attributes.get('friendly_name', entity_id)
                
                # Format attributes as a compact string, excluding generic ones
                ignored_attrs = {'friendly_name', 'icon', 'entity_picture', 'supported_features', 'context'}
                attr_str = ", ".join([f"{k}={v}" for k, v in attributes.items() if k not in ignored_attrs])
                
                # Check if this is the triggering entity
                is_source = state_info.get('_is_trigger_source', False)
                source_tag = " [TRIGGER SOURCE]" if is_source else ""
                
                state_text += f"- {friendly_name} ({entity_id}){source_tag}: State={state_val}"
                if attr_str:
                    state_text += f", Attributes=[{attr_str}]"
                state_text += "\n"
            
            user_content.append({
                "type": "text",
                "text": state_text
            })

        user_content.append({
            "type": "text",
            "text": prefixes["condition_question_template"].format(condition=condition)
        })

        chat_history_messages.add_content("user", user_content)

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
