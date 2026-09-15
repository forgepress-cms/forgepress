import { describe, expect, it } from 'vitest'
import { resolveConfig } from '../../src/config/resolve'

const repository = { owner: 'forgepress-cms', name: 'forgepress' }

describe('resolveConfig', () => {
  it('accepts a content folder outside the project while it stays in the repository', () => {
    const config = resolveConfig({ path: '../.forgepress', provider: { type: 'github', repository, base: 'playgrounds/next' } })

    expect(config.paths.schema).toBe('../.forgepress/schema.ts')
  })

  it('stops when the editor could not find the content folder in the repository', () => {
    expect(() => resolveConfig({ path: '../.forgepress', provider: { type: 'github', repository } }))
      .toThrow('[forgepress] the content folder "../.forgepress" is outside the repository when the project is at the root of the repository. Set provider.base to the folder of this project in the repository')

    expect(() => resolveConfig({ path: '../../content', provider: { type: 'gitlab', repository, base: 'docs' } }))
      .toThrow('the content folder "../../content" is outside the repository when the project is at provider.base "docs"')

    expect(() => resolveConfig({ media: { dir: '../uploads' }, provider: { type: 'forgejo', repository } }))
      .toThrow('the media folder "../uploads" is outside the repository')
  })

  it('leaves folders alone without a provider, since nothing reads them from the repository', () => {
    expect(resolveConfig({ path: '../content' }).paths.dir).toBe('../content')
  })
})
