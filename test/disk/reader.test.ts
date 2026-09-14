import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { locateOutput } from '../../src/disk/locate'
import { diskReader } from '../../src/disk/reader'

const scratch = fileURLToPath(new URL('../../node_modules/.forgepress-reader-output-test', import.meta.url))

function write(path: string, text: string): void {
  mkdirSync(join(scratch, path, '..'), { recursive: true })
  writeFileSync(join(scratch, path), text)
}

afterEach(() => {
  rmSync(scratch, { recursive: true, force: true })
})

describe('diskReader', () => {
  it('reads output files from the folder and has nothing for missing ones', async () => {
    write('public/content/index.json', '{"version":1}')
    mkdirSync(join(scratch, 'public/content/author'), { recursive: true })

    const read = diskReader(async () => join(scratch, 'public/content'))

    expect(await read('index.json')).toEqual({ version: 1 })
    expect(await read('author/index.1234abcd.json')).toBeUndefined()
    await expect(read('author')).rejects.toThrow()
  })

  it('finds the output folder of the project it runs in', async () => {
    write('.forgepress/schema.ts', 'export default { collections: {} }\n')
    mkdirSync(join(scratch, 'src/pages'), { recursive: true })

    expect(await locateOutput(join(scratch, 'src/pages'))).toBe(join(scratch, 'public/content'))

    write('forgepress.config.mjs', 'export default { output: { dir: \'dist/content\' } }\n')

    expect(await locateOutput(join(scratch, 'src/pages'))).toBe(join(scratch, 'dist/content'))
  })
})
