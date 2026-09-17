# Contributing

Thanks for helping improve pi-lego.

## Development

pi-lego requires Node.js 24 or newer and npm 11.15.0 or newer (enforced by
`devEngines` in `package.json`), plus
[actionlint](https://github.com/rhysd/actionlint) 1.7.12. Node version support
tracks the [active-support cycles](https://endoflife.date/nodejs): the
`engines.node` floor is the oldest actively supported major and CI tests
exactly the active-support majors; maintenance-LTS lines are not supported
targets. On macOS, install
`actionlint` with Homebrew:

```bash
brew install actionlint
```

For other platforms, follow actionlint's
[official installation instructions](https://github.com/rhysd/actionlint/blob/v1.7.12/docs/install.md).
CI downloads the same release directly from the upstream project.

```bash
npm ci
npm run check
npm pack --dry-run
```

Run `npm run lint:fix` to apply Biome and Markdown fixes. `actionlint` reports
workflow problems but does not modify workflow files.

Keep convention blocks focused on broadly useful agent behavior. Organization- or repository-specific conventions belong in private extensions that consume pi-lego's public API.

Add or update tests for behavior changes. Pull requests should explain the problem, the chosen behavior, and any user-visible documentation changes.

## Reporting bugs and proposing changes

Use [GitHub issues](https://github.com/nertzy/pi-lego/issues) for reproducible bugs and focused proposals. For vulnerabilities, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.
