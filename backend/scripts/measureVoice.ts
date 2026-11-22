const phrases = [
  'Coffee mug',
  'Search bluetooth earphones',
  'Add 2 organic milk',
  'Order boAt Airdopes in Coimbatore'
];

async function measure() {
  console.log('--- Testing Voice Commands against http://localhost:4000/api/voice-command ---');
  for (const phrase of phrases) {
    const start = Date.now();
    try {
      const res = await fetch('http://localhost:4000/api/voice-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `voice-test-${Date.now()}` },
        body: JSON.stringify({ transcript: phrase })
      });
      const duration = Date.now() - start;
      const text = await res.text();
      console.log(`\nTranscript: "${phrase}"`);
      console.log(`Status: ${res.status} in ${duration}ms`);
      try {
        const json = JSON.parse(text);
        console.log(`Response:`, JSON.stringify(json, null, 2).slice(0, 300) + '...');
      } catch {
        console.log(`Raw text:`, text.slice(0, 200));
      }
    } catch (err: any) {
      const duration = Date.now() - start;
      console.log(`\nTranscript: "${phrase}" FAILED in ${duration}ms: ${err.message}`);
    }
  }
}

measure();
