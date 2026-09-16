import type { InjectionKey, Ref } from 'vue'

import { ref, watchEffect } from 'vue'
import { readLocal, writeLocal } from '../../src/store/local'

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
  const value = readLocal(STORAGE_KEY) as ColorMode | null

  return value && MODES.includes(value) ? value : 'light'
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
      writeLocal(STORAGE_KEY, mode.value)
    },

    dispose: stop,
  }
}
