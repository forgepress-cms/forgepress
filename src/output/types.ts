export const OUTPUT_VERSION = 1

export interface OutputFile {
  path: string
  text: string
}

export interface OutputEntry {
  id: string
  createdAt: string
  updatedAt: string
  [field: string]: unknown
}

export interface OutputManifest {
  indexed: string[]
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
