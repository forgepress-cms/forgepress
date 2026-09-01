import { defineBuildConfig } from 'obuild/config'

export default defineBuildConfig({
  entries: [
    {
      type: 'bundle',
      input: [
        './src/index.ts',
        './src/unplugin.ts',
        './src/content/source.ts',
        './src/content/reader/node.ts',
      ],
      dts: true,
      rolldown: {
        external: [/^virtual:/],
      },
    },
  ],
})
