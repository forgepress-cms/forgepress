import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadConfig } from '../../src/disk/config'

let scratch: string | undefined

function project(files: Record<string, string> = {}): string {
  scratch ??= mkdtempSync(join(tmpdir(), 'forgepress-config-'))

  for (const [file, text] of Object.entries(files))
    writeFileSync(join(scratch, file), text)

  return scratch
}

afterEach(() => {
  vi.restoreAllMocks()

  if (scratch)
    rmSync(scratch, { recursive: true, force: true })

  scratch = undefined
})

describe('loadConfig', () => {
  it('has no config without a config file', async () => {
    expect(await loadConfig(project())).toBeUndefined()
  })

  it('loads a config written in TypeScript before a JavaScript one', async () => {
    const root = project({
      'forgepress.config.mjs': 'export default { path: \'javascript\' }\n',
      'forgepress.config.ts': 'import type { ForgePressConfig } from \'forgepress\'\n\nconst path: string = \'typescript\'\n\nexport default { path } satisfies ForgePressConfig\n',
    })

    expect(await loadConfig(root)).toEqual({ path: 'typescript' })
  })

  it('reads a changed config again, like a restarted dev server needs', async () => {
    const root = project({ 'forgepress.config.mjs': 'export default { path: \'before\' }\n' })

    expect(await loadConfig(root)).toEqual({ path: 'before' })

    project({ 'forgepress.config.mjs': 'export default { path: \'after\' }\n' })

    expect(await loadConfig(root)).toEqual({ path: 'after' })
  })

  it('says which Node.js runs a TypeScript config when the current one cannot', async () => {
    vi.spyOn(process.features, 'typescript', 'get').mockReturnValue(false)

    const root = project({ 'forgepress.config.ts': 'export default {\n' })

    await expect(loadConfig(root)).rejects.toThrow(`[forgepress] could not load forgepress.config.ts: Node.js ${process.versions.node} can't run TypeScript. Use Node.js 22.18 or newer, or write the config as forgepress.config.mjs`)
  })

  it('reports a broken config with the reason', async () => {
    const root = project({ 'forgepress.config.ts': 'export default {\n' })

    await expect(loadConfig(root)).rejects.toThrow(/^\[forgepress\] could not load forgepress\.config\.ts: (?!Node\.js)/)
  })
})
