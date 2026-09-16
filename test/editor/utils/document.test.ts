import { describe, expect, it } from 'vitest'
import { documentRules } from '../../../editor/utils/document'

const PROPERTY = '@property --tw-shadow{syntax:"*";inherits:false;initial-value:0 0 #0000}'
const FONT = '@font-face{font-family:"ForgePress Bricolage Grotesque";font-weight:200 800;src:url(data:font/woff2;base64,d09GMgABAAAAAA+/aB==)format("woff2-variations");unicode-range:U+0000-00FF,U+20AC}'

describe('documentRules', () => {
  it('takes the property and font rules a shadow root ignores, from minified CSS', () => {
    const css = `:host{--ui-radius:.375rem}${PROPERTY}.sheet{background-color:var(--ui-bg-sheet)}${FONT}@media (min-width:64rem){.lg\\:p-6{padding:1.5rem}}`

    expect(documentRules(css)).toEqual([PROPERTY, FONT])
  })

  it('finds nothing in a stylesheet without them', () => {
    expect(documentRules('.sheet{background-color:var(--ui-bg-sheet)}')).toEqual([])
  })
})
