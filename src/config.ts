import type { Logger } from './utils/logger.js';
import { configureLogger, resetLogger } from './utils/logger.js';
import type { ShamelaConfig, ShamelaConfigKey } from './types';

let runtimeConfig: Partial<ShamelaConfig> = {};

const ENV_MAP: Record<ShamelaConfigKey, string> = {
    apiKey: 'SHAMELA_API_KEY',
    booksEndpoint: 'SHAMELA_API_BOOKS_ENDPOINT',
    masterPatchEndpoint: 'SHAMELA_API_MASTER_PATCH_ENDPOINT',
    sqlJsWasmUrl: 'SHAMELA_SQLJS_WASM_URL',
};

const isProcessAvailable = typeof process !== 'undefined' && Boolean(process?.env);

const readEnv = (key: ShamelaConfigKey): string | undefined => {
    if (runtimeConfig[key]) {
        return runtimeConfig[key];
    }

    const envKey = ENV_MAP[key];
    if (isProcessAvailable) {
        return process.env[envKey];
    }

    return undefined;
};

export type ConfigureOptions = Partial<ShamelaConfig> & { logger?: Logger };

export const configure = (config: ConfigureOptions) => {
    const { logger, ...options } = config;

    if ('logger' in config) {
        configureLogger(logger);
    }

    runtimeConfig = { ...runtimeConfig, ...options };
};

export const getConfigValue = (key: ShamelaConfigKey) => {
    return readEnv(key);
};

export const getConfig = (): ShamelaConfig => {
    return {
        apiKey: readEnv('apiKey'),
        booksEndpoint: readEnv('booksEndpoint'),
        masterPatchEndpoint: readEnv('masterPatchEndpoint'),
        sqlJsWasmUrl: readEnv('sqlJsWasmUrl'),
    };
};

export const requireConfigValue = (key: ShamelaConfigKey) => {
    const value = getConfigValue(key);
    if (!value) {
        throw new Error(`${ENV_MAP[key]} environment variable not set`);
    }

    return value;
};

export const resetConfig = () => {
    runtimeConfig = {};
    resetLogger();
};
