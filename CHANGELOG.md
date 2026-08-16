# Changelog

All notable changes to this project are documented in this file.

## [0.1.0] - 2026-08-16

Initial release.

### Added

- System clipboard monitoring (macOS `pbpaste/pbcopy`, Linux `xclip`/`wl-paste`, Windows PowerShell).
- Bounded persisted history at `~/.dsh/clipboard-history.json` (500 entries, oldest dropped).
- Web panel: session-header **📋 Clipboard** button, searchable history list, click-to-copy, per-entry delete, pause/resume monitoring, clear all.
- Agent tools: `clipboard_get`, `clipboard_history_search`, `clipboard_copy`, `clipboard_history_delete`.
- Host↔Client communication over `webServer` `/clipboard-api/*` HTTP endpoints.
- Standalone smoke test (`npm run smoke`) for history dedup/bounding logic.
