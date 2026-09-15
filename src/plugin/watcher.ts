import { existsSync, watch } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { parentPort, workerData } from 'node:worker_threads'

const { dir, schema } = workerData as { dir: string, schema: string }

function changed(file: string): void {
  parentPort?.postMessage(file)
}

function start(): boolean {
  if (!existsSync(dir))
    return false

  watch(dir, { recursive: true }, (_, name) => {
    if (name)
      changed(join(dir, name))
  })

  return true
}

if (!start() && existsSync(dirname(dir))) {
  const parent = watch(dirname(dir), (_, name) => {
    if (name !== basename(dir) || !start())
      return

    parent.close()
    changed(schema)
  })
}

parentPort?.postMessage(null)
