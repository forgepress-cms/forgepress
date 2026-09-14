import { describe, expect, it, vi } from 'vitest'

const cleared: string[] = []

vi.doMock('../src/editor/storage', () => ({
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

const { useSession } = await import('../src/editor/composables/useSession')

describe('session', () => {
  it('removes the token and everything kept from the repository when signing out', async () => {
    await useSession().signOut()

    expect(cleared).toEqual(['token', 'repository'])
  })
})
