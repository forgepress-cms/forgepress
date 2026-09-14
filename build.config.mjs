import { defineBuildConfig } from 'obuild/config'

export default defineBuildConfig({
  entries: [
    {
      type: 'bundle',
      input: [
        './src/index.ts',
        './src/unplugin.ts',
        './src/store/bundle.ts',
        './src/disk/source.ts',
        './src/cli/bin.ts',
      ],
      dts: true,
      rolldown: {
        external: [/^virtual:/],
      },
    },
  ],
})
