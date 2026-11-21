import fs from 'fs';
import path from 'path';
import { Kafka, logLevel } from 'kafkajs';
import { config } from './config.js';
import { logger } from './logger.js';

let caCert: string;
try {
  const resolvedPath = path.resolve(process.cwd(), config.PG_CA_PATH);
  caCert = fs.readFileSync(resolvedPath).toString();
} catch (err) {
  caCert = fs.readFileSync(path.resolve(process.cwd(), '../ca.pem')).toString();
}

export const kafka = new Kafka({
  clientId: 'inventory-hub-backend',
  brokers: [config.KAFKA_BROKER],
  ssl: {
    ca: [caCert],
  },
  sasl: {
    mechanism: config.KAFKA_SASL_MECHANISM.toLowerCase() as any,
    username: config.KAFKA_USER,
    password: config.KAFKA_PASSWORD,
  },
  logLevel: logLevel.NOTHING,
});
