# SagaPay frontend

The SagaPay browser application lets customers send money, verify held transfers and follow activity.

## Development

Use Node 24 and the pnpm version pinned in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm run dev
```

Set `API_PROXY_TARGET` to the gateway origin to proxy local development requests under `/v1`.

## Verification

Run `pnpm run verify` to check formatting, lint, types, the production build and unit and component coverage.

Run the browser suite against the production build with Chromium.

```sh
pnpm exec playwright install chromium
pnpm run build
pnpm test:e2e
```

## Repository

This implementation repository contains the browser application. The [SagaPay specification](https://github.com/lucas-987/sagapay-spec) describes the system, its architecture and its milestones.
