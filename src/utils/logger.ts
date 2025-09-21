type LogFunction = (...args: unknown[]) => void;

interface Logger {
    debug: LogFunction;
    error: LogFunction;
    info: LogFunction;
    warn: LogFunction;
}

const SILENT_LOGGER = { debug: () => {}, error: () => {}, info: () => {}, warn: () => {} };
let logger: Logger = SILENT_LOGGER;

export const setLogger = (newLogger: Logger = SILENT_LOGGER) => {
    if (!newLogger.debug || !newLogger.error || !newLogger.info) {
        throw new Error('Logger must implement debug, error, and info methods');
    }

    logger = newLogger;
};

export { logger as default };
