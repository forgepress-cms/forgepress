import { spawn } from 'node:child_process'
import { watch } from 'node:fs'
import { cp, mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { debounce } from 'perfect-debounce'
import { build as buildEditor } from 'vite'
import config from '../build.config.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST = join(ROOT, 'dist')
const WINDOWS = process.platform === 'win32'

const [target, ...args] = process.argv.slice(2)
const env = { ...process.env }

process.env.CONSOLA_LEVEL ??= '1'

const { build } = await import('obuild')

let child
let restarting = false

function log(message) {
  process.stdout.write(`[forgepress] ${message}\n`)
}

async function files(dir) {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true }).catch(() => [])

  return entries.filter(entry => entry.isFile()).map(entry => relative(dir, join(entry.parentPath, entry.name)))
}

async function buildLibrary() {
  const out = await mkdtemp(join(tmpdir(), 'forgepress-dev-'))

  try {
    await build({ ...config, entries: config.entries.map(entry => ({ ...entry, outDir: out, license: false })) })

    const built = await files(out)
    const changed = []

    for (const file of built) {
      const next = await readFile(join(out, file))
      const current = await readFile(join(DIST, file)).catch(() => undefined)

      if (current?.equals(next))
        continue

      await mkdir(dirname(join(DIST, file)), { recursive: true })
      await cp(join(out, file), join(DIST, file))
      changed.push(file)
    }

    for (const file of await files(DIST)) {
      if (file.endsWith('.mjs') && !file.startsWith(`editor${sep}`) && !built.includes(file)) {
        await rm(join(DIST, file))
        changed.push(file)
      }
    }

    return changed
  }
  finally {
    await rm(out, { recursive: true, force: true })
  }
}

async function watchEditor() {
  const watcher = await buildEditor({
    configFile: join(ROOT, 'editor/vite.config.mjs'),
    logLevel: 'warn',
    build: { watch: {} },
  })

  return new Promise((resolve, reject) => {
    let ready = false

    watcher.on('event', (event) => {
      if (event.code === 'BUNDLE_END')
        event.result?.close?.()

      if (event.code === 'ERROR') {
        if (ready)
          console.error(`[forgepress] the editor failed to build: ${event.error.message}`)
        else
          reject(event.error)
      }

      if (event.code === 'END' && ready)
        log('rebuilt the editor')

      if (event.code === 'END' && !ready) {
        ready = true
        resolve(watcher)
      }
    })
  })
}

function start() {
  child = spawn('pnpm', ['--filter', target, 'run', 'dev', ...args], {
    cwd: ROOT,
    env,
    stdio: ['ignore', 'inherit', 'inherit'],
    detached: !WINDOWS,
    shell: WINDOWS,
  })

  child.once('exit', (code) => {
    if (!restarting)
      void shutdown(code ?? 1)
  })
}

function stop() {
  if (!child || child.exitCode !== null || child.signalCode !== null)
    return Promise.resolve()

  const exited = new Promise(resolve => child.once('exit', resolve))

  if (WINDOWS)
    spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'])
  else
    process.kill(-child.pid, 'SIGTERM')

  return exited
}

const rebuild = debounce(async () => {
  try {
    const changed = await buildLibrary()

    if (!changed.some(file => file.endsWith('.mjs')))
      return

    if (!target)
      return log('rebuilt the library')

    log(`rebuilt the library, restarting ${target}`)

    restarting = true
    await stop()
    restarting = false
    start()
  }
  catch (error) {
    console.error(`[forgepress] the library failed to build: ${error instanceof Error ? error.message : error}`)
  }
}, 100)

const [editor] = await Promise.all([watchEditor(), buildLibrary()])
const sources = watch(join(ROOT, 'src'), { recursive: true }, () => void rebuild())

async function shutdown(code = 0) {
  restarting = true
  sources.close()
  await editor.close()
  await stop()
  process.exit(code)
}

process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())

log(target ? `built the library and the editor, starting ${target}` : 'built the library and the editor, watching for changes')

if (target)
  start()
