import { describe, expect, it } from 'vitest'
import { markdownInline, markdownText } from '../src/editor/utils/markdown'

describe('markdownText', () => {
  it('drops heading and list markers', () => {
    expect(markdownText('## Welcome\n\n- one\n- two')).toBe('Welcome one two')
  })

  it('unwraps emphasis, code and links', () => {
    expect(markdownText('A **bold** and *soft* `call()` with a [link](https://example.com)'))
      .toBe('A bold and soft call() with a link')
  })

  it('removes images entirely', () => {
    expect(markdownText('Before ![Hero](/uploads/hero.png) after')).toBe('Before after')
  })

  it('drops horizontal rules and blank lines', () => {
    expect(markdownText('One\n\n---\n\nTwo')).toBe('One Two')
  })

  it('leaves plain text alone', () => {
    expect(markdownText('Just a sentence.')).toBe('Just a sentence.')
  })

  it('keeps underscores inside words', () => {
    expect(markdownText('the some_field_name value')).toBe('the some_field_name value')
  })
})

describe('markdownInline', () => {
  it('renders emphasis as tags', () => {
    expect(markdownInline('**bold** and *soft*')).toBe('<strong>bold</strong> and <em>soft</em>')
  })

  it('renders code and strikethrough', () => {
    expect(markdownInline('`call()` and ~~gone~~')).toBe('<code>call()</code> and <del>gone</del>')
  })

  it('keeps link text without the target', () => {
    expect(markdownInline('a [link](https://example.com) here')).toBe('a link here')
  })

  it('drops images', () => {
    expect(markdownInline('![Hero](/uploads/hero.png)Text')).toBe('Text')
  })

  it('escapes markup in the content', () => {
    expect(markdownInline('a <script>alert(1)</script> b')).toBe('a &lt;script&gt;alert(1)&lt;/script&gt; b')
  })

  it('escapes ampersands', () => {
    expect(markdownInline('Tom & Jerry')).toBe('Tom &amp; Jerry')
  })

  it('flattens blocks onto one line', () => {
    expect(markdownInline('# Title\n\nBody text')).toBe('Title Body text')
  })
})
