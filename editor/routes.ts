import type { EditorRoutes } from './plugins/router'

import assets from './pages/assets.vue'
import contentCollectionId from './pages/content/collection/id.vue'
import contentCollection from './pages/content/collection/index.vue'
import content from './pages/content/index.vue'
import index from './pages/index.vue'
import schemaCollectionField from './pages/schema/collection/field.vue'
import schemaCollection from './pages/schema/collection/index.vue'
import schema from './pages/schema/index.vue'

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
