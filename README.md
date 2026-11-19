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

For browser tests against the real services, start the browser Compose stack from the [SagaPay backend repository](https://github.com/lucas-987/sagapay). Run Playwright with the stack origin and the two synthetic Keycloak passwords from that checkout's `infra/keycloak.env`.

```sh
SAGAPAY_BASE_URL=http://localhost:8088 JULIEN_PASSWORD="$JULIEN_PASSWORD" GINA_PASSWORD="$GINA_PASSWORD" pnpm exec playwright test
```

## Repository

This implementation repository contains the browser application. The [SagaPay specification](https://github.com/lucas-987/sagapay-spec) describes the system, its architecture and its milestones.
