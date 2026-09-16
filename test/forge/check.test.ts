import type { FileChange } from '../../src/forge/types'
import { describe, expect, it } from 'vitest'
import { formatIssue } from '../../src/files/issues'
import { defaultPaths, repositoryPaths } from '../../src/files/paths'
import { checkResult } from '../../src/forge/check'

const target = { paths: defaultPaths, mediaDir: 'public/uploads' }

const schema = 'export default { collections: { author: { fields: { name: { type: \'text\' } } }, blogPost: { fields: { author: { type: \'relation\', collection: \'author\' } } } } }\n'

function author(id: string, name: unknown = 'Alice'): string {
  return `export default { id: '${id}', status: 'published', createdAt: '2024-01-01', updatedAt: '2024-01-01', name: ${JSON.stringify(name)} }\n`
}

function post(id: string, writer: string): string {
  return `export default { id: '${id}', status: 'published', createdAt: '2024-01-01', updatedAt: '2024-01-01', author: '${writer}' }\n`
}

function repository(files: Record<string, string>) {
  const blobs = new Map<string, string>()
  const reads: string[] = []

  const listing = new Map(Object.entries(files).map(([path, text]) => {
    blobs.set(`sha:${path}`, text)

    return [path, `sha:${path}`]
  }))

  async function read(sha: string): Promise<string> {
    reads.push(sha)

    return blobs.get(sha)!
  }

  return { listing, reads, read }
}

async function problems(files: Record<string, string>, changes: FileChange[], base?: string): Promise<string[]> {
  const repo = repository(files)

  return (await checkResult(repo.listing, changes, repo.read, { ...target, paths: repositoryPaths(defaultPaths, base) })).map(formatIssue)
}

describe('checking the result of publishing', () => {
  it('finds nothing wrong when the changes keep the content valid', async () => {
    expect(await problems({
      '.forgepress/schema.ts': schema,
      '.forgepress/content/author/author_1.ts': author('author_1'),
      '.forgepress/content/blog-post/post_1.ts': post('post_1', 'author_1'),
    }, [
      { path: '.forgepress/content/author/author_1.ts', data: author('author_1', 'Alicia'), encoding: 'utf-8' },
    ])).toEqual([])
  })

  it('reports an entry that is removed while another one still references it', async () => {
    expect(await problems({
      '.forgepress/schema.ts': schema,
      '.forgepress/content/author/author_1.ts': author('author_1'),
      '.forgepress/content/blog-post/post_1.ts': post('post_1', 'author_1'),
    }, [
      { path: '.forgepress/content/author/author_1.ts', removed: true },
    ])).toEqual([
      '.forgepress/content/blog-post/post_1.ts:1:103 Field "author" references author/author_1, which doesn\'t exist',
    ])
  })

  it('checks the files being published instead of the ones they replace', async () => {
    expect(await problems({
      '.forgepress/schema.ts': schema,
      '.forgepress/content/author/author_1.ts': author('author_1'),
    }, [
      { path: '.forgepress/content/author/author_1.ts', data: author('author_1', 42), encoding: 'utf-8' },
      { path: '.forgepress/content/blog-post/post_2.ts', data: btoa(post('post_2', 'author_9')), encoding: 'base64' },
      { path: 'public/uploads/photo.png', data: btoa('png'), encoding: 'base64' },
    ])).toEqual([
      '.forgepress/content/author/author_1.ts:1:105 Field "name" has to be a string',
      '.forgepress/content/blog-post/post_2.ts:1:103 Field "author" references author/author_9, which doesn\'t exist',
    ])
  })

  it('reads only the unchanged files that make up the content', async () => {
    const repo = repository({
      '.forgepress/schema.ts': schema,
      '.forgepress/forgepress.d.ts': 'export {}\n',
      '.forgepress/content/author/author_1.ts': author('author_1'),
      '.forgepress/content/author/author_2.ts': author('author_2'),
      '.forgepress/content/author/notes.md': '# notes\n',
      '.forgepress/content/author/drafts/author_3.ts': 'export default nonsense\n',
    })

    expect(await checkResult(repo.listing, [
      { path: '.forgepress/content/author/author_1.ts', data: author('author_1', 'Alicia'), encoding: 'utf-8' },
    ], repo.read, target)).toEqual([])
    expect(repo.reads.sort()).toEqual(['sha:.forgepress/content/author/author_2.ts', 'sha:.forgepress/schema.ts'])
  })

  it('finds the content inside a larger repository', async () => {
    expect(await problems({
      'apps/site/.forgepress/schema.ts': schema,
      'apps/site/.forgepress/content/blog-post/post_1.ts': post('post_1', 'author_1'),
    }, [], 'apps/site')).toEqual([
      'apps/site/.forgepress/content/blog-post/post_1.ts:1:103 Field "author" references author/author_1, which doesn\'t exist',
    ])
  })

  it('checks a repository without a schema as one without collections', async () => {
    expect(await problems({}, [{ path: 'public/uploads/photo.png', data: btoa('png'), encoding: 'base64' }])).toEqual([])
    expect(await problems({}, [{ path: '.forgepress/content/author/author_1.ts', data: author('author_1'), encoding: 'utf-8' }])).toEqual([
      '.forgepress/content/author/author_1.ts:1:16 Collection "author" is not in the schema',
    ])
  })
})
