import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createApp } from "./server.ts";

const databasePath = resolve(
  process.env.DATABASE_PATH ?? "./data/wappy.sqlite",
);
mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });
const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT must be between 1 and 65535");
const host = process.env.HOST ?? "127.0.0.1";
const server = createApp({
  databasePath,
  trustProxy: process.env.TRUST_PROXY === "1",
  origins: process.env.ALLOWED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
});
server.listen(port, host, () =>
  console.log(`Wappy API listening on http://${host}:${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close();
    server.closeIdleConnections();
  });
}
