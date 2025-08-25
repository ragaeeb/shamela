type LogFunction = (...args: any[]) => void;

interface Logger {
    debug: LogFunction;
    error: LogFunction;
    info: LogFunction;
    warn?: LogFunction;
}

let logger: Logger = { debug: () => {}, error: () => {}, info: () => {}, warn: () => {} };

export const setLogger = (newLogger: Logger) => {
    logger = newLogger;
};

export default logger;
