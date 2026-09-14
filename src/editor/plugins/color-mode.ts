import type { InjectionKey, Ref } from 'vue'

import { ref, watchEffect } from 'vue'

export type ColorMode = 'light' | 'dark'

export interface EditorColorMode {
  mode: Ref<ColorMode>
  cycle: () => void
  dispose: () => void
}

export const colorModeKey: InjectionKey<EditorColorMode> = Symbol('forgepress:editor:color-mode')

const STORAGE_KEY = 'forgepress:color-mode'
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
  const mode = ref<ColorMode>(read())

  const stop = watchEffect(() => {
    container.classList.toggle('dark', mode.value === 'dark')
  })

  return {
    mode,

    cycle: () => {
      mode.value = MODES[(MODES.indexOf(mode.value) + 1) % MODES.length]!
      write(mode.value)
    },

    dispose: stop,
  }
}
