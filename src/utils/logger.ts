import pino, { Logger } from 'pino';
import pretty, { PrettyOptions } from 'pino-pretty';
import process from 'process';

const stream = pretty({
    colorize: true,
} as PrettyOptions);

const logger: Logger = pino(
    {
        base: { pid: undefined, hostname: undefined }, // This will remove pid and hostname but keep time
        level: process.env.LOG_LEVEL || 'info',
    },
    stream,
);

export default logger;
