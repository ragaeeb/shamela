/**
 * Signature accepted by logger methods.
 */
export type LogFunction = (...args: unknown[]) => void;

/**
 * Contract expected from logger implementations consumed by the library.
 */
export interface Logger {
    debug: LogFunction;
    error: LogFunction;
    info: LogFunction;
    warn: LogFunction;
}

/**
 * No-op logger used when consumers do not provide their own implementation.
 */
export const SILENT_LOGGER: Logger = Object.freeze({
    debug: () => {},
    error: () => {},
    info: () => {},
    warn: () => {},
});

let currentLogger: Logger = SILENT_LOGGER;

/**
 * Configures the active logger or falls back to {@link SILENT_LOGGER} when undefined.
 *
 * @param newLogger - The logger instance to use for subsequent log calls
 * @throws {Error} When the provided logger does not implement the required methods
 */
export const configureLogger = (newLogger?: Logger) => {
    if (!newLogger) {
        currentLogger = SILENT_LOGGER;
        return;
    }

    const requiredMethods: Array<keyof Logger> = ['debug', 'error', 'info', 'warn'];
    const missingMethod = requiredMethods.find((method) => typeof newLogger[method] !== 'function');

    if (missingMethod) {
        throw new Error(
            `Logger must implement debug, error, info, and warn methods. Missing: ${String(missingMethod)}`,
        );
    }

    currentLogger = newLogger;
};

/**
 * Retrieves the currently configured logger.
 */
export const getLogger = () => currentLogger;

/**
 * Restores the logger configuration back to {@link SILENT_LOGGER}.
 */
export const resetLogger = () => {
    currentLogger = SILENT_LOGGER;
};

/**
 * Proxy that delegates logging calls to the active logger at invocation time.
 */
const loggerProxy: Logger = new Proxy({} as Logger, {
    get: (_target, property: keyof Logger) => {
        const activeLogger = getLogger();
        const value = activeLogger[property];

        if (typeof value === 'function') {
            return (...args: unknown[]) => (value as LogFunction).apply(activeLogger, args);
        }

        return value;
    },
}) as Logger;

export default loggerProxy;
