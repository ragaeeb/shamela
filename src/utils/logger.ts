export type LogFunction = (...args: unknown[]) => void;

export interface Logger {
    debug: LogFunction;
    error: LogFunction;
    info: LogFunction;
    warn: LogFunction;
}

export const SILENT_LOGGER: Logger = { debug: () => {}, error: () => {}, info: () => {}, warn: () => {} };

let currentLogger: Logger = SILENT_LOGGER;

export const configureLogger = (newLogger?: Logger) => {
    if (!newLogger) {
        currentLogger = SILENT_LOGGER;
        return;
    }

    const requiredMethods: Array<keyof Logger> = ['debug', 'error', 'info', 'warn'];
    const missingMethod = requiredMethods.find((method) => typeof newLogger[method] !== 'function');

    if (missingMethod) {
        throw new Error('Logger must implement debug, error, info, and warn methods');
    }

    currentLogger = newLogger;
};

export const getLogger = () => currentLogger;

export const resetLogger = () => {
    currentLogger = SILENT_LOGGER;
};

const loggerProxy: Logger = new Proxy(
    {} as Logger,
    {
        get: (_target, property: keyof Logger) => {
            const activeLogger = getLogger();
            const value = activeLogger[property];

            if (typeof value === 'function') {
                return (...args: unknown[]) => (value as LogFunction).apply(activeLogger, args);
            }

            return value;
        },
    },
) as Logger;

export default loggerProxy;
