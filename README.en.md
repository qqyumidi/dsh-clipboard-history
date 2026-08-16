# dsh-clipboard-history

Monitor the system clipboard and keep a searchable history with a Web panel and agent tools for DeepSeek Harness (DSH).

Continuously polls the system clipboard (macOS `pbpaste/pbcopy`, Linux `xclip`/`wl-paste`, Windows PowerShell), stores copied text into `~/.dsh/clipboard-history.json` (bounded at 500 entries), and exposes a **📋 Clipboard** button in the session header that opens a panel — search, click-to-copy, per-entry delete, pause/resume, clear. It also registers four agent tools: `clipboard_get`, `clipboard_history_search`, `clipboard_copy`, `clipboard_history_delete`.

## Install

```sh
dsh plugin --profile web add "file:$HOME/dsh-clipboard-history"
dsh web   # restart so the profile takes effect
```

Or install directly from GitHub:

```sh
dsh plugin --profile web add github:qqyumidi/dsh-clipboard-history
dsh web
```

Uninstall:

```sh
dsh plugin --profile web remove @dsh-external/dsh-clipboard-history
```

## Usage

- Click **📋 Clipboard** in the session header (beside Session log) to open the panel.
- Panel: search box filters history; click an entry or **📋 Copy** to copy it back to the system clipboard; **🗑 Delete** removes one entry; header buttons pause/resume monitoring and clear all.
- Agent tools: `clipboard_get` (read current clipboard), `clipboard_history_search` (search history), `clipboard_copy` (write to clipboard), `clipboard_history_delete` (delete by id).

## Data

- History file: `~/.dsh/clipboard-history.json`
- Cap: 500 entries, oldest dropped
- Poll interval: 1.5s

## Layout

```
dsh-clipboard-history/
├── package.json          # dsh.bundle.patch + dsh.client.platform
├── cordis.patch.yml      # insert plugin row
└── lib/
    ├── index.js          # Host: polling / persistence / HTTP API / tools
    └── client.js         # Client: session-header button + floating panel
```

## Notes

- Host and Client talk over `/clipboard-api/*` HTTP endpoints registered on `webServer` (static bundles have no dynamic `harness.handle`/`host.call`).
- Functionally equivalent to the dynamic `cordis_define` version; both share the same history file.

## License

MIT
