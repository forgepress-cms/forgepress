import type { PreviewPage } from 'forgepress'

export type PreviewLink = string | ((page: PreviewPage) => string | undefined)

export interface EditorOptions {
  preview?: PreviewLink
}

export type MountEditor = (target?: Element | string | null, options?: EditorOptions) => () => void
