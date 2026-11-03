import { parentPort, workerData } from "node:worker_threads";

// A worker thread for parallel.ts: runs one task and posts its result.
const { module, task, args, seed, n } = workerData;
const m = await import(module);
parentPort!.postMessage(await m[task](...args, seed, n));
