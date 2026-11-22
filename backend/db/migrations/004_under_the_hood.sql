ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS kafka_partition INT;
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS kafka_offset VARCHAR(64);

