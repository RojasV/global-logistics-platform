import { Kafka } from "kafkajs";
import { createClient } from "redis";
import { parseStatusChangedEvent } from "./contracts.ts";
import { SHIPMENT_STATUS_CHANNEL } from "./pubsub.ts";

const topic = "shipment-status";
const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const kafkaBroker = process.env.KAFKA_BROKER ?? "127.0.0.1:9092";

const publisher = createClient({ url: redisUrl });
await publisher.connect();

const kafka = new Kafka({ clientId: "notification-dispatcher", brokers: [kafkaBroker] });
const consumer = kafka.consumer({ groupId: "notification-dispatcher" });
await consumer.connect();
await consumer.subscribe({ topic, fromBeginning: false });

console.log(`Dispatcher reading Kafka topic ${topic} and publishing Redis channel ${SHIPMENT_STATUS_CHANNEL}`);

await consumer.run({
  eachMessage: async ({ message }) => {
    const raw = message.value?.toString("utf8");
    if (!raw) return;
    const event = parseStatusChangedEvent(JSON.parse(raw));
    if (!event) return;
    const receivers = await publisher.publish(SHIPMENT_STATUS_CHANNEL, JSON.stringify({
      eventId: event.eventId,
      shipmentId: event.shipmentId,
      tenantId: event.tenantId,
      revision: event.revision,
      status: event.status,
      occurredAt: event.occurredAt,
    }));
    console.log(`Published ${event.eventId} revision ${event.revision} to ${receivers} Redis subscriber(s)`);
  },
});
