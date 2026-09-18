# prismicon

## Agento

Delivery work in this repository is driven by the Agento plugin (slash commands
/agento start-session, /agento new-initiative, /agento next-feature, /agento new-feature, /agento new-issue,
/agento build-feature, /agento build-issue, /agento review-feature, /agento review-issue, /agento ap, /agento ship,
/agento continue, /agento close-session, /agento start-freehand, /agento finish-freehand, /agento doctor; /agento ship audits
a finished build in place and tears its worktree down, /agento close-session is for
plan and freehand sessions and abandoned builds). Artifacts live in the companion
repository `david-perry-software/prismicon-docs` cloned at `../prismicon-docs` —
`features/YYYY/MM/<slug>/`, `issues/YYYY/MM/<slug>/`, and
`initiatives/YYYY/MM/<slug>/` there; configuration is this repository's
`.github/agento.json`.
Commands are always written `/agento <name>`; a bare `/<name>` or a `.prompt`/`.md`
suffix is read as the canonical command and proceeds without confirmation.

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