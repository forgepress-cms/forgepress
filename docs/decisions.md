# Decisions

Design decisions that are not yet visible in the code. Newest first.

## Static publishing model — 2026-09-02

### Auth

- The editor is gated on being an authenticated **collaborator** with write access to the content repo. No forks, no anonymous editing.
- The gate is UX, not a security boundary. Enforcement is the forge rejecting the write from a non-collaborator.
- Collaborator check per forge, all confirmed against the live APIs: GitHub and Forgejo both expose `permissions.push` on the repository; GitLab exposes `permissions.project_access.access_level` / `group_access.access_level`, where Developer (30) or above may push.
- Neither GitLab nor Forgejo has an upsert file action, so a publish probes each path first — GitLab returns 404 for a missing file and hands back `last_commit_id` for one that exists, Forgejo returns the blob `sha`. Both are then used as the per-file concurrency guard, which is finer-grained than GitHub's whole-ref check.
- Repos may be public **or private**, so narrow public-only scopes (GitHub `public_repo`) are not viable.
- **CORS decides what is possible, and it differs per forge.** Measured 2026-09-03:
  - `github.com/login/device/code` and `/login/oauth/access_token` send **no CORS headers at all** and 404 the preflight. No browser-only OAuth on GitHub, device flow included. A proxy would fix it and is refused — it would defeat the premise.
  - `gitlab.com/oauth/token` and `codeberg.org/login/oauth/access_token` both send `access-control-allow-origin: *` and allow `POST`. Browser-only PKCE genuinely works there.
  - Every forge **API** (`api.github.com`, `gitlab.com/api/v4`, `codeberg.org/api/v1`) is CORS-enabled, so all reading and writing works from a static page on all three.
- GitHub staff confirm the situation directly in [community discussion 15752](https://github.com/orgs/community/discussions/15752). Two corrections to earlier notes here:
  - GitHub **did** ship PKCE for OAuth apps on 2025-07-14. "GitHub has no PKCE" is out of date.
  - Shipping the client secret in a public bundle is **not** a blocker, and staff say so outright: *"The client secret can only be used to manipulate a token someone has in possession - there's nothing it can do without a token."* and *"This is how e.g. VS Code, Visual Studio, GH CLI, and GitHub Mobile all work."* They would rather move away from it — *"it's a common thing people trip up on"* — but they do not treat it as unsafe.
- **The one and only blocker is CORS on the token endpoint.** Staff, July 2025: *"We still have to add support for CORS on the token endpoint unfortunately. We are working on it though."* Nobody in the thread reports a successful browser exchange; the one attempt reported CORS errors. Measured again 2026-09-03: still no `access-control-*` header on any `github.com` endpoint.
- Note what every example staff cite has in common — VS Code, Visual Studio, GH CLI, GitHub Mobile are all **native** clients. The same-origin policy never applies to them, so they can ship a secret and still call the endpoint. A browser cannot. The secret is not what separates them from us; CORS is.
- No browser escape hatch exists: `mode: 'no-cors'` sends the request but yields an opaque unreadable response, a form POST into a hidden iframe cannot be read cross-origin, and the endpoint is POST-only so no JSONP-style trick applies.
- The SPA-support roadmap item (github/roadmap#1153) was **paused** as of August 2026, so do not plan around it landing.
- Sveltia CMS, solving the same problem in the same space, ships a hosted intermediary auth service. Independent confirmation that there is no browser-only trick on GitHub.
- If GitHub later ships CORS *and* public clients, the PKCE path built for GitLab and Forgejo extends to GitHub by adding a config entry. Build it so that swap is cheap.
- GitHub therefore authenticates by **pasting a fine-grained token**, kept in IndexedDB and sent nowhere but the API. Not a downgrade in safety: a token scoped to one repository with Contents read and write is narrower than the `repo` scope an OAuth App would have demanded.
- **GitLab and Forgejo are the primary targets; GitHub is the fallback.** They get real OAuth PKCE with a redirect sign-in button, no infrastructure. GitHub gets a pasted fine-grained token. This is deliberate: the forges that respect the browser get the better experience, which also reinforces the anti-lock-in argument.
- PKCE details: `code_verifier` is 32 random bytes base64url-encoded, `code_challenge` is its SHA-256, method `S256`, verified against the RFC 7636 test vector. Verifier and state live in `sessionStorage` across the redirect; the state is compared on return and a mismatch aborts. The callback lands on the editor's own URL, and `code`/`state` are stripped with `replaceState` before anything else runs.
- Access tokens refresh transparently: the token getter handed to a forge client is async and renews with the refresh token 30s before expiry. GitLab and Forgejo both expire tokens, so this is required, not optional. A pasted GitHub token has no expiry and simply skips the path.
- If GitHub ships CORS on its token endpoint, it joins the PKCE path by adding `clientId` to its provider config. No new code.
- `clientSecret` is gone from `ProviderConfig`: no browser flow can ever use one.

### The draft

- Edits accumulate in **one** record under a single IndexedDB key (`draft`), holding the pending schema, per-component rows, media uploads, asset tombstones, and the published commit. Previously content and media were separate buffers under separate keys with a `published` marker each, which duplicated the same five-method surface twice and could diverge if one write failed after a successful publish.
- `DraftService` exposes two views over that one record — `content` (a `ContentStore`) and `media` (a `MediaClient`) — because their `list` signatures collide and cannot merge into one interface.
- **The draft cannot be pure file-space** (`Record<path, bytes>`), which would be the elegant shape. Serialization is one-way: `serializeSchema` and `serializeContent` write `.webenv/*.ts`, and reads get rows by `import()`ing the virtual module and letting the bundler compile the TS. There is no parser to go back. Reads need structure, writes need files, so the draft holds rows and derives files at publish. Do not try to collapse it.
- **Do not mirror the repository into IndexedDB.** It was considered and rejected: the baked bundle already *is* a complete copy of the content, shipped with the site and by construction in sync with the deployed build, so a mirror adds a third copy with no new information and one that can go stale. The only thing it would add is media *bytes*, which are unnecessary — diffing an image is a thumbnail pair, not a byte comparison — and "images, paths and all" runs into origin storage quotas that Safari in particular will evict.

### Diff

- A publish shows a real textual diff, built entirely from what is already in memory: `serializeContent(pendingRows)` against `serializeContent(bakedRows)`. No network, works offline, needs no auth.
- The diff is therefore against the **baked bundle**, i.e. the last build, not the branch head. Where those disagree someone published since this build was made. That makes the diff view the right home for the stale-base warning: fetch the branch blob per changed path when signed in and say so there, right as the user is about to commit over it. Not yet implemented.
- Media diffs are not textual: an added upload shows its pending preview, a deleted asset shows what it was.
- The line diff is plain LCS over a flat `Int32Array`, falling back to whole-file replacement past 4000 lines.

### Change accumulation

- Edits accumulate client-side on every save; nothing reaches the forge until Publish.
- Storage is **IndexedDB**, not localStorage — the ~5MB string-only quota cannot hold media binaries. Drafts and binaries share one store so a successful publish clears one thing.

### Publish

- One publish is **one commit directly to main**. No branch, no PR, no review step.
- `ProviderConfig.base` prefixes every committed path, because the project root can sit inside a larger repo (the playground lives at `playgrounds/nuxt`). Without it a publish writes to the wrong place.
- Publishing does **not** clear the local overlay; it records the commit on it. Clearing would drop the editor back to baked content predating the publish, and since writes are whole-component, the next edit would silently revert what was just published. Any further edit clears the recorded commit.
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
