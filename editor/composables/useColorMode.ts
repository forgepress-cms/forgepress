import type { EditorColorMode } from '../plugins/color-mode'
import { inject } from 'vue'
import { colorModeKey } from '../plugins/color-mode'

export function useColorMode(): EditorColorMode {
  return inject(colorModeKey)!
}
