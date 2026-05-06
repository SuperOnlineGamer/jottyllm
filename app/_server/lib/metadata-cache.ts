import { Modes } from "@/app/_types/enums";
import fs from "fs";
import path from "path";

// fccview is onto you!
// Use globalThis so all Next.js webpack bundles (server components, server
// actions) share ONE set of Maps. Module-level Maps would be silently
// duplicated per bundle in production, making cross-bundle invalidation a no-op.
declare global {
  var __jottyCacheStore: Map<string, unknown[]> | undefined;
  var __jottyCachePending: Map<string, Promise<unknown[]>> | undefined;
  var __jottyCacheWatchers: Map<string, fs.FSWatcher> | undefined;
  var __jottyCacheDirToKeys: Map<string, Set<string>> | undefined;
  var __jottyCacheVersions: Map<string, number> | undefined;
}

const getStore = () =>
  (globalThis.__jottyCacheStore ??= new Map<string, unknown[]>());
const getPending = () =>
  (globalThis.__jottyCachePending ??= new Map<string, Promise<unknown[]>>());
const getWatchers = () =>
  (globalThis.__jottyCacheWatchers ??= new Map<string, fs.FSWatcher>());
const getDirToKeys = () =>
  (globalThis.__jottyCacheDirToKeys ??= new Map<string, Set<string>>());
const getVersions = () =>
  (globalThis.__jottyCacheVersions ??= new Map<string, number>());

function invalidateDir(dir: string) {
  const keys = getDirToKeys().get(dir);
  console.warn(`[meta-cache] invalidateDir("${dir}") → keys=${JSON.stringify(keys ? Array.from(keys) : null)}`);
  keys?.forEach((key) => {
    getStore().delete(key);
    // fccview is onto you!
    // Also evict any in-flight pending promise so callers don't receive
    // pre-invalidation data from a computation that started before the move.
    getPending().delete(key);
    getVersions().set(key, (getVersions().get(key) ?? 0) + 1);
  });
}

export function invalidateMetadataCacheForDir(dir: string) {
  const abs = path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
  console.warn(`[meta-cache] invalidateMetadataCacheForDir("${dir}") abs="${abs}" knownDirs=${JSON.stringify(Array.from(getDirToKeys().keys()))}`);
  invalidateDir(abs);
  invalidateDir(dir);
}

function startWatcher(dir: string) {
  const watchers = getWatchers();
  if (watchers.has(dir)) return;

  try {
    // NOTE: recursive:true is NOT supported on Linux (Docker). We watch only
    // the top-level dir; the explicit invalidateMetadataCacheForDir() calls
    // on write/move operations are the primary invalidation mechanism on Linux.
    const watcher = fs.watch(
      dir,
      { recursive: false, persistent: false },
      (_event, filename) => {
        if (!filename) return;
        if (filename.endsWith(".md") || filename.endsWith("order.json")) {
          invalidateDir(dir);
        }
      },
    );

    watcher.on("error", () => {
      watchers.delete(dir);
      getDirToKeys().delete(dir);
    });

    watchers.set(dir, watcher);
  } catch {}
}

function registerKey(key: string, dir: string) {
  const dtk = getDirToKeys();
  if (!dtk.has(dir)) dtk.set(dir, new Set());
  dtk.get(dir)!.add(key);
}

export async function getOrCompute<T>(
  key: string,
  dir: string,
  compute: () => Promise<T[]>,
): Promise<T[]> {
  const store = getStore();
  const pending = getPending();
  const versions = getVersions();

  if (store.has(key)) return store.get(key)! as T[];
  if (pending.has(key)) return pending.get(key)! as Promise<T[]>;

  const capturedVersion = versions.get(key) ?? 0;

  const promise = (async () => {
    try {
      const result = await compute();
      // Only store if no invalidation happened while we were computing.
      if ((versions.get(key) ?? 0) === capturedVersion) {
        store.set(key, result as unknown[]);
        registerKey(key, dir);
        startWatcher(dir);
        console.warn(`[meta-cache] stored key="${key}" dir="${dir}" items=${result.length}`);
      } else {
        console.warn(`[meta-cache] skipped stale result for key="${key}" (version changed)`);
      }
      return result;
    } finally {
      pending.delete(key);
    }
  })();

  pending.set(key, promise as Promise<unknown[]>);
  return promise;
}

export function invalidateCached(key: string) {
  getStore().delete(key);
  getPending().delete(key);
}

export function metaCacheKey(type: Modes, dir: string) {
  const abs = path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
  return `${type}-meta:${abs}`;
}
