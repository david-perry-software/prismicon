## Agento

Delivery work in this repository is driven by the Agento plugin (slash commands
/start-session, /new-initiative, /next-feature, /new-feature, /new-issue,
/build-feature, /build-issue, /review-feature, /review-issue, /ap, /ship,
/close-session, /start-freehand, /finish-freehand). Artifacts live in
`features/YYYY/MM/<slug>/`, `issues/YYYY/MM/<slug>/`, and
`initiatives/YYYY/MM/<slug>/`; configuration is `.github/agento.json`.

### Commands

- Install: `npm install`
- Test: `npm test`
- Typecheck: none
- Lint: none
- Full verification: `npm test`

### Verification strategy

Run `npm test` for the Node and jsdom test suite. Open `demo/index.html` directly
in a browser for manual user-visible verification; there is no dev server, e2e
runner, or deployment preview system configured.

### Shared resources

None.

### Skills

| Domain | Skill |
|---|---|
| JavaScript package development | none installed |