# Fork Customizations

This fork contains deployment-oriented fixes and UI improvements that were
validated on a self-hosted Docker deployment. Sensitive runtime information
such as IP addresses, tokens, passwords, and camera credentials has been
removed from this document and is not part of the repository changes.

## Included changes

### Home Assistant

- Added Home Assistant device list endpoints and grouping support.
- Fixed Home Assistant device control passthrough so service data is forwarded.
- Added Home Assistant hidden-device management:
  - hide devices inside Miloco only
  - list hidden devices
  - restore hidden devices
- Improved Home Assistant area resolution for device management views.

### RTSP cameras

- Added RTSP camera CRUD APIs:
  - list configured RTSP cameras
  - add RTSP camera
  - update RTSP camera
  - delete RTSP camera
- Added RTSP configuration persistence helpers so runtime changes can be kept.
- Added frontend RTSP management entry in the AI center camera list.
- Improved RTSP edit behavior:
  - existing URL is loaded when editing
  - leaving the URL blank keeps the current stream address

### Device management UI

- Added Mi Home and Home Assistant batch remove actions.
- Added hidden-device restore entry with:
  - separate Mi Home and Home Assistant tabs
  - single restore
  - batch restore
- Added search filtering by name, ID, model, and area.
- Added grouping by area/home and per-area bulk selection.

### Camera UI

- Added inline RTSP edit/delete actions for third-party cameras.
- Simplified RTSP list cards to prioritize camera names instead of generic group labels.
- Improved fullscreen video presentation to preserve a 16:9 landscape view with letterboxing instead of aggressive cropping.

## Deployment notes

### Recommended deployment path

Use Docker Compose and mount persistent storage for:

- application data directory
- logs
- configuration file

If you deploy custom RTSP camera management, make sure the server config file is
mounted read-write so runtime edits can be persisted.

### Basic steps

1. Clone the repository.
2. Prepare `config/server_config.yaml`.
3. Start the backend with Docker Compose.
4. Complete first-login setup in the web UI.
5. Configure Home Assistant and any cloud models you plan to use.
6. Add RTSP cameras from the UI if needed.

### Security notes

- Do not commit production tokens, API keys, camera credentials, or private IP inventory.
- Keep environment-specific deployment values outside the repository.
- Prefer runtime env vars or local-only config files for secrets.

## Operational note

The repository changes intentionally avoid embedding local infrastructure
details. If you need a site-specific deployment bundle, keep that in a private
operations repository or private deployment directory instead of the public
source tree.

This fork summary also excludes any temporary rule-engine experiments that were
used only for local debugging and were not kept as stable source changes.
