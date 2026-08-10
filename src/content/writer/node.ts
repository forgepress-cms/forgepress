import type { ContentConfig } from '../../types/config/content'
import type { ContentWriter } from '../../types/content/writer'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { CONTENT_DIR, SCHEMA_FILE, toFileName } from '../paths'
import { serializeContent, serializeSchema } from '../serialize'

export function createWriter(root: string, config?: ContentConfig): ContentWriter {
  return {
    async writeSchema(schema) {
      writeFileSync(join(root, SCHEMA_FILE), serializeSchema(schema, config))
    },
    async writeContent(component, rows) {
      const dir = join(root, CONTENT_DIR)
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, toFileName(component)), serializeContent(component, rows, config))
    },
  }
}
