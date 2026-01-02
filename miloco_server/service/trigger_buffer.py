# Copyright (C) 2025 Xiaomi Corporation
# This software may be used and distributed according to the terms of the Xiaomi Miloco License Agreement.

"""
Trigger Buffer Service
Handles event batched execution with source entity tracking.
"""

import asyncio
import logging
from typing import Callable, Set, Optional, Dict, Any

logger = logging.getLogger(__name__)


class TriggerBuffer:
    """
    Trigger Buffer with Source Tracking.
    
    Accumulates rule IDs and the specific entities that triggered them.
    """

    def __init__(self, 
                 execute_callback: Callable[[Dict[str, Set[str]]], Any], 
                 debounce_seconds: float = 1.0):
        """
        Args:
            execute_callback: Async function to call with Dict[rule_id, set(entity_ids)].
        """
        self._execute_callback = execute_callback
        self._debounce_seconds = debounce_seconds
        
        # rule_id -> set of entities that triggered it in this window
        self._dirty_rules: Dict[str, Set[str]] = {}
        self._timer_task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()

    async def mark_dirty(self, rule_ids: Set[str], entity_id: str):
        """
        Mark rules as dirty and record the triggering entity.
        """
        if not rule_ids:
            return

        async with self._lock:
            for rid in rule_ids:
                if rid not in self._dirty_rules:
                    self._dirty_rules[rid] = set()
                self._dirty_rules[rid].add(entity_id)
            
            logger.debug("Rules marked dirty by entity %s: %s", entity_id, rule_ids)
            
            # Reset timer
            if self._timer_task:
                self._timer_task.cancel()
            
            self._timer_task = asyncio.create_task(self._flush_after_delay())

    async def _flush_after_delay(self):
        try:
            await asyncio.sleep(self._debounce_seconds)
            
            async with self._lock:
                work_load = self._dirty_rules.copy()
                self._dirty_rules.clear()
                self._timer_task = None
            
            if work_load:
                logger.info("TriggerBuffer flushing %d rules", len(work_load))
                await self._execute_callback(work_load)

        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error("Error in TriggerBuffer flush: %s", e)