import type { ShamelaConfig, ShamelaConfigKey } from './types';
import type { Logger } from './utils/logger';
import { configureLogger, resetLogger } from './utils/logger';

/**
 * Mutable runtime configuration overrides supplied at runtime via {@link configure}.
 */
let runtimeConfig: Partial<ShamelaConfig> = {};

/**
 * Mapping between configuration keys and their corresponding environment variable names.
 */
const ENV_MAP: Record<Exclude<ShamelaConfigKey, 'fetchImplementation'>, string> = {
    apiKey: 'SHAMELA_API_KEY',
    booksEndpoint: 'SHAMELA_API_BOOKS_ENDPOINT',
    masterPatchEndpoint: 'SHAMELA_API_MASTER_PATCH_ENDPOINT',
    sqlJsWasmUrl: 'SHAMELA_SQLJS_WASM_URL',
};

/**
 * Detects whether the Node.js {@link process} global is available for reading environment variables.
 */
const isProcessAvailable = typeof process !== 'undefined' && Boolean(process?.env);

/**
 * Reads a configuration value either from runtime overrides or environment variables.
 *
 * @param key - The configuration key to resolve
 * @returns The resolved configuration value if present
 */
const readEnv = <Key extends Exclude<ShamelaConfigKey, 'fetchImplementation'>>(key: Key) => {
    const runtimeValue = runtimeConfig[key];

    if (runtimeValue !== undefined) {
        return runtimeValue as ShamelaConfig[Key];
    }

    const envKey = ENV_MAP[key];

    if (isProcessAvailable) {
        return process.env[envKey] as ShamelaConfig[Key];
    }

    return undefined as ShamelaConfig[Key];
};

/**
 * Runtime configuration options accepted by {@link configure}.
 */
export type ConfigureOptions = Partial<ShamelaConfig> & { logger?: Logger };

/**
 * Updates the runtime configuration for the library.
 *
 * This function merges the provided options with existing overrides and optionally
 * configures a custom logger implementation.
 *
 * @param config - Runtime configuration overrides and optional logger instance
 */
export const configure = (config: ConfigureOptions) => {
    const { logger, ...options } = config;

    if ('logger' in config) {
        configureLogger(logger);
    }

    runtimeConfig = { ...runtimeConfig, ...options };
};

/**
 * Retrieves a single configuration value.
 *
 * @param key - The configuration key to read
 * @returns The configuration value when available
 */
export const getConfigValue = <Key extends ShamelaConfigKey>(key: Key) => {
    if (key === 'fetchImplementation') {
        return runtimeConfig.fetchImplementation as ShamelaConfig[Key];
    }

    return readEnv(key as Exclude<Key, 'fetchImplementation'>);
};

/**
 * Resolves the current configuration by combining runtime overrides and environment variables.
 *
 * @returns The resolved {@link ShamelaConfig}
 */
export const getConfig = (): ShamelaConfig => {
    return {
        apiKey: readEnv('apiKey'),
        booksEndpoint: readEnv('booksEndpoint'),
        fetchImplementation: runtimeConfig.fetchImplementation,
        masterPatchEndpoint: readEnv('masterPatchEndpoint'),
        sqlJsWasmUrl: readEnv('sqlJsWasmUrl'),
    };
};

/**
 * Retrieves a configuration value and throws if it is missing.
 *
 * @param key - The configuration key to require
 * @throws {Error} If the configuration value is not defined
 * @returns The resolved configuration value
 */
export const requireConfigValue = <Key extends Exclude<ShamelaConfigKey, 'fetchImplementation'>>(key: Key) => {
    if ((key as ShamelaConfigKey) === 'fetchImplementation') {
        throw new Error('fetchImplementation must be provided via configure().');
    }

    const value = getConfigValue(key);
    if (!value) {
        throw new Error(`${ENV_MAP[key]} environment variable not set`);
    }

    return value as NonNullable<ShamelaConfig[Key]>;
};

/**
 * Clears runtime configuration overrides and restores the default logger.
 */
export const resetConfig = () => {
    runtimeConfig = {};
    resetLogger();
};

/**
 * Creates a default configuration for Node.js environments.
 * Automatically sets the correct sqlJsWasmUrl path for bundled environments.
 *
 * This helper is optional - the library will auto-detect the WASM file location
 * in most cases. Use this if you want explicit control or are experiencing issues.
 *
 * @param config - Your API configuration
 * @returns Complete configuration with sqlJsWasmUrl set for Node.js
 *
 * @example
 * ```typescript
 * import { configure, createNodeConfig } from 'shamela';
 *
 * configure(createNodeConfig({
 *   apiKey: process.env.SHAMELA_API_KEY,
 *   booksEndpoint: process.env.SHAMELA_BOOKS_ENDPOINT,
 *   masterPatchEndpoint: process.env.SHAMELA_MASTER_ENDPOINT,
 * }));
 * ```
 */
export const createNodeConfig = (config: Omit<ShamelaConfig, 'sqlJsWasmUrl'>): ShamelaConfig => {
    const { join } = require('node:path');
    return {
        ...config,
        sqlJsWasmUrl: join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
    };
};
