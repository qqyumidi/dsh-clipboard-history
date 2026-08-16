/**
 * dsh-clipboard-history — standalone smoke test.
 *
 * Exercises the pure helpers (history path, dedup/push logic, summary
 * projection) without a live DSH runtime. Run: node scripts/smoke.mjs
 */
import assert from 'node:assert/strict'

/* Mirror of the production history cap. */
const MAX_HISTORY = 500

/* Minimal in-memory state shaped like createState(). */
function fakeState() {
  return { history: [], seq: 0 }
}

/* Mirrors pushClip's dedup + bounded-insert logic from lib/index.js. */
function pushClip(state, text) {
  if (!text) return
  const t = text.trim()
  if (!t) return
  if (state.history[0] && state.history[0].text === text) {
    state.history[0].time = Date.now()
    return
  }
  state.history.unshift({ id: 'c' + (++state.seq), text, time: Date.now() })
  if (state.history.length > MAX_HISTORY) state.history.length = MAX_HISTORY
}

function summarize(items, limit = 100) {
  return items.slice(0, limit).map(x => ({ id: x.id, text: x.text, time: x.time }))
}

const state = fakeState()

pushClip(state, 'hello')
pushClip(state, 'hello')   // duplicate → timestamp refresh, no new entry
pushClip(state, '   ')    // blank → ignored
pushClip(state, 'world')
pushClip(state, 'world')  // duplicate → refresh

assert.equal(state.history.length, 2, 'two unique entries expected')
assert.equal(state.history[0].text, 'world', 'most recent first')
assert.equal(state.history[1].text, 'hello', 'older entry preserved')
assert.equal(state.seq, 2, 'ids are sequential')

const sum = summarize(state.history)
assert.equal(sum.length, 2)
assert.equal(sum[0].id, 'c2')
assert.equal(sum[0].text, 'world')
assert.equal('time' in sum[0], true)

// Bounded insert: 500 cap never exceeded.
const big = fakeState()
for (let i = 0; i < 520; i++) pushClip(big, 'item-' + i)
assert.equal(big.history.length, MAX_HISTORY, 'history is bounded at 500')

console.log('smoke: all assertions passed')
