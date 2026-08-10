import { defineBuildConfig } from 'obuild/config'

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
  ],
})
