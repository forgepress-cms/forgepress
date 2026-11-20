import type { ResolvedConfig } from '../config'
import { editorSettings } from '../config'

export const SETTINGS_ID = 'virtual:forgepress/settings'

export function resolved(id: string): string {
  return `\0${id}`
}

export function generateSettings(local: boolean, config: ResolvedConfig): string {
  return `export default ${JSON.stringify(editorSettings(local, config))}\n`
}
