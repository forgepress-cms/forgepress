import type { MaybeRefOrGetter } from 'vue'
import { inject, onScopeDispose } from 'vue'
import { titleKey } from '../../plugins'

export function useTitle(heading: MaybeRefOrGetter<string>): void {
  onScopeDispose(inject(titleKey)!.show(heading))
}
