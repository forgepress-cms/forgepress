import type { ContentConfig } from '../../types/config/content'
import type { ContentWriter } from '../../types/content/writer'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { CONTENT_DIR, SCHEMA_FILE, toFileName } from '../paths'
import { serializeContent, serializeSchema } from '../serialize'

export function createWriter(root: string, config?: ContentConfig): ContentWriter {
  return {
    async writeSchema(schema) {
      await writeFile(join(root, SCHEMA_FILE), serializeSchema(schema, config))
    },

    async writeContent(component, rows) {
      const dir = join(root, CONTENT_DIR)

      await mkdir(dir, { recursive: true })

      await writeFile(join(dir, toFileName(component)), serializeContent(component, rows, config))
    },

    async removeContent(component) {
      await rm(join(root, CONTENT_DIR, toFileName(component)), { force: true })
    },
  }
}
