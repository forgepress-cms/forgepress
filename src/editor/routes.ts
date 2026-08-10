import type { EditorRoutes } from './router'

import assets from './pages/assets.vue'
import contentComponentId from './pages/content/component/id.vue'
import contentComponent from './pages/content/component/index.vue'
import content from './pages/content/index.vue'
import index from './pages/index.vue'
import schema from './pages/schema.vue'

export const routes: EditorRoutes = {
  '': index,

  'content': content,
  'content/:component': contentComponent,
  'content/:component/:id': contentComponentId,

  'schema': schema,
  'assets': assets,
}
