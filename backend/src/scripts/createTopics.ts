import { kafka } from '../kafka.js';
import { logger } from '../logger.js';

const TOPICS = [
  { topic: 'order.placed', numPartitions: 1 },
  { topic: 'inventory.updated', numPartitions: 1 },
  { topic: 'notification.requested', numPartitions: 1 },
  { topic: 'product.changed', numPartitions: 1 },
];

async function createTopics() {
  const admin = kafka.admin();
  try {
    await admin.connect();
    logger.info('Connected to Kafka admin client.');

    const existingTopics = await admin.listTopics();
    const existingSet = new Set(existingTopics);

    const topicsToCreate = TOPICS.filter((t) => !existingSet.has(t.topic));

    if (topicsToCreate.length === 0) {
      logger.info('All required Kafka topics already exist (<= 5 topics limit respected).');
    } else {
      logger.info(`Creating Kafka topics: ${topicsToCreate.map((t) => t.topic).join(', ')}`);
      await admin.createTopics({
        topics: topicsToCreate,
      });
      logger.info('✅ Topics created successfully.');
    }
  } catch (err: any) {
    logger.error({ err }, 'Failed to create Kafka topics');
    process.exit(1);
  } finally {
    await admin.disconnect();
  }
}

createTopics();
