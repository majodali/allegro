// =============================================================================
// Allegretto - Module Loader
// Loads .alg files as anonymous extensions.
// =============================================================================

import { parseBase, parseStandard } from "./hybrid-parser.js";
import { buildEvalCtx, resolvePrimitives, resolveSymbols, Extension } from "./runtime.js";
import { evaluate } from "./evaluator.js";
import { Value, ValueKind, ContextValue, BitsValue, ComposedFunctionValue, PrimitiveFnImpl, makePrimitive, makeContext, makeExpr, makeMultiValue, stringToBits, bitsToString, primaryOf, AllegroError } from "./types.js";
import { withType } from "./types-std.js";

// --- Types ---

export interface ModuleConfig {
  /** Module identifier, e.g. "math" */
  id: string;
  /** IDs of modules this one depends on (loaded first) */
  deps?: string[];
}

/** Async file reader — browser-compatible (fetch) or Node (fs.promises). */
export type FileReader = (path: string) => Promise<string>;

/** Maps a module ID to a file path, or null if not found. */
export type ModuleResolver = (moduleId: string) => string | null;

export interface ModuleLoaderOptions {
  modules: ModuleConfig[];
  resolve: ModuleResolver;
  readFile: FileReader;
  /** Standard extensions (type system, etc.) to make available in modules */
  extensions?: Extension[];
}

// --- Module Type Builder ---

/**
 * Capture closure variables in a function body by substituting
 * named Params that reference module bindings.
 */
function captureModuleVars(
  value: Value,
  moduleBindings: Record<string, Value>,
  ownParams: Set<string>,
  seen?: Set<Value>,
): Value {
  if (!seen) seen = new Set();
  if (seen.has(value)) return value;
  seen.add(value);

  switch (value.kind) {
    case ValueKind.Bits:
    case ValueKind.PrimitiveFunction:
    case ValueKind.Context:
      return value;

    case ValueKind.Param:
      return value;

    case ValueKind.Symbol: {
      if (!ownParams.has(value.name)) {
        const resolved = moduleBindings[value.name];
        if (resolved !== undefined) return resolved;
      }
      return value;
    }

    case ValueKind.ComposedFunction: {
      const fn = value as ComposedFunctionValue;
      const innerOwn = new Set(ownParams);
      for (const p of fn.params) {
        if (p._name) innerOwn.add(p._name);
      }
      const newBody = captureModuleVars(fn.body, moduleBindings, innerOwn, seen);
      if (newBody === fn.body) return value;
      const newFn: ComposedFunctionValue = {
        kind: ValueKind.ComposedFunction,
        params: fn.params,
        body: newBody,
      };
      for (const p of newFn.params) p.owner = newFn;
      return newFn;
    }

    case ValueKind.Expression: {
      const newFn = captureModuleVars(value.fn, moduleBindings, ownParams, seen);
      const newArgs = value.args.map(a => captureModuleVars(a, moduleBindings, ownParams, seen));
      if (newFn === value.fn && newArgs.every((a, i) => a === value.args[i])) return value;
      return makeExpr(newFn, newArgs);
    }

    case ValueKind.MultiValue: {
      const newP = captureModuleVars(value.primary, moduleBindings, ownParams, seen);
      if (newP === value.primary) return value;
      return makeMultiValue(newP, new Map(value.components));
    }

    default:
      return value;
  }
}

/**
 * Build a typed module object from exported bindings.
 * Creates a module-specific type with getters for each exported field.
 * The underlying Context holds all bindings (public and private),
 * but only exported fields are accessible through the type.
 * Exported functions have closure variables captured from the module scope.
 */
export function buildModuleObject(
  name: string,
  allBindings: Record<string, Value>,
  exportedNames: Set<string>,
): Value {
  // Capture closure variables in exported functions.
  // Skip self-referential bindings (recursive functions).
  const capturedBindings: Record<string, Value> = {};
  for (const [key, value] of Object.entries(allBindings)) {
    const p = primaryOf(value);
    if (p.kind === ValueKind.ComposedFunction) {
      // Exclude this binding's own name to prevent infinite recursion
      const selfExclude = new Set([key]);
      capturedBindings[key] = captureModuleVars(value, allBindings, selfExclude);
    } else {
      capturedBindings[key] = value;
    }
  }

  // Build the underlying Context with ALL bindings (public + private)
  const ctx = makeContext();
  for (const [key, value] of Object.entries(capturedBindings)) {
    ctx.bindings.set(key, { key, value, isUse: false });
    ctx.bindingList.push({ key, value, isUse: false });
  }

  // Build a module-specific type with __getMember for exported fields only.
  // The __getMember checks if the requested field is in the exported set,
  // enforcing encapsulation — private module bindings are inaccessible.
  const moduleType = makeContext();

  // __name
  const nameKey = "__name";
  const nameVal = stringToBits(name);
  moduleType.bindings.set(nameKey, { key: nameKey, value: nameVal, isUse: false });
  moduleType.bindingList.push({ key: nameKey, value: nameVal, isUse: false });

  // __getMember: only allows access to exported fields
  const getMember: PrimitiveFnImpl = (args) => {
    const moduleCtx = args[0] as ContextValue;
    const fieldName = bitsToString(args[1] as BitsValue);
    if (!exportedNames.has(fieldName)) {
      throw new AllegroError(`Module '${name}': '${fieldName}' is not exported`);
    }
    const b = moduleCtx.bindings.get(fieldName);
    if (!b?.value) throw new AllegroError(`Module '${name}': '${fieldName}' is undefined`);
    return b.value;
  };
  const getMemberPrim = makePrimitive(`${name}.__getMember`, getMember);
  moduleType.bindings.set("__getMember", { key: "__getMember", value: getMemberPrim, isUse: false });
  moduleType.bindingList.push({ key: "__getMember", value: getMemberPrim, isUse: false });

  return withType(ctx, moduleType);
}

// --- Module Loader ---

export class ModuleLoader {
  private cache = new Map<string, Extension>();
  private configs: Map<string, ModuleConfig>;
  private resolve: ModuleResolver;
  private readFile: FileReader;
  private extensions: Extension[];

  constructor(options: ModuleLoaderOptions) {
    this.configs = new Map(options.modules.map(m => [m.id, m]));
    this.resolve = options.resolve;
    this.readFile = options.readFile;
    this.extensions = options.extensions ?? [];
  }

  /**
   * Load all configured modules in dependency order.
   * Returns Extensions ready to pass to evalSource().
   */
  async loadAll(): Promise<Extension[]> {
    const extensions: Extension[] = [];
    const loading = new Set<string>();

    for (const config of this.configs.values()) {
      const ext = await this.loadModule(config.id, loading);
      // Only add to result list if not already present (deps may have added it)
      if (!extensions.some(e => e.name === ext.name)) {
        extensions.push(ext);
      }
    }

    return extensions;
  }

  /**
   * Load a single module and its dependencies.
   * @param id       Module identifier
   * @param loading  Set of module IDs currently being loaded (circular dep detection)
   */
  async loadModule(id: string, loading: Set<string>): Promise<Extension> {
    // 1. Check cache
    const resolvedPath = this.resolve(id);
    if (resolvedPath === null) {
      throw new Error(`Module '${id}': could not resolve to a file path`);
    }

    const cached = this.cache.get(resolvedPath);
    if (cached) return cached;

    // 2. Circular dependency check
    if (loading.has(id)) {
      throw new Error(`Circular dependency detected: '${id}' is already being loaded`);
    }
    loading.add(id);

    // 3. Load dependencies first
    const config = this.configs.get(id);
    const deps = config?.deps ?? [];
    const depExtensions: Extension[] = [];

    for (const depId of deps) {
      const depExt = await this.loadModule(depId, loading);
      depExtensions.push(depExt);
    }

    // 4. Read and parse module source
    const source = await this.readFile(resolvedPath);
    const normalized = source.replace(/\r\n/g, "\n");
    // Use standard parser if extensions are available (enables typed syntax)
    const parseResult = this.extensions.length > 0
      ? parseStandard(normalized)
      : parseBase(normalized);

    if (parseResult.errors.length > 0) {
      throw new Error(`Module '${id}': parse error: ${parseResult.errors[0].message}`);
    }

    const fileCtx = (parseResult.tree as any).ctx;
    if (!fileCtx) {
      // Empty module
      const ext: Extension = { name: id, bindings: {} };
      this.cache.set(resolvedPath, ext);
      loading.delete(id);
      return ext;
    }

    // 5. Resolve symbols and build evaluation context
    //    Include standard extensions so modules can use types (Float, Int, etc.)
    const allExtensions = [...this.extensions, ...depExtensions];
    resolveSymbols(fileCtx, undefined, allExtensions);
    const evalCtx = buildEvalCtx(fileCtx, undefined, allExtensions);

    // 6. Evaluate bare expressions (side effects)
    for (const b of fileCtx.bindingList) {
      if (b.key === null && b.value !== undefined) {
        evaluate(b.value, evalCtx);
      }
    }

    // 7. Extract source-defined bindings as exports
    //    If any binding has an "exported" component, only export those.
    //    Otherwise export all source-defined bindings (backward compat).
    const allBindings: Record<string, Value> = {};
    const exportedBindings: Record<string, Value> = {};
    let hasExports = false;

    for (const b of fileCtx.bindingList) {
      if (b.key !== null && b.value !== undefined) {
        const ctxBinding = evalCtx.bindings.get(b.key);
        if (ctxBinding?.value !== undefined) {
          const evaluated = evaluate(ctxBinding.value, evalCtx);
          allBindings[b.key] = evaluated;
          // Check for "exported" component
          if (evaluated.kind === ValueKind.MultiValue) {
            const exp = evaluated.components.get("exported");
            if (exp) {
              hasExports = true;
              exportedBindings[b.key] = evaluated;
            }
          }
        }
      }
    }

    const exportNames = hasExports
      ? new Set(Object.keys(exportedBindings))
      : new Set(Object.keys(allBindings));
    const bindings = hasExports ? exportedBindings : allBindings;

    // Build typed module object for use with `import name` + dot access
    const moduleObj = buildModuleObject(id, allBindings, exportNames);

    const ext: Extension = { name: id, bindings, moduleObject: moduleObj };
    this.cache.set(resolvedPath, ext);
    loading.delete(id);
    return ext;
  }
}
