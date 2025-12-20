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
const fileExists = (path: string) => {
    try {
        const fs = require('node:fs');
        return fs.existsSync(path);
    } catch {
        return false;
    }
};

/**
 * Try common node_modules patterns from process.cwd()
 */
const getNodeModuleWasmPath = () => {
    try {
        const pathModule = require('node:path');
        const cwd = process.cwd();

        const candidates: string[] = [
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
    } catch {
        // Continue to next strategy
    }
};

/**
 * Try to resolve using require.resolve (works in most Node.js scenarios)
 */
const getWasmFilePath = () => {
    try {
        const sqlJsPath = require.resolve('sql.js');
        const pathModule = require('node:path');
        const sqlJsDir = pathModule.dirname(sqlJsPath);
        const wasmPath: string = pathModule.join(sqlJsDir, 'dist', 'sql-wasm.wasm');

        if (fileExists(wasmPath)) {
            return wasmPath;
        }
    } catch {
        // Continue to next strategy
    }
};

/**
 * Try using require.resolve.paths to find all possible locations
 */
const getResolvedPath = () => {
    try {
        const pathModule = require('node:path');
        const searchPaths = require.resolve.paths('sql.js') || [];

        for (const searchPath of searchPaths) {
            const wasmPath: string = pathModule.join(searchPath, 'sql.js', 'dist', 'sql-wasm.wasm');
            if (fileExists(wasmPath)) {
                return wasmPath;
            }
        }
    } catch {
        // Continue to next strategy
    }
};

const getMetaUrlPath = () => {
    try {
        const url = new URL('../../node_modules/sql.js/dist/sql-wasm.wasm', import.meta.url);
        const path = decodeURIComponent(url.pathname);

        // On Windows, file URLs start with /C:/ but we need C:/
        const normalizedPath = process.platform === 'win32' && path.startsWith('/') ? path.slice(1) : path;

        if (fileExists(normalizedPath)) {
            return normalizedPath;
        }
    } catch {
        // All strategies exhausted
    }
};

/**
 * Attempts to find the sql.js WASM file in node_modules using multiple strategies.
 * This handles cases where the library is bundled by tools like webpack/Turbopack.
 *
 * @returns The resolved filesystem path to the WASM file, or null if not found
 */
export const findNodeWasmPath = () => {
    let wasmPath: string | undefined = '';

    // Strategy 1: Try to resolve using require.resolve (works in most Node.js scenarios)
    if (typeof require?.resolve !== 'undefined') {
        wasmPath = getWasmFilePath();
    }

    if (!wasmPath && 'cwd' in process) {
        wasmPath = getNodeModuleWasmPath();
    }

    if (!wasmPath && typeof require?.resolve?.paths !== 'undefined') {
        wasmPath = getResolvedPath();
    }

    if (!wasmPath && typeof import.meta !== 'undefined' && import.meta.url) {
        wasmPath = getMetaUrlPath();
    }

    return wasmPath;
};
