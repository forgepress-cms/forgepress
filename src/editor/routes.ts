import type { EditorRoutes } from './plugins/router'

import assets from './pages/assets.vue'
import contentComponentId from './pages/content/component/id.vue'
import contentComponent from './pages/content/component/index.vue'
import content from './pages/content/index.vue'
import index from './pages/index.vue'
import schemaComponentField from './pages/schema/component/field.vue'
import schemaComponent from './pages/schema/component/index.vue'
import schema from './pages/schema/index.vue'

export const routes: EditorRoutes = {
  '': index,

  'content': content,
  'content/:component': contentComponent,
  'content/:component/new': contentComponentId,
  'content/:component/:id': contentComponentId,

  'schema': schema,
  'schema/:component': schemaComponent,
  'schema/:component/:field': schemaComponentField,

  'assets': assets,
}
