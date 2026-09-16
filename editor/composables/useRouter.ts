import type { EditorRouter } from '../plugins/router'
import { inject } from 'vue'
import { routerKey } from '../plugins/router'

export function useRouter(): EditorRouter {
  return inject(routerKey)!
}
