import type { ForgePressSchema, RegisteredSchema } from '../types/schema'
import type { Query } from './types'
import { reader } from '#content-reader'
import { Builder } from './builder'
import { createLoader } from './client'
import { fetchReader } from './fetch'

export interface ClientOptions {
  url?: string
}

export interface Client<TSchema extends ForgePressSchema = RegisteredSchema> {
  query: Query<TSchema>
}

export function createClient<TSchema extends ForgePressSchema = RegisteredSchema>(options: ClientOptions = {}): Client<TSchema> {
  const loader = createLoader(options.url === undefined ? reader : fetchReader(options.url))
  const query = (collection: string): Builder => new Builder(loader, collection)

  return { query: query as unknown as Query<TSchema> }
}

export const query: Query<RegisteredSchema> = createClient().query
