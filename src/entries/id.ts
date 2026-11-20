import { toHex } from '../utils'

const ENTRY_ID = /^[\w-]+$/

export function entryId(collection: string): string {
  return `${collection}_${toHex(crypto.getRandomValues(new Uint8Array(6)))}`
}

export function isEntryId(id: string): boolean {
  return ENTRY_ID.test(id)
}
