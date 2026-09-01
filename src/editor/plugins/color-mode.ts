import type { ComputedRef, InjectionKey, Ref } from 'vue'

import { computed, ref, watchEffect } from 'vue'

export type ColorMode = 'light' | 'dark'

export interface EditorColorMode {
  mode: Ref<ColorMode>
  resolved: ComputedRef<'light' | 'dark'>
  cycle: () => void
  dispose: () => void
}

export const colorModeKey: InjectionKey<EditorColorMode> = Symbol('webenv:editor:color-mode')

const STORAGE_KEY = 'webenv:color-mode'
const MODES: ColorMode[] = ['light', 'dark']

function read(): ColorMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY) as ColorMode | null
    return value && MODES.includes(value) ? value : 'light'
  }
  catch {
    return 'light'
  }
}

function write(mode: ColorMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  }
  catch {
  }
}

export function createColorMode(container: Element): EditorColorMode {
  const query = window.matchMedia('(prefers-color-scheme: dark)')

  const system = ref<'light' | 'dark'>(query.matches ? 'dark' : 'light')
  const mode = ref<ColorMode>(read())
  const resolved = computed<'light' | 'dark'>(() => mode.value)

  const onChange = (): void => {
    system.value = query.matches ? 'dark' : 'light'
  }

  query.addEventListener('change', onChange)

  const stop = watchEffect(() => {
    container.classList.toggle('dark', resolved.value === 'dark')
  })

  return {
    mode,
    resolved,

    cycle: () => {
      mode.value = MODES[(MODES.indexOf(mode.value) + 1) % MODES.length]!
      write(mode.value)
    },

    dispose: () => {
      stop()
      query.removeEventListener('change', onChange)
    },
  }
}
