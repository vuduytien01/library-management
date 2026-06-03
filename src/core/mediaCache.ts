import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

export type CachedMediaType = "BOOK_COVER" | "AUDIO";

export interface CachedMediaEntry {
  id: string;
  type: CachedMediaType;
  title: string;
  sourceUrl: string;
  uri: string;
  storage: "file" | "browser";
  cachedAt: string;
  lastAccessedAt?: string;
  size?: number;
}

const MEDIA_CACHE_KEY = "BIBLIO_MEDIA_CACHE";
const MEDIA_CACHE_DIR = "bibliotech-media-cache";

const canUseFileCache = () =>
  Platform.OS !== "web" && !!(FileSystem as any).documentDirectory;

const getCacheRoot = () =>
  `${(FileSystem as any).documentDirectory}${MEDIA_CACHE_DIR}/`;

const getCacheKey = (type: CachedMediaType, id: string) => `${type}:${id}`;
const inFlightWrites = new Map<string, Promise<CachedMediaEntry | null>>();

const sanitizeFilename = (value: string) =>
  value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);

const getExtension = (url: string, type: CachedMediaType) => {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const match = pathname.match(/\.([a-z0-9]+)$/);
    if (match?.[1]) return match[1];
  } catch {}

  return type === "AUDIO" ? "mp3" : "jpg";
};

const readState = async (): Promise<Record<string, CachedMediaEntry>> => {
  try {
    const raw = await AsyncStorage.getItem(MEDIA_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.warn("[mediaCache] Failed to read state:", error);
    return {};
  }
};

const writeState = async (state: Record<string, CachedMediaEntry>) => {
  await AsyncStorage.setItem(MEDIA_CACHE_KEY, JSON.stringify(state));
};

const ensureCacheDir = async () => {
  if (!canUseFileCache()) return null;

  const root = getCacheRoot();
  const info = await FileSystem.getInfoAsync(root);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(root, { intermediates: true });
  }
  return root;
};

export const mediaCache = {
  async getState(): Promise<CachedMediaEntry[]> {
    return Object.values(await readState());
  },

  async getCachedUri(
    id: string,
    type: CachedMediaType,
    sourceUrl?: string | null,
  ): Promise<string | null> {
    const state = await readState();
    const entry = state[getCacheKey(type, id)];

    if (!entry) return null;
    if (sourceUrl && entry.sourceUrl !== sourceUrl) return null;

    if (entry.storage === "file") {
      const info = await FileSystem.getInfoAsync(entry.uri);
      if (info.exists) {
        state[getCacheKey(type, id)] = {
          ...entry,
          lastAccessedAt: new Date().toISOString(),
        };
        await writeState(state);
        return entry.uri;
      }

      delete state[getCacheKey(type, id)];
      await writeState(state);
      return null;
    }

    state[getCacheKey(type, id)] = {
      ...entry,
      lastAccessedAt: new Date().toISOString(),
    };
    await writeState(state);
    return entry.uri;
  },

  async cacheRemoteAsset({
    id,
    type,
    title,
    url,
  }: {
    id: string;
    type: CachedMediaType;
    title: string;
    url?: string | null;
  }): Promise<CachedMediaEntry | null> {
    if (!url || url.startsWith("file:") || url.startsWith("data:")) {
      return null;
    }

    const key = getCacheKey(type, id);
    const taskKey = `${key}:${url}`;
    const pending = inFlightWrites.get(taskKey);
    if (pending) return pending;

    const task = this.writeRemoteAsset({ id, type, title, url }).finally(() => {
      inFlightWrites.delete(taskKey);
    });
    inFlightWrites.set(taskKey, task);
    return task;
  },

  async writeRemoteAsset({
    id,
    type,
    title,
    url,
  }: {
    id: string;
    type: CachedMediaType;
    title: string;
    url: string;
  }): Promise<CachedMediaEntry | null> {
    const key = getCacheKey(type, id);
    const state = await readState();
    const existingUri = await this.getCachedUri(id, type, url);
    if (existingUri && state[key]) return state[key];

    if (!canUseFileCache()) {
      try {
        await fetch(url, { cache: "force-cache" });
      } catch (error) {
        console.warn("[mediaCache] Browser cache warm failed:", error);
      }

      const entry: CachedMediaEntry = {
        id,
        type,
        title,
        sourceUrl: url,
        uri: url,
        storage: "browser",
        cachedAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
      };
      await writeState({ ...state, [key]: entry });
      return entry;
    }

    const root = await ensureCacheDir();
    if (!root) return null;

    const extension = getExtension(url, type);
    const localUri = `${root}${sanitizeFilename(key)}.${extension}`;
    const result = await FileSystem.downloadAsync(url, localUri);
    const info = await FileSystem.getInfoAsync(result.uri);

    const entry: CachedMediaEntry = {
      id,
      type,
      title,
      sourceUrl: url,
      uri: result.uri,
      storage: "file",
      cachedAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString(),
      size: info.exists && "size" in info ? info.size : undefined,
    };

    await writeState({ ...state, [key]: entry });
    return entry;
  },

  async prefetchRemoteAssets(
    assets: Array<{
      id: string;
      type: CachedMediaType;
      title: string;
      url?: string | null;
    }>,
    concurrency = 4,
  ): Promise<CachedMediaEntry[]> {
    const uniqueAssets = assets.filter(
      (asset, index, list) =>
        !!asset.url &&
        list.findIndex(
          (item) => item.id === asset.id && item.type === asset.type,
        ) === index,
    );
    const results: CachedMediaEntry[] = [];
    let cursor = 0;

    const worker = async () => {
      while (cursor < uniqueAssets.length) {
        const asset = uniqueAssets[cursor++];
        const entry = await this.cacheRemoteAsset(asset).catch((error) => {
          console.warn("[mediaCache] Prefetch failed:", error);
          return null;
        });
        if (entry) results.push(entry);
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(concurrency, uniqueAssets.length) }, () =>
        worker(),
      ),
    );

    return results;
  },

  async deleteCachedAsset(id: string, type: CachedMediaType) {
    const state = await readState();
    const key = getCacheKey(type, id);
    const entry = state[key];

    if (entry?.storage === "file") {
      try {
        await FileSystem.deleteAsync(entry.uri, { idempotent: true });
      } catch (error) {
        console.warn("[mediaCache] Failed to delete file:", error);
      }
    }

    delete state[key];
    await writeState(state);
  },

  async clearAll() {
    const state = await readState();

    await Promise.all(
      Object.values(state)
        .filter((entry) => entry.storage === "file")
        .map((entry) =>
          FileSystem.deleteAsync(entry.uri, { idempotent: true }).catch(
            (error) =>
              console.warn("[mediaCache] Failed to delete cached file:", error),
          ),
        ),
    );

    await writeState({});
  },
};
