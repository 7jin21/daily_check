const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { createRequire } = require('node:module')
const ts = require('typescript')

/** Load actual TS/TSX source with explicit dependency mocks; never write compiled files. */
function loadTs(relativePath, mocks = {}, globals = {}) {
  const root = path.resolve(__dirname, '..')
  const cache = new Map()
  function resolveSource(target) {
    for (const candidate of [target, `${target}.ts`, `${target}.tsx`, `${target}.js`, path.join(target, 'index.ts')]) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate
    }
    throw new Error(`Cannot resolve source: ${target}`)
  }
  function load(filename) {
    filename = resolveSource(filename)
    if (cache.has(filename)) return cache.get(filename).exports
    const module = { exports: {} }
    cache.set(filename, module)
    const nativeRequire = createRequire(filename)
    const localRequire = (id) => {
      if (Object.prototype.hasOwnProperty.call(mocks, id)) return mocks[id]
      if (id.startsWith('@/')) return load(path.join(root, id.slice(2)))
      if (id.startsWith('.')) return load(path.resolve(path.dirname(filename), id))
      return nativeRequire(id)
    }
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
      fileName: filename,
    }).outputText
    const context = vm.createContext({
      console, process, Buffer, URL, URLSearchParams, TextEncoder, TextDecoder,
      Request, Response, Headers, FormData, Blob, File, ReadableStream,
      AbortController, AbortSignal, DOMException, setTimeout, clearTimeout,
      setInterval, clearInterval, queueMicrotask, fetch, ...globals,
    })
    const wrapper = vm.runInContext(`(function(require,module,exports,__filename,__dirname){\n${code}\n})`, context, { filename })
    wrapper(localRequire, module, module.exports, filename, path.dirname(filename))
    return module.exports
  }
  return load(path.resolve(root, relativePath))
}

function deferred() {
  let resolve, reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

module.exports = { loadTs, deferred }
