# Architecture

ForgePress runs in four places: on the site (queries and the preview), in the browser editor, in bundler plugins and in the CLI. To keep that manageable, the code is split into modules that are stacked in layers. A module may import the modules below it, never the ones above it.

Two ESLint rules in [`scripts/architecture.ts`](scripts/architecture.ts) enforce what this file describes: `forgepress/layers` keeps imports pointing down the layers, and `forgepress/entries` keeps modules talking to each other only through their `index.ts`. `unicorn/filename-case` checks how files are named. [`test/scripts/architecture.test.ts`](test/scripts/architecture.test.ts) checks that the lists in `scripts/architecture.ts` match the folders that exist, that folders are named in kebab-case and that every test sits in the folder of the code it tests.

## Modules

A module is a folder in `src` or `editor`, or a single file at their root, like `editor/App.vue`. Every module follows the same conventions:

- `index.ts` is the module's API. It only re-exports, by name, what other modules may use, like `export { createOutput } from './create'`. It never holds code of its own.
- Other modules import a module through its `index.ts` (`'../schema'`), never a file inside it (`'../schema/types'`).
- Files of a module import each other directly (`'./types'`), never through their own `index.ts`.
- A module that no other module imports, like `cli`, has no `index.ts`.
- Subfolders group the files of a module that belong together, like `editor/components/publish`. They are private to the module and have no `index.ts`. A module only gets them when it does several things, so most modules stay flat.
- Files are named after what they do, in kebab-case. Types that several files of a module share go in `types.ts`; the rest stay next to the code that uses them.
- In the editor, components are PascalCase `.vue` files, composables are `useName.ts` and pages are named after their route.
- The files the package publishes are listed in `build.config.mjs`. They are ordinary files of their module, like `plugin/nuxt.ts`. `src/index.ts` and `src/unplugin.ts` only re-export.
- Tests sit next to the code they test: `src/output/create.ts` is tested in `src/output/create.test.ts`, and `BlockInput.vue` in `BlockInput.test.ts`. A test that covers more of a module, like `src/forge/clients/commit.test.ts`, sits in that module's folder and is named after what it covers. `test/` keeps only the tests of the published types (`test/types`), the fixtures and shared helpers like `settle.ts`.
- Tests may import any file. The layer rules and the size limits skip them, and so do Tailwind and the icon scan in the editor, so nothing from a test reaches the bundle.

## `src`, from the bottom up

**Foundation**

1. `utils`: small helpers that know nothing about content
2. `issues`: problems found in content, with the file and position they belong to

**Content model**

3. `media`: media files and their settings
4. `schema`: collections, components, fields, locales and the meta fields every entry has
5. `entries`: entries, their ids, order, references and validation

**Files and storage**

6. `store`: what content is read from and written to, and storage in the browser
7. `files`: the `.forgepress` folder, its paths, parsing, writing and checks

**Site output**

8. `output`: the JSON files the site reads
9. `query`: queries against that output

**Project**

10. `forge`: git forges, for reading, committing, build checks and signing in, with the GitHub, GitLab and Forgejo clients in `forge/clients`
11. `config`: `forgepress.config` and how it resolves

**Editing**

12. `migrate`: moving content to a changed schema
13. `changes`: unpublished changes, kept in the browser
14. `endpoint`: the content routes of the dev server, and their client
15. `preview`: unpublished content on the site, in the editor and in other tabs

**Integrations**

16. `next`: browser code for Next.js sites
17. `disk`: the project on disk (Node)
18. `server`: the dev server behind the bundler plugins and `forgepress edit`, with its content routes, migrations and the project it loads (Node)
19. `plugin`: the bundler plugins and the Nuxt and Next.js integrations (Node)
20. `cli`: the `forgepress` command (Node)
21. `index.ts`: the entry point of the package
22. `unplugin.ts`: the entry point of the bundler plugins

## `editor`, from the bottom up

The editor builds on `src` and may import any of it. Inside the editor, the same rule applies:

1. `styles.css`
2. `types.ts`: the types of `mountEditor`
3. `settings.ts`: the settings the bundler bakes into the editor
4. `utils`: helpers that render nothing
5. `plugins`: the router, the color mode, the title and the preview pane
6. `composables`: in `common`, `content`, `preview`, `schema` and `session`
7. `components`: grouped by what they are for, like `fields`, `publish` or `table`
8. `pages`: the pages and the routes that lead to them
9. `App.vue`
10. `mount.ts`: `mountEditor`
11. `vue.ts`: the Vue build the editor ships with

## Rules

- Imports between modules point down the lists above.
- `src` never imports the editor.
- `src/cli`, `src/disk`, `src/server`, `src/plugin` and `src/unplugin.ts` use Node. Everything else also has to run in the browser, so it can't import them or `node:` modules.
- A new module needs a place in `LAYERS` in [`scripts/architecture.ts`](scripts/architecture.ts) and in this file. Until it has one, the lint rule reports it.
- The build treats every file in `src` as free of side effects, except the files it publishes. That keeps an `index.ts` from pulling unused code into a bundle. Code that has to run as soon as its file loads, without anything using the file, belongs in a published file, like `next/preview.ts`.

When a rule reports an import, move what both sides need down to the lowest module that uses it, or move the importing code up. Types that several layers share usually belong with the module that owns the concept, such as `MediaConfig` in `media` rather than in `config`.

## Checks

Besides the rules above, `pnpm lint` checks the code itself:

- Type-aware TypeScript rules catch promises nobody waits for, casts that change nothing and `switch` statements that miss a case.
- A function has a complexity of at most 20, and a file in `src`, `editor` or `scripts` at most 400 lines.

`pnpm knip` reports files, exports and dependencies that nothing uses. A file only exports what other files import; the published entries come from `build.config.mjs`. CI runs both.
