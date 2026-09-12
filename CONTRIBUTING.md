# Contributing

Thanks for helping improve pi-lego.

## Development

pi-lego requires Node.js 22.19.0 or newer.

```bash
npm ci
npm test
npm run typecheck
npm pack --dry-run
```

Keep convention blocks focused on broadly useful agent behavior. Organization- or repository-specific conventions belong in private extensions that consume pi-lego's public API.

Add or update tests for behavior changes. Pull requests should explain the problem, the chosen behavior, and any user-visible documentation changes.

## Reporting bugs and proposing changes

Use [GitHub issues](https://github.com/nertzy/pi-lego/issues) for reproducible bugs and focused proposals. For vulnerabilities, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.
