import type { ResolvedConfig } from '../config/resolve'

export const SETTINGS_ID = 'virtual:forgepress/settings'

export function resolved(id: string): string {
  return `\0${id}`
}

export function generateSettings(local: boolean, config: ResolvedConfig): string {
  return [
    `export const local = ${local}`,
    `export const provider = ${JSON.stringify(config.provider ?? null)}`,
    `export const format = ${JSON.stringify(config.content ?? null)}`,
    `export const contentPath = ${JSON.stringify(config.paths.dir)}`,
    `export const media = ${JSON.stringify(config.media)}`,
    '',
  ].join('\n')
}
