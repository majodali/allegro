// A transport for the HTTP capability that reaches no network (B-196 (the
// rebuild's acceptance side), chunk Q16 (the capabilities the launchers
// ship), part 1). The HTTP capability, next/launch/http.ts, takes a
// transport, so the network is the target's: the terminal passes the
// host's `fetch`, and the tests and the corpus runner
// (next/corpus/allegretto.ts) pass this one.
//
// It is made with a table from a method and a URL to an answer. A request
// the table holds is answered with that answer; every other request is
// rejected, which the capability fills as the failure `unreachable`. It
// keeps every request it is handed, in the order asked, so a test can see
// what a program sent.
//
// It keeps the order. The answers are delivered in the order the requests
// were asked, one at a time, and between two answers the host's event
// loop takes one turn (`nextTurn` of next/launch/clock.ts). In that turn
// the launcher fills the cell of the answer and evaluates again what
// waited on it, and a request asked then is answered after those asked
// before it. So a program's printed order under requests is the same on
// every run.
//
// Host-neutral: no process, no fs, no Buffer, no network.

import { nextTurn } from "./clock.js";
import type { HttpAnswer, HttpRequest, Transport } from "./http.js";

/** One answer the table holds: for the request of this method and URL. */
export interface Served {
  readonly method: string;
  readonly url: string;
  readonly answer: HttpAnswer;
}

/** A transport that reaches no network, and what it has been handed. */
export interface ScriptedTransport {
  readonly transport: Transport;
  /** Every request handed to it, in the order asked. */
  readonly asked: HttpRequest[];
  /** The requests asked and not yet answered. */
  pending(): number;
}

/** A scripted transport serving `served`: every other request is rejected as unreachable. */
export function scriptedTransport(served: readonly Served[]): ScriptedTransport {
  const table = new Map(served.map((s) => [`${s.method} ${s.url}`, s.answer] as const));
  const asked: HttpRequest[] = [];
  const queue: Array<{ readonly request: HttpRequest; readonly resolve: (a: HttpAnswer) => void; readonly reject: (e: Error) => void }> = [];
  let turning = false;
  const answerNext = (): void => {
    turning = false;
    const next = queue.shift();
    if (next === undefined) return;
    const answer = table.get(`${next.request.method} ${next.request.url}`);
    if (answer === undefined) next.reject(new Error(`nothing serves ${next.request.method} ${next.request.url}`));
    else next.resolve(answer);
    turn();
  };
  const turn = (): void => {
    if (turning || queue.length === 0) return;
    turning = true;
    nextTurn(answerNext);
  };
  return {
    transport: (request) =>
      new Promise<HttpAnswer>((resolve, reject) => {
        asked.push(request);
        queue.push({ request, resolve, reject });
        turn();
      }),
    asked,
    pending: () => queue.length,
  };
}
