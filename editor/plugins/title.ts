import type { InjectionKey, MaybeRefOrGetter } from 'vue'

import { shallowReactive, toValue, watchEffect } from 'vue'

export interface EditorTitle {
  show: (heading: MaybeRefOrGetter<string>) => () => void
  dispose: () => void
}

export const titleKey: InjectionKey<EditorTitle> = Symbol('forgepress:editor:title')

const NAME = 'ForgePress'

export function createTitle(): EditorTitle {
  const original = document.title
  const headings = shallowReactive<MaybeRefOrGetter<string>[]>([])

  const stop = watchEffect(() => {
    const heading = headings.length > 0 ? toValue(headings.at(-1)) : ''

    document.title = heading ? `${heading} · ${NAME}` : NAME
  })

  return {
    show: (heading) => {
      headings.push(heading)

      return () => {
        const index = headings.indexOf(heading)

        if (index !== -1)
          headings.splice(index, 1)
      }
    },

    dispose: () => {
      stop()
      document.title = original
    },
  }
}
