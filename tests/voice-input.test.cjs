const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTs, deferred } = require('./helpers.cjs')

const flush = () => new Promise(setImmediate)
const sameDeps = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]))

function findElement(element, type) {
  if (!element || typeof element !== 'object') return null
  if (element.type === type) return element
  for (const child of [element.props?.children].flat()) {
    const found = findElement(child, type)
    if (found) return found
  }
  return null
}

// Exercise the actual TextStep callback and VoiceInputButton across renders and
// async media/network completion, without accessing a microphone or live API.
function createHarness({ delayedPermission = false } = {}) {
  const slots = []
  let cursor = 0
  let pendingEffects = []
  let text = 'original'
  let resultCalls = 0
  let stoppedTracks = 0
  const recorders = []
  const requests = []
  const timers = new Map()
  const permission = deferred()
  const stream = { getTracks: () => [{ stop() { stoppedTracks++ } }] }
  const react = {
    useState(initial) {
      const i = cursor++
      if (!(i in slots)) slots[i] = { value: initial }
      return [slots[i].value, (next) => { slots[i].value = typeof next === 'function' ? next(slots[i].value) : next }]
    },
    useRef(initial) {
      const i = cursor++
      if (!(i in slots)) slots[i] = { current: initial }
      return slots[i]
    },
    useEffect(create, deps) {
      const i = cursor++
      if (!slots[i] || !sameDeps(slots[i].deps, deps)) {
        pendingEffects.push(() => {
          slots[i]?.cleanup?.()
          slots[i] = { deps, cleanup: create() }
        })
      }
    },
    useCallback(callback, deps) {
      const i = cursor++
      if (!slots[i] || !sameDeps(slots[i].deps, deps)) slots[i] = { deps, callback }
      return slots[i].callback
    },
  }
  class MediaRecorder {
    static isTypeSupported() { return true }
    constructor(_stream, options) {
      this.state = 'inactive'
      this.mimeType = options?.mimeType || 'audio/webm'
      recorders.push(this)
    }
    start() { this.state = 'recording' }
    stop() {
      this.state = 'inactive'
      // Browser media events arrive asynchronously after stop().
      queueMicrotask(() => {
        this.ondataavailable?.({ data: new Blob(['recorded audio']) })
        this.onstop?.()
      })
    }
  }
  const Voice = loadTs('components/ui/VoiceInputButton.tsx', { react }, {
    MediaRecorder,
    navigator: { mediaDevices: { getUserMedia: () => delayedPermission ? permission.promise : Promise.resolve(stream) } },
    fetch: (_url, options) => {
      const response = deferred()
      requests.push({ ...options, response })
      // Intentionally ignore abort so late responses also exercise the result guard.
      return response.promise
    },
    setTimeout: (callback, ms) => { const id = {}; timers.set(id, { callback, ms }); return id },
    clearTimeout: (id) => timers.delete(id),
  }).default
  const VoicePlaceholder = () => null
  const TextStep = loadTs('components/checkin/TextStep.tsx', {
    '@/components/ui/VoiceInputButton': { __esModule: true, default: VoicePlaceholder },
  }).default
  function render() {
    const field = TextStep({ value: text, onChange: (next) => { resultCalls++; text = next } })
    const voiceProps = findElement(field, VoicePlaceholder).props
    cursor = 0
    const element = Voice(voiceProps)
    const effects = pendingEffects
    pendingEffects = []
    effects.forEach((effect) => effect())
    return element
  }
  render() // Mount support detection before interacting with the rendered button.
  return {
    button: () => findElement(render(), 'button'),
    type(value) { text = value; render() },
    reset() { text = '' },
    get text() { return text },
    get resultCalls() { return resultCalls },
    get stoppedTracks() { return stoppedTracks },
    recorders,
    requests,
    timers,
    grantPermission() { permission.resolve(stream) },
    unmount() { slots.forEach((slot) => slot?.cleanup?.()) },
  }
}

async function startAndStop(harness) {
  harness.button().props.onClick()
  await flush()
  assert.equal(harness.recorders[0].state, 'recording')
  harness.button().props.onClick()
  await flush()
  assert.equal(harness.requests.length, 1)
}

test('voice input appends the transcript, releases the microphone, and can record again', async () => {
  const h = createHarness()
  await startAndStop(h)
  assert.equal(h.button().props.disabled, true)
  assert.equal(h.stoppedTracks, 1)
  assert.equal(h.timers.size, 0)
  assert.equal(h.requests[0].body.get('audio').name, 'recording.webm')
  h.requests[0].response.resolve({ ok: true, json: async () => ({ text: 'spoken words' }) })
  await flush()
  assert.equal(h.text, 'original spoken words')
  assert.equal(h.button().props.disabled, false)
  h.button().props.onClick()
  await flush()
  assert.equal(h.recorders.length, 2)
  h.unmount()
  await flush()
  assert.equal(h.stoppedTracks, 2)
  assert.equal(h.requests.length, 1)
})

test('voice input preserves edits made both while recording and while transcribing', async () => {
  const h = createHarness()
  h.button().props.onClick()
  await flush()
  h.type('edited during recording')
  h.button().props.onClick()
  await flush()
  h.type('latest edit during transcription')
  h.requests[0].response.resolve({ ok: true, json: async () => ({ text: 'spoken words' }) })
  await flush()
  assert.equal(h.text, 'latest edit during transcription spoken words')
  assert.equal(h.resultCalls, 1)
  h.unmount()
})

test('leaving the input aborts transcription and a late response cannot restore reset text', async () => {
  const h = createHarness()
  await startAndStop(h)
  h.unmount()
  h.reset()
  assert.equal(h.requests[0].signal.aborted, true)
  h.requests[0].response.resolve({ ok: true, json: async () => ({ text: 'private words' }) })
  await flush()
  assert.equal(h.resultCalls, 0)
  assert.equal(h.text, '')
})

test('leaving while reading the response body also discards the transcript', async () => {
  const h = createHarness()
  const body = deferred()
  await startAndStop(h)
  h.requests[0].response.resolve({ ok: true, json: () => body.promise })
  await flush()
  h.unmount()
  h.reset()
  body.resolve({ text: 'private words' })
  await flush()
  assert.equal(h.resultCalls, 0)
  assert.equal(h.text, '')
})

test('microphone permission arriving after navigation releases the stream without recording', async () => {
  const h = createHarness({ delayedPermission: true })
  h.button().props.onClick()
  h.unmount()
  h.grantPermission()
  await flush()
  assert.equal(h.stoppedTracks, 1)
  assert.equal(h.recorders.length, 0)
  assert.equal(h.requests.length, 0)
})
