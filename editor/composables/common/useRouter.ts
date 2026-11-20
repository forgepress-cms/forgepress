import type { EditorRouter } from '../../plugins'
import { inject } from 'vue'
import { routerKey } from '../../plugins'

export function useRouter(): EditorRouter {
  return inject(routerKey)!
}
