import type { Ref } from 'vue'
import type { Component } from '../../types/core/component'
import type { WebenvSchema } from '../../types/core/schema'
import { ref, toRaw } from 'vue'
import { useContent } from './useContent'
import { useSave } from './useSave'

export interface SchemaDraft {
  components: Record<string, Component>
  locales?: readonly string[]
}

export interface SchemaEditor {
  schema: Ref<SchemaDraft>
  saving: Ref<boolean>
  error: Ref<string>
  write: (mutate: (draft: SchemaDraft) => void | Promise<void>) => Promise<boolean>
}

function clone(schema: SchemaDraft | WebenvSchema): SchemaDraft {
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
      await store.writeSchema(next as unknown as WebenvSchema)
    })

    if (!written)
      return false

    schema.value = next

    const components = bundled.components as Record<string, Component>

    for (const key of Object.keys(components))
      delete components[key]

    Object.assign(components, clone(next).components)

    return true
  }

  return { schema, saving, error, write }
}
