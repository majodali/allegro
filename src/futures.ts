// =============================================================================
// Allegro — Future Manager
// Bridges JavaScript Promises to the forward-chaining partial evaluation system.
// Futures are synthetic bindings that start incomplete and complete when
// their underlying Promise resolves, triggering re-evaluation of dependents.
// =============================================================================

import { Value, ContextValue, makeSymbol, SymbolValue, makeMultiValue, stringToBits, isResolved } from "./types.js";
import { DependencyRegistry, applyPhase } from "./runtime.js";
import { makeCell } from "./scope.js";
import { withType, ErrorType, StringType } from "./types-std.js";

export interface FutureManager {
  registry: DependencyRegistry;
  evalCtx: ContextValue;
  pendingCount: number;
  counter: number;
  /** Called when a deferred print fires (for streaming output) */
  onOutput: ((text: string) => void) | null;
  /** Called when all pending futures have resolved */
  onDrain: (() => void) | null;
  /** Internal: resolves the waitForAll() promise */
  _drainResolve: (() => void) | null;

  /** Create a future: registers an incomplete binding, attaches Promise handler */
  createFuture(promise: Promise<Value>): SymbolValue;
  /** Returns true if any futures are still pending */
  hasPending(): boolean;
  /** Returns a Promise that resolves when all pending futures complete */
  waitForAll(): Promise<void>;
}

export function createFutureManager(): FutureManager {
  const fm: FutureManager = {
    registry: null as any,  // linked by evalSource
    evalCtx: null as any,   // linked by evalSource
    pendingCount: 0,
    counter: 0,
    onOutput: null,
    onDrain: null,
    _drainResolve: null,

    createFuture(promise: Promise<Value>): SymbolValue {
      const name = `__future_${fm.counter++}`;
      const sym = makeSymbol(name);

      // One pending future cell, shared by the eval scope and the
      // dependency registry (C2.3b: the binding IS the cell — value stays
      // undefined until the Promise resolves it via applyPhase).
      const cell = makeCell(name);
      fm.evalCtx.bindings.set(name, cell);
      fm.evalCtx.bindingList.push(cell);
      fm.registry.bindings.set(name, cell);

      fm.pendingCount++;

      const onComplete = () => {
        fm.pendingCount--;
        if (fm.pendingCount === 0) {
          if (fm.onDrain) fm.onDrain();
          if (fm._drainResolve) {
            fm._drainResolve();
            fm._drainResolve = null;
          }
        }
      };

      promise.then((resolvedValue) => {
        applyPhase(fm.registry, fm.evalCtx, new Map([[name, resolvedValue]]));
        onComplete();
      }).catch((err) => {
        // Resolve with an error value
        const errorVal = makeMultiValue(
          stringToBits(""),
          new Map<string, Value>([
            ["error", withType(stringToBits(String(err)), StringType)],
            ["type", ErrorType],
          ]),
        );
        applyPhase(fm.registry, fm.evalCtx, new Map([[name, errorVal]]));
        onComplete();
      });

      return sym;
    },

    hasPending(): boolean {
      return fm.pendingCount > 0;
    },

    waitForAll(): Promise<void> {
      if (fm.pendingCount === 0) return Promise.resolve();
      return new Promise((resolve) => {
        fm._drainResolve = resolve;
      });
    },
  };

  return fm;
}
