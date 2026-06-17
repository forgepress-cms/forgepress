export async function query(component: string, ids?: string | string[]) {
  let componentData: any[] = []

  try {
    const module = await import(`./.webenv/content/${component}.ts`)

    componentData = Array.isArray(module.default) ? module.default : []
  }
  catch {
    if (!ids) {
      return []
    }

    return typeof ids === 'string' ? undefined : []
  }

  if (!ids) {
    return componentData
  }

  const isSingular = typeof ids === 'string'

  const idArray = Array.isArray(ids) ? ids : [ids]

  const filteredData = componentData.filter((item: any) => idArray.includes(item.id))

  return isSingular ? filteredData[0] : filteredData
}

