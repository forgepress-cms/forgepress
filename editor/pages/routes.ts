import type { EditorRoutes } from '../plugins'

import assets from './assets.vue'
import contentCollectionId from './content/collection/id.vue'
import contentCollection from './content/collection/index.vue'
import content from './content/index.vue'
import index from './index.vue'
import schemaCollectionField from './schema/collection/field.vue'
import schemaCollection from './schema/collection/index.vue'
import schema from './schema/index.vue'

export const routes: EditorRoutes = {
  '': index,

  'content': content,
  'content/:collection': contentCollection,
  'content/:collection/new': contentCollectionId,
  'content/:collection/:id': contentCollectionId,

  'schema': schema,
  'schema/collections/:collection': schemaCollection,
  'schema/collections/:collection/:field': schemaCollectionField,
  'schema/components/:component': schemaCollection,
  'schema/components/:component/:field': schemaCollectionField,

  'assets': assets,
}
