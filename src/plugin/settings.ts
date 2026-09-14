import type { ResolvedConfig } from '../config/resolve'
import { createMediaStore } from '../disk/media'

export const SETTINGS_ID = 'virtual:forgepress/settings'

export function resolved(id: string): string {
  return `\0${id}`
}

export async function generateSettings(root: string, local: boolean, config: ResolvedConfig): Promise<string> {
  const assets = await createMediaStore(root, config.media).list()

  return [
    `export const local = ${local}`,
    `export const provider = ${JSON.stringify(config.provider ?? null)}`,
    `export const format = ${JSON.stringify(config.content ?? null)}`,
    `export const contentPath = ${JSON.stringify(config.paths.dir)}`,
    `export const media = ${JSON.stringify({ ...config.media, assets })}`,
    '',
  ].join('\n')
}
