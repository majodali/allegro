// =============================================================================
// Allegro Base Language - Module Loader
// Loads .alg files as anonymous extensions.
// =============================================================================

import { parse } from "./parser.js";
import { buildEvalCtx, resolvePrimitives, Extension } from "./runtime.js";
import { evaluate } from "./evaluator.js";
import { Value, ValueKind } from "./types.js";

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
}

// --- Module Loader ---

export class ModuleLoader {
  private cache = new Map<string, Extension>();
  private configs: Map<string, ModuleConfig>;
  private resolve: ModuleResolver;
  private readFile: FileReader;

  constructor(options: ModuleLoaderOptions) {
    this.configs = new Map(options.modules.map(m => [m.id, m]));
    this.resolve = options.resolve;
    this.readFile = options.readFile;
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
    const parseResult = parse(normalized);

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

    // 5. Build evaluation context with dependency extensions
    const evalCtx = buildEvalCtx(fileCtx, undefined, depExtensions);

    // 6. Evaluate bare expressions (side effects)
    for (const b of fileCtx.bindingList) {
      if (b.key === null && b.value !== undefined) {
        const resolved = resolvePrimitives(b.value);
        evaluate(resolved, evalCtx);
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

    const bindings = hasExports ? exportedBindings : allBindings;

    const ext: Extension = { name: id, bindings };
    this.cache.set(resolvedPath, ext);
    loading.delete(id);
    return ext;
  }
}
