import type { MediaElement, MediaElementInput } from './media'
import type { RelationElement, RelationElementInput } from './relation'
import type { RichTextElement, RichTextElementInput } from './rich-text'
import type { TextElement, TextElementInput } from './text'

export type ElementType = TextElement | RichTextElement | MediaElement | RelationElement

export type ElementInput<TElement extends ElementType>
  = TElement extends TextElement
    ? TextElementInput
    : TElement extends RichTextElement
      ? RichTextElementInput
      : TElement extends MediaElement
        ? MediaElementInput
        : TElement extends RelationElement
          ? RelationElementInput
          : never
