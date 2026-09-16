import { globSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { icons } from '@iconify-json/hugeicons'
import { describe, expect, it } from 'vitest'

const EDITOR = fileURLToPath(new URL('../../editor/', import.meta.url))
const ICON = /["'`]i-([a-z0-9]+)-([a-z0-9-]+)["'`]/g

function iconNames(): string[] {
  const files = globSync('**/*.{vue,ts,mjs}', { cwd: EDITOR, exclude: ['node_modules/**'] }).filter(file => !file.endsWith('.d.ts'))
  const names = files.flatMap(file => [...readFileSync(join(EDITOR, file), 'utf8').matchAll(ICON)].map(([, prefix, name]) => `${prefix}:${name}`))

  return [...new Set(names)]
}

describe('editor icons', () => {
  it('names only Hugeicons that exist, because the bundle carries no other icons', () => {
    const names = iconNames()
    const unknown = names.filter((name) => {
      const [prefix, icon = ''] = name.split(':')

      return prefix !== 'hugeicons' || !(icon in icons.icons || icon in (icons.aliases ?? {}))
    })

    expect(names.length).toBeGreaterThan(50)
    expect(unknown).toEqual([])
  })
})
