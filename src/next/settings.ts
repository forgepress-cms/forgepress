import type { EditorSettings } from '../config/settings'

declare const __FORGEPRESS_SETTINGS__: string

export default JSON.parse(__FORGEPRESS_SETTINGS__) as EditorSettings
