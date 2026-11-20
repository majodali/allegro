// The HTTP capability (B-196 (the rebuild's acceptance side), chunk Q16
// (the capabilities the launchers ship), part 1,
// docs/plans/rebuild-acceptance.md §5).
//
// What it realises, from docs/plans/book-pass-inventory.md:
//   "A capability is a named set of effectful primitives"
//   "The terminal and the browser ship output, timers and HTTP": the
//    capability for making HTTP requests
//   "A late answer or its failure fills a cell as plain data"
//   "A failure a program can handle is plain data of one shape"
//
// The names and shapes are this stream's proposal: no decision names the
// capability for HTTP, its parts, or the shape of a request and an
// answer. The maintainer confirmed them on 2026-11-20, for now: the
// capability is not final, and is to be reworked as it matures. Named
// then: request and answer bodies that are streamed; arguments checked
// more closely against the HTTP standard, a body on a GET refused among
// them; more transports and protocols. The capability is `http`, and its
// one part is `request`.
//
// `http.request(r)` takes a structure with the entries `method`, a text;
// `url`, a text; `headers`, an array of pairs `[name, value]` of texts;
// and `body`, bits of whole bytes. `method` and `url` are required.
// `headers` left out is no header, and `body` left out is no body.
//
// It answers late: it returns a cell, and the launcher fills the cell
// (`CapabilityHost.later` of next/launch/launcher.ts) with plain data,
// the structure `{status, headers, body}`. `status` is a whole number of
// 64 bits, `headers` an array of pairs of texts, and `body` the bytes
// received. Any status the server gives is an answer, a 404 and a 500
// included: the program decides what a status means.
//
// Where no answer comes, the cell is filled with a failure of the one
// shape (next/ext/allegretto/forms.md §2, "Failures"):
// ``{failure: `unreachable, reason: <a text>}``. The transport's
// rejection or throw is that case: a name that does not resolve, a
// connection refused, or anything else the transport throws.
//
// A value outside the part's domain is a refutation, as for any primitive
// function (next/ext/allegretto/forms.md §1): the part throws the
// kernel's `Refusal` (next/kernel/interface.ts) with a reason that names
// the part. Outside the domain are a value that is no structure; a
// missing or non-text `method` or `url`; `headers` that is not an array
// of pairs of texts; a `body` that is not bits of whole bytes; and an
// entry under any other key. A text is bits of whole bytes read as UTF-8.
//
// The transport is the target's. The capability is made with a function
// from a request as host data to a promise of an answer as host data. The
// terminal passes `fetchTransport`, over the host's `fetch`. The tests
// and the corpus runner pass the scripted one of
// next/launch/scripted-transport.ts, which reaches no network.
//
// Host-neutral: no process, no fs, no Buffer. The one host API it reaches
// is `globalThis.fetch`, in `fetchTransport`; TextEncoder and TextDecoder
// besides.

import { Refusal, type PrimitiveContext, type PrimitiveDeclaration, type Value } from "../kernel/interface.js";
import type { CapabilityDefinition, CapabilityHost, CapabilityImplementation, Plain } from "./launcher.js";

/** The HTTP capability: one part, which makes a request. */
export const HTTP: CapabilityDefinition = { name: "http", parts: ["request"] };

/** A request, as host data. */
export interface HttpRequest {
  readonly method: string;
  readonly url: string;
  /** The headers in the order written; empty when the program wrote none. */
  readonly headers: ReadonlyArray<readonly [string, string]>;
  /** The body's bytes; undefined when the program wrote no body. */
  readonly body?: Uint8Array;
}

/** An answer, as host data. */
export interface HttpAnswer {
  readonly status: number;
  readonly headers: ReadonlyArray<readonly [string, string]>;
  readonly body: Uint8Array;
}

/** What the target makes requests with. A rejection or a throw is a request that got no answer. */
export type Transport = (request: HttpRequest) => Promise<HttpAnswer>;

const decoder = new TextDecoder("utf-8", { fatal: true });
const encoder = new TextEncoder();

/** The keys a request may have. */
const KEYS = ["method", "url", "headers", "body"] as const;

/** Reads `value` as a text for `what`; refuses anything else. */
function textAt(value: Value, what: string, context: PrimitiveContext): string {
  if (context.kind(value) !== "bits") throw new Refusal(`http.request takes ${what} as a text, not ${context.kind(value)}`);
  const { bytes, bitLength } = context.bitsOf(value);
  if (bitLength % 8 !== 0) throw new Refusal(`http.request takes ${what} as a text of whole bytes; this value has ${bitLength} bits`);
  try {
    return decoder.decode(bytes);
  } catch {
    throw new Refusal(`http.request takes ${what} as a text; these bytes are not UTF-8`);
  }
}

/** True for a structure every entry of which has no key. */
function isArray(value: Value, context: PrimitiveContext): boolean {
  return context.kind(value) === "structure" && context.entriesOf(value).every(([k]) => k === null);
}

/** Reads a request from the part's argument; refuses a value outside the domain. */
export function requestOf(value: Value, context: PrimitiveContext): HttpRequest {
  if (context.kind(value) !== "structure") throw new Refusal(`http.request takes a structure, not ${context.kind(value)}`);
  const found = new Map<string, Value>();
  for (const [k, v] of context.entriesOf(value)) {
    if (k === null) throw new Refusal("http.request takes a structure whose entries are keyed; this one has an entry with no key");
    if (context.kind(k) !== "symbol") throw new Refusal(`http.request takes a structure keyed by symbols; this one has an entry keyed by a ${context.kind(k)}`);
    const name = context.symbolName(k);
    if (!(KEYS as readonly string[]).includes(name)) throw new Refusal(`http.request takes the entries method, url, headers and body; this structure has an entry ${name}`);
    found.set(name, v);
  }
  for (const required of ["method", "url"] as const)
    if (!found.has(required)) throw new Refusal(`http.request takes a structure with an entry ${required}; this one has none`);
  const method = textAt(found.get("method")!, "the method", context);
  const url = textAt(found.get("url")!, "the url", context);
  const headers: Array<readonly [string, string]> = [];
  const h = found.get("headers");
  if (h !== undefined) {
    if (!isArray(h, context)) throw new Refusal("http.request takes headers as an array of pairs of texts; this value is no array");
    for (const [, pair] of context.entriesOf(h)) {
      if (!isArray(pair, context) || context.entriesOf(pair).length !== 2)
        throw new Refusal("http.request takes headers as an array of pairs of texts; an entry is no pair");
      const [[, name], [, v]] = context.entriesOf(pair);
      headers.push([textAt(name, "a header's name", context), textAt(v, "a header's value", context)]);
    }
  }
  const b = found.get("body");
  if (b === undefined) return { method, url, headers };
  if (context.kind(b) !== "bits") throw new Refusal(`http.request takes the body as bits of whole bytes, not ${context.kind(b)}`);
  const { bytes, bitLength } = context.bitsOf(b);
  if (bitLength % 8 !== 0) throw new Refusal(`http.request takes the body as bits of whole bytes; this value has ${bitLength} bits`);
  return { method, url, headers, body: Uint8Array.from(bytes) };
}

/** A text as plain data. */
const textPlain = (t: string): Plain => {
  const bytes = encoder.encode(t);
  return { bits: bytes, bitLength: bytes.length * 8 };
};
/** An entry keyed by the symbol `name`. */
const keyed = (name: string, value: Plain): readonly [Plain, Plain] => [{ symbol: name }, value];

/** A whole number as 64 bits, most significant byte first. */
function int64(n: number): Plain {
  const bytes = new Uint8Array(8);
  let v = BigInt(n);
  for (let i = 7; i >= 0; i--) {
    bytes[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return { bits: bytes, bitLength: 64 };
}

/** An answer as plain data: `{status, headers, body}`. A transport's answer of another shape is a fault of the target. */
export function answerPlain(answer: HttpAnswer): Plain {
  if (!Number.isSafeInteger(answer.status) || answer.status < 0) throw new Error(`the transport answered the status ${String(answer.status)}, which is no whole number`);
  return {
    entries: [
      keyed("status", int64(answer.status)),
      keyed("headers", { entries: answer.headers.map(([n, v]) => [null, { entries: [[null, textPlain(n)], [null, textPlain(v)]] }] as const) }),
      keyed("body", { bits: Uint8Array.from(answer.body), bitLength: answer.body.length * 8 }),
    ],
  };
}

/** The failure of a request that got no answer: ``{failure: `unreachable, reason: <a text>}``. */
export function unreachable(reason: string): Plain {
  return { entries: [keyed("failure", { symbol: "unreachable" }), keyed("reason", textPlain(reason))] };
}

/** What a transport threw or rejected with, as a text. */
function reasonOf(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const cause = (e as { cause?: unknown }).cause;
  return cause instanceof Error && cause.message !== "" ? `${e.message}: ${cause.message}` : e.message;
}

/** The part `request` of `http`, on `transport`: it returns a cell, and `later` is told what fills it. */
export function httpRequest(transport: Transport, later: CapabilityHost["later"]): PrimitiveDeclaration {
  return {
    purity: "effectful",
    capability: HTTP.name,
    part: "request",
    arity: 1,
    run: (args, context) => {
      const request = requestOf(args[0], context);
      const cell = context.cell();
      // A throw of the transport, as its rejection, is no answer; a malformed answer is a fault of the target.
      const asked = new Promise<HttpAnswer>((resolve) => resolve(transport(request)));
      later(cell, asked.then(answerPlain, (e: unknown) => unreachable(reasonOf(e))));
      return cell;
    },
  };
}

/** The HTTP capability as a target supplies it, on `transport`. */
export function http(transport: Transport): CapabilityImplementation {
  return { definition: HTTP, create: (host) => [httpRequest(transport, (cell, answer) => host.later(cell, answer))] };
}

/** The host's `fetch`, as far as this file uses it. */
type HostFetch = (
  url: string,
  init: { method: string; headers: Array<[string, string]>; body?: Uint8Array },
) => Promise<{ status: number; headers: { forEach(f: (value: string, name: string) => void): void }; arrayBuffer(): Promise<ArrayBuffer> }>;

/** The terminal's transport: the host's `fetch`, reached as `globalThis.fetch`. No test calls it. */
export const fetchTransport: Transport = async (request) => {
  const hostFetch = (globalThis as { fetch?: unknown }).fetch;
  if (typeof hostFetch !== "function") throw new Error("this host has no fetch");
  const response = await (hostFetch as HostFetch)(request.url, {
    method: request.method,
    headers: request.headers.map(([n, v]) => [n, v]),
    ...(request.body === undefined ? {} : { body: request.body }),
  });
  const headers: Array<readonly [string, string]> = [];
  response.headers.forEach((value, name) => headers.push([name, value]));
  return { status: response.status, headers, body: new Uint8Array(await response.arrayBuffer()) };
};
