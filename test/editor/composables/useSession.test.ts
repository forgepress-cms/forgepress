// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { createPaths } from '../../../src/files/paths'

const cleared: string[] = []
const provider = { type: 'forgejo' as const, url: 'http://127.0.0.1:3310', repository: { owner: 'fred', name: 'site' } }

vi.doMock('../../../src/editor/settings', () => ({
  baked: async () => ({ local: false, provider, paths: createPaths('content'), media: { dir: 'public/media', url: '/media', maxSize: 1024, assets: [] } }),
}))

vi.doMock('../../../src/forge', () => ({
  createForge: () => ({
    access: async () => ({ identity: { login: 'fred' }, writable: true, branch: 'main' }),
  }),
}))

vi.doMock('../../../src/storage', () => ({
  TOKEN_KEY: 'token',
  persist: () => ({
    read: async () => undefined,
    write: async () => {},
    clear: async () => {
      cleared.push('token')
    },
  }),
  repositoryCache: () => ({
    readListing: async () => undefined,
    writeListing: async () => {},
    keep: async () => new Map(),
    writeFile: async () => {},
    clear: async () => {
      cleared.push('repository')
    },
  }),
}))

const { useSession } = await import('../../../src/editor/composables/useSession')
const { previewing, previewSettings } = await import('../../../src/preview/state')

describe('session', () => {
  it('lets the site preview for the editor who signed in, on the branch the editor found', async () => {
    const session = useSession()

    await session.restore()

    expect(previewing()).toBe(false)
    expect(await session.signIn('secret')).toBe(true)
    expect(previewSettings()).toEqual({ provider: { ...provider, repository: { ...provider.repository, branch: 'main' } }, contentPath: 'content', mediaUrl: '/media' })
    expect(previewing()).toBe(true)
  })

  it('removes the token, everything kept from the repository and the site preview when signing out', async () => {
    await useSession().signOut()

    expect(cleared).toEqual(['token', 'repository'])
    expect(previewing()).toBe(false)
  })
})
