# Changelog

All notable fork-facing changes in this repository will be documented in this file.

The format is intentionally lightweight and focused on deployable changes that differ
from upstream.

## v0.0.5-fork - 2026-04-15

### Added

- Public-safe deployment notes for this fork.
- Home Assistant device list, grouping, hidden-device, and restore flows.
- RTSP camera add, edit, delete, and persistence flows.
- Device management search, area grouping, area bulk selection, and hidden-device restore UI.
- Inline RTSP camera management in the camera list.

### Changed

- Fork README and contributing docs now point users to `xyiqq/xiaomi-miloco` instead of upstream for deployment, issues, and discussions.
- Camera fullscreen presentation now preserves a 16:9 landscape view.
- RTSP editing keeps the existing stream URL when the field is left blank.

### Fixed

- Home Assistant control requests now forward `service_data`.
- Home Assistant area information is resolved correctly in device management views.
- RTSP configuration changes are persisted for self-hosted deployments.

### Notes

- This changelog excludes site-specific deployment secrets and private infrastructure details.
- Temporary local rule-engine experiments that were not retained as stable source changes are not part of this release.
