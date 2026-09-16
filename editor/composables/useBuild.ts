import type { Ref } from 'vue'
import type { BuildState } from '../../src/forge/build'
import type { BuildCheck } from '../../src/forge/types'
import type { OutputIndex } from '../../src/output/types'
import { ref, shallowRef } from 'vue'
import { createBuildReader } from '../../src/forge/build'
import { OUTPUT_INDEX } from '../../src/output/types'
import { reader } from '../../src/query/fetch'
import { persist } from '../../src/store'
import { useSession } from './useSession'

export const POLL = 15_000
export const PATIENCE = 30 * 60_000

export interface BuildWatch {
  commit: Ref<string>
  state: Ref<BuildState | undefined>
  checks: Ref<readonly BuildCheck[]>
  error: Ref<string>
  restore: () => Promise<void>
  track: (commit: string) => Promise<void>
  retry: () => Promise<void>
  dismiss: () => Promise<void>
}

interface Watched {
  commit: string
  since: number
}

const commit = ref('')
const state = ref<BuildState>()
const checks = shallowRef<readonly BuildCheck[]>([])
const error = ref('')

const store = persist<Watched>('build')

const read = createBuildReader(async () => {
  const index = await reader(OUTPUT_INDEX) as OutputIndex | undefined

  return index?.dev ? undefined : index?.commit
})

let since = 0
let round = 0
let timer: ReturnType<typeof setTimeout> | undefined
let loaded: Promise<void> | undefined

function stop(): void {
  clearTimeout(timer)
  timer = undefined
  round += 1
}

function later(): void {
  timer = setTimeout(() => void poll(), POLL)
}

async function poll(): Promise<void> {
  stop()

  const current = round
  const watched = commit.value
  const forge = useSession().forge()

  if (!watched || !forge)
    return

  if (document.visibilityState === 'hidden') {
    later()

    return
  }

  const report = await read(forge, watched, Date.now() - since >= PATIENCE)

  if (current !== round)
    return

  state.value = report.state
  checks.value = report.checks
  error.value = report.error

  if (report.state === 'building')
    later()
  else if (report.state === 'live' || report.state === 'passed')
    await store.clear().catch(() => undefined)
}

function watch(next: string, start: number): void {
  stop()

  commit.value = next
  since = start
  state.value = 'building'
  checks.value = []
  error.value = ''
}

export function useBuild(): BuildWatch {
  return {
    commit,
    state,
    checks,
    error,

    restore: async () => {
      loaded ??= store.read().then((saved) => {
        if (saved && !commit.value)
          watch(saved.commit, saved.since)
      }, () => undefined)

      await loaded

      if (state.value === 'building' && timer === undefined)
        await poll()
    },

    track: async (next) => {
      watch(next, Date.now())

      await store.write({ commit: next, since }).catch(() => undefined)

      void poll()
    },

    retry: async () => {
      if (!commit.value)
        return

      watch(commit.value, Date.now())

      await store.write({ commit: commit.value, since }).catch(() => undefined)

      void poll()
    },

    dismiss: async () => {
      stop()

      commit.value = ''
      state.value = undefined
      checks.value = []
      error.value = ''

      await store.clear().catch(() => undefined)
    },
  }
}
