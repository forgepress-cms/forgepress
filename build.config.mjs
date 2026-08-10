import { defineBuildConfig } from 'obuild/config'
import Vue from 'unplugin-vue/rolldown'

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
        plugins: [Vue()],
        external: [/^virtual:/],
        platform: 'browser',
      },
    },
  ],
})
