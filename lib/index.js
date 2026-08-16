/**
 * dsh-clipboard-history — host half.
 *
 * Monitors the system clipboard, keeps a bounded persisted history under
 * `~/.dsh/clipboard-history.json`, exposes a small HTTP API for the client
 * panel, and registers agent tools for clipboard read / history search /
 * write / delete.
 *
 * Static (bundle) plugin: no `harness` builtin here — tools go through
 * `ctx.tools.register(defineTool(...))` and the panel talks to us over
 * `webServer` HTTP endpoints instead of `host.call`.
 */
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'clipboard-history'

export const inject = ['timer', 'subprocess', 'fs', 'webServer', 'tools']

/** History file location (user home + DSH home). */
function historyPath(home) {
  return `${home}/.dsh/clipboard-history.json`
}

/** History entry cap (oldest entries are dropped). */
const MAX_HISTORY = 500

/** Clipboard polling interval in ms. */
const POLL_MS = 1500

/** Read one process's collected stdout after it closes. */
async function runCapture(ctx, argv, cwd, input) {
  const handle = ctx.subprocess.spawn({
    argv,
    cwd,
    stdio: {
      stdin: input === undefined ? 'ignore' : { data: input },
      stdout: { maxBytes: 4 * 1024 * 1024 },
      stderr: { maxBytes: 64 * 1024 },
    },
    graceMs: 5000,
  })
  const outcome = await handle.done
  let text = ''
  if (handle.collected && handle.collected.stdout) {
    text = handle.collected.stdout.readFrom(0).text || ''
  }
  return { ok: outcome.exitCode === 0, text }
}

/**
 * Detect the platform clipboard reader/writer argv.
 *
 * Windows write: PowerShell cannot read raw stdin into Set-Clipboard directly,
 * so we read stdin ourselves in the -Command script and pass it as -Value.
 */
async function detectPlatform(ctx) {
  try {
    const p = await ctx.subprocess.resolveExecutable('pbpaste')
    return { read: [p], write: [await ctx.subprocess.resolveExecutable('pbcopy')] }
  } catch (e) { /* fall through */ }
  try {
    const x = await ctx.subprocess.resolveExecutable('xclip')
    return { read: [x, '-selection', 'clipboard', '-o'], write: [x, '-selection', 'clipboard'] }
  } catch (e) { /* fall through */ }
  try {
    const w = await ctx.subprocess.resolveExecutable('wl-paste')
    return { read: [w, '--no-newline'], write: [await ctx.subprocess.resolveExecutable('wl-copy')] }
  } catch (e) { /* fall through */ }
  try {
    const ps = await ctx.subprocess.resolveExecutable('powershell')
    return {
      read: [ps, '-NoProfile', '-Command', 'Get-Clipboard -Raw'],
      // [Console]::In.ReadToEnd() consumes our piped stdin, then Set-Clipboard applies it.
      write: [ps, '-NoProfile', '-Command', 'Set-Clipboard -Value ([Console]::In.ReadToEnd())'],
    }
  } catch (e) { /* fall through */ }
  return null
}

/**
 * Shared clipboard state. One instance per apply, passed explicitly to every
 * helper so there is a single source of truth for history.
 */
function createState() {
  return {
    readCmd: null,
    writeCmd: null,
    home: '/',
    history: [],
    seq: 0,
    paused: false,
    lastClip: '',
  }
}

/** Read the system clipboard as plain text (trailing newline trimmed). */
async function readClipboard(ctx, state) {
  if (!state.readCmd) return ''
  const r = await runCapture(ctx, state.readCmd, state.home)
  if (!r.ok) return ''
  let t = r.text
  if (t.endsWith('\n')) t = t.slice(0, -1)
  if (t.endsWith('\r')) t = t.slice(0, -1)
  return t
}

/** Write plain text into the system clipboard. */
async function writeClipboard(ctx, state, text) {
  if (!state.writeCmd) return false
  const r = await runCapture(ctx, state.writeCmd, state.home, String(text))
  return r.ok
}

/** Load persisted history from disk (missing/corrupt file → empty). */
async function loadHistory(ctx, state) {
  try {
    const target = await ctx.fs.resolve(historyPath(state.home))
    const raw = await ctx.fs.readText(target)
    const parsed = JSON.parse(raw)
    state.history = Array.isArray(parsed) ? parsed : []
  } catch (e) {
    state.history = []
  }
}

/** Persist history to disk (best effort, never throws). */
async function saveHistory(ctx, state) {
  try {
    const target = await ctx.fs.resolve(historyPath(state.home))
    await ctx.fs.writeText(target, JSON.stringify(state.history))
  } catch (e) { /* best effort */ }
}

/** Insert one clipboard text into history with dedup, then persist. */
function pushClip(ctx, state, text) {
  if (!text) return
  const t = text.trim()
  if (!t) return
  if (state.history[0] && state.history[0].text === text) {
    state.history[0].time = Date.now()
    return
  }
  state.history.unshift({ id: 'c' + (++state.seq), text, time: Date.now() })
  if (state.history.length > MAX_HISTORY) state.history.length = MAX_HISTORY
  saveHistory(ctx, state)
}

/** Start the polling loop and register API + tools. */
async function start(ctx, state) {
  const platform = await detectPlatform(ctx)
  if (platform) {
    state.readCmd = platform.read
    state.writeCmd = platform.write
  }
  const h = await runCapture(ctx, ['sh', '-c', 'printf "%s" "$HOME"'], '/')
  if (h.ok && h.text) state.home = h.text
  await loadHistory(ctx, state)
  state.seq = state.history.reduce((m, x) => {
    const n = parseInt(String(x.id).slice(1), 10)
    return Number.isFinite(n) ? Math.max(m, n) : m
  }, 0)
  const cur = await readClipboard(ctx, state)
  state.lastClip = cur
  if (cur) pushClip(ctx, state, cur)

  ctx.timer.interval(async () => {
    if (state.paused) return
    const text = await readClipboard(ctx, state)
    if (text && text !== state.lastClip) {
      state.lastClip = text
      pushClip(ctx, state, text)
    }
  }, POLL_MS)

  registerApi(ctx, state)
  registerTools(ctx, state)
}

export function apply(ctx) {
  const state = createState()
  start(ctx, state).catch((e) => console.error('[clipboard-history] init failed', e))
}

/** Read a JSON request body with a size cap. */
function readBody(req, maxBytes = 64 * 1024) {
  return new Promise((resolve) => {
    let data = ''
    let done = false
    const finish = (value) => {
      if (done) return
      done = true
      resolve(value)
    }
    req.on('data', (chunk) => {
      data += chunk
      if (data.length > maxBytes) finish({})
    })
    req.on('end', () => {
      try {
        finish(data ? JSON.parse(data) : {})
      } catch (e) {
        finish({})
      }
    })
    req.on('error', () => finish({}))
  })
}

/** Send a JSON response. */
function sendJson(res, value, status = 200) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-cache',
  })
  res.end(body)
}

/** Summarize history entries for API/tool payloads. */
function summarize(items, limit = 100) {
  return items.slice(0, limit).map(x => ({ id: x.id, text: x.text, time: x.time }))
}

/** HTTP API consumed by the client panel (replaces dynamic `host.call`). */
function registerApi(ctx, state) {
  ctx.webServer.register({
    kind: 'prefix',
    path: '/clipboard-api',
    handler: async (req, res) => {
      try {
        await apiHandle(ctx, state, req, res)
      } catch (e) {
        try {
          sendJson(res, { ok: false, error: String(e && e.stack || e) }, 500)
        } catch (e2) {
          if (!res.headersSent) {
            res.writeHead(500)
            res.end()
          } else {
            res.destroy()
          }
        }
      }
    },
  })
}

/** Route one /clipboard-api request. */
async function apiHandle(ctx, state, req, res) {
  const url = new URL(req.url ?? '/', 'http://x')
  const method = (req.method ?? 'GET').toUpperCase()
  const pathname = url.pathname

  if (pathname === '/clipboard-api/list' && method === 'GET') {
    sendJson(res, { items: summarize(state.history) })
    return
  }
  if (pathname === '/clipboard-api/search' && method === 'GET') {
    const q = (url.searchParams.get('q') ?? '').toLowerCase()
    const items = q ? state.history.filter(x => x.text.toLowerCase().includes(q)) : state.history
    sendJson(res, { items: summarize(items) })
    return
  }
  if (pathname === '/clipboard-api/status' && method === 'GET') {
    sendJson(res, { paused: state.paused, count: state.history.length, current: state.lastClip.slice(0, 100) })
    return
  }
  if (pathname === '/clipboard-api/current' && method === 'GET') {
    sendJson(res, { text: await readClipboard(ctx, state) })
    return
  }
  if (pathname === '/clipboard-api/copy' && method === 'POST') {
    const args = await readBody(req)
    const id = String((args && args.id) || '')
    const item = state.history.find(x => x.id === id)
    if (!item) { sendJson(res, { ok: false, error: 'not found' }, 404); return }
    const ok = await writeClipboard(ctx, state, item.text)
    if (ok) state.lastClip = item.text
    sendJson(res, { ok })
    return
  }
  if (pathname === '/clipboard-api/delete' && method === 'POST') {
    const args = await readBody(req)
    const id = String((args && args.id) || '')
    const before = state.history.length
    state.history = state.history.filter(x => x.id !== id)
    if (state.history.length === before) { sendJson(res, { ok: false, error: 'not found' }, 404); return }
    await saveHistory(ctx, state)
    sendJson(res, { ok: true })
    return
  }
  if (pathname === '/clipboard-api/clear' && method === 'POST') {
    state.history = []
    await saveHistory(ctx, state)
    sendJson(res, { ok: true })
    return
  }
  if (pathname === '/clipboard-api/pause' && method === 'POST') {
    const args = await readBody(req)
    state.paused = !!(args && args.paused)
    sendJson(res, { paused: state.paused })
    return
  }
  sendJson(res, { ok: false, error: 'not found' }, 404)
}

/** Model-visible tools (static registration with `defineTool`). */
function registerTools(ctx, state) {
  ctx.tools.register(defineTool({
    name: 'clipboard_get',
    description: '读取系统剪贴板当前的文本内容。',
    parameters: {},
    output: { type: 'json' },
    execute: async () => {
      const text = await readClipboard(ctx, state)
      return { text }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'clipboard_history_search',
    description: '在剪贴板历史中按关键词搜索，返回最近的匹配条目（含文本与时间戳）。',
    parameters: {
      query: { type: 'string', required: true, description: '搜索关键词' },
      limit: { type: 'number', description: '返回条数上限，默认 10' },
    },
    output: { type: 'json' },
    execute: async (args) => {
      const q = String((args && args.query) || '').toLowerCase()
      const limit = Math.max(1, Math.min(Number((args && args.limit)) || 10, 50))
      const items = q
        ? state.history.filter(x => x.text.toLowerCase().includes(q))
        : state.history
      return { items: summarize(items, limit) }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'clipboard_copy',
    description: '把指定的文本写入系统剪贴板，用户粘贴时生效。',
    parameters: {
      text: { type: 'string', required: true, description: '要写入剪贴板的文本' },
    },
    output: { type: 'json' },
    execute: async (args) => {
      const text = String((args && args.text) || '')
      const ok = await writeClipboard(ctx, state, text)
      if (ok) {
        state.lastClip = text
        pushClip(ctx, state, text)
      }
      return { ok }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'clipboard_history_delete',
    description: '按 id 删除剪贴板历史中的一条记录。',
    parameters: {
      id: { type: 'string', required: true, description: '要删除的记录 id（来自 clipboard_history_search 的结果）' },
    },
    output: { type: 'json' },
    execute: async (args) => {
      const id = String((args && args.id) || '')
      const before = state.history.length
      state.history = state.history.filter(x => x.id !== id)
      if (state.history.length === before) return { ok: false }
      await saveHistory(ctx, state)
      return { ok: true }
    },
  }))
}
