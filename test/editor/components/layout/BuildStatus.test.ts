// @vitest-environment happy-dom
import type { App } from 'vue'
import type { BuildState } from '../../../../src/forge/build'
import type { BuildCheck } from '../../../../src/forge/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, ref, shallowRef } from 'vue'
import { settle } from '../../../settle'

const commit = ref('')
const state = ref<BuildState>()
const checks = shallowRef<readonly BuildCheck[]>([])
const error = ref('')
const calls: string[] = []

vi.doMock('../../../../editor/composables/useBuild', () => ({
  PATIENCE: 30 * 60_000,
  useBuild: () => ({
    commit,
    state,
    checks,
    error,
    restore: async () => {
      calls.push('restore')
    },
    retry: async () => {
      calls.push('retry')
    },
    dismiss: async () => {
      calls.push('dismiss')
      state.value = undefined
    },
  }),
}))

vi.doMock('../../../../editor/composables/useSession', () => ({
  useSession: () => ({ provider: ref({ type: 'forgejo', url: 'http://127.0.0.1:3310', repository: { owner: 'fred', name: 'site' } }) }),
}))

const { default: BuildStatus } = await import('../../../../editor/components/layout/BuildStatus.vue')

const stubs = {
  UPopover: defineComponent({
    setup: (_, { slots }) => () => h('div', [slots.default?.(), h('div', { role: 'dialog' }, slots.content?.())]),
  }),
  UButton: defineComponent({
    props: { label: String, to: String },
    emits: ['click'],
    setup: (props, { emit }) => () => props.to
      ? h('a', { href: props.to }, props.label)
      : h('button', { onClick: () => emit('click') }, props.label),
  }),
  UIcon: defineComponent({
    props: { name: String },
    setup: props => () => h('span', { 'data-icon': props.name }),
  }),
}

let app: App
let container: HTMLElement

function text(): string {
  return container.textContent ?? ''
}

async function click(label: string): Promise<void> {
  const button = [...container.querySelectorAll('button')].find(element => element.textContent === label)

  if (!button)
    throw new Error(`no button "${label}" in: ${text()}`)

  button.click()
  await settle()
}

beforeEach(async () => {
  commit.value = ''
  state.value = undefined
  checks.value = []
  error.value = ''
  calls.length = 0

  container = document.createElement('div')
  app = createApp(BuildStatus)

  for (const [name, component] of Object.entries(stubs))
    app.component(name, component)

  app.mount(container)
  await settle()
})

afterEach(() => {
  app.unmount()
})

describe('build status', () => {
  it('shows nothing until something was published, and picks up a build from before a reload', () => {
    expect(text()).toBe('')
    expect(calls).toEqual(['restore'])
  })

  it('says when no build has reported yet and links the commit on the forge', async () => {
    commit.value = '8f3c2a1b9d0e4f5a6b7c8d9e0f1a2b3c4d5e6f70'
    state.value = 'building'
    await settle()

    expect(container.querySelector('button')?.textContent).toBe('Building')
    expect(text()).toContain('Building 8f3c2a1')
    expect(text()).toContain('No build has reported to Forgejo yet.')
    expect(container.querySelector('a')?.getAttribute('href')).toBe('http://127.0.0.1:3310/fred/site/commit/8f3c2a1b9d0e4f5a6b7c8d9e0f1a2b3c4d5e6f70')
    expect(text()).not.toContain('Check again')
  })

  it('links the failed check and checks again or goes away when asked', async () => {
    commit.value = '8f3c2a1b9d0e4f5a6b7c8d9e0f1a2b3c4d5e6f70'
    state.value = 'failed'
    checks.value = [
      { name: 'build / site (push)', state: 'failure', url: 'http://127.0.0.1:3310/fred/site/actions/runs/3/jobs/0' },
      { name: 'size', state: 'skipped' },
    ]
    await settle()

    expect(container.querySelector('button')?.textContent).toBe('Build failed')
    expect(text()).toContain('The build of 8f3c2a1 failed')

    const details = [...container.querySelectorAll('a')].filter(link => link.textContent === 'Details')

    expect(details.map(link => link.getAttribute('href'))).toEqual(['http://127.0.0.1:3310/fred/site/actions/runs/3/jobs/0'])
    expect([...container.querySelectorAll('[role=img]')].map(icon => icon.getAttribute('aria-label'))).toEqual(['Failed', 'Skipped'])

    await click('Check again')
    await click('Dismiss')

    expect(calls).toEqual(['restore', 'retry', 'dismiss'])
    expect(text()).toBe('')
  })

  it('explains why the checks are missing', async () => {
    commit.value = '8f3c2a1b9d0e4f5a6b7c8d9e0f1a2b3c4d5e6f70'
    state.value = 'stalled'
    error.value = '[forgepress] the GitHub token can\'t read the builds of this repository; give it read access to actions and commit statuses'
    await settle()

    expect(container.querySelector('button')?.textContent).toBe('Not live yet')
    expect(text()).toContain('The site didn\'t show this commit within 30 minutes.')
    expect(text()).toContain('Couldn\'t read the checks: [forgepress] the GitHub token can\'t read the builds of this repository')
  })
})
