/**
 * In-process stand-in for Redis Pub/Sub.
 *
 * Same delivery contract as Redis Pub/Sub, and the same limit: a message is
 * handed to subscribers registered at publish time and then forgotten.
 * This is not a Redis server and it does not speak the Redis protocol.
 */

export type MessageHandler = (channel: string, message: string) => void;

export interface RedisPubSub {
  subscribe(channel: string, handler: MessageHandler): void;
  unsubscribe(channel: string, handler: MessageHandler): void;
  publish(channel: string, message: string): number;
}

export const SHIPMENT_STATUS_CHANNEL = "shipment-status";

export class InMemoryRedisPubSub implements RedisPubSub {
  private readonly subscribers = new Map<string, Set<MessageHandler>>();

  subscribe(channel: string, handler: MessageHandler): void {
    let handlers = this.subscribers.get(channel);
    if (!handlers) {
      handlers = new Set();
      this.subscribers.set(channel, handlers);
    }
    handlers.add(handler);
  }

  unsubscribe(channel: string, handler: MessageHandler): void {
    const handlers = this.subscribers.get(channel);
    if (!handlers) return;
    handlers.delete(handler);
    if (handlers.size === 0) this.subscribers.delete(channel);
  }

  publish(channel: string, message: string): number {
    const handlers = this.subscribers.get(channel);
    if (!handlers || handlers.size === 0) return 0;
    const current = [...handlers];
    for (const handler of current) handler(channel, message);
    return current.length;
  }

  subscriberCount(channel: string): number {
    return this.subscribers.get(channel)?.size ?? 0;
  }
}
