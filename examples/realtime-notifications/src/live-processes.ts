import { spawn, type ChildProcess } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const node = process.execPath;
const children: ChildProcess[] = [];

function once(script: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(node, ["--experimental-strip-types", script], {
      cwd: root,
      env: process.env,
      stdio: "inherit",
    });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

const declared = await once("src/declare-topic.ts");
if (declared !== 0) {
  console.error("topic declaration failed");
  process.exit(declared);
}

function start(script: string, env: Record<string, string>, name: string): void {
  const child = spawn(node, ["--experimental-strip-types", script], {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: "inherit",
  });
  child.on("exit", (code) => {
    console.error(`${name} exited (${code ?? "signal"})`);
  });
  children.push(child);
}

start("src/dispatcher-main.ts", {}, "dispatcher");
start("src/replica-main.ts", { REPLICA_ID: "A", PORT: "4317" }, "replica A");
start("src/replica-main.ts", { REPLICA_ID: "B", PORT: "4318" }, "replica B");
start("src/replica-main.ts", { REPLICA_ID: "C", PORT: "4319" }, "replica C");

function stop(): void {
  for (const child of children) child.kill();
}

process.on("SIGINT", () => {
  stop();
  process.exit(0);
});
process.on("SIGTERM", stop);
