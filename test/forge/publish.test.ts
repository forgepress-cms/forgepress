import type { FileChange, Forge } from '../../src/forge/types'
import type { ContentIssue } from '../../src/types/issues'
import { describe, expect, it } from 'vitest'
import { defaultPaths } from '../../src/files/paths'
import { commitMessage, ConflictError, gitHash, InvalidContentError, publishable, publishFiles } from '../../src/forge/publish'

const target = { paths: defaultPaths, mediaDir: 'public/uploads' }

async function valid(): Promise<ContentIssue[]> {
  return []
}

function hash(text: string): Promise<string> {
  return gitHash(new TextEncoder().encode(text), 'SHA-1')
}

function file(name: string): string {
  return `.forgepress/content/author/${name}.ts`
}

function repository(files: Record<string, string>) {
  const commits = new Map<string, Record<string, string>>([['c1', files]])
  const calls: string[] = []
  const state = { head: 'c1', count: 1, during: [] as (() => void)[], failure: '' }

  function push(changes: Record<string, string | null>): string {
    const next = { ...commits.get(state.head) }

    for (const [path, text] of Object.entries(changes)) {
      if (text === null)
        delete next[path]
      else
        next[path] = text
    }

    state.count += 1
    state.head = `c${state.count}`
    commits.set(state.head, next)

    return state.head
  }

  const forge: Forge = {
    access: async () => {
      throw new Error('not used')
    },
    head: async () => {
      calls.push('head')

      return state.head
    },
    files: async (commit, directory) => {
      calls.push(`files ${commit} ${directory}`)

      const listed = Object.entries(commits.get(commit) ?? {}).filter(([path]) => path.startsWith(`${directory}/`))

      return Promise.all(listed.map(async ([path, text]) => ({ path, sha: await hash(text) })))
    },
    read: async () => {
      throw new Error('not used')
    },
    commit: async (changes, message, parent) => {
      calls.push(`commit ${parent} ${changes.map(change => change.path).join(' ')}`)
      state.during.shift()?.()

      if (state.failure)
        throw new Error(state.failure)

      if (parent !== state.head)
        throw new Error('GitHub 422: Update is not a fast forward')

      return push(Object.fromEntries(changes.map(change => [change.path, 'removed' in change ? null : change.data])))
    },
  }

  return {
    forge,
    calls,
    push,
    files: () => commits.get(state.head),
    during: (work: () => void) => state.during.push(work),
    fail: (message: string) => {
      state.failure = message
    },
  }
}

function edit(path: string, data: string, replaces: string | null): FileChange {
  return { path, data, encoding: 'utf-8', replaces }
}

describe('git hashes', () => {
  it('hashes content the way git does', async () => {
    const hello = new TextEncoder().encode('hello\n')
    const greeting = new TextEncoder().encode('Grüße 👋\n')

    expect(await gitHash(hello, 'SHA-1')).toBe('ce013625030ba8dba906f756967f9e9ca394464a')
    expect(await gitHash(greeting, 'SHA-1')).toBe('196bf59107e05593145b8615596ac6a50d5627c6')
    expect(await gitHash(hello, 'SHA-256')).toBe('2cf8d83d9ee29543b34a87727421fdecb7e3f3a183d337639025de576db9ebb4')
    expect(await gitHash(greeting, 'SHA-256')).toBe('b775c7389ceac693d489d1c556061a124c21bcf6da7d5df2441e2548c8898f51')
  })
})

describe('publishing files', () => {
  it('commits on the head it checked when nothing changed in the meantime', async () => {
    const repo = repository({ [file('a')]: 'a1', 'src/index.ts': 'code' })

    const commit = await publishFiles(repo.forge, [edit(file('a'), 'a2', await hash('a1')), edit(file('b'), 'b1', null)], 'content: authors', target, valid)

    expect(commit).toBe('c2')
    expect(repo.files()).toEqual({ [file('a')]: 'a2', [file('b')]: 'b1', 'src/index.ts': 'code' })
    expect(repo.calls).toEqual(['head', 'files c1 .forgepress', `commit c1 ${file('a')} ${file('b')}`])
  })

  it('stops before overwriting a file that changed or appeared in the meantime', async () => {
    const repo = repository({ [file('a')]: 'a1', [file('b')]: 'b1', [file('c')]: 'c1' })

    repo.push({ [file('a')]: 'theirs', [file('c')]: null, [file('d')]: 'theirs' })

    const publishing = publishFiles(repo.forge, [
      edit(file('a'), 'mine', await hash('a1')),
      edit(file('b'), 'mine', await hash('b1')),
      { path: file('c'), removed: true, replaces: await hash('c1') },
      edit(file('d'), 'mine', null),
    ], 'content: authors', target, valid)

    await expect(publishing).rejects.toThrow(ConflictError)
    await expect(publishing).rejects.toMatchObject({
      commit: 'c2',
      conflicts: [{ path: file('a'), hash: await hash('theirs') }, { path: file('d'), hash: await hash('theirs') }],
    })
    expect(repo.calls.some(call => call.startsWith('commit'))).toBe(false)
  })

  it('stops before writing a file that was deleted in the meantime', async () => {
    const repo = repository({ [file('a')]: 'a1' })

    repo.push({ [file('a')]: null })

    await expect(publishFiles(repo.forge, [edit(file('a'), 'mine', await hash('a1'))], 'content', target, valid)).rejects.toMatchObject({
      conflicts: [{ path: file('a'), hash: null }],
    })
  })

  it('leaves out changes the repository already has', async () => {
    const repo = repository({ [file('a')]: 'a1', [file('b')]: 'b1', [file('c')]: 'c1' })

    repo.push({ [file('a')]: 'same', [file('b')]: null })

    await publishFiles(repo.forge, [
      edit(file('a'), 'same', await hash('a1')),
      { path: file('b'), removed: true, replaces: await hash('b1') },
      edit(file('c'), 'c2', await hash('c1')),
    ], 'content', target, valid)

    expect(repo.calls.at(-1)).toBe(`commit c2 ${file('c')}`)
    expect(repo.files()).toEqual({ [file('a')]: 'same', [file('c')]: 'c2' })
  })

  it('returns the head without committing or checking the content when the repository already has everything', async () => {
    const repo = repository({ [file('a')]: 'a1' })
    const unchecked = async (): Promise<ContentIssue[]> => {
      throw new Error('checked the content')
    }

    repo.push({ [file('a')]: 'same' })

    expect(await publishFiles(repo.forge, [edit(file('a'), 'same', await hash('a1'))], 'content', target, unchecked)).toBe('c2')
    expect(repo.calls.some(call => call.startsWith('commit'))).toBe(false)
  })

  it('compares only files it knows a hash for', async () => {
    const repo = repository({ [file('a')]: 'theirs' })

    await publishFiles(repo.forge, [
      { path: file('a'), data: 'mine', encoding: 'utf-8' },
      { path: 'public/uploads/photo.png', data: btoa('png'), encoding: 'base64' },
    ], 'media', target, valid)

    expect(repo.calls).toEqual(['head', 'files c1 .forgepress', `commit c1 ${file('a')} public/uploads/photo.png`])
    expect(repo.files()).toEqual({ [file('a')]: 'mine', 'public/uploads/photo.png': btoa('png') })
  })

  it('lists the content folder inside a larger repository', async () => {
    const repo = repository({ 'apps/site/.forgepress/schema.ts': 's1' })

    await publishFiles(repo.forge, [edit('apps/site/.forgepress/schema.ts', 's2', await hash('s1'))], 'schema', { ...target, base: 'apps/site' }, valid)

    expect(repo.calls).toContain('files c1 apps/site/.forgepress')
  })

  it('checks again on the new head when the branch moved while committing', async () => {
    const repo = repository({ [file('a')]: 'a1', 'src/index.ts': 'code' })

    repo.during(() => repo.push({ 'src/index.ts': 'new code' }))

    expect(await publishFiles(repo.forge, [edit(file('a'), 'a2', await hash('a1'))], 'content', target, valid)).toBe('c3')
    expect(repo.files()).toEqual({ [file('a')]: 'a2', 'src/index.ts': 'new code' })
    expect(repo.calls.filter(call => call.startsWith('commit'))).toEqual([`commit c1 ${file('a')}`, `commit c2 ${file('a')}`])
  })

  it('stops when the file itself changed while committing', async () => {
    const repo = repository({ [file('a')]: 'a1' })

    repo.during(() => repo.push({ [file('a')]: 'theirs' }))

    await expect(publishFiles(repo.forge, [edit(file('a'), 'mine', await hash('a1'))], 'content', target, valid)).rejects.toMatchObject({
      commit: 'c2',
      conflicts: [{ path: file('a'), hash: await hash('theirs') }],
    })
  })

  it('passes on a failed commit when the branch did not move', async () => {
    const repo = repository({ [file('a')]: 'a1' })

    repo.fail('GitHub 403: Resource not accessible')

    await expect(publishFiles(repo.forge, [edit(file('a'), 'a2', await hash('a1'))], 'content', target, valid)).rejects.toThrow('GitHub 403')
    expect(repo.calls.filter(call => call.startsWith('commit'))).toHaveLength(1)
  })

  it('tries only once more when the branch keeps moving', async () => {
    const repo = repository({ [file('a')]: 'a1', 'src/index.ts': 'code' })

    repo.during(() => repo.push({ 'src/index.ts': 'code 2' }))
    repo.during(() => repo.push({ 'src/index.ts': 'code 3' }))

    await expect(publishFiles(repo.forge, [edit(file('a'), 'a2', await hash('a1'))], 'content', target, valid)).rejects.toThrow('not a fast forward')
    expect(repo.calls.filter(call => call.startsWith('commit'))).toHaveLength(2)
  })
})

describe('checking the content', () => {
  it('checks the content on the head it compared against, before committing', async () => {
    const repo = repository({ [file('a')]: 'a1', 'src/index.ts': 'code' })
    const listings: ReadonlyMap<string, string>[] = []

    await publishFiles(repo.forge, [edit(file('a'), 'a2', await hash('a1'))], 'content', target, async (listing) => {
      repo.calls.push('check')
      listings.push(listing)

      return []
    })

    expect(repo.calls).toEqual(['head', 'files c1 .forgepress', 'check', `commit c1 ${file('a')}`])
    expect(listings).toEqual([new Map([[file('a'), await hash('a1')]])])
  })

  it('commits nothing when the content has problems', async () => {
    const repo = repository({ [file('a')]: 'a1' })
    const issues = [{ file: file('a'), line: 5, column: 3, message: 'Field "name" has to be a string' }]

    const publishing = publishFiles(repo.forge, [edit(file('a'), 'a2', await hash('a1'))], 'content', target, async () => issues)

    await expect(publishing).rejects.toThrow(InvalidContentError)
    await expect(publishing).rejects.toMatchObject({ commit: 'c1', issues })
    expect(repo.calls.some(call => call.startsWith('commit'))).toBe(false)
  })

  it('reports conflicts before checking the content', async () => {
    const repo = repository({ [file('a')]: 'a1' })

    repo.push({ [file('a')]: 'theirs' })

    await expect(publishFiles(repo.forge, [edit(file('a'), 'mine', await hash('a1'))], 'content', target, async () => [
      { file: file('a'), line: 1, column: 1, message: 'broken' },
    ])).rejects.toThrow(ConflictError)
  })

  it('checks the content again on the new head when the branch moved while committing', async () => {
    const repo = repository({ [file('a')]: 'a1', [file('b')]: 'b1' })
    const seen: (string | undefined)[] = []

    repo.during(() => repo.push({ [file('b')]: 'b2' }))

    await publishFiles(repo.forge, [edit(file('a'), 'a2', await hash('a1'))], 'content', target, async (listing) => {
      seen.push(listing.get(file('b')))

      return []
    })

    expect(seen).toEqual([await hash('b1'), await hash('b2')])
    expect(repo.files()).toEqual({ [file('a')]: 'a2', [file('b')]: 'b2' })
  })
})

describe('commit message', () => {
  it('fills the placeholder in the configured template', () => {
    expect(commitMessage('content: {name}', 'new pricing page')).toBe('content: new pricing page')
  })

  it('appends the name when the template has no placeholder', () => {
    expect(commitMessage('content update —', 'new pricing')).toBe('content update — new pricing')
  })

  it('falls back when the editor names nothing', () => {
    expect(commitMessage(undefined, '   ')).toBe('Update content')
    expect(commitMessage('content: {name}', '')).toBe('content: update content')
  })
})

describe('publishable files', () => {
  it('refuses to commit nothing', () => {
    const files: FileChange[] = [{ path: 'public/uploads/old.png', removed: true }]

    expect(publishable(files)).toBe(files)
    expect(() => publishable([])).toThrow('[forgepress] there is nothing to publish')
  })
})
