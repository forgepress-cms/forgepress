// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPaths } from '../../../src/files/paths'

const stored = new Map<string, unknown>()
const cleared: string[] = []
const used: string[] = []
let accessing = (): void => {}
const provider = { type: 'forgejo' as const, url: 'http://127.0.0.1:3310', clientId: 'editor', repository: { owner: 'fred', name: 'site' } }

vi.doMock('../../../editor/settings', () => ({
  baked: async () => ({ local: false, provider, paths: createPaths('content'), media: { dir: 'public/media', url: '/media', maxSize: 1024, assets: [] } }),
}))

vi.doMock('../../../src/forge', () => ({
  createForge: (_config: unknown, token: () => Promise<string>) => ({
    access: async () => {
      accessing()
      used.push(await token())

      return { identity: { login: 'fred' }, writable: true, branch: 'main' }
    },
  }),
}))

vi.doMock('../../../src/store', () => ({
  TOKEN_KEY: 'token',
  persist: (key: string) => ({
    read: async () => stored.get(key),
    write: async (value: unknown) => void stored.set(key, value),
    clear: async () => {
      stored.delete(key)
      cleared.push(key)
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

async function load() {
  vi.resetModules()

  const { useSession } = await import('../../../editor/composables/useSession')

  return { session: useSession(), preview: await import('../../../src/preview/state') }
}

afterEach(() => {
  vi.unstubAllGlobals()
  stored.clear()
  cleared.length = 0
  used.length = 0
  localStorage.clear()
  sessionStorage.clear()
  window.history.replaceState(null, '', '/')
  accessing = () => {}
})

describe('session', () => {
  it('lets the site preview for the editor who signed in, on the branch the editor found', async () => {
    const { session, preview } = await load()

    await session.restore()

    expect(preview.previewing()).toBe(false)
    expect(await session.signIn('secret')).toBe(true)
    expect(stored.get('token')).toEqual({ access: 'secret' })
    expect(preview.previewSettings()).toEqual({ provider: { ...provider, repository: { ...provider.repository, branch: 'main' } }, contentPath: 'content', mediaUrl: '/media' })
    expect(preview.previewing()).toBe(true)
  })

  it('stays signed in after signing in on the forge and reloading the editor', async () => {
    const requests: { url: string, body: Record<string, string> }[] = []

    vi.stubGlobal('BroadcastChannel', undefined)
    vi.stubGlobal('fetch', async (input: string, init: RequestInit) => {
      requests.push({ url: input, body: Object.fromEntries(new URLSearchParams(String(init.body))) })

      return Response.json({ access_token: 'granted', token_type: 'bearer', refresh_token: 'renewal', expires_in: 7200 })
    })

    sessionStorage.setItem('forgepress:pkce', JSON.stringify({ verifier: 'verifier', state: 'state' }))
    window.history.replaceState(null, '', '/admin?code=code&state=state')

    const signedIn = await load()
    const kept: unknown[] = []

    signedIn.preview.onPreviewChange(() => kept.push(stored.get('token')))
    await signedIn.session.restore()

    expect(signedIn.session.identity.value).toEqual({ login: 'fred' })
    expect(kept).toEqual([{ access: 'granted', refresh: 'renewal', expires: expect.any(Number) }])
    expect(window.location.pathname + window.location.search + window.location.hash).toBe('/admin')

    const reloaded = await load()

    await reloaded.session.restore()

    expect(reloaded.session.identity.value).toEqual({ login: 'fred' })
    expect(reloaded.preview.previewing()).toBe(true)
    expect(requests).toEqual([{
      url: 'http://127.0.0.1:3310/login/oauth/access_token',
      body: { client_id: 'editor', grant_type: 'authorization_code', code: 'code', redirect_uri: `${window.location.origin}/admin`, code_verifier: 'verifier' },
    }])
    expect(used).toEqual(['granted', 'granted'])
  })

  it('shows why the forge refused the sign-in and takes its answer out of the address', async () => {
    const fetch = vi.fn()

    vi.stubGlobal('fetch', fetch)

    sessionStorage.setItem('forgepress:pkce', JSON.stringify({ verifier: 'verifier', state: 'state' }))
    window.history.replaceState(null, '', '/admin?tab=content&error=access_denied&error_description=the+request+is+denied&state=state')

    const { session } = await load()

    await session.restore()

    expect(session.identity.value).toBeUndefined()
    expect(session.error.value).toBe('[forgepress] the forge refused the sign-in: the request is denied')
    expect(window.location.pathname + window.location.search).toBe('/admin?tab=content')
    expect(sessionStorage.getItem('forgepress:pkce')).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('uses tokens another tab renewed instead of renewing its expired ones again', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('renewed a second time')
    })

    stored.set('token', { access: 'expired', refresh: 'used', expires: Date.now() - 60_000 })
    accessing = () => stored.set('token', { access: 'renewed', refresh: 'next', expires: Date.now() + 3_600_000 })

    const { session } = await load()

    await session.restore()

    expect(session.identity.value).toEqual({ login: 'fred' })
    expect(used).toEqual(['renewed'])
  })

  it('removes the token, everything kept from the repository and the site preview when signing out', async () => {
    const { session, preview } = await load()

    await session.restore()
    await session.signIn('secret')
    await session.signOut()

    expect(stored.has('token')).toBe(false)
    expect(cleared).toEqual(['token', 'repository'])
    expect(preview.previewing()).toBe(false)
  })
})
