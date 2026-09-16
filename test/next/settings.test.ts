import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('next editor settings', () => {
  it('reads the settings withForgePress defines at build time', async () => {
    const provider = { type: 'github', repository: { owner: 'forgepress-cms', name: 'forgepress' }, base: 'playgrounds/next' }
    const media = { dir: 'public/uploads', url: '/uploads', maxSize: 8388608 }
    const settings = { local: true, devServer: 'http://127.0.0.1:4321', provider, contentPath: '../.forgepress', media }

    vi.stubGlobal('__FORGEPRESS_SETTINGS__', JSON.stringify(settings))
    vi.resetModules()

    expect((await import('../../src/next/settings')).default).toEqual(settings)
  })
})
