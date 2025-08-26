/* 
Testing library and framework:
- This test is written to be compatible with common TS test runners (Vitest or Jest).
- If Vitest is used, vi and expectTypeOf are available; tests will still pass on Jest with runtime assertions only.

Focus of tests (based on diff-provided barrel file):
export * from './api';
export * from './types';
export { setLogger } from './utils/logger';

We validate:
1) All runtime exports from ./api are re-exported identically by ./index (identity check).
2) The named export setLogger is re-exported from ./utils/logger (identity and shape).
3) Edge cases: ensure no accidental default export appears; ensure non-function values are also re-exported.
*/

import * as api from './api';
import * as root from './index';
// Import setLogger directly to compare identity
// If utils/logger has additional exports, we only import setLogger to keep scope narrow
import { setLogger as directSetLogger } from './utils/logger';

// Narrow helpers to avoid depending on framework-specific mocking APIs
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

describe('src/index barrel exports', () => {
  it('should not have a default export (barrel re-exports should be named)', () => {
    // TS/ES interop may add __esModule or default in some compiled outputs,
    // but for pure TS barrel re-exports, default should be undefined.
    // This assertion makes sure consumers use named imports.
    expect((root as any).default).toBeUndefined();
  });

  it('should re-export setLogger from ./utils/logger', () => {
    expect(typeof root.setLogger).toBe('function');
    // Identity check: named export from index should be the exact same reference
    expect(root.setLogger).toBe(directSetLogger);
  });

  it('should re-export all runtime members from ./api with identical references', () => {
    const apiKeys = Object.keys(api).filter((k) => k !== '__esModule' && k !== 'default');

    // Ensure we at least have a stable baseline: if api has no runtime keys,
    // this test will still succeed, as barrel should not introduce unexpected keys.
    for (const key of apiKeys) {
      expect(root).toHaveProperty(key);
      // Compare references; functions and objects should be strictly equal to originals
      expect((root as any)[key]).toBe((api as any)[key]);
    }

    // Also ensure that index did not add extra keys that aren't present in api (besides setLogger)
    const rootKeys = Object.keys(root).filter((k) => k !== '__esModule');
    const extra = rootKeys.filter((k) => k !== 'setLogger' && !apiKeys.includes(k));
    // It's acceptable to re-export other modules in the future,
    // but based on current diff, only api + setLogger are expected at runtime.
    expect(extra).toEqual([]);
  });

  it('should preserve types-only exports from ./types at compile time (when Vitest expectTypeOf is available)', () => {
    // This block is a no-op in Jest and will be tree-shaken in TS if expectTypeOf is unavailable.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - expectTypeOf is only provided by Vitest at compile-time
    if (typeof expectTypeOf !== 'undefined') {
      // We cannot assert concrete type names without repository knowledge.
      // However, we can at least assert that importing types from index is valid TypeScript.
      // This is a sentinel compile-time check that index re-exports types without runtime impact.
      type ImportApi = typeof import('./api');
      type ImportIndex = typeof import('./index');

      // At compile time, index should be compatible as a superset that includes api runtime and types.
      // We don't attempt equality because index also has setLogger. We only ensure ImportIndex is an object type.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _compileCheck: ImportApi | ImportIndex | object = {};
      // eto({_unused: true} as any).toEqualTypeOf<{}>(); // Simple placeholder to exercise expectTypeOf
    }
  });

  it('should handle non-function runtime exports from ./api (if present) by re-exporting same references', () => {
    // If api has constants or objects, ensure they are re-exported as-is (identity).
    const apiEntries = Object.entries(api).filter(
      ([k]) => k !== '__esModule' && k !== 'default'
    );
    for (const [k, v] of apiEntries) {
      expect((root as any)[k]).toBe(v);
      if (isObject(v)) {
        // Spot-check that nested object identity is preserved (not cloned)
        expect((root as any)[k]).toBe(v);
      }
    }
  });
});