export interface FieldBase {
  label?: string
  description?: string
  optional?: boolean
  translate?: boolean
}

export type FieldOptionType = 'text' | 'number' | 'boolean' | 'collections' | 'components' | 'strings'

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
  without?: readonly (keyof FieldBase)[]
}

type OptionContent<TOption extends FieldOption> = TOption['type'] extends 'number'
  ? number
  : TOption['type'] extends 'boolean'
    ? boolean
    : TOption['type'] extends 'collections' | 'components' | 'strings'
      ? readonly string[]
      : string

type Without<TDefinition extends FieldTypeDefinition> = TDefinition['without'] extends readonly (infer TKey extends keyof FieldBase)[] ? TKey : never

type RequiredOptions<TOptions> = {
  [TKey in keyof TOptions]: TOptions[TKey] extends { required: true } ? TKey : never
}[keyof TOptions]

export type FieldOf<TDefinition extends FieldTypeDefinition> = TDefinition extends FieldTypeDefinition
  ? Omit<FieldBase, Without<TDefinition>>
  & { [TKey in Without<TDefinition>]?: never }
  & { type: TDefinition['type'] }
  & { [TKey in RequiredOptions<TDefinition['options']>]: OptionContent<TDefinition['options'][TKey]> }
  & { [TKey in Exclude<keyof TDefinition['options'], RequiredOptions<TDefinition['options']>>]?: OptionContent<TDefinition['options'][TKey]> }
  : never
