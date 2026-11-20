import type { DiskWriter } from '../disk'
import type { Schema } from '../schema'
import type { MigrationState, SchemaChangeset } from '../store'
import { same } from '../utils'

export interface DevMigrations {
  state: () => MigrationState
  apply: (changeset: SchemaChangeset) => Promise<void>
  dismiss: () => void
  observe: (schema: Schema) => void
}

export function createMigrations(writer: DiskWriter): DevMigrations {
  let known: Schema | undefined
  let replaced: Schema | undefined
  let outstanding: Schema | undefined

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
