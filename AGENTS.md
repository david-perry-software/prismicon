# prismicon

## Agento

Delivery work in this repository is driven by the Agento plugin (slash commands
/start-session, /new-initiative, /next-feature, /new-feature, /new-issue,
/build-feature, /build-issue, /review-feature, /review-issue, /ap, /ship,
/close-session, /start-freehand, /finish-freehand). Artifacts live in
`features/YYYY/MM/<slug>/`, `issues/YYYY/MM/<slug>/`, and
`initiatives/YYYY/MM/<slug>/`; configuration is `.github/agento.json`.

### Commands

- Install: `npm ci`
- Test: `npm test`
- Typecheck: `npm run check:variants` (types group; also runs contract, exports, pack, goldens)
- Lint: none
- Full verification: `npm run verify`

### Verification strategy

Pure library: run `npm test` for the Node test suite and `npm run check:variants` for
the maintainer gate (variant contract, exports, `index.d.ts` typecheck, `npm pack`
contents, golden freshness). Open `demo/index.html` in a browser for manual visual
verification. No dev server, end-to-end runner, or
deployment preview system is configured.

### Shared resources

None.

### Skills

| Domain | Skill |
|---|---|
| none needed | none installed |
| Modern JavaScript / Node.js ESM | modern-javascript-patterns |
| React integration | vercel-react-best-practices |