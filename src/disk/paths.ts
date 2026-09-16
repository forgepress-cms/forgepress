import { isAbsolute, relative, sep } from 'node:path'

export function toPosix(path: string): string {
  return path.split(sep).join('/')
}

export function isInside(parent: string, child: string): boolean {
  const path = relative(parent, child)

  return path !== '' && path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path)
}
