/**
 * Utility for resolving the sql.js WASM file path in different runtime environments.
 * Handles bundled environments (Next.js, webpack, Turbopack), monorepos, and standard Node.js.
 */

/**
 * Checks if a file exists at the given path (Node.js only).
 *
 * @param path - Absolute path to validate
 * @returns True when the file system entry is present
 */
const fileExists = (path: string): boolean => {
    try {
        const fs = require('node:fs');
        return fs.existsSync(path);
    } catch {
        return false;
    }
};

/**
 * Attempts to find the sql.js WASM file in node_modules using multiple strategies.
 * This handles cases where the library is bundled by tools like webpack/Turbopack.
 *
 * @returns The resolved filesystem path to the WASM file, or null if not found
 */
export const findNodeWasmPath = (): string | null => {
    // Strategy 1: Try to resolve using require.resolve (works in most Node.js scenarios)
    if (typeof require !== 'undefined' && typeof require.resolve !== 'undefined') {
        try {
            const sqlJsPath = require.resolve('sql.js');
            const pathModule = require('node:path');
            const sqlJsDir = pathModule.dirname(sqlJsPath);
            const wasmPath = pathModule.join(sqlJsDir, 'dist', 'sql-wasm.wasm');

            if (fileExists(wasmPath)) {
                return wasmPath;
            }
        } catch (e) {
            // Continue to next strategy
        }
    }

    // Strategy 2: Try common node_modules patterns from process.cwd()
    if (typeof process !== 'undefined' && process.cwd) {
        try {
            const pathModule = require('node:path');
            const cwd = process.cwd();

            const candidates = [
                // Standard location
                pathModule.join(cwd, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
                // Monorepo or workspace root
                pathModule.join(cwd, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
                pathModule.join(cwd, '../..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
                // Next.js specific locations
                pathModule.join(cwd, '.next', 'server', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
            ];

            for (const candidate of candidates) {
                if (fileExists(candidate)) {
                    return candidate;
                }
            }
        } catch (e) {
            // Continue to next strategy
        }
    }

    // Strategy 3: Try using require.resolve.paths to find all possible locations
    if (typeof require !== 'undefined' && typeof require.resolve !== 'undefined' && require.resolve.paths) {
        try {
            const pathModule = require('node:path');
            const searchPaths = require.resolve.paths('sql.js') || [];

            for (const searchPath of searchPaths) {
                const wasmPath = pathModule.join(searchPath, 'sql.js', 'dist', 'sql-wasm.wasm');
                if (fileExists(wasmPath)) {
                    return wasmPath;
                }
            }
        } catch (e) {
            // Continue to next strategy
        }
    }

    // Strategy 4: Try import.meta.url (works in unbundled ESM scenarios)
    try {
        if (typeof import.meta !== 'undefined' && import.meta.url) {
            const url = new URL('../../node_modules/sql.js/dist/sql-wasm.wasm', import.meta.url);
            const path = decodeURIComponent(url.pathname);

            // On Windows, file URLs start with /C:/ but we need C:/
            const normalizedPath = process.platform === 'win32' && path.startsWith('/') ? path.slice(1) : path;

            if (fileExists(normalizedPath)) {
                return normalizedPath;
            }
        }
    } catch {
        // All strategies exhausted
    }

    return null;
};
