import type { ComputedRef, Ref, ShallowRef } from 'vue'
import type { Entry } from '../../src/entries/types'
import type { SchemaDraft } from '../../src/migrate/schema'
import type { Fill, Fix, Migration, RenameQuestion, Renames } from '../../src/migrate/types'
import type { ForgePressSchema } from '../../src/schema/types'
import type { MigrationState, SchemaStore } from '../../src/store/types'
import { computed, reactive, ref, shallowRef } from 'vue'
import { planMigration } from '../../src/migrate/plan'
import { renameQuestions } from '../../src/migrate/questions'
import { validateSchema } from '../../src/schema/validate'
import { plain } from '../../src/utils/value'
import { useContent } from './useContent'
import { useSave } from './useSave'

export const REMOVE = '-'

export interface Choices {
  answers: Record<string, string>
  fills: Record<string, Record<string, Fill>>
  fixes: Record<string, Record<string, Fix>>
  create: Record<string, string[]>
}

export interface Review {
  before: ForgePressSchema
  after: ForgePressSchema
  choices: Choices
  questions: ComputedRef<RenameQuestion[]>
  renames: ComputedRef<Renames>
  undecided: ComputedRef<Migration>
  migration: ComputedRef<Migration>
  ready: ComputedRef<boolean>
  saving: Ref<boolean>
  error: Ref<string>
  apply: () => Promise<void>
  cancel: () => void
}

export interface SchemaEditor {
  schema: Ref<ForgePressSchema>
  state: Ref<MigrationState>
  saving: Ref<boolean>
  error: Ref<string>
  review: ShallowRef<Review | undefined>
  change: (mutate: (draft: SchemaDraft) => void, renames?: Renames) => Promise<boolean>
  content: () => Promise<Record<string, Entry[]>>
  mismatch: () => Promise<number>
  repair: () => Promise<boolean>
  dismiss: () => Promise<void>
}

interface Opened extends Review {
  result: Promise<boolean>
}

const review = shallowRef<Review>()

export function questionKey(question: RenameQuestion): string {
  return [question.kind, question.collection ?? question.component ?? '', question.from].join('/')
}

function answered(base: Renames, questions: readonly RenameQuestion[], answers: Readonly<Record<string, string>>): Renames {
  const collections = { ...base.collections }
  const fields = Object.fromEntries(Object.entries(base.fields ?? {}).map(([collection, renamed]) => [collection, { ...renamed }]))
  const locales = { ...base.locales }
  const components = { ...base.components }
  const componentFields = Object.fromEntries(Object.entries(base.componentFields ?? {}).map(([component, renamed]) => [component, { ...renamed }]))

  for (const question of questions) {
    const answer = answers[questionKey(question)]

    if (answer === undefined || answer === REMOVE)
      continue

    if (question.kind === 'collection')
      collections[question.from] = answer
    else if (question.kind === 'component')
      components[question.from] = answer
    else if (question.kind === 'locale')
      locales[question.from] = answer
    else if (question.component !== undefined)
      (componentFields[question.component] ??= {})[question.from] = answer
    else
      (fields[question.collection!] ??= {})[question.from] = answer
  }

  return { collections, fields, locales, components, componentFields }
}

function open(store: SchemaStore, before: ForgePressSchema, after: ForgePressSchema, content: Record<string, Entry[]>, base: Renames, repair: boolean): Opened {
  const choices = reactive<Choices>({ answers: {}, fills: {}, fixes: {}, create: {} })
  const input = { before, after, content, repair }
  const { saving, error, save } = useSave()

  let settle: (applied: boolean) => void = () => {}

  const result = new Promise<boolean>((resolve) => {
    settle = resolve
  })

  const questions = computed(() => {
    if (!repair)
      return []

    const collections = renameQuestions({ ...input, renames: base }).filter(question => question.kind === 'collection' || question.kind === 'component')
    const named = answered(base, collections, choices.answers)
    const fields = renameQuestions({ ...input, renames: named }).filter(question => question.kind === 'field')
    const moved = answered(named, fields, choices.answers)
    const locales = renameQuestions({ ...input, renames: moved }).filter(question => question.kind === 'locale')

    return [...collections, ...fields, ...locales]
  })

  const renames = computed(() => answered(base, questions.value, choices.answers))
  const undecided = computed(() => planMigration({ ...input, renames: renames.value }))
  const migration = computed(() => planMigration({ ...input, renames: renames.value, decisions: choices }))
  const ready = computed(() => migration.value.blocked.length === 0 && questions.value.every(question => choices.answers[questionKey(question)] !== undefined))

  return {
    before,
    after,
    choices,
    questions,
    renames,
    undecided,
    migration,
    ready,
    saving,
    error,
    result,

    apply: async () => {
      if (!ready.value || saving.value)
        return

      if (await save(() => store.apply(migration.value.changeset))) {
        review.value = undefined
        settle(true)
      }
    },

    cancel: () => {
      if (saving.value)
        return

      review.value = undefined
      settle(false)
    },
  }
}

function needsReview(opened: Review): boolean {
  const { blocked, effects } = opened.undecided.value

  return opened.questions.value.length > 0 || blocked.length > 0 || effects.some(effect => effect.kind !== 'converted')
}

async function writable(): Promise<SchemaStore> {
  const store = await useContent().schemaStore()

  if (!store)
    throw new Error('[forgepress] the schema can only be edited in development, since the site build depends on it')

  return store
}

export async function useSchema(): Promise<SchemaEditor> {
  const { store } = useContent()
  const target = await writable()
  const [current, found] = await Promise.all([store.schema(), target.state()])
  const schema = ref<ForgePressSchema>(plain(current))
  const state = ref<MigrationState>(found)

  const { saving, error, save } = useSave()

  async function content(): Promise<Record<string, Entry[]>> {
    return target.content()
  }

  async function start(before: ForgePressSchema, after: ForgePressSchema, renames: Renames, repair: boolean): Promise<boolean> {
    let loaded: Record<string, Entry[]> = {}

    if (!await save(async () => {
      loaded = await content()
    })) {
      return false
    }

    const opened = open(target, before, after, loaded, renames, repair)

    const applied = needsReview(opened)
      ? await (review.value = opened).result
      : await save(() => target.apply(opened.migration.value.changeset))

    if (applied)
      schema.value = plain(after)

    return applied
  }

  return {
    schema,
    state,
    saving,
    error,
    review,
    content,

    change: async (mutate, renames = {}) => {
      const draft = plain(schema.value) as SchemaDraft

      mutate(draft)

      const issues = validateSchema(draft)

      if (issues.length > 0) {
        error.value = issues.map(issue => issue.message).join('\n')

        return false
      }

      return start(plain(schema.value), draft as ForgePressSchema, renames, false)
    },

    mismatch: async () => {
      const opened = open(target, plain(state.value.outstanding ?? schema.value), plain(schema.value), await content(), {}, true)
      const count = new Set(opened.migration.value.effects.map(effect => `${effect.collection}/${effect.id}`)).size

      if (count === 0 && state.value.outstanding) {
        await target.dismiss()
        state.value = await target.state()
      }

      return count
    },

    repair: () => start(plain(state.value.outstanding ?? schema.value), plain(schema.value), {}, true),

    dismiss: async () => {
      await target.dismiss()
      state.value = await target.state()
    },
  }
}
