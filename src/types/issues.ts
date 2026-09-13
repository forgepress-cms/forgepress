export type ValuePath = readonly (string | number)[]

export interface Location {
  line: number
  column: number
}

export interface ValueIssue {
  path: ValuePath
  message: string
}

export interface ContentIssue extends Location {
  file: string
  message: string
}
