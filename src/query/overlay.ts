import type { ContentReader } from './client'

export type ContentOverlay = (path: string, base: ContentReader) => Promise<unknown>

let overlay: ContentOverlay | undefined

export function overlaid(base: ContentReader): ContentReader {
  return path => overlay ? overlay(path, base) : base(path)
}

export function overlayContent(next: ContentOverlay | undefined): void {
  overlay = next
}
