import pino from 'pino';
import { config } from './config';

// Pretty-printed, colorized logs in development; plain JSON (for log
// aggregators) in production. pino-pretty is a devDependency only — it is
// never required when env !== 'development', so it stays out of the runtime
// image.
export const logger: pino.Logger = pino({
  level: config.logLevel,
  transport: config.env === 'development'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
    : undefined,
});
