# Deployment Notes

This directory contains public-safe deployment notes for this fork.

## Recommended reading order

1. `../environment-setup.md`
   Use the upstream environment preparation guide for Docker, drivers, and host prerequisites.
2. `fork-customizations.md`
   Review the stable fork-specific backend and frontend changes included in this branch.
3. `fork-customizations_zh-Hans.md`
   Simplified Chinese version of the same fork customization summary.

## Suggested self-hosted deployment flow

1. Clone the repository to your target host.
2. Prepare a writable `config/server_config.yaml`.
3. Start the backend and frontend with Docker Compose or your equivalent container stack.
4. Complete first-login initialization in the web UI.
5. Configure Home Assistant credentials and cloud model settings from the UI.
6. Add or edit RTSP cameras from the UI if needed.
7. Keep runtime secrets outside the repository by using environment variables or local-only config files.

## Scope

The documents in this directory intentionally exclude:

- private IP inventory
- tokens and API keys
- camera credentials
- site-specific Docker overrides
- experimental runtime-only rule-engine patches
