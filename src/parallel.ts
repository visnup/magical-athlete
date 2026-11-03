import { availableParallelism } from "node:os";
import { Worker } from "node:worker_threads";

/**
 * Runs `n` races' worth of `task` split across a worker per core, then adds up what they return
 * (numbers, arrays, objects or Maps of them). `task` is an export of `module` called as
 * `task(...args, seed, n)`; `module` must not do anything at the top level but define things, so
 * scripts guard their main code with `import.meta.main`.
 */
export async function parallel<T>(module: string, task: string, args: unknown[], n: number): Promise<T> {
  const k = Math.min(availableParallelism(), n);
  const parts = await Promise.all(
    Array.from({ length: k }, (_, i) => {
      const count = Math.floor(n / k) + (i < n % k ? 1 : 0);
      const worker = new Worker(new URL("./worker.ts", import.meta.url), { workerData: { module, task, args, seed: i + 1, n: count } });
      return new Promise<T>((resolve, reject) => {
        worker.once("message", resolve);
        worker.once("error", reject);
      });
    }),
  );
  return parts.reduce(add);
}

function add<T>(a: T, b: T): T {
  if (typeof a === "number") return (a + (b as number)) as T;
  if (Array.isArray(a)) return a.map((x, i) => add(x, (b as unknown[])[i])) as T;
  if (a instanceof Map) return new Map([...a].map(([key, x]) => [key, add(x, (b as Map<unknown, unknown>).get(key))])) as T;
  if (a && typeof a === "object") {
    return Object.fromEntries(Object.entries(a).map(([key, x]) => [key, add(x, (b as Record<string, unknown>)[key])])) as T;
  }
  return a;
}
