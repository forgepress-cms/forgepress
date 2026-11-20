import type { EditorColorMode } from '../../plugins'
import { inject } from 'vue'
import { colorModeKey } from '../../plugins'

export function useColorMode(): EditorColorMode {
  return inject(colorModeKey)!
}
