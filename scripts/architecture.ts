import type { ESLint, Rule } from 'eslint'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

export const LAYERS = {
  src: ['utils', 'issues', 'media', 'schema', 'entries', 'store', 'files', 'output', 'query', 'forge', 'config', 'migrate', 'changes', 'endpoint', 'preview', 'next', 'disk', 'server', 'plugin', 'cli', 'index', 'unplugin'],
  editor: ['styles', 'types', 'settings', 'utils', 'plugins', 'composables', 'components', 'pages', 'App', 'mount', 'vue'],
} as const

type Area = keyof typeof LAYERS

export const NODE: Record<Area, readonly string[]> = {
  src: ['disk', 'server', 'plugin', 'cli', 'unplugin'],
  editor: [],
}

const BUILDS_ON: Record<Area, readonly Area[]> = {
  src: [],
  editor: ['src'],
}

interface Place {
  area: Area
  module: string
  inner: readonly string[]
}

function isArea(name: string | undefined): name is Area {
  return name !== undefined && Object.hasOwn(LAYERS, name)
}

function placeOf(file: string): Place | undefined {
  const [area, first = 'index', ...inner] = relative(ROOT, file).split(sep)

  if (!isArea(area))
    return undefined

  return { area, module: inner.length > 0 ? first : basename(first, extname(first)), inner }
}

function rank(place: Place): number {
  return (LAYERS[place.area] as readonly string[]).indexOf(place.module)
}

function runsInNode(place: Place): boolean {
  return NODE[place.area].includes(place.module)
}

function sameModule(left: Place, right: Place): boolean {
  return left.area === right.area && left.module === right.module
}

function isIndex(name: string | undefined): boolean {
  return name === 'index' || name === 'index.ts'
}

type ImportNode = Rule.Node & { source?: unknown }

function specifierOf(node: ImportNode): string | undefined {
  const source = node.source as { type?: string, value?: unknown } | null | undefined

  return source?.type === 'Literal' && typeof source.value === 'string' ? source.value : undefined
}

function targetOf(file: string, specifier: string): Place | undefined {
  const [path = specifier] = specifier.split('?')

  return specifier.startsWith('.') ? placeOf(resolve(dirname(file), path)) : undefined
}

function visitImports(check: (node: ImportNode, specifier: string) => void): Rule.RuleListener {
  function visit(node: ImportNode): void {
    const specifier = specifierOf(node)

    if (specifier !== undefined)
      check(node, specifier)
  }

  return {
    ImportDeclaration: visit,
    ExportNamedDeclaration: visit,
    ExportAllDeclaration: visit,
    ImportExpression: visit,
  }
}

const layers: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: { description: 'Keep imports pointing down the layers listed in ARCHITECTURE.md' },
    schema: [],
    messages: {
      upward: '`{{own}}` sits below `{{other}}` in the {{area}} layers, so it can\'t import it. Move the shared code down, or this code up (see ARCHITECTURE.md).',
      area: 'Code in {{own}}/ can\'t import from {{other}}/ (see ARCHITECTURE.md).',
      unknown: '`{{module}}` isn\'t in the {{area}} layers yet. Add it to LAYERS in scripts/architecture.ts and to ARCHITECTURE.md.',
      node: '`{{own}}` also runs in the browser, so it can\'t import `{{other}}`, which uses Node.',
      builtin: '`{{own}}` also runs in the browser, so it can\'t import `{{specifier}}`.',
    },
  },

  create(context) {
    const own = placeOf(context.filename)

    if (!own)
      return {}

    const listener = visitImports((node, specifier) => {
      if (specifier.startsWith('node:')) {
        if (!runsInNode(own))
          context.report({ node, messageId: 'builtin', data: { own: own.module, specifier } })

        return
      }

      const target = targetOf(context.filename, specifier)

      if (!target || sameModule(own, target))
        return

      if (target.area !== own.area && !BUILDS_ON[own.area].includes(target.area)) {
        context.report({ node, messageId: 'area', data: { own: own.area, other: target.area } })

        return
      }

      if (rank(target) < 0)
        context.report({ node, messageId: 'unknown', data: { area: target.area, module: target.module } })
      else if (target.area === own.area && rank(target) > rank(own))
        context.report({ node, messageId: 'upward', data: { area: own.area, own: own.module, other: target.module } })
      else if (runsInNode(target) && !runsInNode(own))
        context.report({ node, messageId: 'node', data: { own: own.module, other: target.module } })
    })

    return {
      ...listener,
      Program(node) {
        if (rank(own) < 0)
          context.report({ node, messageId: 'unknown', data: { area: own.area, module: own.module } })
      },
    }
  },
}

function entryOf(file: string, target: Place): string {
  const path = relative(dirname(file), join(ROOT, target.area, target.module)).split(sep).join('/')

  return path.startsWith('.') ? path : `./${path}`
}

const entries: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: { description: 'Let modules talk to each other only through their index.ts (see ARCHITECTURE.md)' },
    schema: [],
    messages: {
      entry: 'Import `{{module}}` through its index.ts: \'{{entry}}\'. Files inside another module are private to it.',
      own: 'Files of `{{module}}` import each other directly. Import the file that defines this, not the module\'s index.ts.',
      reexport: 'An index.ts only re-exports, by name, from files of its own module.',
      star: 'Name what index.ts exports, so the module\'s API stays visible.',
      nested: 'Only the folder of a module has an index.ts. Name this file after what it does.',
    },
  },

  create(context) {
    const own = placeOf(context.filename)

    if (!own)
      return {}

    const index = isIndex(own.inner.at(-1)) || (own.inner.length === 0 && own.module === 'index')
    const listener = visitImports((node, specifier) => {
      const target = targetOf(context.filename, specifier)

      if (!target)
        return

      if (sameModule(own, target)) {
        if (target.inner.length === 0 || (target.inner.length === 1 && isIndex(target.inner[0])))
          context.report({ node, messageId: 'own', data: { module: own.module } })

        return
      }

      if (target.inner.length > 0)
        context.report({ node, messageId: 'entry', data: { module: target.module, entry: entryOf(context.filename, target) } })
    })

    return {
      ...listener,
      Program(node) {
        if (!index)
          return

        if (own.inner.length > 1) {
          context.report({ node, messageId: 'nested' })

          return
        }

        for (const statement of node.body) {
          if (statement.type === 'ExportAllDeclaration')
            context.report({ node: statement, messageId: 'star' })
          else if (statement.type !== 'ExportNamedDeclaration' || statement.source == null || (own.inner.length === 1 && !String(statement.source.value).startsWith('./')))
            context.report({ node: statement, messageId: 'reexport' })
        }
      },
    }
  },
}

const plugin: ESLint.Plugin = {
  meta: { name: 'forgepress' },
  rules: { layers, entries },
}

export default plugin
