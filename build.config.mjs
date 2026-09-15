import { defineBuildConfig } from 'obuild/config'

export default defineBuildConfig({
  entries: [
    {
      type: 'bundle',
      input: [
        './src/index.ts',
        './src/preview/index.ts',
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
      ],
      dts: true,
      rolldown: {
        external: [/^virtual:/],
      },
    },
  ],
})
