import type { ResolvedConfig } from '../config/resolve'
import { editorSettings } from '../config/settings'

export const SETTINGS_ID = 'virtual:forgepress/settings'

export function resolved(id: string): string {
  return `\0${id}`
}

export function generateSettings(local: boolean, config: ResolvedConfig): string {
  return `export default ${JSON.stringify(editorSettings(local, config))}\n`
}
