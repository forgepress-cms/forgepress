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
        define: {
          'process.env.NODE_ENV': '"production"',
          '__VUE_OPTIONS_API__': 'false',
          '__VUE_PROD_DEVTOOLS__': 'false',
          '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': 'false',
        },
      },
    },
  ],
})
