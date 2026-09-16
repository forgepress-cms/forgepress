const DOCUMENT_RULE = /@(?:property\s+--[\w-]+|font-face)\s*\{[^}]*\}/g

export function documentRules(css: string): string[] {
  return css.match(DOCUMENT_RULE) ?? []
}
