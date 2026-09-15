import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { run, USAGE } from '../../src/cli'

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
  const log: string[] = []
  const error: string[] = []
  const code = await run(args, cwd, { log: message => log.push(message), error: message => error.push(message) })

  return { code, log: log.join('\n'), error: error.join('\n') }
}

afterEach(() => {
  rmSync(scratch, { recursive: true, force: true })
})

describe('forgepress', () => {
  it('explains its commands', async () => {
    expect(await command([])).toEqual({ code: 0, log: USAGE, error: '' })
    expect(await command(['--help'])).toEqual({ code: 0, log: USAGE, error: '' })
    expect(await command(['deploy'])).toEqual({ code: 1, log: '', error: `Unknown command "deploy"\n\n${USAGE}` })
    expect(await command(['build', '--out', 'dist'])).toEqual({ code: 1, log: '', error: `build takes no arguments\n\n${USAGE}` })
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
    rmSync(scratch, { recursive: true, force: true })
    mkdirSync(join(scratch, 'src'), { recursive: true })
    writeFileSync(join(scratch, 'package.json'), '{}\n')

    expect(await command(['check'], join(scratch, 'src'))).toEqual({ code: 0, log: 'No problems found', error: '' })
    expect((await command(['build'], join(scratch, 'src'))).log).toMatch(/^Wrote the content output to public\/content \(1 file, /)
    expect(existsSync(join(scratch, 'public/content/index.json'))).toBe(true)
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
