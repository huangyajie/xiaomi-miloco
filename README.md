# Xiaomi Miloco (大傻 Fork)

A deployment-focused Xiaomi Miloco fork for self-hosted smart home assistants.

This repository keeps the upstream Xiaomi Miloco foundation, but treats this fork
as the maintained deployment target for the features documented here. If you need
the Home Assistant, RTSP, and management UI improvements in this branch, deploy
from this repository instead of the upstream repository.

<div align="center">

English | [简体中文](README.zh_Hans.md)

</div>

## Why this fork

- Home Assistant device management is improved for self-hosted use.
- Third-party RTSP cameras can be added, edited, deleted, and persisted.
- Device management supports hide, restore, search, area grouping, and bulk actions.
- Camera UI behavior is improved for day-to-day operation, including inline RTSP management and 16:9 fullscreen playback.
- Public-safe deployment notes are included so the repo can be used as an actual deployment source instead of a one-off patch set.

## Current release

- Latest fork release: [`v0.0.5-fork`](https://github.com/xyiqq/xiaomi-miloco/releases/tag/v0.0.5-fork)
- Changelog: [CHANGELOG.md](CHANGELOG.md)
- Deployment notes: [docs/deployment/README.md](docs/deployment/README.md)

## Quick deploy

```bash
git clone https://github.com/xyiqq/xiaomi-miloco.git
cd xiaomi-miloco
bash scripts/install.sh
```

For self-hosted deployment, read these first:

1. [docs/deployment/README.md](docs/deployment/README.md)
2. [docs/deployment/fork-customizations.md](docs/deployment/fork-customizations.md)
3. [docs/environment-setup.md](docs/environment-setup.md)

## Fork highlights

### Home Assistant

- Device list and grouped device flows
- Better area resolution in device management
- Hidden-device and restore flows
- Correct forwarding of `service_data` for device control

### RTSP cameras

- Add, edit, delete, and list RTSP cameras
- Runtime persistence for RTSP camera configuration
- Inline RTSP management from the camera list
- Edit behavior that keeps the current URL when the field is left blank

### Device management UI

- Search by name, ID, model, and area
- Group by area or home
- Per-area bulk selection
- Batch remove and hidden-device restore flows

### Camera UI

- Inline edit and delete actions for RTSP cameras
- Cleaner camera card presentation
- 16:9 fullscreen playback instead of aggressive cropping

## Documentation

- Deployment notes: [docs/deployment/README.md](docs/deployment/README.md)
- Fork customizations: [docs/deployment/fork-customizations.md](docs/deployment/fork-customizations.md)
- Changelog: [CHANGELOG.md](CHANGELOG.md)
- Usage docs: [docs/usage/README.md](docs/usage/README.md)
- Development setup: [docs/development/developer-setup.md](docs/development/developer-setup.md)

## Relationship to upstream

This fork is based on the upstream Xiaomi Miloco project and keeps its core
concepts, architecture, and license terms. Upstream remains the original source
of the framework. This fork exists to provide a maintained, deployable branch
for the self-hosted integrations and UI/runtime fixes documented here.

If you need the upstream project itself, see:

- Upstream repository: [XiaoMi/xiaomi-miloco](https://github.com/XiaoMi/xiaomi-miloco)

## Support

- Issues: [大傻/xiaomi-miloco issues](https://github.com/xyiqq/xiaomi-miloco/issues)
- Discussions: [大傻/xiaomi-miloco discussions](https://github.com/xyiqq/xiaomi-miloco/discussions)

## License

License details are in [LICENSE.md](LICENSE.md).

This project continues to follow the upstream non-commercial license notice.
