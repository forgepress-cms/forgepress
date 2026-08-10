import type { DynamicElement, DynamicElementContent } from './elements/dynamic'
import type { ImageElement, ImageElementContent } from './elements/image'
import type { NumberElement, NumberElementContent } from './elements/number'
import type { RelationElement, RelationElementContent } from './elements/relation'
import type { RichTextElement, RichTextElementContent } from './elements/rich-text'
import type { TextElement, TextElementContent } from './elements/text'
import type { VideoElement, VideoElementContent } from './elements/video'
import dynamic from './elements/dynamic'
import image from './elements/image'
import number from './elements/number'
import relation from './elements/relation'
import richtext from './elements/rich-text'
import text from './elements/text'
import video from './elements/video'

export const elements = { text, richtext, number, image, video, relation, dynamic }

export type ElementType = TextElement | RichTextElement | NumberElement | ImageElement | VideoElement | RelationElement | DynamicElement

export type ElementContent<TElement extends ElementType>
  = TElement extends DynamicElement
    ? DynamicElementContent<TElement>
    : TElement extends RelationElement
      ? RelationElementContent<TElement>
      : TElement extends ImageElement
        ? ImageElementContent<TElement>
        : TElement extends VideoElement
          ? VideoElementContent<TElement>
          : TElement extends TextElement
            ? TextElementContent
            : TElement extends NumberElement
              ? NumberElementContent
              : TElement extends RichTextElement
                ? RichTextElementContent
                : never

export const elementTypes = Object.keys(elements) as ElementType['type'][]
