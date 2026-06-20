# Folder Structure

```
src/
├── index.ts                  # Public runtime entry; re-exports the define*  functions and public types
├── config.ts                 # The defineWebenvConfig / defineWebenvSchema / defineWebenvContent functions
├── unplugin.ts               # Thin bundler entry; wires the build logic into Vite/Webpack/Rollup/etc.
│
├── elements.ts               # Element type union and ElementContent resolver; also drives editor form widgets
├── elements/
│   └── [element].ts          # The element module for each element type; exports the ElementContent type and the element's schema
│
├── query.ts                  # Exports query() and selects the backend by environment
├── query/
│   ├── builder.ts            # Lazy, awaitable chained builder: query('x').where().sort().with().limit()
│   ├── evaluator.ts          # Shared where/sort/limit core used identically by both backends
│   └── backend/
│       ├── node.ts           # Disk/in-memory read backend for SSR/SSG build time
│       └── browser.ts        # Fetches the static index, plans shards, fetches only what's needed
│
├── build/
│   └── content.ts            # Loads .webenv/*, validates, emits the index + body shards + manifest
│
├── write.ts                  # The headless write API (mutate, publish)
├── write/
│   ├── state.ts              # Holds pending edits client-side (memory/localStorage) until publish
│   └── serialize.ts          # Full-regeneration canonical TS printer; data -> .ts content files
│
├── storage.ts                # The write-target storage abstraction
├── storage/
│   ├── node.ts               # Local disk storage target (dev): read current file, write file
│   └── git/
│       ├── github.ts         # GitHub provider: get current file + commit changes
│       ├── gitlab.ts         # GitLab provider: get current file + commit changes
│       └── codeberg.ts       # Codeberg/Forgejo provider: get current file + commit changes
│
├── validation.ts             # The shared validator
├── validation/
│   └── relations.ts          # Build-time relation integrity: every referenced id resolves
│
├── editor/                   # Opt-in, lazy editor; webenv's own mountable UI surface
│   ├── index.ts              # Editor entry point
│   ├── forms/                # Schema-driven form widgets per element type
│   ├── schema/               # Local-only schema editing; omitted from the deployed editor bundle
│   └── auth/                 # Per-provider OAuth (PKCE) for committing to Git from the browser
│
└── types/
    ├── config/
    │   ├── index.d.ts        # WebenvConfig type
    │   └── provider.d.ts     # Provider config types
    └── core/
        ├── schema.d.ts       # WebenvSchema and locale types
        ├── component.d.ts    # Component type
        ├── element.d.ts      # Element metadata types
        ├── content.d.ts      # Content row/collection types derived from schema + elements
        ├── query.d.ts        # Query builder, operator, and result types
        ├── write.d.ts        # Write API contracts
        └── storage.d.ts      # Storage provider interface contract
```
