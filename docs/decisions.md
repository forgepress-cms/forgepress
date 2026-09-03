# Decisions

Design decisions that are not yet visible in the code. Newest first.

## Static publishing model — 2026-09-02

### Auth

- The editor is gated on being an authenticated **collaborator** with write access to the content repo. No forks, no anonymous editing.
- The gate is UX, not a security boundary. Enforcement is the forge rejecting the write from a non-collaborator.
- Collaborator check: authenticated `GET /repos/{owner}/{repo}`, read `permissions.push`.
- Repos may be public **or private**, so narrow public-only scopes (GitHub `public_repo`) are not viable.
- GitHub cannot do OAuth PKCE, and a GitHub App does not fix that on its own — user-to-server token exchange still posts a `client_secret`, which cannot ship in a static bundle. GitHub uses the **device flow** (`/login/device/code`), which needs no secret. GitLab and Forgejo use PKCE.
- GitHub uses a **GitHub App**, not an OAuth App: the app is installed per-repository, so a user token reaches only the repos it is installed on. An OAuth App would require `repo` scope, granting the editor every repo the user can see.
- Token refresh is required regardless of provider — GitLab (2h, rotating single-use refresh) and Forgejo both expire access tokens, as do GitHub App user tokens (8h + 6mo refresh). Build refresh once, in shared code.
- `GitHubProviderConfig.auth.clientSecret` in `src/types/config/provider.d.ts` is wrong and must not survive into the implementation.

### Change accumulation

- Edits accumulate client-side on every save; nothing reaches the forge until Publish.
- Storage is **IndexedDB**, not localStorage — the ~5MB string-only quota cannot hold media binaries. Drafts and binaries share one store so a successful publish clears one thing.

### Publish

- One publish is **one commit directly to main**. No branch, no PR, no review step.
- The commit message comes from an admin-configured template carrying a placeholder, filled with a changelog-style name the user supplies at publish time.
- Use the Git Data API rather than per-file contents calls: create blobs, build a tree on the known base commit, create the commit, then update the ref with `force: false`. This makes a multi-file publish atomic and makes a stale write fail loudly instead of clobbering.

### Stale base

- The editor reads content from the build-time bundle (`virtual:webenv/content`) — a snapshot of the last CI build. Main moves independently.
- Writes are whole-component (`writeContent(component, rows)`), so an editor on a stale bundle would otherwise silently revert newer changes. With no PR step, nothing else catches this.
- Correctness backstop is the non-forced ref update above: if main moved, the publish is rejected and the editor refetches.
- Additionally bake the source commit SHA into the bundle at build time, so a stale editor can warn *before* the user starts editing rather than at publish.

### Deployed vs dev

- Schema editing is dev-only. A deployed editor renders the schema pages **read-only**.
- Mode is detected, never configured. `mountEditor(target)` takes no setup arguments: an embedder should not have to work out which mode they are in.
- The editor bundle is built once and shipped to both, so its own build constants say nothing about the host app. `virtual:webenv/content` *is* generated per host app, so the plugin emits `local` there — true only when a dev server is actually serving the write endpoint.
- `local` means "can I write to the project from here", not "is this a dev build". `write: false` during dev therefore reads as not local, and non-Vite bundlers read as not local because the write middleware is Vite-only. Both are accurate rather than fallbacks.
- Provider config will reach the editor the same way: loaded from `webenv.config.mjs` by the plugin and baked into the virtual module, never passed at the mount call.

### Access control

- Deliberately out of scope: any authenticated collaborator may edit everything.

### Deferred

- Publishing via PR onto a templated branch instead of straight to main.
- Scheduled forge workflows running policy checks to approve or deny content PRs. When this lands, the diff must be confined to content and media paths — a PR touching `.github/workflows/**` must never auto-merge, since it would then execute with repo credentials.
- Any feedback path telling the editor what happened to a submitted change.
- Conflict recovery beyond refetch: three-way merge of a stale publish.
