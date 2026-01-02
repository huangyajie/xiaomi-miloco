# Copyright (C) 2025 Xiaomi Corporation
# This software may be used and distributed according to the terms of the Xiaomi Miloco License Agreement.

"""
Trigger rule data access object
Handles CRUD operations for trigger_rule table
"""

import logging
import json
import uuid
from typing import Optional, List, Dict, Any
from datetime import datetime
from miloco_server.utils.database import get_db_connector
from miloco_server.schema.trigger_schema import TriggerRule, Action, TriggerFilter, ExecuteInfo


logger = logging.getLogger(__name__)


class TriggerRuleDAO:
    """Trigger rule data access object"""

    def __init__(self):
        self.db_connector = get_db_connector()

    def _dict_to_trigger_action(self, data: Dict[str, Any]) -> Action:
        """Convert dictionary to TriggerAction object"""
        return Action(**data)

    def _trigger_rule_to_dict(self, rule: TriggerRule) -> Dict[str, Any]:
        """Convert TriggerRule object to database storage format"""
        return {
            "id": rule.id,
            "name": rule.name,
            "enabled": rule.enabled,
            "camera_dids": json.dumps(rule.cameras),
            "ha_devices": json.dumps(rule.ha_devices),
            "condition": rule.condition,
            "execute_info": json.dumps(rule.execute_info.model_dump(mode="json")) if rule.execute_info else None,
            "filter": json.dumps(rule.filter.model_dump(mode="json")) if rule.filter else None,
        }

    def _dict_to_trigger_rule(self, data: Dict[str, Any]) -> TriggerRule:
        """Convert database data to TriggerRule object"""
        cameras = json.loads(data["camera_dids"]) if data.get("camera_dids") else []
        ha_devices = json.loads(data["ha_devices"]) if data.get("ha_devices") else []

        execute_info_data = json.loads(data["execute_info"]) if data.get("execute_info") else None
        execute_info = ExecuteInfo(**execute_info_data) if execute_info_data else None
        filter_data = json.loads(data["filter"]) if data.get("filter") else None
        filter_obj = TriggerFilter(**filter_data) if filter_data else None

        return TriggerRule(
            id=data["id"],
            name=data["name"],
            enabled=bool(data["enabled"]),
            cameras=cameras,
            ha_devices=ha_devices,
            condition=data["condition"],
            execute_info=execute_info,
            filter=filter_obj,
        )

    def create(self, rule: TriggerRule) -> Optional[str]:
        """
        Create new trigger rule

        Args:
            rule: Trigger rule object

        Returns:
            Optional[str]: New UUID if successful, None if failed
        """
        try:
            rule_id = str(uuid.uuid4())

            sql = """
                INSERT INTO trigger_rule (id, name, enabled, camera_dids, ha_devices, condition, execute_info, filter, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            current_time = datetime.now().isoformat()
            params = (
                rule_id,
                rule.name,
                rule.enabled,
                json.dumps(rule.cameras),
                json.dumps(rule.ha_devices),
                rule.condition,
                json.dumps(rule.execute_info.model_dump(mode="json")) if rule.execute_info else None,
                json.dumps(rule.filter.model_dump(mode="json")) if rule.filter else None,
                current_time,
                current_time
            )

            with self.db_connector.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(sql, params)
                conn.commit()

                logger.info("Trigger rule created successfully: id=%s, name=%s", rule_id, rule.name)
                return rule_id

        except (ValueError, TypeError, KeyError, AttributeError) as e:
            logger.error("Error creating trigger rule: name=%s, error=%s", rule.name, e, exc_info=True)
            return None

    def get_by_id(self, rule_id: str) -> Optional[TriggerRule]:
        """
        Get trigger rule by ID

        Args:
            rule_id: Rule ID (UUID)

        Returns:
            Optional[TriggerRule]: Trigger rule object, None if not exists
        """
        try:
            sql = "SELECT * FROM trigger_rule WHERE id = ?"
            params = (rule_id,)

            results = self.db_connector.execute_query(sql, params)

            if results:
                logger.debug("Trigger rule found: id=%s", rule_id)
                return self._dict_to_trigger_rule(results[0])
            else:
                logger.debug("Trigger rule not found: id=%s", rule_id)
                return None

        except (ValueError, TypeError, KeyError, AttributeError) as e:
            logger.error("Error querying trigger rule: id=%s, error=%s", rule_id, e)
            return None

    def get_by_name(self, name: str) -> Optional[TriggerRule]:
        """
        Get trigger rule by name

        Args:
            name: Rule name

        Returns:
            Optional[TriggerRule]: Trigger rule object, None if not exists
        """
        try:
            sql = "SELECT * FROM trigger_rule WHERE name = ?"
            params = (name,)

            results = self.db_connector.execute_query(sql, params)

            if results:
                logger.debug("Trigger rule found: name=%s", name)
                return self._dict_to_trigger_rule(results[0])
            else:
                logger.debug("Trigger rule not found: name=%s", name)
                return None

        except (ValueError, TypeError, KeyError, AttributeError) as e:
            logger.error("Error querying trigger rule: name=%s, error=%s", name, e)
            return None

    def get_all(self, enabled_only: bool = False) -> List[TriggerRule]:
        """
        Get all trigger rules

        Args:
            enabled_only: Whether to return only enabled rules

        Returns:
            List[TriggerRule]: List of trigger rules
        """
        try:
            if enabled_only:
                sql = "SELECT * FROM trigger_rule WHERE enabled = 1 ORDER BY created_at DESC"
            else:
                sql = "SELECT * FROM trigger_rule ORDER BY created_at DESC"

            results = self.db_connector.execute_query(sql)

            rules = [self._dict_to_trigger_rule(row) for row in results]
            logger.debug("Retrieved %s trigger rules", len(rules))
            return rules

        except (ValueError, TypeError, KeyError, AttributeError) as e:
            logger.error("Error retrieving trigger rules: error=%s", e)
            raise e

    def update(self, rule: TriggerRule) -> bool:
        """
        Update trigger rule

        Args:
            rule: Trigger rule object

        Returns:
            bool: True if update successful, False otherwise
        """
        try:
            sql = """
                UPDATE trigger_rule
                SET name = ?, enabled = ?, camera_dids = ?, ha_devices = ?, condition = ?, execute_info = ?, filter = ?, updated_at = ?
                WHERE id = ?
            """
            params = (
                rule.name,
                rule.enabled,
                json.dumps(rule.cameras),
                json.dumps(rule.ha_devices),
                rule.condition,
                json.dumps(rule.execute_info.model_dump(mode="json")) if rule.execute_info else None,
                json.dumps(rule.filter.model_dump(mode="json")) if rule.filter else None,
                datetime.now().isoformat(),
                rule.id
            )

            affected_rows = self.db_connector.execute_update(sql, params)

            if affected_rows > 0:
                logger.info("Trigger rule updated successfully: id=%s, name=%s", rule.id, rule.name)
                return True
            else:
                logger.warning("Failed to update trigger rule, might not exist: id=%s", rule.id)
                return False

        except (ValueError, TypeError, KeyError, AttributeError) as e:
            logger.error("Error updating trigger rule: id=%s, error=%s", rule.id, e)
            return False

    def delete(self, rule_id: str) -> bool:
        """
        Delete trigger rule

        Args:
            rule_id: Rule ID (UUID)

        Returns:
            bool: True if deletion successful, False otherwise
        """
        try:
            sql = "DELETE FROM trigger_rule WHERE id = ?"
            params = (rule_id,)

            affected_rows = self.db_connector.execute_update(sql, params)

            if affected_rows > 0:
                logger.info("Trigger rule deleted successfully: id=%s", rule_id)
                return True
            else:
                logger.warning("Failed to delete trigger rule, might not exist: id=%s", rule_id)
                return False

        except (ValueError, TypeError, KeyError, AttributeError) as e:
            logger.error("Error deleting trigger rule: id=%s, error=%s", rule_id, e)
            return False

    def exists(self, rule_id: str) -> bool:
        """
        Check if trigger rule exists

        Args:
            rule_id: Rule ID (UUID)

        Returns:
            bool: True if exists, False otherwise
        """
        try:
            sql = "SELECT COUNT(*) as count FROM trigger_rule WHERE id = ?"
            params = (rule_id,)

            results = self.db_connector.execute_query(sql, params)

            if results and results[0]["count"] > 0:
                return True
            return False

        except (ValueError, TypeError, KeyError, AttributeError) as e:
            logger.error("Error checking trigger rule existence: id=%s, error=%s", rule_id, e)
            return False

    def exists_by_name(self, name: str, exclude_id: Optional[str] = None) -> bool:
        """
        Check if trigger rule with specified name exists

        Args:
            name: Rule name
            exclude_id: Excluded rule ID (UUID) (for checking name uniqueness during update)

        Returns:
            bool: True if exists, False otherwise
        """
        try:
            if exclude_id is not None:
                sql = "SELECT COUNT(*) as count FROM trigger_rule WHERE name = ? AND id != ?"
                params = (name, exclude_id)
            else:
                sql = "SELECT COUNT(*) as count FROM trigger_rule WHERE name = ?"
                params = (name,)

            results = self.db_connector.execute_query(sql, params)

            if results and results[0]["count"] > 0:
                return True
            return False

        except (ValueError, TypeError, KeyError, AttributeError) as e:
            logger.error("Error checking trigger rule name existence: name=%s, error=%s", name, e)
            return False

    def count_all(self) -> int:
        """
        Get total count of trigger rules

        Returns:
            int: Total count of trigger rules
        """
        try:
            sql = "SELECT COUNT(*) as count FROM trigger_rule"
            results = self.db_connector.execute_query(sql)

            if results:
                return results[0]["count"]
            return 0

        except (ValueError, TypeError, KeyError, AttributeError) as e:
            logger.error("Error getting trigger rule count: error=%s", e)
            return 0

    def count_enabled(self) -> int:
        """
        Get count of enabled trigger rules

        Returns:
            int: Count of enabled trigger rules
        """
        try:
            sql = "SELECT COUNT(*) as count FROM trigger_rule WHERE enabled = 1"
            results = self.db_connector.execute_query(sql)

            if results:
                return results[0]["count"]
            return 0

        except (ValueError, TypeError, KeyError, AttributeError) as e:
            logger.error("Error getting enabled trigger rule count: error=%s", e)
            return 0
