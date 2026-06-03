import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';

const CACHE_PREFIX = 'biblio_cache_';

export function useOfflineCache<T>(key: string, freshData?: T) {
  const [cachedData, setCachedData] = useState<T | null>(null);
  const fullKey = CACHE_PREFIX + key;

  // Load cache on mount
  useEffect(() => {
    loadCache();
  }, []);

  // Update cache when fresh data arrives
  useEffect(() => {
    if (freshData) {
      saveCache(freshData);
    }
  }, [freshData]);

  const loadCache = async () => {
    try {
      const stored = await AsyncStorage.getItem(fullKey);
      if (stored) {
        setCachedData(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Error loading cache:', e);
    }
  };

  const saveCache = async (data: T) => {
    try {
      await AsyncStorage.setItem(fullKey, JSON.stringify(data));
      setCachedData(data);
    } catch (e) {
      console.error('Error saving cache:', e);
    }
  };

  return cachedData;
}
