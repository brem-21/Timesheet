// kafkajs uses Node.js built-ins (net, tls, crypto) and must never be bundled
// by webpack. All imports use /* webpackIgnore: true */ to keep them out of
// both the Node.js server bundle AND the Edge runtime bundle.

import type { Kafka, Producer } from "kafkajs";

export const EVENTS_TOPIC = "clockit.user-events";

const BROKERS = (process.env.KAFKA_BROKERS ?? "localhost:9094").split(",");

const globalForKafka = globalThis as unknown as {
  _kafka: Kafka | undefined;
  _producer: Producer | undefined;
};

async function getKafka(): Promise<Kafka> {
  if (!globalForKafka._kafka) {
    // webpackIgnore prevents webpack from following this import
    const { Kafka, logLevel } = await import(/* webpackIgnore: true */ "kafkajs");
    globalForKafka._kafka = new Kafka({
      clientId: "clockit-app",
      brokers: BROKERS,
      logLevel: logLevel.ERROR,
      retry: { retries: 3, initialRetryTime: 300 },
    });
  }
  return globalForKafka._kafka!;
}

export async function getProducer(): Promise<Producer> {
  if (!globalForKafka._producer) {
    const kafka = await getKafka();
    const producer = kafka.producer();
    await producer.connect();
    globalForKafka._producer = producer;
  }
  return globalForKafka._producer!;
}

export async function publishEvent(event: Record<string, unknown>): Promise<void> {
  try {
    const producer = await getProducer();
    await producer.send({
      topic: EVENTS_TOPIC,
      messages: [
        {
          key: String(event.sessionId ?? "anon"),
          value: JSON.stringify(event),
        },
      ],
    });

  } catch (err) {
    console.error("[Kafka] publishEvent failed:", err);
  }
}

export async function createConsumer(groupId: string) {
  const kafka = await getKafka();
  return kafka.consumer({ groupId, sessionTimeout: 30000 });
}
