import type { Ref } from 'vue'
import type { SchemaWriter } from '../../store/types'
import type { Collection, ForgePressSchema } from '../../types/schema'
import { ref, toRaw } from 'vue'
import { validateSchema } from '../../schema/validate'
import { useContent } from './useContent'
import { useSave } from './useSave'

export interface SchemaDraft {
  collections: Record<string, Collection>
  locales?: readonly string[]
}

export interface SchemaEditor {
  schema: Ref<SchemaDraft>
  saving: Ref<boolean>
  error: Ref<string>
  write: (mutate: (draft: SchemaDraft) => void, apply?: (writer: SchemaWriter) => Promise<void>) => Promise<boolean>
}

function clone(schema: SchemaDraft | ForgePressSchema): SchemaDraft {
  return structuredClone(toRaw(schema)) as SchemaDraft
}

async function writable(): Promise<SchemaWriter> {
  const writer = await useContent().schemaWriter()

  if (!writer)
    throw new Error('[forgepress] the schema can only be edited in development, since the site build depends on it')

  return writer
}

export async function useSchema(): Promise<SchemaEditor> {
  const { store } = useContent()
  const writer = await writable()
  const schema = ref<SchemaDraft>(clone(await store.schema()))

  const { saving, error, save } = useSave()

  async function write(mutate: (draft: SchemaDraft) => void, apply?: (writer: SchemaWriter) => Promise<void>): Promise<boolean> {
    const next = clone(schema.value)

    const written = await save(async () => {
      mutate(next)

      const issues = validateSchema(next)

      if (issues.length > 0)
        throw new Error(issues.map(issue => issue.message).join('\n'))

      await apply?.(writer)
      await writer.writeSchema(next as unknown as ForgePressSchema)
    })

    if (written)
      schema.value = next

    return written
  }

  return { schema, saving, error, write }
}
