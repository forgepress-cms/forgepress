# Webenv

A framework-agnostic static CMS platform where your app consumes typed local content at build time without a backend API, while an optional in-browser CMS syncs content through Git provider APIs and ships as part of the static site.

## What?

A schema-driven CMS but without any database or server. It runs fully on your Git Provider and / or locally.
Use it locally to scheme and edit your content with your preferred web framework or use it hosted statically with
the CMS bundled in your static site.

Like Payload CMS but framework agnostic and without the server, database and hosting.

## Why?

I don't like hosting stuff. No database, no server, no nothing. Not even serverless functions. Just a static site that you can host anywhere.
Which also happens to have a CMS baked in.
No vendor lock-in, no lock-in to a specific hosting provider, no lock-in to a specific database. Just you and your content in a Git repository.
Consumable and bundle-able with anything, use it in your Astro or Nuxt App that statically generates your site, or use it in your Next.js app that does server-side rendering, your choice.

## How?

It uses the Git provider as the backend, so you can use any of the following:
- GitHub
- GitLab
- Forgejo/Codeberg

We authenticate using OAuth PKCE for browser-only auth.
Yes i know GitHub doesn't support it, but they do support GitHub Apps which is a similar enough concept and also works without a backend.
The CMS is bundled into the static website, and it uses the GitHub/GitLab/Forgejo API to pull the content and push changes.
In the browser frontend, you can edit your content.
To be fast, it uses a local model of the content and only pushes the cumulated changes to the API when you hit save. This also allows for offline editing.
When you hit save, it pushes the changes to the Git provider API, which creates a commit and pushes the new content.
Then, the CI pipeline will pick up the changes and rebuild the site, which is then published to the CDN again.

So for the Developer the setup looks like this:

1. Create Repository
2. Create Schema, Content + CI pipeline
3. Consume Content in your static site / app
4. Publish static site / app with the CMS bundled in
5. Edit from wherever you want, whenever you want

For the User, editing content follows this flow:

1. Edit content in the CMS (e.g. /webenv route of your static site)
2. Hit save, which pushes changes to Git provider API
3. Git provider creates commit and pushes new content
4. CI pipeline of static site pulls changes and rebuilds site
5. New version of static site is published to CDN (or wherever you host it)
