import type { WebenvConfig } from './types'

export function defineWebenvConfig<const T extends WebenvConfig>(config: T) {
  return config
}
