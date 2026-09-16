import type { OutputEntry, OutputIndex, OutputManifest } from '../output/types'
import { OUTPUT_INDEX, OUTPUT_VERSION } from '../output/types'
import { keyed } from '../utils/once'
import { quote } from '../utils/value'

export type ContentReader = (path: string) => Promise<unknown>

export interface Snapshot {
  index: OutputIndex
  manifest: (collection: string, locale: string | undefined) => Promise<OutputManifest>
  entries: (collection: string, locale: string | undefined, ids: readonly string[]) => Promise<OutputEntry[]>
}

export interface ContentLoader {
  run: <TValue>(task: (snapshot: Snapshot) => Promise<TValue>) => Promise<TValue>
}

class MissingFile extends Error {}

function manifestPath(index: OutputIndex, collection: string, locale: string | undefined): string {
  const found = index.collections[collection]

  if (!found)
    throw new Error(`[forgepress] the content output has no collection ${quote(collection)}`)

  if (!found.localized)
    return found.manifest

  const path = locale === undefined ? undefined : found.manifests[locale]

  if (path === undefined)
    throw new Error(`[forgepress] the content output has no ${quote(collection)} entries in locale ${quote(locale)}`)

  return path
}

export function createLoader(read: ContentReader): ContentLoader {
  const files = keyed<unknown>()

  function file(path: string): Promise<unknown> {
    return files(path, () => read(path).then((value) => {
      if (value === undefined)
        throw new MissingFile(path)

      return value
    }))
  }

  async function snapshot(): Promise<Snapshot> {
    const index = await read(OUTPUT_INDEX) as OutputIndex | undefined

    if (index === undefined)
      throw new Error(`[forgepress] there is no content output yet: ${OUTPUT_INDEX} is missing. Run forgepress build, or start the dev server with the forgepress plugin`)

    if (index.version !== OUTPUT_VERSION)
      throw new Error(`[forgepress] the content output has format version ${quote(index.version)}, but this version of forgepress reads version ${OUTPUT_VERSION}`)

    const manifest = (collection: string, locale: string | undefined): Promise<OutputManifest> =>
      file(manifestPath(index, collection, locale)) as Promise<OutputManifest>

    return {
      index,
      manifest,
      entries: async (collection, locale, ids) => {
        const { files: paths } = await manifest(collection, locale)

        return Promise.all(ids.flatMap(id => paths[id] === undefined ? [] : [file(paths[id]) as Promise<OutputEntry>]))
      },
    }
  }

  return {
    async run(task) {
      try {
        return await task(await snapshot())
      }
      catch (error) {
        if (!(error instanceof MissingFile))
          throw error
      }

      try {
        return await task(await snapshot())
      }
      catch (error) {
        if (error instanceof MissingFile)
          throw new Error(`[forgepress] the content output links ${error.message}, but the file doesn't exist`)

        throw error
      }
    },
  }
}
