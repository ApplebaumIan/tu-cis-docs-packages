# TU CIS 4398 Documentation Packages

Maintainer monorepo for reusable Docusaurus components, preset, application
scaffold, progressive content templates, and project creation tools.

Student-ready files are synchronized into `tu-cis-4398-docs-template`.

## Packages

- `@tu-cis-courses/docusaurus-components`: reusable MDX components
- `@tu-cis-courses/docusaurus-preset`: Docusaurus configuration, theme, and plugins
- `@tu-cis-courses/docusaurus-template`: versioned application scaffold
- `@tu-cis-courses/docs-content-template`: progressive assignment content
- `@tu-cis-courses/create-project-docs`: project creation and safe updates

The private `create-project-docs` workspace becomes the final `2.1.0`
compatibility release after the scoped CLI reaches `1.0.0`.

## Development

```bash
yarn install --frozen-lockfile
yarn test
yarn pack:check
yarn test:packed
ORG_NAME=test-organization PROJECT_NAME=test-project DISABLE_REVISION_HISTORY=1 yarn build
```

## Beta Releases

Packages are in Changesets prerelease mode and publish to npm's `next` tag.
Add a changeset for each releasable change. Whenever a scoped package version
changes, include `@tu-cis-courses/docusaurus-template` in the changeset so its
embedded tested versions receive a publishable version bump.

The first publication requires a temporary direct-publish `NPM_TOKEN` because
npm cannot stage a brand-new package. Revoke that token after the beta is live,
then configure `release.yml` as an npm trusted publisher for each package.
Generated template synchronization requires the `TEMPLATE_SYNC_TOKEN` secret
and the `GENERATED_TEMPLATE_REPOSITORY` variable.
