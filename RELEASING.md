# Releasing

Releases use explicit versions, curated changelog entries, and immutable `v<version>` tags. Pushing a matching tag runs `.github/workflows/publish.yml`, which publishes through npm trusted publishing and then creates a GitHub Release from the matching `CHANGELOG.md` section.

The workflow uses GitHub's OIDC identity and does not require an npm token. It uses the npm version bundled with Node 24 and fails before publishing if that version is older than the trusted-publishing minimum.

## Prepare a release

1. Add a nonempty `## [<version>] - YYYY-MM-DD` section to `CHANGELOG.md`.
2. Update `version` in `package.json` and `package-lock.json` without creating a tag:

   ```bash
   npm version <version> --no-git-tag-version
   ```

3. Run the release checks locally:

   ```bash
   npm ci
   npm run check
   npm pack --dry-run
   node scripts/extract-release-notes.ts <version>
   ```

4. Merge the version and changelog change to `main` after CI passes.
5. Verify the intended `main` commit, then create and push an annotated `v<version>` tag at that exact commit.

The tag push starts the publish workflow. It rejects a tag that differs from `package.json`, a tag that does not point at the checked-out commit, and a missing or empty changelog section before publishing. After publication succeeds, it creates the corresponding GitHub Release using only that version's changelog section.

Do not move or reuse a pushed release tag. If a release fails after its tag is pushed, fix the problem and release a new version.

## Initial release

Version `0.1.0` was published manually to register the package name before npm trusted publishing was configured. Its `v0.1.0` tag and GitHub Release are historical backfills only; they must not rerun publication.
