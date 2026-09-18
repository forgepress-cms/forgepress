import type { CommandDef } from 'citty'
import type { ContentIssue } from '../files/issues'
import type { Ask } from './migrate'
import process from 'node:process'
import { defineCommand } from 'citty'
import { consola } from 'consola'
import { version } from '../../package.json'
import { resolveConfig } from '../config/resolve'
import { loadConfig } from '../disk/config'
import { diskFiles } from '../disk/files'
import { buildOutput } from '../disk/output'
import { findRoot } from '../disk/root'
import { readContent } from '../files/content'
import { ContentError, formatIssue } from '../files/issues'
import { errorMessage } from '../utils/error'
import { migrate } from './migrate'

function fail(message: string): void {
  console.error(message)
  process.exitCode = 1
}

function report(issues: readonly ContentIssue[]): void {
  fail(`${issues.map(formatIssue).join('\n')}\n\n${issues.length} ${issues.length === 1 ? 'problem' : 'problems'} found`)
}

const terminal: Ask = {
  select: async (message, options) => String(await consola.prompt(message, { type: 'select', options: options.map(option => ({ label: option.label, value: option.value })), cancel: 'reject' })),
  text: async message => String(await consola.prompt(message, { type: 'text', cancel: 'reject' })),
  confirm: async (message, initial) => Boolean(await consola.prompt(message, { type: 'confirm', initial, cancel: 'reject' })),
}

async function inProject(cwd: string, task: (root: string) => Promise<void>): Promise<void> {
  try {
    await task(findRoot(cwd))
  }
  catch (error) {
    if (error instanceof ContentError)
      return report(error.issues)

    fail(errorMessage(error))
  }
}

export function createCli(cwd: string, ask: Ask | undefined = process.stdin.isTTY ? terminal : undefined): CommandDef {
  const check = defineCommand({
    meta: { name: 'check', description: 'Check the schema and all content the way the build does' },

    run: () => inProject(cwd, async (root) => {
      const config = resolveConfig(await loadConfig(root))
      const { issues } = await readContent(diskFiles(root), config.paths)

      if (issues.length > 0)
        return report(issues)

      console.log('No problems found')
    }),
  })

  const build = defineCommand({
    meta: { name: 'build', description: 'Check the content, then write the content output' },

    run: () => inProject(cwd, async (root) => {
      const result = await buildOutput(root, resolveConfig(await loadConfig(root)))

      console.log(`Wrote the content output to ${result.dir} (${result.files} ${result.files === 1 ? 'file' : 'files'}, ${result.commit ? `commit ${result.commit.slice(0, 7)}` : 'no commit found'})`)
    }),
  })

  const migration = defineCommand({
    meta: { name: 'migrate', description: 'Migrate the content to the schema after changing schema.ts by hand or merging a branch' },
    args: {
      yes: { type: 'boolean', description: 'Migrate without asking for confirmation' },
    },

    run: ({ args }) => inProject(cwd, async (root) => {
      await migrate(root, resolveConfig(await loadConfig(root)), { ask, yes: args.yes === true, log: message => console.log(message) })
    }),
  })

  return defineCommand({
    meta: { name: 'forgepress', version, description: 'Check, migrate and build the content of a ForgePress project' },
    subCommands: { check, migrate: migration, build },
  })
}
