import { toHex } from '../utils/encoding'

export function entryId(collection: string): string {
  return `${collection}_${toHex(crypto.getRandomValues(new Uint8Array(6)))}`
}
