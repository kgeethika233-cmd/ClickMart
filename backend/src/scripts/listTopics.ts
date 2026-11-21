import { kafka } from '../kafka.js';

async function main() {
  const admin = kafka.admin();
  try {
    await admin.connect();
    const topics = await admin.listTopics();
    console.log('Current Kafka topics:', topics);
  } catch (err: any) {
    console.error('Failed to list topics:', err.message);
  } finally {
    await admin.disconnect();
  }
}

main();

