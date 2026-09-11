/**
 * Test-only square variant fixture.
 *
 * A deliberately minimal variant used to prove that the renderer dispatch is
 * variant-agnostic: it renders a single `<rect>` that spins while `working`
 * and settles back to the portrait pose, with no shared code from the
 * polyhedron implementation.
 *
 * The implementation lives in `demo/square-variant.js` so the documented
 * consumer example is the one under test.
 */

export * from '../../demo/square-variant.js';
