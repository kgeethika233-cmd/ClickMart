import { kafka } from '../kafka.js';
import { pool } from '../db.js';
import { logger } from '../logger.js';
import { buildEnvelope } from '../events.js';

async function run() {
  const consumer = kafka.consumer({ groupId: 'inventory-worker' });

  await consumer.connect();
  await consumer.subscribe({ topic: 'order.placed', fromBeginning: false });

  logger.info('Inventory worker subscribed to order.placed.');

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      let raw: any;
      try {
        raw = JSON.parse(message.value.toString());
      } catch (e) {
        logger.error('Failed to parse order.placed message JSON');
        return;
      }

      const eventId = String(raw.eventId || raw.data?.orderId || raw.orderId);
      const data = raw.data || raw;

      let retries = 0;
      const maxRetries = 3;

      while (retries <= maxRetries) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          // Idempotency check via processed_events
          const check = await client.query(
            'SELECT 1 FROM processed_events WHERE event_id = $1 AND consumer_name = $2',
            [eventId, 'inventory-worker']
          );

          if (check.rows.length > 0) {
            logger.info(`Event ${eventId} already processed by inventory-worker. Skipping.`);
            await client.query('COMMIT');
            client.release();
            return;
          }

          // Sort items by productId ascending to prevent deadlocks
          const items = (data.items || []).slice().sort((a: any, b: any) => a.productId - b.productId);

          for (const item of items) {
            // Deduct from stock_count and decrement reserved_count
            // (netting to exactly 1 total deduction between reservation & confirmation)
            const upd = await client.query(
              `UPDATE inventory 
               SET stock_count = GREATEST(0, stock_count - $1), 
                   reserved_count = GREATEST(0, reserved_count - $1),
                   updated_at = NOW() 
               WHERE product_id = $2 
               RETURNING stock_count, reserved_count`,
              [item.quantity, item.productId]
            );

            if (upd.rows.length > 0) {
              const { stock_count, reserved_count } = upd.rows[0];
              const availableCount = Math.max(0, stock_count - reserved_count);

              // Insert outbox event for inventory.updated
              const inventoryUpdatedData = {
                productId: item.productId,
                stockCount: stock_count,
                reservedCount: reserved_count,
                availableCount,
                inStock: availableCount > 0,
                reason: 'ORDER_CONFIRMED',
                orderId: data.orderId,
              };

              await client.query(
                `INSERT INTO outbox_events (topic, event_key, payload) 
                 VALUES ($1, $2, $3)`,
                [
                  'inventory.updated',
                  String(item.productId),
                  buildEnvelope('inventory.updated', inventoryUpdatedData, `inv-${item.productId}-${Date.now()}`),
                ]
              );
            }
          }

          // Move the order to CONFIRMED
          await client.query(
            "UPDATE orders SET status = 'CONFIRMED', updated_at = NOW() WHERE id = $1",
            [data.orderId]
          );

          // Request customer confirmation email
          const notifyData = {
            orderId: data.orderId,
            recipient: data.customerEmail || data.email,
            customerName: data.customerName,
            totalCents: data.totalCents,
            items: data.items,
          };

          await client.query(
            `INSERT INTO outbox_events (topic, event_key, payload) 
             VALUES ($1, $2, $3)`,
            [
              'notification.requested',
              String(data.orderId),
              buildEnvelope('notification.requested', notifyData, `notif-${data.orderId}`),
            ]
          );

          // Record processed event
          await client.query(
            'INSERT INTO processed_events (event_id, consumer_name) VALUES ($1, $2)',
            [eventId, 'inventory-worker']
          );

          await client.query('COMMIT');
          logger.info(`✅ Order #${data.orderId} moved to CONFIRMED and inventory deducted.`);
          client.release();
          return;
        } catch (err: any) {
          await client.query('ROLLBACK').catch(() => {});
          client.release();
          retries++;
          logger.error({ err, retries }, 'Failed to process order.placed event');
          if (retries <= maxRetries) {
            await new Promise((r) => setTimeout(r, Math.pow(2, retries) * 500));
          } else {
            logger.error(`Dead-lettering event ${eventId} to Postgres dead_letter_events table`);
            await pool.query(
              `INSERT INTO dead_letter_events (topic, event_key, payload, error) VALUES ($1, $2, $3, $4)`,
              ['order.placed', String(data.orderId || eventId), raw, err?.message || 'Max retries exceeded']
            ).catch((e) => logger.error({ e }, 'Failed to write to dead_letter_events table'));
            return;
          }
        }
      }
    },
  });
}

run().catch((err) => {
  logger.error({ err }, 'Inventory worker crashed');
  process.exit(1);
});
