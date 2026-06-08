import type { WebenvConfig } from './types/config'

export function defineWebenvConfig<const T extends WebenvConfig>(config: T) {
  return config
}
