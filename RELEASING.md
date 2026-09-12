# Releasing

The npm package is published from `.github/workflows/publish.yml` with npm trusted publishing. The workflow uses GitHub's OIDC identity and does not require an npm token.

## First publication

The `pi-lego` name must first be registered by publishing `0.1.0` manually. Before publishing, run the checks below and inspect the tarball contents:

```bash
npm install --global npm@latest
npm ci
npm test
npm run typecheck
npm pack --dry-run
npm publish --access public --provenance=false
```

The first local publication cannot carry GitHub Actions provenance. The explicit
`--provenance=false` overrides `publishConfig.provenance: true` for this bootstrap
publish; later releases run in GitHub Actions and publish with provenance.

No automated workflow should be run until that first publication is complete.

Afterward, configure `pi-lego` on npmjs.com with this trusted publisher:

- Provider: GitHub Actions
- Repository owner: `nertzy`
- Repository: `pi-lego`
- Workflow filename: `publish.yml`
- Allowed action: `npm publish`

Then require two-factor authentication and disallow token-based publishing in the package settings.

## Later releases

1. Update `version` in `package.json` and `package-lock.json`.
2. Merge the release change to `main` after CI passes.
3. Create and push a `v<version>` tag that points at that commit.
4. In GitHub Actions, select **Publish to npm**, choose that tag as the workflow ref, and run the workflow.
5. Confirm the published version and provenance on npmjs.com.

The workflow rejects branches and tags that do not exactly match the package version, then repeats installation, tests, and typechecking before publishing from a GitHub-hosted runner.
