import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { Scanner } from '@tailwindcss/oxide'
import { defineBuildConfig } from 'obuild/config'
import { compile } from 'tailwindcss'
import Vue from 'unplugin-vue/rolldown'

const SUFFIX = '.css?inline'
const require = createRequire(import.meta.url)

async function loadStylesheet(id, base) {
  const file = id.startsWith('.') ? resolve(base, id) : require.resolve(`${id}/index.css`)
  return { base: dirname(file), path: file, content: await readFile(file, 'utf8') }
}

function Tailwind() {
  return {
    name: 'webenv:tailwind',

    resolveId(id, importer) {
      if (id.endsWith(SUFFIX) && importer)
        return resolve(dirname(importer), id)
    },

    async load(id) {
      if (!id.endsWith(SUFFIX))
        return

      const file = id.slice(0, -'?inline'.length)
      const compiler = await compile(await readFile(file, 'utf8'), { base: dirname(file), loadStylesheet })
      const css = compiler.build(new Scanner({ sources: compiler.sources }).scan())

      return `export default ${JSON.stringify(css)}`
    },
  }
}

export default defineBuildConfig({
  entries: [
    {
      type: 'bundle',
      input: [
        './src/index.ts',
        './src/unplugin.ts',
      ],
      dts: true,
      rolldown: {
        external: [/^virtual:/],
      },
    },
    {
      type: 'bundle',
      input: ['./src/editor/index.ts'],
      dts: true,
      minify: true,
      rolldown: {
        plugins: [Vue(), Tailwind()],
        external: [/^virtual:/],
        platform: 'browser',
      },
    },
  ],
})
