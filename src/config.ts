import type { Logger } from './utils/logger.js';
import { configureLogger, resetLogger } from './utils/logger.js';
import type { ShamelaConfig, ShamelaConfigKey } from './types';

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
const readEnv = (key: ShamelaConfigKey): string | undefined => {
    if (key === 'fetchImplementation') {
        return undefined;
    }

    if (runtimeConfig[key]) {
        return runtimeConfig[key];
    }

    const envKey = ENV_MAP[key];
    if (isProcessAvailable) {
        return process.env[envKey];
    }

    return undefined;
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
export const getConfigValue = (key: ShamelaConfigKey) => {
    if (key === 'fetchImplementation') {
        return runtimeConfig.fetchImplementation;
    }

    return readEnv(key);
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
        masterPatchEndpoint: readEnv('masterPatchEndpoint'),
        sqlJsWasmUrl: readEnv('sqlJsWasmUrl'),
        fetchImplementation: runtimeConfig.fetchImplementation,
    };
};

/**
 * Retrieves a configuration value and throws if it is missing.
 *
 * @param key - The configuration key to require
 * @throws {Error} If the configuration value is not defined
 * @returns The resolved configuration value
 */
export const requireConfigValue = (key: ShamelaConfigKey) => {
    if (key === 'fetchImplementation') {
        throw new Error('fetchImplementation must be provided via configure().');
    }

    const value = getConfigValue(key);
    if (!value) {
        throw new Error(`${ENV_MAP[key]} environment variable not set`);
    }

    return value;
};

/**
 * Clears runtime configuration overrides and restores the default logger.
 */
export const resetConfig = () => {
    runtimeConfig = {};
    resetLogger();
};
