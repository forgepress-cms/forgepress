import type { OutputMeta } from '../entries/types'

export const OUTPUT_VERSION = 3

export const OUTPUT_INDEX = 'index.json'

export interface LinkField {
  collections: string[]
  multiple: boolean
}

export interface LinkItems {
  components: string[]
  multiple: boolean
}

export type LinkTarget = LinkField | LinkItems

export type LinkedFields = Record<string, LinkTarget>

export interface OutputFile {
  path: string
  text: string
}

export interface OutputEntry extends OutputMeta {
  [field: string]: unknown
}

export interface OutputManifest {
  indexed: string[]
  links: LinkedFields
  components?: Record<string, LinkedFields>
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
