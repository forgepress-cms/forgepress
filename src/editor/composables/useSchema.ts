import type { Ref } from 'vue'
import type { Collection } from '../../types/core/collection'
import type { ForgePressSchema } from '../../types/core/schema'
import { ref, toRaw } from 'vue'
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
  write: (mutate: (draft: SchemaDraft) => void | Promise<void>) => Promise<boolean>
}

function clone(schema: SchemaDraft | ForgePressSchema): SchemaDraft {
  return structuredClone(toRaw(schema)) as SchemaDraft
}

export async function useSchema(): Promise<SchemaEditor> {
  const { store } = useContent()
  const bundled = await store.schema()
  const schema = ref<SchemaDraft>(clone(bundled))

  const { saving, error, save } = useSave()

  async function write(mutate: (draft: SchemaDraft) => void | Promise<void>): Promise<boolean> {
    const next = clone(schema.value)

    const written = await save(async () => {
      await mutate(next)
      await store.writeSchema(next as unknown as ForgePressSchema)
    })

    if (!written)
      return false

    schema.value = next

    const collections = bundled.collections as Record<string, Collection>

    for (const key of Object.keys(collections))
      delete collections[key]

    Object.assign(collections, clone(next).collections)

    return true
  }

  return { schema, saving, error, write }
}
