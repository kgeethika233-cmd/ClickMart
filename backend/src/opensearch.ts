import { Client } from '@opensearch-project/opensearch';
import { config } from './config.js';

export const opensearch = new Client({
  node: `https://${config.OS_HOST}:${config.OS_PORT}`,
  auth: {
    username: config.OS_USER,
    password: config.OS_PASSWORD,
  },
  ssl: {
    rejectUnauthorized: false,
  },
});
