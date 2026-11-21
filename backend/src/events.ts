import { z } from 'zod';

export const EventEnvelopeSchema = z.object({
  eventId: z.number().or(z.string()),
  eventType: z.string(),
  occurredAt: z.string(),
  data: z.record(z.unknown()),
});

export type EventEnvelope<T = Record<string, unknown>> = {
  eventId: number | string;
  eventType: string;
  occurredAt: string;
  data: T;
};

export function buildEnvelope<T extends Record<string, unknown>>(
  eventType: string,
  data: T,
  eventId: number | string
): EventEnvelope<T> {
  return {
    eventId,
    eventType,
    occurredAt: new Date().toISOString(),
    data,
  };
}
