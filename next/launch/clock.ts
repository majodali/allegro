// The clocks the timer capability is given (B-196 (the rebuild's
// acceptance side), chunk Q7 (the minimal launcher and the output
// capability), part 5). The timer capability, next/launch/timer.ts, takes
// a clock, so time is the target's: the terminal passes the host's real
// timer (`realClock`), and the launcher's tests and the corpus runner
// (next/corpus/allegretto.ts) pass one that runs no real time
// (`virtualClock`).
//
// A clock is a function asked to call back once `ms` milliseconds have
// passed. The count is a bigint, so a wait of any whole number of 64 bits
// is asked exactly.
//
// The real clock is the host's `setTimeout`. A host timer takes at most
// 2^31 - 1 milliseconds, so a longer wait is several timers, one after
// the other.
//
// The virtual clock keeps the waits asked of it and their due times,
// counted from its own zero. It answers them in the order they fall due,
// the earlier asked first among waits due at the same time, one at a
// time. Between two answers it lets the host's event loop take one turn
// (`setImmediate` where the host has it, a timer of 0 milliseconds
// otherwise). In that turn the launcher fills the cell of the answer and
// evaluates again what waited on it, and what that evaluation asks of the
// clock is due counted from the time of the answer. So a program's
// printed order is the order its waits fall due, a run never waits the
// milliseconds it asks for, and two runs of one program print the same.
//
// Host-neutral: no process, no fs, no Buffer.

/** Calls `callback` once `ms` milliseconds have passed, as the clock counts them. */
export type Clock = (ms: bigint, callback: () => void) => void;

/** The longest wait one host timer takes, in milliseconds. */
const LONGEST_TIMER = 2n ** 31n - 1n;

/** The host's real timer. */
export const realClock: Clock = (ms, callback) => {
  const step = ms > LONGEST_TIMER ? LONGEST_TIMER : ms;
  setTimeout(() => (ms > step ? realClock(ms - step, callback) : callback()), Number(step));
};

/** A clock that runs no real time, and what it has been asked. */
export interface VirtualClock {
  readonly clock: Clock;
  /** The clock's time: the due time of the last wait it answered, from its zero. */
  now(): bigint;
  /** The waits asked and not yet answered. */
  pending(): number;
}

/** One host turn: what lets the launcher go on before the next answer. The scripted transport of next/launch/scripted-transport.ts uses it too. */
export const nextTurn: (f: () => void) => void =
  typeof (globalThis as { setImmediate?: unknown }).setImmediate === "function"
    ? (f) => (globalThis as unknown as { setImmediate: (f: () => void) => void }).setImmediate(f)
    : (f) => setTimeout(f, 0);

/** A new virtual clock, at its zero, with nothing asked. */
export function virtualClock(): VirtualClock {
  let now = 0n;
  let asked = 0;
  let turning = false;
  const waits: Array<{ readonly at: bigint; readonly order: number; readonly callback: () => void }> = [];
  const answerNext = (): void => {
    turning = false;
    if (waits.length === 0) return;
    // The earliest due; among those due at one time, the earliest asked.
    let i = 0;
    for (let j = 1; j < waits.length; j++)
      if (waits[j].at < waits[i].at || (waits[j].at === waits[i].at && waits[j].order < waits[i].order)) i = j;
    const [w] = waits.splice(i, 1);
    now = w.at;
    w.callback();
    turn();
  };
  const turn = (): void => {
    if (turning || waits.length === 0) return;
    turning = true;
    nextTurn(answerNext);
  };
  return {
    clock: (ms, callback) => {
      waits.push({ at: now + ms, order: asked++, callback });
      turn();
    },
    now: () => now,
    pending: () => waits.length,
  };
}
