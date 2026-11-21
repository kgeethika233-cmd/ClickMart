import { EventEmitter } from 'events';

export interface StockUpdatePayload {
  productId: number;
  availableCount: number;
  inStock: boolean;
}

class StockEventEmitter extends EventEmitter {}

export const stockEvents = new StockEventEmitter();
stockEvents.setMaxListeners(100);

