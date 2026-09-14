import { describe, expect, it } from 'vitest'
import { fileIssues } from '../../../src/editor/utils/issues'
import { defaultPaths } from '../../../src/files/paths'

describe('file issues', () => {
  it('groups problems by file and names the entry each file holds', () => {
    const target = { paths: defaultPaths, mediaDir: 'public/uploads', base: 'apps/site' }

    expect(fileIssues([
      { file: 'apps/site/.forgepress/content/blog-post/post_1.ts', line: 9, column: 3, message: 'Field "author" references author/author_3, which doesn\'t exist' },
      { file: 'apps/site/.forgepress/schema.ts', line: 1, column: 16, message: '`defineSchema` is not a literal value' },
      { file: 'apps/site/.forgepress/content/blog-post/post_1.ts', line: 10, column: 3, message: '"colour" is not a field of collection "blogPost"' },
    ], target)).toEqual([
      {
        path: 'apps/site/.forgepress/content/blog-post/post_1.ts',
        entry: { collection: 'blogPost', id: 'post_1' },
        messages: ['Field "author" references author/author_3, which doesn\'t exist', '"colour" is not a field of collection "blogPost"'],
      },
      { path: 'apps/site/.forgepress/schema.ts', entry: undefined, messages: ['`defineSchema` is not a literal value'] },
    ])
  })
})
