declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const collection: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default collection
}

declare module '*.css?inline' {
  const styles: string
  export default styles
}
