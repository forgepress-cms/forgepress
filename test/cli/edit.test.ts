import type { Editor } from '../../src/cli/edit'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { edit } from '../../src/cli/edit'
import { resolveConfig } from '../../src/config/resolve'

const scratch = fileURLToPath(new URL('../../node_modules/.forgepress-edit-test', import.meta.url))
const assets = join(scratch, 'bundle')

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

const author = `export default {
  id: 'author_1',
  status: 'published',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  name: 'Alice',
}
`

let editor: Editor | undefined

function project(): void {
  rmSync(scratch, { recursive: true, force: true })
  mkdirSync(join(scratch, '.forgepress/content/author'), { recursive: true })
  mkdirSync(join(scratch, 'public/uploads'), { recursive: true })
  mkdirSync(assets, { recursive: true })
  writeFileSync(join(scratch, '.forgepress/schema.ts'), schema)
  writeFileSync(join(scratch, '.forgepress/content/author/author_1.ts'), author)
  writeFileSync(join(scratch, 'public/uploads/photo.png'), 'png')
  writeFileSync(join(assets, 'index.mjs'), 'export const mountEditor = () => {}\n')
  writeFileSync(join(assets, 'vue.mjs'), 'export const version = "3"\n')
}

async function start(): Promise<string> {
  project()

  editor = await edit(scratch, resolveConfig({}), { port: 0, assets, log: () => {} })

  return editor.url
}

afterEach(async () => {
  await editor?.close()
  editor = undefined
  rmSync(scratch, { recursive: true, force: true })
})

describe('forgepress edit', () => {
  it('serves the editor, its settings and the content endpoint', async () => {
    const base = await start()
    const page = await fetch(base)

    expect(page.headers.get('content-type')).toContain('text/html')
    expect(await page.text()).toContain('mountEditor()')

    const settings = await (await fetch(`${base}/@forgepress/settings.mjs`)).text()

    expect(settings).toContain('"local":true')
    expect(settings).toContain('"contentPath":".forgepress"')

    expect(await (await fetch(`${base}/@forgepress/editor.mjs`)).text()).toContain('mountEditor')
    expect(await (await fetch(`${base}/@forgepress/vue.mjs`)).text()).toContain('version')

    const content = await (await fetch(`${base}/__forgepress/content`)).json() as Record<string, unknown[]>

    expect(content.author).toHaveLength(1)
  })

  it('serves uploaded media and refuses paths outside it', async () => {
    const base = await start()

    expect(await (await fetch(`${base}/uploads/photo.png`)).text()).toBe('png')
    expect((await fetch(`${base}/uploads/../../.forgepress/schema.ts`)).status).toBe(200)
    expect(await (await fetch(`${base}/uploads/../../.forgepress/schema.ts`)).text()).toContain('mountEditor()')
  })

  it('serves every other address as the editor page', async () => {
    const base = await start()

    expect(await (await fetch(`${base}/?path=/schema`)).text()).toContain('id="forgepress"')
    expect((await fetch(`${base}/@forgepress/missing.mjs`)).status).toBe(404)
  })

  it('tells the page to reload when a file changes', async () => {
    const base = await start()
    const stream = await fetch(`${base}/@forgepress/reload`)
    const reader = stream.body!.getReader()
    const read = async (): Promise<string> => new TextDecoder().decode((await reader.read()).value)

    expect(await read()).toContain(': ready')

    writeFileSync(join(scratch, '.forgepress/content/author/author_1.ts'), author.replace('Alice', 'Ada'))

    expect(await read()).toContain('data: reload')

    await reader.cancel()
  })

  it('starts in a folder that holds no content yet', async () => {
    project()
    rmSync(join(scratch, '.forgepress'), { recursive: true, force: true })

    editor = await edit(scratch, resolveConfig({}), { port: 0, assets, log: () => {} })

    expect(await (await fetch(`${editor.url}/__forgepress/content`)).json()).toEqual({})
    expect((await fetch(editor.url)).status).toBe(200)
  })

  it('writes an entry through the endpoint and reloads', async () => {
    const base = await start()
    const entry = { id: 'author_2', status: 'published', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z', name: 'Bob' }

    const written = await fetch(`${base}/__forgepress/entry/author/author_2`, { method: 'POST', body: JSON.stringify(entry) })

    expect(written.status).toBe(204)

    const content = await (await fetch(`${base}/__forgepress/content`)).json() as Record<string, unknown[]>

    expect(content.author).toHaveLength(2)
  })
})
