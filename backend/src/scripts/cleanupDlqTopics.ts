import { kafka } from '../kafka.js';

async function main() {
  const admin = kafka.admin();
  try {
    await admin.connect();
    const topicsToDelete = ['order.placed.dlq', 'notification.requested.dlq', 'product.changed.dlq'];
    console.log('Deleting DLQ topics to comply with <= 5 topics limit:', topicsToDelete);
    await admin.deleteTopics({ topics: topicsToDelete });
    const remaining = await admin.listTopics();
    console.log('Remaining Kafka topics:', remaining);
  } catch (err: any) {
    console.error('Failed to cleanup topics:', err.message);
  } finally {
    await admin.disconnect();
  }
}

main();

