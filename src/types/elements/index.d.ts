import type { DynamicElement, DynamicElementContent } from './dynamic'
import type { MediaElement, MediaElementContent } from './media'
import type { RelationElement, RelationElementContent } from './relation'
import type { RichTextElement, RichTextElementContent } from './rich-text'
import type { TextElement, TextElementContent } from './text'

export type ElementType = DynamicElement | TextElement | RichTextElement | MediaElement | RelationElement

export type ElementContent<TElement extends ElementType>
  = TElement extends DynamicElement
    ? DynamicElementContent<TElement>
    : TElement extends RelationElement
      ? RelationElementContent<TElement>
      : TElement extends MediaElement
        ? MediaElementContent<TElement>
        : TElement extends TextElement
          ? TextElementContent
          : TElement extends RichTextElement
            ? RichTextElementContent
            : never

