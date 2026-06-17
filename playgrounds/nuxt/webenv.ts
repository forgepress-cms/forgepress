import { defineWebenvConfig } from '../../src/config'
import { defineWebenvSchema } from '../../src/schema'
import { defineWebenvContent } from '../../src/content'

type ContentModule = {
  default?: unknown
}

type ContentLoader = () => Promise<ContentModule>

declare global {
  interface ImportMeta {
    glob(pattern: string): Record<string, ContentLoader>
  }
}

export {}

const contentLoaders = import.meta.glob('./.webenv/content/*.ts') as Record<
  string,
  ContentLoader
>

export async function query(component: string, ids?: string | string[]) {
  const loader = contentLoaders[`./.webenv/content/${component}.ts`]
  const module = loader ? await loader() : undefined
  const componentData = (Array.isArray(module?.default) ? module.default : []) as any[]

  if (!ids) {
    return componentData
  }

  const isSingular = typeof ids === 'string'
  const idArray = Array.isArray(ids) ? ids : [ids]
  const filteredData = componentData.filter((item: any) => idArray.includes(item.id))

  return isSingular ? filteredData[0] : filteredData
}

export { defineWebenvConfig, defineWebenvSchema, defineWebenvContent }
