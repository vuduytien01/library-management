import { useState, useEffect } from "react";
import NetInfo from "@react-native-community/netinfo";
import { membersService } from "../features/members/member-service";

export function useConnectivity() {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(!!state.isConnected && !!state.isInternetReachable);
    });

    return () => unsubscribe();
  }, []);

  const triggerSync = async () => {
    if (!isOnline) return;

    setIsSyncing(true);
    try {
      await membersService.processQueue();
    } catch (error) {
      console.error("[Sync] Sync failed:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  return { isOnline, isSyncing, triggerSync };
}
