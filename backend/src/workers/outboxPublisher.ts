import { kafka } from '../kafka.js';
import { pool } from '../db.js';
import { logger } from '../logger.js';

let isRunning = true;

async function run() {
  const producer = kafka.producer({
    idempotent: true,
    maxInFlightRequests: 1,
  });

  let connected = false;
  while (isRunning && !connected) {
    try {
      await producer.connect();
      connected = true;
      logger.info('Outbox publisher connected to Kafka.');
    } catch (err: any) {
      logger.warn(`Failed to connect to Kafka (${err.message}), retrying in 3s...`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  while (isRunning) {
    const client = await pool.connect();
    client.on('error', (err) => logger.warn({ err: err.message }, 'Client error ignored'));
    try {
      await client.query('BEGIN');

      const { rows: events } = await client.query(
        `SELECT id, topic, event_key, payload 
         FROM outbox_events 
         WHERE published_at IS NULL 
         ORDER BY id ASC 
         LIMIT 50 
         FOR UPDATE SKIP LOCKED`
      );

      if (events.length > 0) {
        for (const ev of events) {
          await producer.send({
            topic: ev.topic,
            acks: -1,
            messages: [
              {
                key: String(ev.event_key),
                value: JSON.stringify(ev.payload),
              },
            ],
          });

          await client.query(
            'UPDATE outbox_events SET published_at = NOW() WHERE id = $1',
            [ev.id]
          );
        }

        await client.query('COMMIT');
        logger.info(`Published ${events.length} outbox event(s) to Kafka.`);
      } else {
        await client.query('COMMIT');
        // Backoff when empty
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (err: any) {
      await client.query('ROLLBACK').catch(() => {});
      logger.error({ err }, 'Error in outbox publishing loop, will retry');
      await new Promise((r) => setTimeout(r, 2000));
    } finally {
      client.release();
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  await producer.disconnect();
}

process.on('SIGINT', () => { isRunning = false; });
process.on('SIGTERM', () => { isRunning = false; });

run().catch((err) => {
  logger.error({ err }, 'Outbox publisher crashed');
  process.exit(1);
});

