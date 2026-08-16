/**
 * dsh-clipboard-history — client half (browser bundle).
 *
 * Static bundle form: `__ModuleLoader__.load({id, factory})` wrapper, React
 * via `require("react")`, and the panel talks to the host half over the
 * `/clipboard-api` HTTP endpoints (no dynamic `host` builtin here).
 */
window.__ModuleLoader__.load({
  id: '@dsh-external/dsh-clipboard-history',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    let React = require('react')

    /* ── styles ──────────────────────────────────────────── */
    const STYLE_ID = 'dsh-clipboard-history-css'
    function mountStyles() {
      if (document.getElementById(STYLE_ID)) return
      const tag = document.createElement('style')
      tag.id = STYLE_ID
      tag.textContent = [
        '.cbhist-head-btn{display:inline-flex;align-items:center;gap:4px;border:none;background:transparent;',
        'color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:13px;padding:4px 8px;border-radius:8px;',
        'font-family:inherit;white-space:nowrap}',
        '.cbhist-head-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
        '.cbhist-head-btn[data-active]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
        '.cbhist-mask{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.35);',
        'display:flex;justify-content:flex-end;pointer-events:auto}',
        '.cbhist-panel{width:440px;max-width:92vw;height:100%;box-sizing:border-box;',
        'background:var(--dsw-alias-bg-overlay);border-left:1px solid var(--dsw-alias-border-l1);',
        'display:flex;flex-direction:column;pointer-events:auto}',
        '.cbhist-head{display:flex;align-items:center;gap:6px;padding:10px 12px;',
        'border-bottom:1px solid var(--dsw-alias-border-l1);font-size:13px;',
        'color:var(--dsw-alias-label-primary)}',
        '.cbhist-head .cbhist-title{font-weight:600;flex:1;white-space:nowrap}',
        '.cbhist-btn-sm{border:1px solid var(--dsw-alias-border-l1);background:transparent;',
        'color:var(--dsw-alias-label-secondary);border-radius:6px;padding:3px 8px;font-size:12px;cursor:pointer;',
        'font-family:inherit;white-space:nowrap}',
        '.cbhist-btn-sm:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
        '.cbhist-hint{padding:8px 12px 0;font-size:12px;color:var(--dsw-alias-label-secondary)}',
        '.cbhist-search{padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l1)}',
        '.cbhist-search input{width:100%;box-sizing:border-box;padding:6px 8px;border-radius:6px;',
        'border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);',
        'color:var(--dsw-alias-label-primary);font-size:13px;outline:none}',
        '.cbhist-search input:focus{border-color:var(--dsw-alias-brand-primary)}',
        '.cbhist-list{flex:1;overflow-y:auto;padding:6px}',
        '.cbhist-item{padding:8px 10px;border-radius:8px;margin-bottom:4px;',
        'border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);',
        'display:flex;align-items:flex-start;gap:8px}',
        '.cbhist-item:hover{border-color:var(--dsw-alias-border-l2)}',
        '.cbhist-item-body{flex:1;min-width:0;cursor:pointer}',
        '.cbhist-item .cbhist-text{font-size:13px;color:var(--dsw-alias-label-primary);',
        'white-space:pre-wrap;word-break:break-all;max-height:84px;overflow:hidden}',
        '.cbhist-item .cbhist-time{font-size:11px;color:var(--dsw-alias-label-secondary);margin-top:4px}',
        '.cbhist-actions{flex:none;display:flex;flex-direction:column;gap:4px;margin-top:2px}',
        '.cbhist-copy-btn{display:inline-flex;align-items:center;gap:4px;justify-content:center;',
        'border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);',
        'color:var(--dsw-alias-label-primary);border-radius:6px;padding:3px 10px;font-size:12px;cursor:pointer;',
        'font-family:inherit;white-space:nowrap}',
        '.cbhist-copy-btn:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l2)}',
        '.cbhist-copy-btn.cbhist-copied{border-color:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary)}',
        '.cbhist-del-btn{display:inline-flex;align-items:center;gap:4px;justify-content:center;',
        'border:1px solid var(--dsw-alias-border-l1);background:transparent;',
        'color:var(--dsw-alias-label-secondary);border-radius:6px;padding:3px 10px;font-size:12px;cursor:pointer;',
        'font-family:inherit;white-space:nowrap}',
        '.cbhist-del-btn:hover{background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}',
        '.cbhist-empty{padding:24px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:13px}',
        '.cbhist-notice{padding:4px 12px;font-size:12px;color:var(--dsw-alias-state-success-primary)}',
      ].join('')
      document.head.appendChild(tag)
    }
    function unmountStyles() {
      const tag = document.getElementById(STYLE_ID)
      if (tag) tag.remove()
    }

    /* ── host HTTP API helper (replaces dynamic `host.call`) ── */
    async function apiGet(path) {
      const res = await fetch(path)
      return parseJson(res)
    }
    async function apiPost(path, body) {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body || {}),
      })
      return parseJson(res)
    }
    async function parseJson(res) {
      let data = null
      try {
        data = await res.json()
      } catch (e) {
        data = null
      }
      if (!res.ok && data === null) {
        throw new Error('HTTP ' + res.status)
      }
      return data || {}
    }

    /* ── plugin ──────────────────────────────────────────── */
    function apply(ctx) {
      const slots = ctx.get('slots')
      if (slots === undefined) return

      let open = false
      const openListeners = new Set()
      function setOpen(v) {
        open = v
        openListeners.forEach(fn => fn())
      }
      function subscribeOpen(fn) {
        openListeners.add(fn)
        return () => openListeners.delete(fn)
      }

      ctx.effect(() => {
        mountStyles()
        return unmountStyles
      }, 'dsh-clipboard-history: styles')

      function ClipboardButton() {
        const [isOpen, setIsOpen] = React.useState(open)
        React.useEffect(() => subscribeOpen(() => setIsOpen(open)), [])
        return React.createElement('button', {
          className: 'cbhist-head-btn',
          type: 'button',
          'data-active': isOpen || undefined,
          'aria-label': '剪贴板历史',
          'aria-expanded': isOpen,
          onClick: () => setOpen(!open),
          title: '剪贴板历史',
        },
          React.createElement('span', { style: { fontSize: '13px', lineHeight: 1 } }, '📋'),
          React.createElement('span', null, ' 剪贴板'),
        )
      }

      function ClipboardPanel() {
        const [isOpen, setIsOpen] = React.useState(open)
        const [items, setItems] = React.useState([])
        const [q, setQ] = React.useState('')
        const [paused, setPaused] = React.useState(false)
        const [notice, setNotice] = React.useState('')
        const [copiedId, setCopiedId] = React.useState(null)
        const timer = ctx.get('timer')

        React.useEffect(() => subscribeOpen(() => setIsOpen(open)), [])

        function load(query) {
          const url = query
            ? '/clipboard-api/search?q=' + encodeURIComponent(query)
            : '/clipboard-api/list'
          return apiGet(url)
            .then(res => setItems((res && res.items) || []))
            .catch(() => { setItems([]); setNotice('加载失败，请确认插件已运行') })
        }

        React.useEffect(() => {
          if (!isOpen) return
          if (timer) {
            const d = timer.timeout(() => load(q), 250)
            return () => d()
          }
          load(q)
        }, [isOpen, q])

        React.useEffect(() => {
          if (!isOpen) return
          apiGet('/clipboard-api/status').then(r => {
            if (r) setPaused(!!r.paused)
          }).catch(() => {})
        }, [isOpen])

        if (!isOpen) return null

        const doCopy = (id) => {
          apiPost('/clipboard-api/copy', { id }).then(r => {
            if (r && r.ok) {
              setCopiedId(id)
              setNotice('已复制到剪贴板')
              if (timer) timer.timeout(() => setCopiedId(null), 1200)
            } else {
              setNotice('复制失败')
            }
          }).catch(() => setNotice('复制失败'))
        }
        const doDelete = (id) => {
          apiPost('/clipboard-api/delete', { id }).then(r => {
            if (r && r.ok) {
              setItems(prev => prev.filter(x => x.id !== id))
              setNotice('已删除该条记录')
            } else {
              setNotice('删除失败')
            }
          }).catch(() => setNotice('删除失败'))
        }
        const doClear = () => {
          apiPost('/clipboard-api/clear', {}).then(() => {
            setItems([])
            setNotice('已清空历史')
          }).catch(() => {})
        }
        const togglePause = () => {
          apiPost('/clipboard-api/pause', { paused: !paused }).then(r => {
            setPaused(!!(r && r.paused))
            setNotice(r && r.paused ? '已暂停监听' : '已恢复监听')
          }).catch(() => {})
        }

        const head = React.createElement('div', { className: 'cbhist-head' },
          React.createElement('span', { className: 'cbhist-title' }, '剪贴板历史'),
          React.createElement('button', { className: 'cbhist-btn-sm', onClick: togglePause }, paused ? '▶ 恢复' : '⏸ 暂停'),
          React.createElement('button', { className: 'cbhist-btn-sm', onClick: doClear }, '清空'),
          React.createElement('button', { className: 'cbhist-btn-sm', onClick: () => setOpen(false) }, '关闭'),
        )
        const hint = React.createElement('div', { className: 'cbhist-hint' },
          '提示：点击条目内容或「复制」按钮复制；「删除」移除该条',
        )
        const search = React.createElement('div', { className: 'cbhist-search' },
          React.createElement('input', {
            placeholder: '搜索剪贴板历史…',
            value: q,
            onChange: (e) => setQ(e.target.value),
          }),
        )
        const list = items.length
          ? React.createElement('div', { className: 'cbhist-list' },
              items.map(item => {
                const copied = copiedId === item.id
                const actions = React.createElement('div', { className: 'cbhist-actions' },
                  React.createElement('button', {
                    className: 'cbhist-copy-btn' + (copied ? ' cbhist-copied' : ''),
                    type: 'button',
                    onClick: (e) => { e.stopPropagation(); doCopy(item.id) },
                  }, copied ? '✓ 已复制' : '📋 复制'),
                  React.createElement('button', {
                    className: 'cbhist-del-btn',
                    type: 'button',
                    onClick: (e) => { e.stopPropagation(); doDelete(item.id) },
                    title: '删除该条',
                  }, '🗑 删除'),
                )
                return React.createElement('div', {
                  key: item.id,
                  className: 'cbhist-item',
                },
                  React.createElement('div', {
                    className: 'cbhist-item-body',
                    onClick: () => doCopy(item.id),
                    title: '点击复制',
                  },
                    React.createElement('div', { className: 'cbhist-text' }, item.text),
                    React.createElement('div', { className: 'cbhist-time' }, new Date(item.time).toLocaleString()),
                  ),
                  actions,
                )
              }),
            )
          : React.createElement('div', { className: 'cbhist-empty' }, '暂无剪贴板历史')
        const noticeEl = notice
          ? React.createElement('div', { className: 'cbhist-notice' }, notice)
          : null

        return React.createElement('div', { className: 'cbhist-mask', onClick: () => setOpen(false) },
          React.createElement('div', { className: 'cbhist-panel', onClick: (e) => e.stopPropagation() },
            head, hint, search, list, noticeEl,
          ),
        )
      }

      slots.inject('conversation.session.header.utilities', () => slots.register(
        { name: 'conversation.session.header.utilities', id: 'clipboard-history', order: 20, label: '剪贴板' },
        () => React.createElement(ClipboardButton),
      ))

      slots.inject('shell.overlay', () => slots.register(
        { name: 'shell.overlay', id: 'clipboard-history-panel', order: 20 },
        () => React.createElement(ClipboardPanel),
      ))
    }

    exports.apply = apply
    return module.exports
  },
})
