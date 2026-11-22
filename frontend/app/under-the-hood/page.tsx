import type { Metadata } from 'next'
import UnderTheHood from '@/components/under-the-hood'

export const metadata: Metadata = {
  title: 'Under the Hood | Inventory Hub Telemetry',
  description: 'Live distributed systems telemetry proving real work across Aiven PostgreSQL, Apache Kafka, and OpenSearch.',
}

export default function UnderTheHoodPage() {
  return <UnderTheHood />
}

