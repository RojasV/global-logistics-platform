import { Kafka } from "kafkajs";
import { parseStatusChangedEvent } from "./contracts.ts";

const topic = "shipment-status";
const kafkaBroker = process.env.KAFKA_BROKER ?? "127.0.0.1:9092";

const kafka = new Kafka({ clientId: "notification-dispatcher", brokers: [kafkaBroker] });
const admin = kafka.admin();
await admin.connect();
await admin.createTopics({
  topics: [{ topic, numPartitions: 1, replicationFactor: 1 }],
  waitForLeaders: true,
});
await admin.disconnect();

const consumer = kafka.consumer({ groupId: "notification-dispatcher" });
await consumer.connect();
await consumer.subscribe({ topic, fromBeginning: false });

console.log(`Dispatcher reading Kafka topic ${topic}`);

await consumer.run({
  eachMessage: async ({ message }) => {
    const raw = message.value?.toString("utf8");
    if (!raw) return;
    const event = parseStatusChangedEvent(JSON.parse(raw));
    if (!event) return;
    console.log(`Read ${event.eventId} revision ${event.revision} from ${topic}`);
  },
});
