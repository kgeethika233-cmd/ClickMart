import fs from 'fs';
import path from 'path';
import { Kafka, logLevel } from 'kafkajs';
import { config } from './config.js';

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
    rejectUnauthorized: false,
  },
  sasl: {
    mechanism: config.KAFKA_SASL_MECHANISM.toLowerCase() as any,
    username: config.KAFKA_USER,
    password: config.KAFKA_PASSWORD,
  },
  connectionTimeout: 20000,
  requestTimeout: 30000,
  retry: {
    initialRetryTime: 500,
    retries: 10,
  },
  logLevel: logLevel.NOTHING,
});
