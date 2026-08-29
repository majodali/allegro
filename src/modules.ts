// =============================================================================
// Allegretto - Module Loader
// Loads .alg files as anonymous extensions.
// =============================================================================

import { evalSource, Extension } from "./runtime.js";
import { dataOf, cloneComponents, setName, setFallbackMember, isBareBindingName, isFutureBindingName, componentsView } from "./slots.js";
import { remapParams } from "./evaluator.js";
import { Value, ValueKind, StructureValue, BitsValue, ComposedFunctionValue, ParamValue, PrimitiveFnImpl, makePrimitive, makeStructure, makeExpr, withMetadata, stringToBits, bitsToString, AllegroError } from "./types.js";
import { withType } from "./types-std.js";
import { primitives } from "./primitives.js";
import { markExported } from "./symbols.js";
import { scanUses } from "./use-scanner.js";

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
  /** B-028 F2 (CE-R6): the session's FutureManager, threaded into module
   *  evaluation so async primitives work inside modules and module-minted
   *  futures drain with the session. Absent = the pre-F2 behavior (an
   *  async primitive inside a module errors: host capability missing). */
  futureManager?: import("./futures.js").FutureManager;
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
      // CRITICAL: clone params so mutating p.owner doesn't corrupt the original
      // function (which is referenced elsewhere — e.g., via ext.bindings for
      // direct-access paths). Without this, any function captured into the
      // module's typed moduleObject would have its original lose valid param
      // ownership, breaking direct-access calls. Mirrors the pattern in
      // evaluator.subst() and runtime.resolveNamedParams.
      const newParams = fn.params.map(p => ({
        kind: ValueKind.Param,
        position: p.position,
        owner: null as any,
        _name: p._name,
      } as ParamValue));
      const paramMap = new Map<ParamValue, ParamValue>();
      for (let i = 0; i < fn.params.length; i++) paramMap.set(fn.params[i], newParams[i]);
      const remappedBody = remapParams(newBody, paramMap);
      const newFn: ComposedFunctionValue = {
        kind: ValueKind.ComposedFunction,
        params: newParams,
        body: remappedBody,
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

    case ValueKind.Structure: {
      const pp = (value as { primary?: Value }).primary;
      if (pp === undefined) return value;
      const newP = captureModuleVars(pp, moduleBindings, ownParams, seen);
      if (newP === pp) return value;
      return withMetadata(newP, cloneComponents(value));
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
    const p = dataOf(value);
    if (p.kind === ValueKind.ComposedFunction) {
      // Exclude this binding's own name to prevent infinite recursion
      const selfExclude = new Set([key]);
      capturedBindings[key] = captureModuleVars(value, allBindings, selfExclude);
    } else {
      capturedBindings[key] = value;
    }
  }

  // Build the underlying Context with ALL bindings (public + private)
  const ctx = makeStructure();
  for (const [key, value] of Object.entries(capturedBindings)) {
    ctx.bindings.set(key, { key, value });
    ctx.bindingList.push({ key, value });
  }

  // Build a module-specific type with __getMember for exported fields only.
  // The __getMember checks if the requested field is in the exported set,
  // enforcing encapsulation — private module bindings are inaccessible.
  const moduleType = makeStructure();

  setName(moduleType, stringToBits(name));

  // __getMember: only allows access to exported fields
  const getMember: PrimitiveFnImpl = (args) => {
    const moduleCtx = args[0] as StructureValue;
    const fieldName = bitsToString(args[1] as BitsValue);
    if (!exportedNames.has(fieldName)) {
      throw new AllegroError(`Module '${name}': '${fieldName}' is not exported`);
    }
    const b = moduleCtx.bindings.get(fieldName);
    if (!b?.value) throw new AllegroError(`Module '${name}': '${fieldName}' is undefined`);
    return b.value;
  };
  const getMemberPrim = makePrimitive(`${name}.__getMember`, getMember);
  setFallbackMember(moduleType, getMemberPrim);

  return withType(ctx, moduleType);
}

// --- Module Loader ---

export class ModuleLoader {
  private cache = new Map<string, Extension>();
  private configs: Map<string, ModuleConfig>;
  private resolve: ModuleResolver;
  private readFile: FileReader;
  private extensions: Extension[];
  private futureManager?: import("./futures.js").FutureManager;

  constructor(options: ModuleLoaderOptions) {
    this.configs = new Map(options.modules.map(m => [m.id, m]));
    this.resolve = options.resolve;
    this.readFile = options.readFile;
    this.extensions = options.extensions ?? [];
    this.futureManager = options.futureManager;
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

    // 4. Read module source.
    const source = await this.readFile(resolvedPath);

    // 4a. Pre-scan for `use` directives. Lib files use the same `use NAME`
    //     syntax as top-level files; without this, body-form modules like
    //     `proven`, `effects`, `contracts` couldn't be consumed from libs.
    //     Module and member forms are recursively loaded via this same
    //     loader so transitive uses resolve through the same path resolver.
    //     `use grammar { … }` literal blocks are not yet supported inside
    //     libs (they'd need a bootstrap evalSource recursion); throw a clear
    //     error rather than silently ignoring.
    const scan = scanUses(source);
    const nestedUseModules = new Set<string>();
    for (const d of scan.directives) {
      if (d.kind === "module") {
        nestedUseModules.add(d.name!);
      } else if (d.kind === "member") {
        // First-iteration policy: member-form load brings in the full module's
        // fragments. Narrowing (only the named Grammar binding) can be added
        // later if a lib needs to disambiguate sibling Grammar values.
        nestedUseModules.add(d.moduleName!);
      } else if (d.kind === "literal") {
        throw new Error(
          `Module '${id}': \`use grammar { … }\` literal blocks are not yet ` +
          `supported inside library modules. Define the grammar in a separate ` +
          `module file and \`use\` it by name.`,
        );
      }
    }

    const useExtensions: Extension[] = [];
    for (const useName of nestedUseModules) {
      const useExt = await this.loadModule(useName, loading);
      useExtensions.push(useExt);
    }

    // 4b. Delegate parse + symbol resolution + precompile + effect / totality /
    //     proof checks + evaluation to evalSource. Strip the use-header so
    //     evalSource sees only the module body. evalSource picks up the
    //     `use`d modules' grammar fragments through the extensions list
    //     (collectFragments scans ext.bindings for Grammar values).
    //
    //     Using evalSource keeps lib loading and top-level file loading on
    //     the SAME pipeline: a buggy lib gets the same totality /
    //     proven-clause / effects-mismatch treatment user code does.
    //     Halt-on-error is preserved (softFail=false).
    //
    //     typed=true: libs are Allegro Standard. Untyped literals like
    //     `pi = 3` get wrapped as Int; primitives that lib code calls get
    //     UntypedFunction wrappers. Consumers (top-level files) see the
    //     wrapped values via the module type's __getMember.
    const cleanSource = source.slice(scan.headerEnd);
    const allExtensions = [...this.extensions, ...depExtensions, ...useExtensions];
    let evalCtx: StructureValue;
    try {
      const result = evalSource(
        cleanSource,
        /* base */ undefined,
        allExtensions,
        /* grammarExtension */ undefined,
        /* typed */ true,
        // B-028 F2 (CE-R6): modules evaluate with the session's manager —
        // async works inside modules; F1's mint-capture makes their
        // futures settle into THIS pass's registry even after the manager
        // is re-pointed at the main program's pass.
        this.futureManager,
        /* softFail */ undefined,
        /* C5.1: the module file path IS the defining-scope FQN (§5) */ resolvedPath,
      );
      evalCtx = result.evalCtx;
    } catch (e: any) {
      throw new Error(`Module '${id}': ${e.message}`);
    }

    // 5. Extract source-defined bindings as exports. We use the evalCtx's
    //    final bindings rather than fileCtx.bindingList because evalSource
    //    has already populated them with the evaluated values.
    //
    //    Source bindings are everything in evalCtx that didn't come from
    //    primitives, extensions, or the base context — i.e., names not
    //    present in any of those layers.
    const nonSourceNames = new Set<string>(Object.keys(primitives));
    for (const ext of allExtensions) {
      for (const name of Object.keys(ext.bindings)) nonSourceNames.add(name);
      if (ext.moduleObject) nonSourceNames.add(ext.name);
    }

    const allBindings: Record<string, Value> = {};
    const exportedBindings: Record<string, Value> = {};
    let hasExports = false;

    for (const [key, binding] of evalCtx.bindings) {
      if (nonSourceNames.has(key)) continue;
      if (isBareBindingName(key) || isFutureBindingName(key)) continue;
      if (binding.value === undefined) continue;
      const evaluated = binding.value;
      allBindings[key] = evaluated;
      // B-097 V1 (V-R4): export-ness is a property of the BINDING in the
      // module scope (Binding.visibility), never of the value — the old
      // value-plane marker (and its `y = x` aliasing wart) is retired.
      if (binding.visibility === "exported") {
        hasExports = true;
        exportedBindings[key] = evaluated;
      }
    }

    // Open-module policy (V-R4, explicit): a module that declares NO
    // exports is an OPEN module — every binding is public (the nine
    // no-export stdlib grammar/body-form libs rely on this). Declaring
    // any `export` closes the module to its export set.
    const exportNames = hasExports
      ? new Set(Object.keys(exportedBindings))
      : new Set(Object.keys(allBindings));
    const bindings = hasExports ? exportedBindings : allBindings;

    // C5.1 (D42): populate the EXPORT PARTITION — only these symbols are
    // reachable to foreign FQNs arriving over the wire (symbolFromWire).
    // Registration of ALL module bindings already happened inside
    // evalSource; exporting is the separate, narrower act.
    for (const name of exportNames) {
      markExported(resolvedPath, name);
    }

    // Build typed module object for use with `import name` + dot access
    const moduleObj = buildModuleObject(id, allBindings, exportNames);

    // Extract grammar fragment if module registered any parselets
    const grammarFragment = (evalCtx as any).grammarFragment;

    const ext: Extension = {
      name: id,
      bindings,
      moduleObject: moduleObj,
      grammarFragment,
    };
    this.cache.set(resolvedPath, ext);
    loading.delete(id);
    return ext;
  }
}
