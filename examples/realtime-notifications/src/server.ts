import { createNotificationApp } from "./app.ts";

const port = Number(process.env.PORT ?? "4317");
const app = createNotificationApp();

app.server.listen(port, "127.0.0.1", () => {
  console.log(`Shipment notification study listening on http://127.0.0.1:${port}`);
  console.log("Open that URL in a browser. Replica A holds the browser socket. Replicas B and C stay subscribed.");
});
