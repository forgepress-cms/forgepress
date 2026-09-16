const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' }

const IMAGE = /!\[[^\]]*\]\([^)]*\)/g
const LINK = /\[([^\]]*)\]\([^)]*\)/g
const CODE = /`([^`]+)`/g
const BOLD = /\*\*([^*]+)\*\*|__([^_]+)__/g
const ITALIC = /(^|\W)(?:\*([^*]+)\*|_([^_]+)_)(?=\W|$)/g
const STRIKE = /~~([^~]+)~~/g
const BLOCK = /^\s*(?:[#>]+\s*|[-*+]\s+|\d+\.\s+)/
const RULE = /^\s*(?:[-*_]\s*){3,}$/

function lines(value: string): string[] {
  return value
    .split('\n')
    .filter(line => !RULE.test(line))
    .map(line => line.replace(BLOCK, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function strip(value: string): string {
  return value
    .replace(IMAGE, '')
    .replace(LINK, '$1')
    .replace(STRIKE, '$1')
    .replace(BOLD, (_, bold: string, underscored: string) => bold ?? underscored)
    .replace(ITALIC, (_, before: string, star: string, underscored: string) => `${before}${star ?? underscored}`)
    .replace(CODE, '$1')
}

export function markdownLines(value: string): string[] {
  return lines(strip(value))
}

export function markdownText(value: string): string {
  return markdownLines(value).join(' ')
}

export function markdownInline(value: string): string {
  const escaped = value.replace(/[&<>]/g, char => ESCAPES[char]!)

  const inline = escaped
    .replace(IMAGE, '')
    .replace(LINK, '$1')
    .replace(CODE, '<code>$1</code>')
    .replace(STRIKE, '<del>$1</del>')
    .replace(BOLD, (_, bold: string, underscored: string) => `<strong>${bold ?? underscored}</strong>`)
    .replace(ITALIC, (_, before: string, star: string, underscored: string) => `${before}<em>${star ?? underscored}</em>`)

  return lines(inline).join(' ')
}
