const CHUNK = 0x8000

function bytesOf(data: ArrayBuffer | Uint8Array): Uint8Array {
  return data instanceof Uint8Array ? data : new Uint8Array(data)
}

export function toBase64(data: ArrayBuffer | Uint8Array): string {
  const bytes = bytesOf(data)
  const parts: string[] = []

  for (let offset = 0; offset < bytes.length; offset += CHUNK)
    parts.push(String.fromCharCode(...bytes.subarray(offset, offset + CHUNK)))

  return btoa(parts.join(''))
}

export function textToBase64(text: string): string {
  return toBase64(new TextEncoder().encode(text))
}

export function base64ToBytes(data: string): Uint8Array {
  return Uint8Array.from(atob(data.replace(/\s/g, '')), char => char.charCodeAt(0))
}

export function base64ToText(data: string): string {
  return new TextDecoder().decode(base64ToBytes(data))
}

export function toHex(data: ArrayBuffer | Uint8Array): string {
  return [...bytesOf(data)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function digest(algorithm: 'SHA-1' | 'SHA-256', data: ArrayBuffer | Uint8Array<ArrayBuffer>): Promise<string> {
  return toHex(await crypto.subtle.digest(algorithm, data))
}
