import { useEffect } from "react";
import { Alert } from "react-native";
import { useRouter, useSegments } from "expo-router";
import { supabase } from "../api/supabase";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../store/useAuthStore";

/**
 * Hook to monitor user account status (locked/active).
 *
 * @param monitor If true, sets up a real-time listener to force logout if locked.
 *                Should only be enabled once in the root layout.
 */
export function useAccountStatus(monitor = false) {
  const userId = useAuthStore((state) => state.session?.user?.id);
  const profileId = useAuthStore((state) => state.profile?.id);
  const logout = useAuthStore((state) => state.logout);
  const updateAccountLockStatus = useAuthStore(
    (state) => state.updateAccountLockStatus,
  );

  const segments = useSegments();
  const rootSegment = segments[0];
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    let isMounted = true;
    if (!monitor || !userId || !profileId || rootSegment === "(auth)") return;

    const checkLockStatus = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("is_locked, lock_reason")
          .eq("id", userId)
          .single();

        if (error) throw error;

        updateAccountLockStatus(data?.is_locked === true, data?.lock_reason);

        if (data?.is_locked && isMounted) {
          Alert.alert(
            t("common.account_locked_title") || "Tài khoản bị khóa",
            data.lock_reason ||
              t("common.account_locked_msg") ||
              "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.",
            [
              {
                text: t("common.logout") || "Đăng xuất",
                onPress: async () => {
                  await logout();
                  router.replace("/(auth)/login");
                },
              },
            ],
            { cancelable: false },
          );
        }
      } catch (err) {
        console.error("[useAccountStatus] Error:", err);
      }
    };

    checkLockStatus();

    // Listen for real-time changes using a stable channel ID
    const channelId = `account_status_${userId}`;
    const channel = supabase.channel(channelId);

    channel
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const isLocked = payload.new.is_locked === true;
          updateAccountLockStatus(isLocked, payload.new.lock_reason);

          if (isLocked && isMounted) {
            Alert.alert(
              t("common.account_locked_title") || "Tài khoản bị khóa",
              payload.new.lock_reason ||
                t("common.account_locked_msg") ||
                "Tài khoản của bạn vừa bị khóa.",
              [
                {
                  text: t("common.logout") || "Đăng xuất",
                  onPress: async () => {
                    await logout();
                    router.replace("/(auth)/login");
                  },
                },
              ],
              { cancelable: false },
            );
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log(`[useAccountStatus] Subscribed to ${channelId}`);
        }
      });

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [userId, profileId, monitor, rootSegment, updateAccountLockStatus]);

  const profile = useAuthStore((state) => state.profile);

  return {
    isLocked: profile?.is_locked === true,
    lockReason: profile?.lock_reason || null,
  };
}
