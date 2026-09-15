import { build } from 'obuild'
import { build as buildEditor } from 'vite'
import config from '../build.config.mjs'

await build(config)
await buildEditor({ configFile: 'vite.editor.config.mjs', logLevel: 'warn' })
