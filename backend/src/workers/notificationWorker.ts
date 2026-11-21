import { kafka } from '../kafka.js';
import { pool } from '../db.js';
import { logger } from '../logger.js';

async function run() {
  const consumer = kafka.consumer({ groupId: 'notification-worker' });
  await consumer.connect();
  await consumer.subscribe({ topic: 'notification.requested', fromBeginning: false });

  logger.info('Notification worker subscribed to notification.requested.');

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const raw = JSON.parse(message.value.toString());
      const eventId = String(raw.eventId || raw.data?.orderId);
      const data = raw.data || raw;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const check = await client.query(
          'SELECT 1 FROM processed_events WHERE event_id = $1 AND consumer_name = $2',
          [eventId, 'notification-worker']
        );

        if (check.rows.length > 0) {
          logger.info(`Notification event ${eventId} already processed. Skipping.`);
          await client.query('COMMIT');
          return;
        }

        const formattedTotal = (Number(data.totalCents || 0) / 100).toFixed(2);

        console.log(`\n======================================================`);
        console.log(`📧 [ORDER CONFIRMATION EMAIL SIMULATION]`);
        console.log(`To:      ${data.recipient}`);
        console.log(`Subject: Your Inventory Hub Order #${data.orderId} is Confirmed!`);
        console.log(`Total:   ₹${formattedTotal}`);
        console.log(`Items:`);
        for (const item of data.items || []) {
          console.log(`  - ${item.productName || 'Product #' + item.productId} x ${item.quantity} (₹${(item.priceCents / 100).toFixed(2)})`);
        }
        console.log(`Thank you for shopping with Inventory Hub!`);
        console.log(`======================================================\n`);

        await client.query(
          `INSERT INTO notifications (order_id, recipient, channel, status) 
           VALUES ($1, $2, $3, $4)`,
          [data.orderId, data.recipient, 'EMAIL', 'SENT']
        );

        await client.query(
          'INSERT INTO processed_events (event_id, consumer_name) VALUES ($1, $2)',
          [eventId, 'notification-worker']
        );

        await client.query('COMMIT');
      } catch (err: any) {
        await client.query('ROLLBACK').catch(() => {});
        logger.error({ err }, 'Notification worker failed to send notification');
      } finally {
        client.release();
      }
    },
  });
}

run().catch((err) => {
  logger.error({ err }, 'Notification worker crashed');
  process.exit(1);
});

