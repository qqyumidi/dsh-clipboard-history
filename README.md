# dsh-clipboard-history

监控系统剪贴板，保留可搜索的历史记录，并提供 Web 面板与 Agent 工具。

DeepSeek Harness（DSH）剪贴板历史管理器：持续监听系统剪贴板（macOS `pbpaste/pbcopy`、Linux `xclip`/`wl-paste`、Windows PowerShell），把复制过的内容按时间存入 `~/.dsh/clipboard-history.json`（上限 500 条），Web 会话标题栏提供「📋 剪贴板」入口打开面板 —— 搜索、点击复制、单条删除、暂停/恢复、清空；同时向 Agent 注册 `clipboard_get` / `clipboard_history_search` / `clipboard_copy` / `clipboard_history_delete` 四个模型工具。

## 安装

```sh
dsh plugin --profile web add "file:$HOME/dsh-clipboard-history"
dsh web   # 重启使 profile 生效
```

或直接从 GitHub 安装：

```sh
dsh plugin --profile web add github:qqyumidi/dsh-clipboard-history
dsh web
```

卸载：

```sh
dsh plugin --profile web remove @dsh-external/dsh-clipboard-history
```

## 使用

- 会话标题栏右侧「📋 剪贴板」按钮打开面板。
- 面板内：搜索框过滤历史；点击条目内容或「📋 复制」把该条复制回系统剪贴板；「🗑 删除」移除单条；顶部可暂停/恢复监听、清空全部。
- Agent 工具：`clipboard_get`（读当前剪贴板）、`clipboard_history_search`（搜历史）、`clipboard_copy`（写入剪贴板）、`clipboard_history_delete`（按 id 删除一条）。

## 数据

- 历史文件：`~/.dsh/clipboard-history.json`
- 上限：500 条，超出后丢弃最旧记录
- 轮询间隔：1.5s

## 结构

```
dsh-clipboard-history/
├── package.json          # dsh.bundle.patch + dsh.client.platform
├── cordis.patch.yml      # insert 插件行
└── lib/
    ├── index.js          # Host：轮询/持久化/HTTP API/工具注册
    └── client.js         # Client：会话头部按钮 + 浮动面板
```

## 说明

- Host 与 Client 通过 `webServer` 注册的 `/clipboard-api/*` HTTP 端点通信（静态 bundle 没有动态插件的 `harness.handle`/`host.call`）。
- 动态插件版（`cordis_define`）与本静态版功能等价；历史文件同一份，可无缝切换。

## License

MIT
