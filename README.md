# ForgePress

[![Github Actions][github-actions-src]][github-actions-href]
[![NPM version][npm-version-src]][npm-version-href]
[![NPM last update][npm-last-update-src]][npm-last-update-href]
[![License][license-src]][license-href]

Fully static, git-based CMS with a live editor.
Deploys with your static site, no database, server or edge functions needed.
Typed schemas, content, and querying end to end, from the repository to the live site.

## How it works

ForgePress deploys an editor with your static website that connects directly to your forge provider:

* GitHub
* GitLab
* Codeberg/Forgejo

You can manage your content, edit it with a live preview, and publish it via a commit to your git repository.

## Features

* Fully static, can live on a CDN
* Live editor with preview
* Typed schemas, content, and queries
* Localization
* Content versioning
* Media management

## Install

```sh
pnpm add forgepress
```

## Quick start

<details>
<summary><b>Nuxt</b></summary>

1. Add the module

   ```ts
   export default defineNuxtConfig({
     modules: ['forgepress/nuxt'],
   })
   ```

2. Give the editor a page, such as `app/pages/admin.vue`

   ```vue
   <script setup lang="ts">
   import { mountEditor } from 'forgepress/editor'

   const host = useTemplateRef('host')

   onMounted(() => {
     const unmount = mountEditor(host.value)

     onBeforeUnmount(unmount)
   })
   </script>

   <template>
     <div id="forgepress" ref="host" />
   </template>
   ```

3. Query the content

   ```ts
   import { query } from 'forgepress'

   const { data: home } = await useAsyncData('home', () => query('page').where('slug', '/').first())
   ```

</details>

<details>
<summary><b>Next.js</b></summary>

1. Wrap the config

   ```ts
   import { withForgePress } from 'forgepress/next'

   export default withForgePress({
     output: 'export',
   })
   ```

2. Give the editor a page, such as `app/admin/page.tsx`

   ```tsx
   'use client'

   import { mountEditor } from 'forgepress/editor'
   import { useEffect, useRef } from 'react'

   export default function Admin() {
     const host = useRef<HTMLDivElement>(null)

     useEffect(() => mountEditor(host.current), [])

     return <div id="forgepress" ref={host} />
   }
   ```

3. Query the content

   ```ts
   import { query } from 'forgepress'

   const home = await query('page').where('slug', '/').first()
   ```

</details>

<details>
<summary><b>Vite, Rollup, webpack, Rspack, Rolldown, Farm</b></summary>

1. Add the plugin for your bundler

   ```ts
   import forgepress from 'forgepress/unplugin'
   import { defineConfig } from 'vite'

   export default defineConfig({
     plugins: [forgepress.vite()],
   })
   ```

   - Or `.rollup()`, `.webpack()`, `.rspack()`, `.rolldown()` and `.farm()` depending on your bundler

2. Mount the editor wherever your app has a page for it

   ```ts
   import { mountEditor } from 'forgepress/editor'

   mountEditor(document.querySelector('#forgepress'))
   ```

3. Query the content

   ```ts
   import { query } from 'forgepress'

   const home = await query('page').where('slug', '/').first()
   ```

</details>

<details>
<summary><b>No framework</b></summary>

Start the editor

```sh
forgepress edit
```

- Serves the editor on its own at `http://localhost:4390`

</details>

## Schema

ForgePress uses a schema to validate and structure your content.
You can edit it through the editor's Schema page or by hand in `.forgepress/schema.ts`.
A typical schema file looks like this:

```ts
import type { ForgePressSchema } from 'forgepress'

export default {
  collections: {
    page: {
      label: 'Page',
      description: 'A page of the site, with a title and content',
      fields: {
        title: {
          type: 'text',
          label: 'Title',
          description: 'The title of the page',
        },
        slug: {
          type: 'text',
          label: 'Slug',
          description: 'The address of the page, such as / for the home page',
          index: true,
        },
        content: {
          type: 'richtext',
          label: 'Content',
          description: 'The content of the page',
        },
      },
    },
  },
  locales: ['en', 'de'],
  defaultLocale: 'en',
} as const satisfies ForgePressSchema
```

Available fields include:
- `text`: single-line text input
- `richtext`: rich text editor
- `number`: numeric input
- `boolean`: on/off switch
- `image`: image upload
- `video`: video upload
- `relation`: link to another collection's entry
- `dynamic`: link to any predefined collection's entry

### Migrations

Schemas define the shape of your content, so changes to the schema may require migrating existing content to fit the new structure.
In the editor, schema changes trigger a review process that gives you the option to update existing content to match the new structure.
When editing schema files by hand you can run `npx forgepress migrate` to keep your content up to date from your terminal.

## Content files

- One TypeScript file per entry, under `.forgepress/content/<collection>/<id>.ts`
- Every entry carries id, status, createdAt and updatedAt
- Entries are typed against the schema, a wrong field is a type error before it's a build error
- Relations store the linked entry's id, dynamic fields store a collection and an id

## Editor

- Runs inside your own site at a page you choose, in development and in production
- Content: entries, drafts, rich text, media and linked blocks
- Schema: collections, fields and locales, with content migrations
- In development it writes the files to disk, in production it collects changes and publishes them as a commit

## Publishing

- The deployed editor signs in with the forge and publishes changes as a commit
- Forges: GitLab, GitHub and Forgejo
- Changes are kept in the browser until they're published
- Conflicts are detected against the version the edit was made on, and merged field by field where possible

## Preview

- The site can render unpublished content for signed-in editors
- A badge on the page turns it on and off

## CLI

ForgePress can be run from the CLI using the following commands:

```sh
forgepress check
forgepress edit
forgepress migrate
forgepress build
```

- `check`: checks the schema and content of your .forgepress folder
- `edit`: starts a standalone editor, with no site or bundler on port 4390
- `migrate`: migrates the content after a hand edit or a merge
- `build`: writes the content output to the directory specified in `output.dir`

## Configuration

You can configure your ForgePress setup using a `forgepress.config.{ts,js,mjs}` file in the project root:

```ts
import { defineForgePressConfig } from 'forgepress'

export default defineForgePressConfig({
  path: '.forgepress',

  provider: {
    type: 'github',

    repository: {
      owner: 'forgepress-cms',
      name: 'forgepress',
      branch: 'main',
    },

    base: '.',

    commitMessage: 'chore(content): {name}',
  },
})
```

Available configuration values:

- `path`: the path to the `.forgepress` folder
- `provider`: the Git provider configuration
  - `type`: the type of Git provider (e.g., 'github', 'gitlab', 'forgejo')
  - `repository`: the repository configuration
    - `owner`: the owner of the repository
    - `name`: the name of the repository
    - `branch`: the branch of the repository
  - `base`: the base directory for the content within the repository
  - `url`: the URL of the Git provider
  - `clientId`: the client ID for authentication
  - `scopes`: the scopes required for authentication
  - `redirectUri`: the redirect URI for authentication
  - `commitMessage`: the commit message template
- `content`: the content configuration
  - `semi`: whether to use semicolons in the content formatting
  - `indent`: the number of spaces to use for indentation in the content formatting
- `media`: the media configuration
  - `dir`: the directory where media files are stored
  - `url`: the base URL for accessing media files
  - `maxSize`: the maximum allowed size for media files
- `output`: the build output configuration
  - `dir`: the directory where the built output-files are written

## License

Published under the [MIT License](https://github.com/forgepress-cms/forgepress/blob/main/LICENSE).

[github-actions-src]: https://github.com/forgepress-cms/forgepress/actions/workflows/test.yml/badge.svg
[github-actions-href]: https://github.com/forgepress-cms/forgepress/actions
[npm-version-src]: https://img.shields.io/npm/v/forgepress/latest.svg?style=flat&colorA=18181B&colorB=31C553
[npm-version-href]: https://npmx.dev/package/forgepress
[npm-last-update-src]: https://img.shields.io/npm/last-update/forgepress.svg?style=flat&colorA=18181B&colorB=31C553
[npm-last-update-href]: https://npmx.dev/package/forgepress
[license-src]: https://img.shields.io/github/license/forgepress-cms/forgepress.svg?style=flat&colorA=18181B&colorB=31C553
[license-href]: https://github.com/forgepress-cms/forgepress/blob/main/LICENSE
