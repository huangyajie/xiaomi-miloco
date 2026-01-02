# Copyright (C) 2025 Xiaomi Corporation
# This software may be used and distributed according to the terms of the Xiaomi Miloco License Agreement.

"""
Home Assistant State Listener
Maintains a real-time connection to Home Assistant via WebSocket to listen for state changes.
Implements an event-driven cache mechanism to reduce polling overhead.
"""

import asyncio
import json
import logging
from typing import Dict, Any, Optional, Callable, List, Set

import aiohttp

from miloco_server.schema.miot_schema import HAConfig

logger = logging.getLogger(__name__)


class HaStateListener:
    """
    Home Assistant WebSocket Listener.

    Responsibilities:
    1. Maintain WebSocket connection with HA (Auto-reconnect).
    2. Cache latest entity states in memory.
    3. Notify subscribers (TriggerBuffer) when relevant states change.
    """

    def __init__(self, ha_config: HAConfig,
                 on_state_changed: Optional[Callable[[str, Dict[str, Any], Dict[str, Any]], None]] = None,
                 on_connected: Optional[Callable[[], Any]] = None):
        """
        Initialize the HA Listener.

        Args:
            ha_config: Home Assistant configuration (url, token).
            on_state_changed: Callback function(entity_id, old_state, new_state)
                              called when a state changes.
            on_connected: Callback function called when connection is established and initialized.
        """
        self._ha_config = ha_config
        self._on_state_changed = on_state_changed
        self._on_connected = on_connected

        # State Cache: {entity_id: state_obj}
        # We store the full state object from HA to avoid frequent re-fetching
        self._state_cache: Dict[str, Dict[str, Any]] = {}

        # Connection management
        self._ws: Optional[aiohttp.ClientWebSocketResponse] = None
        self._session: Optional[aiohttp.ClientSession] = None
        self._is_running = False
        self._reconnect_delay = 5  # Seconds
        self._task: Optional[asyncio.Task] = None

        # Subscription management
        self._interaction_id = 1

        # Track which entities are actually watched by rules to filter noise (Optional optimization)
        self._watched_entities: Set[str] = set()

    @property
    def is_connected(self) -> bool:
        return self._ws is not None and not self._ws.closed

    def update_config(self, ha_config: HAConfig):
        """Update HA configuration and reconnect if necessary."""
        old_url = self._ha_config.base_url
        self._ha_config = ha_config
        if self._is_running and old_url != ha_config.base_url:
            logger.info('HA Config updated, restarting listener...')
            asyncio.create_task(self.restart())

    def update_watched_entities(self, entities: List[str]):
        """Update the set of entities we care about."""
        self._watched_entities = set(entities)
        logger.debug('Updated watched entities: %s', self._watched_entities)

    def get_state(self, entity_id: str) -> Optional[Dict[str, Any]]:
        """
        Get the current cached state of an entity.
        Returns None if entity is unknown.
        """
        return self._state_cache.get(entity_id)

    def get_all_states(self) -> Dict[str, Dict[str, Any]]:
        """Get a copy of the entire state cache."""
        return self._state_cache.copy()

    async def start(self):
        """Start the listener loop."""
        if self._is_running:
            return

        self._is_running = True
        self._session = aiohttp.ClientSession()
        self._task = asyncio.create_task(self._connect_loop())
        logger.info('HA State Listener started.')

    async def stop(self):
        """Stop the listener."""
        self._is_running = False
        if self._ws:
            await self._ws.close()
        if self._session:
            await self._session.close()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info('HA State Listener stopped.')

    async def restart(self):
        await self.stop()
        await self.start()

    async def _connect_loop(self):
        """Main connection loop with auto-reconnect."""
        while self._is_running:
            try:
                if not self._ha_config.base_url or not self._ha_config.token:
                    logger.warning('HA config missing, waiting...')
                    await asyncio.sleep(10)
                    continue

                # Construct WebSocket URL (handle http/https -> ws/wss)
                base_url = self._ha_config.base_url.rstrip('/')
                if base_url.startswith('https://'):
                    ws_url = base_url.replace('https://', 'wss://') + '/api/websocket'
                elif base_url.startswith('http://'):
                    ws_url = base_url.replace('http://', 'ws://') + '/api/websocket'
                else:
                    ws_url = f'ws://{base_url}/api/websocket'

                logger.info('Connecting to HA WebSocket: %s', ws_url)

                async with self._session.ws_connect(ws_url) as ws:
                    self._ws = ws
                    self._reconnect_delay = 5  # Reset delay on successful connect

                    # 1. Authenticate
                    await self._authenticate(ws)

                    # 2. Subscribe to events
                    await self._subscribe_events(ws)

                    # 3. Fetch initial states (Bootstrap cache)
                    await self._fetch_initial_states(ws)

                    logger.info('HA WebSocket connected and subscribed.')

                    # 4. Notify connected callback
                    if self._on_connected:
                        try:
                            if asyncio.iscoroutinefunction(self._on_connected):
                                asyncio.create_task(self._on_connected())
                            else:
                                self._on_connected()
                        except Exception as e:  # pylint: disable=broad-except
                            logger.error('Error in on_connected callback: %s', e)

                    # 5. Listen for messages
                    async for msg in ws:
                        if msg.type == aiohttp.WSMsgType.TEXT:
                            await self._handle_message(json.loads(msg.data))
                        elif msg.type == aiohttp.WSMsgType.ERROR:
                            logger.error('HA WebSocket connection closed with error %s', ws.exception())
                            break

            except Exception as e:  # pylint: disable=broad-except
                logger.error('HA WebSocket error: %s', e)
                # Exponential backoff for reconnect
                logger.info('Reconnecting in %s seconds...', self._reconnect_delay)
                await asyncio.sleep(self._reconnect_delay)
                self._reconnect_delay = min(self._reconnect_delay * 2, 60)
            finally:
                self._ws = None

    async def _authenticate(self, ws):
        """Handle auth phase."""
        # Wait for 'auth_required'
        auth_req = await ws.receive_json()
        if auth_req.get('type') != 'auth_required':
            raise Exception(f'Unexpected auth message: {auth_req}')  # pylint: disable=broad-exception-raised

        # Send auth
        await ws.send_json({
            'type': 'auth',
            'access_token': self._ha_config.token
        })

        # Wait for 'auth_ok'
        auth_response = await ws.receive_json()
        if auth_response.get('type') != 'auth_ok':
            raise Exception(f'Authentication failed: {auth_response}')  # pylint: disable=broad-exception-raised

    async def _subscribe_events(self, ws):
        """Subscribe to state_changed events."""
        self._interaction_id += 1
        await ws.send_json({
            'id': self._interaction_id,
            'type': 'subscribe_events',
            'event_type': 'state_changed'
        })
        # Note: We should verify the subscription success response,
        # but for simplicity we assume it works or fails later.

    async def _fetch_initial_states(self, ws):
        """Get all states to populate cache initially."""
        self._interaction_id += 1
        req_id = self._interaction_id
        await ws.send_json({
            'id': req_id,
            'type': 'get_states'
        })

        # We need to wait for this specific response
        # In a robust implementation, we'd use a Future/Event map to match IDs.
        # Here we do a simple loop peek (simplified for prototype)
        # Warning: This blocking read is risky if other messages arrive first.
        # A proper implementation would handle async message dispatching.
        # For this prototype, we'll assume the next message is the response
        # (since we just sent it and haven't processed event stream yet).

        # Optimization: We won't block here. We'll handle the response in _handle_message.
        # Just register that we expect states.
        pass

    async def _handle_message(self, data: Dict[str, Any]):
        """Process incoming WS messages."""
        msg_type = data.get('type')

        if msg_type == 'event':
            event = data.get('event', {})
            if event.get('event_type') == 'state_changed':
                self._process_state_change(event.get('data', {}))

        elif msg_type == 'result':
            # Handle get_states response
            if data.get('success') and isinstance(data.get('result'), list):
                results = data['result']
                # Verify if it's a state list (each item should have entity_id)
                if results and isinstance(results[0], dict) and 'entity_id' in results[0]:
                    logger.info('Received initial state dump (%d entities)', len(results))
                    for state in results:
                        self._state_cache[state['entity_id']] = state

    def _process_state_change(self, data: Dict[str, Any]):
        """Update cache and notify callback."""
        entity_id = data.get('entity_id')
        new_state = data.get('new_state')
        old_state = data.get('old_state')

        if not entity_id or not new_state:
            return

        # Update cache
        self._state_cache[entity_id] = new_state

        # Log for debugging
        # logger.info('HA State Changed: %s -> %s', entity_id, new_state.get('state'))

        # Filter noise: if we only care about specific entities
        if self._watched_entities and entity_id not in self._watched_entities:
            return

        # Notify callback (Trigger Buffer)
        if self._on_state_changed:
            try:
                self._on_state_changed(entity_id, old_state, new_state)
            except Exception as e:  # pylint: disable=broad-except
                logger.error('Error in state change callback: %s', e)
