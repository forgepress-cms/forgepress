const COLLECTION_NAME = /^[a-z][a-zA-Z\d]*$/

export function isCollectionName(name: string): boolean {
  return COLLECTION_NAME.test(name)
}
