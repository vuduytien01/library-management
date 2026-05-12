import AsyncStorage from "@react-native-async-storage/async-storage";

export const persistence = {
  async saveItem(key: string, data: any) {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn(`[Persistence] Save failed for ${key}:`, e);
    }
  },

  async getItem(key: string) {
    try {
      const d = await AsyncStorage.getItem(key);
      return d ? JSON.parse(d) : null;
    } catch (e) {
      console.warn(`[Persistence] Get failed for ${key}:`, e);
      return null;
    }
  },

  async removeItem(key: string) {
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.warn(`[Persistence] Remove failed for ${key}:`, e);
    }
  },

  async multiRemove(keys: string[]) {
    try {
      await AsyncStorage.multiRemove(keys);
    } catch (e) {
      console.warn(`[Persistence] Multi-remove failed:`, e);
    }
  },

  // Specific helpers
  async saveProfile(profile: any) {
    await this.saveItem("BIBLIO_OFFLINE_PROFILE", profile);
  },

  async getProfile() {
    return await this.getItem("BIBLIO_OFFLINE_PROFILE");
  },

  async clearAllAuth() {
    await this.multiRemove([
      "BIBLIO_OFFLINE_PROFILE",
      "BIBLIO_OFFLINE_BORROWS",
      "BIBLIO_OFFLINE_BOOKS",
      "BIBLIO_OFFLINE_DOWNLOADS",
      "BIBLIO_OFFLINE_ACTION_QUEUE",
    ]);
  },
};
