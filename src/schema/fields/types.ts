export interface FieldBase {
  label?: string
  description?: string
  optional?: boolean
  translate?: boolean
}

export type FieldOptionType = 'text' | 'number' | 'boolean' | 'collection' | 'collections'

export interface FieldOption {
  label: string
  type: FieldOptionType
  description?: string
  required?: true
}

export interface FieldTypeDefinition {
  type: string
  label: string
  options: Record<string, FieldOption>
}

type OptionContent<TOption extends FieldOption> = TOption['type'] extends 'number'
  ? number
  : TOption['type'] extends 'boolean'
    ? boolean
    : TOption['type'] extends 'collections'
      ? readonly string[]
      : string

type RequiredOptions<TOptions> = {
  [TKey in keyof TOptions]: TOptions[TKey] extends { required: true } ? TKey : never
}[keyof TOptions]

export type FieldOf<TDefinition extends FieldTypeDefinition> = TDefinition extends FieldTypeDefinition
  ? FieldBase
  & { type: TDefinition['type'] }
  & { [TKey in RequiredOptions<TDefinition['options']>]: OptionContent<TDefinition['options'][TKey]> }
  & { [TKey in Exclude<keyof TDefinition['options'], RequiredOptions<TDefinition['options']>>]?: OptionContent<TDefinition['options'][TKey]> }
  : never
