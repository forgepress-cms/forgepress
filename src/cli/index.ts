import type { CommandDef } from 'citty'
import type { ContentIssue } from '../files/issues'
import process from 'node:process'
import { defineCommand } from 'citty'
import { version } from '../../package.json'
import { resolveConfig } from '../config/resolve'
import { loadConfig } from '../disk/config'
import { diskFiles } from '../disk/files'
import { buildOutput } from '../disk/output'
import { findRoot } from '../disk/root'
import { readContent } from '../files/content'
import { ContentError, formatIssue } from '../files/issues'
import { errorMessage } from '../utils/error'

function fail(message: string): void {
  console.error(message)
  process.exitCode = 1
}

function report(issues: readonly ContentIssue[]): void {
  fail(`${issues.map(formatIssue).join('\n')}\n\n${issues.length} ${issues.length === 1 ? 'problem' : 'problems'} found`)
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

export function createCli(cwd: string): CommandDef {
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

  return defineCommand({
    meta: { name: 'forgepress', version, description: 'Check and build the content of a ForgePress project' },
    subCommands: { check, build },
  })
}
