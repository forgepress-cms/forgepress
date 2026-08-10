export interface Element {
  label?: string
  description?: string
  optional?: boolean
  translate?: boolean
}

export interface ElementContentMetadata {
  id: string
  status: 'draft' | 'published' | 'archived'
  createdAt: string
  updatedAt: string
}

export type ElementOptionType = 'text' | 'number' | 'boolean' | 'component' | 'components'

export interface ElementOption {
  label: string
  type: ElementOptionType
  required?: true
}

export interface ElementDefinition {
  type: string
  label: string
  options: Record<string, ElementOption>
}

type OptionContent<TOption extends ElementOption> = TOption['type'] extends 'number'
  ? number
  : TOption['type'] extends 'boolean'
    ? boolean
    : TOption['type'] extends 'components'
      ? readonly string[]
      : string

type RequiredOptions<TOptions> = {
  [TKey in keyof TOptions]: TOptions[TKey] extends { required: true } ? TKey : never
}[keyof TOptions]

/** The schema shape an element definition accepts, so every option is declared once. */
export type ElementOf<TDefinition extends ElementDefinition> = TDefinition extends ElementDefinition
  ? Element
  & { type: TDefinition['type'] }
  & { [TKey in RequiredOptions<TDefinition['options']>]: OptionContent<TDefinition['options'][TKey]> }
  & { [TKey in Exclude<keyof TDefinition['options'], RequiredOptions<TDefinition['options']>>]?: OptionContent<TDefinition['options'][TKey]> }
  : never
