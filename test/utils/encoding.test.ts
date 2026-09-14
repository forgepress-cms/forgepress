import { describe, expect, it } from 'vitest'
import { base64ToText, digest, textToBase64, toBase64, toHex } from '../../src/utils/encoding'

describe('base64', () => {
  it('round-trips binary data', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 255])

    expect(toBase64(bytes.buffer)).toBe(btoa(String.fromCharCode(...bytes)))
    expect(toBase64(bytes)).toBe(btoa(String.fromCharCode(...bytes)))
  })

  it('handles data larger than one chunk', () => {
    const bytes = new Uint8Array(0x8000 * 2 + 5).fill(65)

    expect(atob(toBase64(bytes.buffer))).toHaveLength(bytes.length)
  })

  it('round-trips text beyond ASCII', () => {
    expect(base64ToText(textToBase64('name: \'Grüße 👋\''))).toBe('name: \'Grüße 👋\'')
  })
})

describe('hex', () => {
  it('writes every byte as two digits', () => {
    expect(toHex(new Uint8Array([0, 15, 255]))).toBe('000fff')
  })

  it('hashes data with SHA-1 and SHA-256', async () => {
    const data = new TextEncoder().encode('abc')

    expect(await digest('SHA-1', data)).toBe('a9993e364706816aba3e25717850c26c9cd0d89d')
    expect(await digest('SHA-256', data)).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})
