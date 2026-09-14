import { defineBuildConfig } from 'obuild/config'

export default defineBuildConfig({
  entries: [
    {
      type: 'bundle',
      input: [
        './src/index.ts',
        './src/unplugin.ts',
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
