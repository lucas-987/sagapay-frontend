# SagaPay UI

A visual React prototype of the send money and activity screens. The content is fictional; no transfer, verification, authentication, or network request is performed. Navigation, the theme switch, recipient selection, and the transfer detail drawer are local interface interactions.

The Nix development shell provides Node.js 24 and npm. Run `nix-shell` in this directory, or run `direnv allow` once to activate it automatically when entering the directory.

```sh
npm ci
npm run dev
```

Run `npm run build` to check the TypeScript application and produce a static build. The sample data lives in `src/data`, reusable UI in `src/components`, and screens in `src/pages`. Colors and component defaults are in `src/theme.ts`.
