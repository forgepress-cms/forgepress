import { useRouter } from './useRouter'

export function useParam(name: string): string {
  const value = useRouter().route.value.params[name]

  if (!value)
    throw new Error(`[webenv] the route is missing the '${name}' parameter`)

  return value
}
