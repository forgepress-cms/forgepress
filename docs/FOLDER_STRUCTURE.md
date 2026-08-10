# Folder Structure

```
src/
├── index.ts                  # Public runtime entry; re-exports the define* functions and public types
├── config.ts                 # The defineWebenvConfig / defineWebenvSchema / defineWebenvContent functions
├── unplugin.ts               # Thin bundler entry; wires the build logic into Vite/Webpack/Rollup/etc.
│
├── elements.ts               # Element type union and ElementContent resolver; also drives editor form widgets
├── elements/
│   └── [element].ts          # The element module for each element type; exports the ElementContent type and the element's schema
│
├── query/                    # Read side: typed, awaitable content querying
│   ├── index.ts              # Exports query() and selects the reader by environment
│   ├── builder.ts            # Lazy, awaitable chained builder: query('x').where().sort().with().limit()
│   └── evaluator.ts          # Shared where/sort/limit/locale core used identically by every backend
│
├── content/                  
│   ├── reader/
│   │   ├── browser.ts        # Read backend for the browser (fetches bundled chunks)
│   │   └── node.ts           # Read backend for Node (fetches virtual:webenv/content)
│   └── writer/
│       ├── git.ts            # Write backend for Git
│       └── node.ts           # Write backend for Node (writes via fs)
│
├── editor/                   # Opt-in, prebuilt Vue SPA; webenv's own mountable UI surface
│   ├── index.ts              # Editor entry point; exports mountEditor(target)
│   ├── router.ts             # Hash-based router (provide/inject)
│   ├── App.vue               # Root component
│   ├── components/
│   │   └── layout/           # Shell components (Header, Logo, …)
│   └── shims-vue.d.ts        # *.vue module shim for tsc/dts
│
└── types/
    ├── config/
    │   ├── index.d.ts        # WebenvConfig type
    │   ├── provider.d.ts     # Provider config types
    │   ├── content.d.ts      # ContentConfig (serialization options: indent, semi, …)
    │   └── editor.d.ts       # EditorConfig type
    ├── content/
    │   ├── reader.d.ts       # ContentReader type
    │   └── writer.d.ts       # ContentWriter type
    ├── core/
    │   ├── schema.d.ts       # WebenvSchema and locale types
    │   ├── component.d.ts    # Component type
    │   ├── element.d.ts      # Element metadata types
    │   └── content.d.ts      # Content row/collection types derived from schema + elements
    ├── query/
    │   ├── index.d.ts        # Query plan + typed QueryBuilder surface
    │   └── virtual.d.ts      # Type for the plugin's virtual:webenv/content module
    └── editor/               # Mirrors types/query, but for the editor's write side
        └── index.d.ts        # Editor surface types
```
