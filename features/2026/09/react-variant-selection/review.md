# Review: react-variant-selection
Verdict: approve

## Acceptance checklist results

1. **Pass.** `npm ci && npm test` completed successfully: `# tests 60`, `# pass 60`, `# fail 0`.
2. **Pass.** A detached `origin/main` worktree was given `test/react-variant.test.js`; the suite exited 1 and cases 2, 4, 5, and 6 failed while cases 1, 3, 7, and 8 passed. The final history places `ab10a2e test(react): cover per-icon variant selection` before `c15782f feat(react): support per-icon variants`, and `git diff --quiet origin/main -- src` is true at the test commit.
3. **Pass.** `node --test test/react-variant.test.js` passes the SSR parity case, and the implementation forwards `variant` to both static rendering and mounting in [src/react.js](../../../../src/react.js#L44-L48).
4. **Pass.** The SSR error case passes for `RangeError` and `TypeError`; the client error case passes through `onUncaughtError` with no SVG mounted. Render-time validation is in [src/react.js](../../../../src/react.js#L38-L39).
5. **Pass.** The variant-change test observes a new SVG with the current state, then observes the same SVG after a state-only update. The mount effect dependency is [src/react.js](../../../../src/react.js#L50-L53).
6. **Pass.** The hydration test passes with zero recoverable errors using `hydrateRoot` over `renderToString`.
7. **Pass.** The React entry test reports exactly `['Prismicon', 'default']`.
8. **Pass.** `grep -c 'variant?: string' index.d.ts` prints `2`. The documented TypeScript check reports exactly one pre-existing TS7016 for the unresolved `react` declaration.
9. **Pass.** `grep -c 'variant="polyhedron"' README.md` prints `2`; `grep -c 'planned for a later release' README.md` prints `0`. The React and Variants sections remain in the documented order.
10. **Pass.** The collateral `git diff --quiet origin/main -- ...` check exits 0. `node scripts/generate-golden.mjs` exits 0 and the golden fixture diff is empty.
11. **Pass.** `npm pack --dry-run --json` includes `src/react.js` and `index.d.ts`, and includes neither `test/` nor `scripts/`.
12. **Pass.** The recorded lint/typecheck policy is `none`; the complete `npm test` gate passed with no lint findings to compare. The branch contains `origin/main` (`git merge-base --is-ancestor origin/main HEAD` exits 0).

## Plan vs implementation

The implementation matches the plan. [src/react.js](../../../../src/react.js#L14-L62) validates the variant during render, forwards it to SSR markup and `mountGlyph`, and adds it to the identity effect dependencies while leaving state updates on the existing handle. [index.d.ts](../../../../index.d.ts#L66-L84) and [README.md](../../../../README.md#L71-L136) document the new prop and its error/remount semantics. The new test file covers all eight planned cases. No out-of-scope product files changed: the final diff only changes the React binding, declaration, README, and the feature test plus delivery artifacts.

## Roadmap audit

All roadmap checkboxes are supported by the current code and independently rerun commands. The resolved roadmap has `status: in-review`, the expected branch, an empty `next-step`, and no manual or post-ship steps. No false ticks, missing work, or roadmap repairs were found.

## Findings

- **Minor:** The client tests emit React 19 warnings that `Root` updates are not wrapped in `act(...)` during cleanup. The warnings occur after the passing client cases when `root.unmount()` is called outside `act` in [test/react-variant.test.js](../../../../test/react-variant.test.js#L75-L76), [test/react-variant.test.js](../../../../test/react-variant.test.js#L92-L93), [test/react-variant.test.js](../../../../test/react-variant.test.js#L108-L109), and [test/react-variant.test.js](../../../../test/react-variant.test.js#L130-L131). This does not fail the suite or affect shipped code, but wrapping unmounts in `act` would keep the verification signal clean.

No security issues, product regressions, or findings above minor severity were identified.

## Follow-ups

- Consider wrapping React root cleanup in `act` in a subsequent test-maintenance change to remove the four warnings noted above.

After this approval, use the required cross-window handoff from the primary workspace:

```text
/close-session feature/react-variant-selection
/ship react-variant-selection
```
