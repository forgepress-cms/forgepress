import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { runMain } from 'citty'
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { version } from '../../package.json'
import { createCli } from '../../src/cli'

const scratch = fileURLToPath(new URL('../../node_modules/.forgepress-cli-test', import.meta.url))

const schema = `import type { ForgePressSchema } from 'forgepress'

export default {
  collections: {
    author: {
      fields: {
        name: { type: 'text' },
      },
    },
  },
} as const satisfies ForgePressSchema
`

function author(name: string): string {
  return [
    'import type { ForgePressEntry } from \'forgepress\'',
    '',
    'export default {',
    '  id: \'author_1\',',
    '  status: \'published\',',
    '  createdAt: \'2024-01-01T00:00:00Z\',',
    '  updatedAt: \'2024-01-01T00:00:00Z\',',
    `  name: ${name},`,
    '} satisfies ForgePressEntry<\'author\'>',
    '',
  ].join('\n')
}

function project(name = '\'Alice\''): string {
  rmSync(scratch, { recursive: true, force: true })
  mkdirSync(join(scratch, '.forgepress/content/author'), { recursive: true })
  mkdirSync(join(scratch, 'src'), { recursive: true })
  writeFileSync(join(scratch, '.forgepress/schema.ts'), schema)
  writeFileSync(join(scratch, '.forgepress/content/author/author_1.ts'), author(name))

  return scratch
}

async function command(args: string[], cwd = scratch): Promise<{ code: number, log: string, error: string }> {
  process.exitCode = undefined

  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

  await runMain(createCli(cwd), { rawArgs: args })

  const code = Number(exit.mock.calls.at(-1)?.[0] ?? process.exitCode ?? 0)
  const lines = (calls: unknown[][]): string => calls.map(call => call.join(' ')).join('\n')
  const result = { code, log: lines(log.mock.calls), error: lines(error.mock.calls) }

  vi.restoreAllMocks()

  return result
}

afterEach(() => {
  process.exitCode = undefined
  vi.restoreAllMocks()
  rmSync(scratch, { recursive: true, force: true })
})

describe('forgepress', () => {
  it('explains its commands', async () => {
    const help = await command(['--help'])

    expect(help).toMatchObject({ code: 0, error: '' })
    expect(help.log).toMatch(/check\s+Check the schema and all content the way the build does/)
    expect(help.log).toMatch(/build\s+Check the content, then write the content output/)
    expect((await command(['build', '--help'])).log).toContain('Check the content, then write the content output (forgepress build')
    expect(await command(['--version'])).toEqual({ code: 0, log: version, error: '' })
    expect(await command([])).toMatchObject({ code: 1, error: 'No command specified.' })
    expect(await command(['deploy'])).toMatchObject({ code: 1, error: 'Unknown command deploy' })
  })

  it('checks the content from anywhere inside the project', async () => {
    project()

    expect(await command(['check'], join(scratch, 'src'))).toEqual({ code: 0, log: 'No problems found', error: '' })
  })

  it('lists every problem and fails', async () => {
    project('42')

    const expected = { code: 1, log: '', error: '.forgepress/content/author/author_1.ts:8:3 Field "name" has to be a string\n\n1 problem found' }

    expect(await command(['check'])).toEqual(expected)
    expect(await command(['build'])).toEqual(expected)
    expect(existsSync(join(scratch, 'public/content'))).toBe(false)
  })

  it('builds the content output', async () => {
    project()

    const head = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { cwd: scratch, encoding: 'utf8' }).trim()

    expect(await command(['build'])).toEqual({ code: 0, log: `Wrote the content output to public/content (3 files, commit ${head})`, error: '' })
    expect(existsSync(join(scratch, 'public/content/index.json'))).toBe(true)
  })

  it('checks and builds a project that has no schema yet', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'forgepress-cli-empty-'))

    onTestFinished(() => rmSync(empty, { recursive: true, force: true }))
    mkdirSync(join(empty, 'src'))
    writeFileSync(join(empty, 'package.json'), '{}\n')

    expect(await command(['check'], join(empty, 'src'))).toEqual({ code: 0, log: 'No problems found', error: '' })
    expect((await command(['build'], join(empty, 'src'))).log).toMatch(/^Wrote the content output to public\/content \(1 file, /)
    expect(existsSync(join(empty, 'public/content/index.json'))).toBe(true)
  })

  it('reports other failures without a stack', async () => {
    project()
    writeFileSync(join(scratch, 'forgepress.config.mjs'), 'export default {\n')

    const result = await command(['check'])

    expect(result.code).toBe(1)
    expect(result.error).toContain('[forgepress] could not load forgepress.config.mjs')
    expect(result.error).not.toContain('    at ')
  })
})
