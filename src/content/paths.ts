export const WEBENV_DIR = '.webenv'
export const CONTENT_DIR = `${WEBENV_DIR}/content`
export const SCHEMA_FILE = `${WEBENV_DIR}/schema.ts`
export const AUGMENTATION_FILE = `${WEBENV_DIR}/webenv.d.ts`

export const ENDPOINT = '/__webenv'

export function toComponentName(file: string): string {
  return file.replace(/\.ts$/, '').replace(/-(\w)/g, (_, char: string) => char.toUpperCase())
}

export function toFileName(component: string): string {
  return `${component.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)}.ts`
}
