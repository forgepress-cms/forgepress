import type { DiskWriter } from '../disk/writer'
import type { ForgePressSchema } from '../schema/types'
import type { MigrationState, SchemaChangeset } from '../store/types'
import { same } from '../utils/value'

export interface DevMigrations {
  state: () => MigrationState
  apply: (changeset: SchemaChangeset) => Promise<void>
  dismiss: () => void
  observe: (schema: ForgePressSchema) => void
}

export function createMigrations(writer: DiskWriter): DevMigrations {
  let known: ForgePressSchema | undefined
  let replaced: ForgePressSchema | undefined
  let outstanding: ForgePressSchema | undefined

  return {
    state: () => outstanding ? { outstanding } : {},

    apply: async (changeset) => {
      await writer.apply(changeset)

      replaced = known
      known = changeset.schema
      outstanding = undefined
    },

    dismiss: () => {
      outstanding = undefined
    },

    observe: (schema) => {
      if (replaced !== undefined && same(schema, replaced))
        return

      replaced = undefined

      if (known !== undefined && !same(schema, known))
        outstanding = outstanding !== undefined && same(schema, outstanding) ? undefined : outstanding ?? known

      known = schema
    },
  }
}
