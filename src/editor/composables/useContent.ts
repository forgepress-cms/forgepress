import type { EditorContent } from '../plugins/content'
import { inject } from 'vue'
import { contentKey } from '../plugins/content'

export function useContent(): EditorContent {
  return inject(contentKey)!
}
