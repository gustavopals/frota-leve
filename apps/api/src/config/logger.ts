import winston from 'winston';
import { env } from './env';

const developmentFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf((info: winston.Logform.TransformableInfo) => {
    const correlationId = info['correlationId'] ? ` [${String(info['correlationId'])}]` : '';
    const { level, message, timestamp, correlationId: _cid, ...meta } = info;
    const metaStr = Object.keys(meta).length ? `\n  ${JSON.stringify(meta)}` : '';
    return `${String(timestamp)}${correlationId} ${level}: ${String(message)}${metaStr}`;
  }),
);

const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: env.NODE_ENV === 'production' ? productionFormat : developmentFormat,
  transports: [new winston.transports.Console()],
  silent: env.NODE_ENV === 'test',
});
