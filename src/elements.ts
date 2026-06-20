import type { DynamicElement, DynamicElementContent } from './elements/dynamic'
import type { MediaElement, MediaElementContent } from './elements/media'
import type { NumberElement, NumberElementContent } from './elements/number'
import type { RelationElement, RelationElementContent } from './elements/relation'
import type { RichTextElement, RichTextElementContent } from './elements/rich-text'
import type { TextElement, TextElementContent } from './elements/text'

export type ElementType = DynamicElement | TextElement | NumberElement | RichTextElement | MediaElement | RelationElement

export type ElementContent<TElement extends ElementType>
  = TElement extends DynamicElement
    ? DynamicElementContent<TElement>
    : TElement extends RelationElement
      ? RelationElementContent<TElement>
      : TElement extends MediaElement
        ? MediaElementContent<TElement>
        : TElement extends TextElement
          ? TextElementContent
          : TElement extends NumberElement
            ? NumberElementContent
            : TElement extends RichTextElement
              ? RichTextElementContent
              : never
