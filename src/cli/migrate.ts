import type { ResolvedConfig } from '../config/resolve'
import type { EffectGroup } from '../migrate/report'
import type { Fill, Fix, Migration, RenameQuestion } from '../migrate/types'
import type { ForgePressSchema } from '../schema/types'
import { execFileSync } from 'node:child_process'
import { diskFiles } from '../disk/files'
import { createWriter } from '../disk/writer'
import { createFileSource, readEntries } from '../files/content'
import { parseSchemaFile } from '../files/parse'
import { planMigration } from '../migrate/plan'
import { renameQuestions } from '../migrate/questions'
import { describeValue, fillOptions, fixOptions, groupCount, groupEffects, groupTitle, questionText, renameHints } from '../migrate/report'

export interface Ask {
  select: (message: string, options: { label: string, value: string }[]) => Promise<string>
  text: (message: string) => Promise<string>
  confirm: (message: string, initial: boolean) => Promise<boolean>
}

export interface MigrateOptions {
  ask: Ask | undefined
  yes: boolean
  log: (message: string) => void
}

const REMOVE = '-'
const EXAMPLES = 3

function committedSchema(root: string, path: string): ForgePressSchema | undefined {
  try {
    const text = execFileSync('git', ['show', `HEAD:./${path}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    const parsed = parseSchemaFile({ path, text })

    return 'schema' in parsed ? parsed.schema : undefined
  }
  catch {
    return undefined
  }
}

function questionKey(question: RenameQuestion): string {
  return [question.kind, question.collection ?? '', question.from].join('/')
}

async function fill(ask: Ask, schema: ForgePressSchema, group: EffectGroup, title: string): Promise<Fill> {
  const options = fillOptions(schema, group)
  const type = await ask.select(`${title} needs a value in ${groupCount(group)}. What should they get?`, options.types)

  if (type === 'value')
    return { type, value: await ask.text(`Value for ${title}`) }

  if (type === 'locale')
    return { type, locale: await ask.select(`Copy which locale into ${title}?`, options.locales) }

  if (type === 'field' || type === 'slug')
    return { type, field: await ask.select(`Use which field for ${title}?`, type === 'slug' ? options.texts : options.fields) }

  return { type: 'empty' }
}

function report(migration: Migration, before: ForgePressSchema, after: ForgePressSchema, log: (message: string) => void): void {
  const sections: [string, EffectGroup[]][] = [
    ['Removed', groupEffects(migration.effects, ['removed', 'lost'])],
    ['Without a matching entry', groupEffects(migration.effects, ['unmatched'])],
    ['Still empty', groupEffects(migration.effects, ['missing'], false)],
    ['Breaking the rules', groupEffects(migration.effects, ['invalid'], false)],
    ['Created', groupEffects(migration.effects, ['created'])],
    ['Changed without losing anything', groupEffects(migration.effects, ['converted'], false)],
  ]

  for (const [heading, groups] of sections.filter(([, found]) => found.length > 0)) {
    log(`\n${heading}:`)

    for (const group of groups) {
      log(`  ${groupTitle(group, after, before)}: ${groupCount(group)}`)

      if (group.kind === 'converted' || group.kind === 'created')
        continue

      for (const effect of group.effects.slice(0, EXAMPLES))
        log(`    ${describeValue(effect.title, 40)}${effect.kind === 'removed' ? '' : `: ${describeValue(effect.message ?? effect.before, 50)}`}`)

      if (group.effects.length > EXAMPLES)
        log(`    and ${group.effects.length - EXAMPLES} more`)
    }
  }
}

export async function migrate(root: string, config: ResolvedConfig, { ask, yes, log }: MigrateOptions): Promise<void> {
  const files = diskFiles(root)
  const after = await createFileSource(files, config.paths).schema()
  const content = await readEntries(files, config.paths)
  const before = committedSchema(root, config.paths.schema) ?? after
  const renames = { collections: {} as Record<string, string>, fields: {} as Record<string, Record<string, string>>, locales: {} as Record<string, string> }
  const answered = new Set<string>()

  for (;;) {
    const question = renameQuestions({ before, after, content, renames, repair: true }).find(item => !answered.has(questionKey(item)))

    if (!question)
      break

    if (!ask)
      throw new Error(`[forgepress] ${questionText(question, after, before)} Run forgepress migrate in a terminal to say whether it was renamed.`)

    const answer = await ask.select(questionText(question, after, before), [
      ...question.to.map(target => ({ label: `Renamed to ${target}`, value: target })),
      { label: 'Removed', value: REMOVE },
    ])

    answered.add(questionKey(question))

    if (answer === REMOVE)
      continue

    if (question.kind === 'collection')
      renames.collections[question.from] = answer
    else if (question.kind === 'locale')
      renames.locales[question.from] = answer
    else
      (renames.fields[question.collection!] ??= {})[question.from] = answer
  }

  const decisions = { fills: {} as Record<string, Record<string, Fill>>, fixes: {} as Record<string, Record<string, Fix>>, create: {} as Record<string, string[]> }
  const plan = (): Migration => planMigration({ before, after, content, renames, decisions, repair: true })

  let migration = plan()

  if (migration.blocked.length > 0)
    throw new Error(`[forgepress] the content can't be migrated:\n${migration.blocked.join('\n')}`)

  if (migration.changeset.write.length === 0 && migration.changeset.collections.length === 0)
    return log('The content fits the schema, nothing to migrate')

  if (ask) {
    for (const group of groupEffects(migration.effects, ['missing'], false))
      (decisions.fills[group.collection] ??= {})[group.field!] = await fill(ask, after, group, groupTitle(group, after, before))

    for (const group of groupEffects(migration.effects, ['invalid'], false))
      (decisions.fixes[group.collection] ??= {})[group.field!] = await ask.select(`${groupTitle(group, after, before)} breaks its rules in ${groupCount(group)}: ${group.effects[0]!.message}`, fixOptions(after, group)) as Fix

    for (const group of groupEffects(migration.effects, ['unmatched'], false)) {
      const choice = await ask.select(`${groupTitle(group, after, before)} holds text without a matching entry in ${groupCount(group)}.`, [
        { label: 'Leave the field empty', value: 'drop' },
        { label: 'Create the missing entries', value: 'create' },
      ])

      if (choice === 'create')
        (decisions.create[group.collection] ??= []).push(group.field!)
    }

    migration = plan()
  }

  report(migration, before, after, log)

  const hints = renameHints(renames)

  if (hints.length > 0)
    log(`\nUpdate the code that uses the old names:\n${hints.map(hint => `  ${hint}`).join('\n')}`)

  const destructive = migration.effects.some(effect => effect.kind === 'removed' || effect.kind === 'lost' || effect.kind === 'unmatched')

  if (!yes) {
    if (!ask)
      throw new Error('[forgepress] run forgepress migrate in a terminal to confirm these changes, or add --yes')

    if (!await ask.confirm(destructive ? 'Remove this content and migrate the rest?' : 'Migrate the content?', !destructive))
      return log('Nothing was changed')
  }

  const written = await createWriter(root, config.paths, config.content).apply(migration.changeset)

  log(`\nMigrated the content, ${written.length} ${written.length === 1 ? 'file' : 'files'} changed`)
}
