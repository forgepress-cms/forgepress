import { fileURLToPath } from 'node:url'
import { defineBuildConfig } from 'obuild/config'

const ENTRIES = [
  './src/index.ts',
  './src/preview/enable.ts',
  './src/preview/react.ts',
  './src/unplugin.ts',
  './src/plugin/nuxt.ts',
  './src/plugin/next.ts',
  './src/plugin/watcher.ts',
  './src/next/preview.ts',
  './src/next/reload.ts',
  './src/next/settings.ts',
  './src/disk/reader.ts',
  './src/query/fetch.ts',
  './src/cli/bin.ts',
]

const SOURCE = fileURLToPath(new URL('./src/', import.meta.url))
const LOADED_DIRECTLY = new Set(ENTRIES.map(entry => fileURLToPath(new URL(entry, import.meta.url))))

function hasSideEffects(id) {
  if (!id.startsWith(SOURCE) || id.endsWith('.d.ts'))
    return undefined

  return LOADED_DIRECTLY.has(id)
}

export default defineBuildConfig({
  entries: [
    {
      type: 'bundle',
      input: ENTRIES,
      dts: true,
      rolldown: {
        external: [/^virtual:/],
        treeshake: {
          moduleSideEffects: hasSideEffects,
        },
      },
    },
  ],
})
