# Webenv

The Fully Static, Git Only CMS.

## What?

A schema-driven CMS but without any database or server. It runs fully on your Git Provider and / or locally.
Use it locally to scheme and edit your content with your preferred web framework or use it hosted statically with
the CMS bundled in your static site.

Like Payload CMS but framework agnostic and without the server, database and hosting.

## Why?

I don't like hosting stuff. No database, no server, no nothing. Not even serverless functions. Just a static site that you can host anywhere.
Which also happens to have a CMS baked in.
No vendor lock-in, no lock-in to a specific hosting provider, no lock-in to a specific database. Just you and your content in a Git repository.
Also consumable and bundle-able with anything! Use it in your Astro or Nuxt App that statically generates your site, or use it in your Next.js app that does server-side rendering, your choice.

## How?

It uses the Git provider as the backend, so you can use any of the following:
- GitHub
- GitLab
- Forgejo/Codeberg

We authenticate using OAuth PKCE for browser-only auth.
Yes i know GitHub doesn't support it, but they do support GitHub Apps which is a similar enough concept and also works without a backend.
The CMS is bundled into the static website, and it uses the GitHub/GitLab/Forgejo API to pull the content and push changes.
In the browser frontend, you can edit your content schema and also the content itself.
To be fast, it uses a local model of the content and only pushes the cumulated changes to the API when you hit save. This also allows for offline editing, which is pretty neat.

So for the CMS user it looks like this:

1. Create Repository
2. Create Schema
3. Create Content
4. Consume Content in your static site
5. Publish static site to CDN with the CMS bundled in
6. Edit from wherever you want, whenever you want, and publish changes to the CDN with a single click

We work with CI / CD to automatically build and deploy the static site whenever there are changes to the content. This way, you don't have to worry about hosting or deploying your site, just focus on creating content.
