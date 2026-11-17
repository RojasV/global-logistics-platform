import { Kafka } from "kafkajs";

const topic = "shipment-status";
const kafkaBroker = process.env.KAFKA_BROKER ?? "127.0.0.1:9092";

const kafka = new Kafka({ clientId: "topic-declaration", brokers: [kafkaBroker] });
const admin = kafka.admin();
await admin.connect();
await admin.createTopics({
  topics: [{ topic, numPartitions: 1, replicationFactor: 1 }],
  waitForLeaders: true,
});
await admin.disconnect();
console.log(`Declared Kafka topic ${topic}`);
process.exit(0);
