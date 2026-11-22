import { API_BASE, USE_MOCK } from './config'

export type ServiceStatus = 'up' | 'down'

export type UnderTheHoodData = {
  health: {
    postgres: ServiceStatus
    kafka: ServiceStatus
    opensearch: ServiceStatus
    timestamp: string
  }
  latestOrders: {
    orderId: string
    customerName: string
    customerEmail: string
    status: string
    totalCents: number
    createdAt: string
    updatedAt: string
  }[]
  latestEvents: {
    id: number
    topic: string
    key: string
    partition: number
    offset: string
    timestamp: string
  }[]
  consumerActions: {
    eventId: string
    consumer: string
    action: string
    timestamp: string
  }[]
  latestSearch: {
    query: string
    normalizedQuery: string
    isCorrected: boolean
    hitCount: number
    tookMs: number
    timestamp: string
  } | null
}

export async function getUnderTheHood(signal?: AbortSignal): Promise<UnderTheHoodData> {
  if (USE_MOCK) {
    return {
      health: { postgres: 'up', kafka: 'up', opensearch: 'up', timestamp: new Date().toISOString() },
      latestOrders: [
        {
          orderId: 'mock-order-001',
          customerName: 'Demo Judge',
          customerEmail: 'j***e@demo.local',
          status: 'CONFIRMED',
          totalCents: 149900,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      latestEvents: [
        {
          id: 1,
          topic: 'order.placed',
          key: 'mock-order-001',
          partition: 0,
          offset: '1',
          timestamp: new Date().toISOString(),
        },
      ],
      consumerActions: [
        {
          eventId: 'mock-order-001',
          consumer: 'inventory-worker',
          action: 'Deducted inventory & confirmed order',
          timestamp: new Date().toISOString(),
        },
      ],
      latestSearch: {
        query: 'bluetooth',
        normalizedQuery: 'bluetooth',
        isCorrected: false,
        hitCount: 8,
        tookMs: 12,
        timestamp: new Date().toISOString(),
      },
    }
  }

  const response = await fetch(`${API_BASE}/api/under-the-hood`, {
    signal,
    headers: { Accept: 'application/json' },
    credentials: 'omit',
  })

  if (!response.ok) {
    throw new Error(`Failed to load Under the Hood telemetry: HTTP ${response.status}`)
  }

  return (await response.json()) as UnderTheHoodData
}

