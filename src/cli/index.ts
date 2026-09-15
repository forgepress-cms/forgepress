import type { ContentIssue } from '../types/issues'
import { resolveConfig } from '../config/resolve'
import { checkContent } from '../disk/check'
import { loadConfig } from '../disk/config'
import { buildOutput } from '../disk/output'
import { findRoot } from '../disk/root'
import { ContentError, formatIssue } from '../files/issues'
import { errorMessage } from '../utils/error'

export interface Terminal {
  log: (message: string) => void
  error: (message: string) => void
}

export const USAGE = `Usage: forgepress <command>

Commands:
  check  Check the schema and all content the way the build does
  build  Check the content, then write the content output`

function report(issues: readonly ContentIssue[], terminal: Terminal): number {
  terminal.error(`${issues.map(formatIssue).join('\n')}\n\n${issues.length} ${issues.length === 1 ? 'problem' : 'problems'} found`)

  return 1
}

async function check(root: string, terminal: Terminal): Promise<number> {
  const config = resolveConfig(await loadConfig(root))
  const issues = await checkContent(root, config.paths)

  if (issues.length > 0)
    return report(issues, terminal)

  terminal.log('No problems found')

  return 0
}

async function build(root: string, terminal: Terminal): Promise<number> {
  const result = await buildOutput(root, resolveConfig(await loadConfig(root)))

  terminal.log(`Wrote the content output to ${result.dir} (${result.files} ${result.files === 1 ? 'file' : 'files'}, ${result.commit ? `commit ${result.commit.slice(0, 7)}` : 'no commit found'})`)

  return 0
}

export async function run(args: readonly string[], cwd: string, terminal: Terminal): Promise<number> {
  const [command, ...rest] = args

  if (command === undefined || command === 'help' || command === '--help' || command === '-h') {
    terminal.log(USAGE)

    return 0
  }

  if ((command !== 'check' && command !== 'build') || rest.length > 0) {
    terminal.error(`${command !== 'check' && command !== 'build' ? `Unknown command ${JSON.stringify(command)}` : `${command} takes no arguments`}\n\n${USAGE}`)

    return 1
  }

  try {
    const root = findRoot(cwd)

    return command === 'check' ? await check(root, terminal) : await build(root, terminal)
  }
  catch (error) {
    if (error instanceof ContentError)
      return report(error.issues, terminal)

    terminal.error(errorMessage(error))

    return 1
  }
}
