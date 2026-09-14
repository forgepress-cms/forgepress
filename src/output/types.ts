import type { OutputMeta } from '../types/entry'

export const OUTPUT_VERSION = 1

export const OUTPUT_INDEX = 'index.json'

export type LinkKind = 'relation' | 'dynamic'

export interface OutputFile {
  path: string
  text: string
}

export interface OutputEntry extends OutputMeta {
  [field: string]: unknown
}

export interface OutputManifest {
  indexed: string[]
  links: Record<string, LinkKind>
  entries: OutputEntry[]
  files: Record<string, string>
}

export type OutputCollection = { localized: false, manifest: string } | { localized: true, manifests: Record<string, string> }

export interface OutputIndex {
  version: number
  commit: string | null
  dev?: true
  locales: string[]
  collections: Record<string, OutputCollection>
}
