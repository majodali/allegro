// =============================================================================
// The kernel's time box: the worker thread's entry (B-187 L4)
// =============================================================================
//
// `runLlmWorker` (`pcp/llm-worker.ts`) judges each turn here when the kernel
// has a time box: the thread loads the file's modules once and answers one
// judgement per message, and the loop terminates the thread when a judgement
// does not come back within the box. `evalSource` is synchronous, so a
// thread the loop can terminate is what ends a diverging evaluation without
// a change to the evaluator.

import { parentPort, workerData } from "node:worker_threads";

// The thread does not inherit the parent's `tsx` hooks, so it registers
// them before it imports the worker's TypeScript (whose imports name `.js`
// files, as the repository's ESM convention has it).
const { register } = await import("tsx/esm/api");
register();
const { serveTurns } = await import("./llm-worker.js");
await serveTurns(parentPort as any, workerData);
