import net from 'net';
import { config } from '../config.js';

function testTcp(name: string, host: string, port: number): Promise<void> {
  return new Promise((resolve) => {
    console.log(`Checking ${name} at ${host}:${port}...`);
    const s = net.createConnection({ host, port, timeout: 10000 }, () => {
      console.log(`✅ ${name} (${host}:${port}) is REACHABLE.`);
      s.destroy();
      resolve();
    });
    s.on('timeout', () => {
      console.log(`❌ ${name} (${host}:${port}) TIMED OUT.`);
      s.destroy();
      resolve();
    });
    s.on('error', (err) => {
      console.log(`❌ ${name} (${host}:${port}) ERROR: ${err.message}`);
      resolve();
    });
  });
}

async function main() {
  const [kafkaHost, kafkaPort] = config.KAFKA_BROKER.split(':');
  await testTcp('PostgreSQL', config.PG_HOST, config.PG_PORT);
  await testTcp('OpenSearch', config.OS_HOST, config.OS_PORT);
  await testTcp('Kafka', kafkaHost, parseInt(kafkaPort || '9092', 10));
}

main();

