import process from 'node:process';
import pino, { Logger } from 'pino';
import pretty, { PrettyOptions } from 'pino-pretty';

const stream = pretty({
    colorize: true,
} as PrettyOptions);

const logger: Logger = pino(
    {
        base: { hostname: undefined, pid: undefined }, // This will remove pid and hostname but keep time
        level: process.env.LOG_LEVEL || 'info',
    },
    stream,
);

export default logger;
