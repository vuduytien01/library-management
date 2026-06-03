import { supabase } from "@/src/api/supabase";
import { LanguageMenuToggle } from "@/src/components/LanguageSwitcher";
import { AdminUser, UserRole } from "@/src/features/admin/admin.types";
import { adminService } from "@/src/features/admin/admin.service";
import { booksService } from "@/src/features/books/books.service";
import { useAuthStore } from "@/src/store/useAuthStore";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { decode } from "base64-arraybuffer";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useUndoStore } from "@/src/store/useUndoStore";

// Removed unused width constant

export default function AdminDashboard() {
  const { width } = useWindowDimensions();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { scroll } = useLocalSearchParams<{ scroll?: string }>();
  const scrollViewRef = React.useRef<ScrollView>(null);
  const [usersLayoutY, setUsersLayoutY] = React.useState(0);
  const [isProfileMenuVisible, setIsProfileMenuVisible] = React.useState(false);
  const { profile, logout, session, updateAvatar } = useAuthStore();
  const { t } = useTranslation();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [isBulkEnriching, setIsBulkEnriching] = useState(false);
  const [showEnrichModal, setShowEnrichModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isRoleModalVisible, setIsRoleModalVisible] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const isNarrow = width < 520;
  const statCardWidth = isNarrow ? "48%" : "23.8%";
  const toolTileWidth = width < 420 ? "48%" : width < 760 ? "31.8%" : "23.8%";

  const pickAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setUploadingAvatar(true);

        const fileName = `${profile?.id || "user"}_${Date.now()}.jpg`;
        const filePath = `avatars/${fileName}`;

        let body: any;
        if (asset.base64) {
          body = decode(asset.base64);
        } else {
          const response = await fetch(asset.uri);
          body = await response.blob();
        }

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, body, {
            contentType: "image/jpeg",
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("avatars").getPublicUrl(filePath);

        const { error: updateError } = await supabase
          .from("profiles")
          .update({ avatar_url: publicUrl })
          .eq("id", profile?.id);

        if (updateError) throw updateError;

        updateAvatar(publicUrl);
        Alert.alert(t("common.success"), t("messages.avatar_updated"));
      }
    } catch (error: any) {
      Alert.alert(
        t("common.error"),
        error.message || t("messages.upload_failed"),
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const { data: users, isLoading } = useQuery<AdminUser[]>({
    queryKey: ["admin_users"],
    queryFn: () => adminService.listUsers(),
  });

  const { data: totalUsersCount } = useQuery({
    queryKey: ["admin_users_count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  useEffect(() => {
    if (scroll === "users") {
      const timer = setTimeout(() => {
        const yCoord = usersLayoutY > 0 ? usersLayoutY : 480;
        scrollViewRef.current?.scrollTo({ y: yCoord, animated: true });
        if (Platform.OS === "web") {
          const el = document.getElementById("users-section");
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [scroll, usersLayoutY]);

  const { data: allBooks } = useQuery({
    queryKey: ["admin_books_count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("books")
        .select("total_copies");
      if (error) throw error;
      return data || [];
    },
  });

  const totalCopies =
    allBooks?.reduce((sum, b) => sum + (b.total_copies || 0), 0) || 0;

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === "web") {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const updateRole = useMutation({
    mutationFn: ({
      userId,
      newRole,
      actorId,
    }: {
      userId: string;
      newRole: string;
      actorId?: string;
    }) => adminService.updateUser(userId, { role: newRole, actorId }),
    onSuccess: (data: any) => {
      showAlert(t("common.success"), t("librarian.user_updated"));
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
      setIsRoleModalVisible(false);
    },
    onError: (error: any) => {
      showAlert(
        t("common.error"),
        error.message || t("messages.update_failed", "Failed to update role"),
      );
    },
  });

  const { queueAction } = useUndoStore();

  const deleteUser = useMutation({
    mutationFn: (userId: string) => adminService.deleteUser(userId),
    onMutate: async (userId) => {
      // Optimistically hide the user
      await queryClient.cancelQueries({ queryKey: ["admin_users"] });
      const previousUsers = queryClient.getQueryData<AdminUser[]>([
        "admin_users",
      ]);
      queryClient.setQueryData<AdminUser[]>(
        ["admin_users"],
        (old) => old?.filter((u) => u.id !== userId) || [],
      );
      return { previousUsers };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_users_count"] });
    },
    onError: (error: any, _userId, context: any) => {
      if (context?.previousUsers) {
        queryClient.setQueryData(["admin_users"], context.previousUsers);
      }
      showAlert(
        t("common.error"),
        error.message || t("messages.delete_failed", "Failed to delete user"),
      );
    },
  });

  const confirmDeleteUser = (user: any) => {
    setIsDeleteModalVisible(false);

    // 1. Store previous state for possible undo
    const previousUsers = queryClient.getQueryData(["admin_users"]);

    // 2. Optimistically hide immediately when queued
    queryClient.setQueryData(["admin_users"], (old: any) =>
      old?.filter((u: any) => u.id !== user.id),
    );

    queueAction({
      message: t("admin.user_deletion_pending", {
        name: user.fullName || user.email,
      }),
      onCommit: async () => {
        deleteUser.mutate(user.id, profile?.id as any);
      },
      onUndo: () => {
        // 3. Restore from previous state if undo is clicked
        if (previousUsers) {
          queryClient.setQueryData(["admin_users"], previousUsers);
        } else {
          queryClient.invalidateQueries({ queryKey: ["admin_users"] });
        }
      },
    });
  };

  const confirmUpdateRole = (user: any, newRole: string) => {
    setIsRoleModalVisible(false);
    const previousUsers = queryClient.getQueryData(["admin_users"]);

    // Optimistically update
    queryClient.setQueryData(["admin_users"], (old: any) =>
      old?.map((u: any) => (u.id === user.id ? { ...u, role: newRole } : u)),
    );

    queueAction({
      message: t("admin.role_update_pending", {
        name: user.fullName || user.email,
        role: t(`roles.${newRole.toLowerCase()}`),
      }),
      onCommit: async () => {
        updateRole.mutate({
          userId: user.id,
          newRole,
          actorId: profile?.id,
        } as any);
      },
      onUndo: () => {
        if (previousUsers) {
          queryClient.setQueryData(["admin_users"], previousUsers);
        } else {
          queryClient.invalidateQueries({ queryKey: ["admin_users"] });
        }
      },
    });
  };

  const confirmToggleLock = (user: any) => {
    const isLocked = !user.isLocked;
    const previousUsers = queryClient.getQueryData(["admin_users"]);

    // Optimistically update
    queryClient.setQueryData(["admin_users"], (old: any) =>
      old?.map((u: any) => (u.id === user.id ? { ...u, isLocked } : u)),
    );

    queueAction({
      message: isLocked
        ? t("admin.lock_pending", { name: user.fullName || user.email })
        : t("admin.unlock_pending", { name: user.fullName || user.email }),
      onCommit: async () => {
        toggleLock.mutate({
          userId: user.id,
          isLocked,
          actorId: profile?.id,
        } as any);
      },
      onUndo: () => {
        if (previousUsers) {
          queryClient.setQueryData(["admin_users"], previousUsers);
        } else {
          queryClient.invalidateQueries({ queryKey: ["admin_users"] });
        }
      },
    });
  };

  const toggleLock = useMutation({
    mutationFn: ({
      userId,
      isLocked,
      actorId,
    }: {
      userId: string;
      isLocked: boolean;
      actorId?: string;
    }) => adminService.updateUser(userId, { isLocked, actorId }),
    onMutate: async ({ userId, isLocked }) => {
      // Optimistically update the UI
      await queryClient.cancelQueries({ queryKey: ["admin_users"] });
      const previousUsers = queryClient.getQueryData(["admin_users"]);

      queryClient.setQueryData(["admin_users"], (old: any) =>
        old?.map((u: any) => (u.id === userId ? { ...u, isLocked } : u)),
      );

      return { previousUsers };
    },
    onSuccess: (data: any) => {
      const msg = data.isLocked
        ? t("admin.user_locked", "Đã khóa tài khoản")
        : t("admin.user_unlocked", "Đã mở khóa tài khoản");
      // Use a less intrusive toast if possible, but showAlert is fine for now
      // showAlert(t("common.success"), msg);
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
    },
    onError: (error: any, _vars, context: any) => {
      if (context?.previousUsers) {
        queryClient.setQueryData(["admin_users"], context.previousUsers);
      }
      showAlert(
        t("common.error"),
        error.message || t("messages.update_failed", "Failed to update user"),
      );
    },
  });

  const handleDeleteUser = (user: any) => {
    setUserToDelete(user);
    setIsDeleteModalVisible(true);
  };

  const handleRoleChange = (user: any) => {
    setSelectedUser(user);
    setIsRoleModalVisible(true);
  };

  const stats = [
    {
      label: t("analytics.kpi_members"),
      value: totalUsersCount ?? (users?.length || 0),
      icon: "people",
      bgColor: "#3A75F2",
      flex: 1,
      onPress: () => {
        const yCoord = usersLayoutY > 0 ? usersLayoutY : 480;
        scrollViewRef.current?.scrollTo({ y: yCoord, animated: true });
        if (Platform.OS === "web") {
          const el = document.getElementById("users-section");
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }
      },
    },
    {
      label: t("admin.total_copies", "Total Copies"),
      value: totalCopies,
      icon: "library",
      bgColor: "#10B981",
    },
    {
      label: t("admin.ai_assistant_short", "AI Assistant"),
      value: "AUTO",
      icon: "sparkles",
      bgColor: "#8B5CF6",
      flex: 1,
      onPress: () => setShowEnrichModal(true),
    },
    {
      label: t("audiobook.title", "Audiobooks"),
      value: "PLAY",
      icon: "headset",
      bgColor: "#EC4899",
      flex: 1,
      onPress: () => router.push("/(member)/audiobooks"),
    },
  ];

  const adminTools = [
    {
      label: t("tabs.logistics"),
      icon: "cube",
      color: "#38BDF8",
      onPress: () => router.push("/(admin)/logistics"),
    },
    {
      label: t("tabs.inventory"),
      icon: "library",
      color: "#10B981",
      onPress: () => router.push("/(admin)/inventory"),
    },
    {
      label: t("tabs.reports"),
      icon: "bar-chart",
      color: "#3A75F2",
      onPress: () => router.push("/(admin)/reports"),
    },
    {
      label: t("tabs.audit"),
      icon: "list",
      color: "#F59E0B",
      onPress: () => router.push("/(admin)/audit"),
    },
    {
      label: t("tabs.config"),
      icon: "settings",
      color: "#8B5CF6",
      onPress: () => router.push("/(admin)/config"),
    },
    {
      label: t("tabs.security_logs"),
      icon: "shield-checkmark",
      color: "#EF4444",
      onPress: () => router.push("/(admin)/security-logs"),
    },
    ...(profile?.is_super_admin
      ? [
          {
            label: "R2 Import",
            icon: "cloud-upload",
            color: "#FF9F43",
            onPress: () => router.push("/(admin)/audiobooks"),
          },
        ]
      : []),
  ];

  const handleConfirmBulkEnrich = async () => {
    setIsBulkEnriching(true);
    try {
      const result = await booksService.bulkEnrichAudiobooks();
      const successMsg = t("admin.ai_enrich_success", {
        updated: result.updated,
        total: result.total,
      });
      setShowEnrichModal(false);
      showAlert(t("common.success"), successMsg);
      queryClient.invalidateQueries({ queryKey: ["audiobooks"] });
    } catch (e: any) {
      setShowEnrichModal(false);
      showAlert(t("common.error"), e.message);
    } finally {
      setIsBulkEnriching(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F121D" />
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Header Section with Profile Dropdown */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{t("tabs.dashboard")}</Text>
            <Text style={styles.subtitle}>{profile?.fullName || "Admin"}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => router.navigate("/notifications" as any)}
              style={styles.notifBtn}
            >
              <Ionicons
                name="notifications-outline"
                size={20}
                color="#3A75F2"
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setIsProfileMenuVisible(true)}
              style={[styles.avatarBtn, { marginLeft: 12 }]}
            >
              {profile?.avatarUrl ? (
                <Image
                  source={{ uri: profile.avatarUrl }}
                  style={styles.avatarImg}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>
                    {profile?.fullName?.charAt(0) || "A"}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Dropdown Menu */}
        <Modal
          visible={isProfileMenuVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsProfileMenuVisible(false)}
        >
          <TouchableOpacity
            style={styles.menuOverlay}
            activeOpacity={1}
            onPress={() => setIsProfileMenuVisible(false)}
          >
            <Animated.View
              entering={FadeInUp.duration(300)}
              style={styles.menuContent}
            >
              <View style={styles.menuHeader}>
                <Text style={styles.menuUserTitle}>
                  {profile?.fullName || t("roles.admin")}
                </Text>
                <Text style={styles.menuUserSub}>
                  {session?.user?.email || "admin@bibliotech.ai"}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsProfileMenuVisible(false);
                  router.push("/profile" as any);
                }}
              >
                <Ionicons name="person-outline" size={18} color="#8A8F9E" />
                <Text style={styles.menuItemText}>{t("common.profile")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsProfileMenuVisible(false);
                  router.push("/settings" as any);
                }}
              >
                <Ionicons name="settings-outline" size={18} color="#8A8F9E" />
                <Text style={styles.menuItemText}>{t("common.settings")}</Text>
              </TouchableOpacity>

              <LanguageMenuToggle />

              <View style={styles.menuDivider} />

              <TouchableOpacity
                style={[styles.menuItem, styles.signOutItem]}
                onPress={() => {
                  setIsProfileMenuVisible(false);
                  logout();
                }}
              >
                <Ionicons name="log-out-outline" size={18} color="#FF6B6B" />
                <Text style={[styles.menuItemText, { color: "#FF6B6B" }]}>
                  {t("common.logout")}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableOpacity>
        </Modal>

        {/* Sync Stats Cards - Matching Librarian Classic Layout */}
        <View style={styles.statsRow}>
          {stats.map((stat: any, index) => (
            <TouchableOpacity
              key={index}
              onPress={stat.onPress}
              disabled={!stat.onPress}
              style={[
                styles.statCard,
                { backgroundColor: stat.bgColor, width: statCardWidth },
              ]}
            >
              <View style={styles.statTop}>
                <Ionicons
                  name={stat.icon as any}
                  size={18}
                  color="rgba(255,255,255,0.9)"
                />
                <Text style={styles.statValue}>{stat.value}</Text>
              </View>
              <Text style={styles.statLabel} numberOfLines={1}>
                {stat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.toolsGrid}>
          {adminTools.map((tool, index) => {
            return (
              <TouchableOpacity
                key={tool.label}
                style={[styles.toolTile, { width: toolTileWidth }]}
                onPress={tool.onPress}
              >
                <View
                  style={[
                    styles.toolIcon,
                    { backgroundColor: `${tool.color}22` },
                  ]}
                >
                  <Ionicons
                    name={tool.icon as any}
                    size={18}
                    color={tool.color}
                  />
                </View>
                <Text style={styles.toolLabel} numberOfLines={1}>
                  {tool.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* User Management Section */}
        <View
          id="users-section"
          nativeID="users-section"
          style={styles.sectionHeader}
          onLayout={(event) => setUsersLayoutY(event.nativeEvent.layout.y)}
        >
          <Text style={styles.sectionTitle}>{t("tabs.users")}</Text>
          <TouchableOpacity
            onPress={() =>
              queryClient.invalidateQueries({ queryKey: ["admin_users"] })
            }
          >
            <Ionicons name="refresh" size={18} color="#3A75F2" />
          </TouchableOpacity>
        </View>

        <View style={styles.userList}>
          {isLoading ? (
            <Text style={styles.loadingText}>{t("messages.loading")}</Text>
          ) : Array.isArray(users) && users.length > 0 ? (
            users.map((item: any) => (
              <UserCard
                key={item.id}
                item={item}
                onEdit={() => handleRoleChange(item)}
                onDelete={() => handleDeleteUser(item)}
                onToggleLock={() => confirmToggleLock(item)}
                isLocking={
                  toggleLock.isPending &&
                  toggleLock.variables?.userId === item.id
                }
                currentUserId={profile?.id}
                profile={profile}
              />
            ))
          ) : (
            <Text style={styles.loadingText}>{t("messages.no_results")}</Text>
          )}
        </View>

        <View style={styles.spacer40} />
      </ScrollView>

      {/* AI Enrich Custom Modal */}
      <Modal visible={showEnrichModal} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.85)",
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: "#171B2B",
              borderRadius: 24,
              padding: 24,
              borderWidth: 1,
              borderColor: "#22293F",
              width: "100%",
              maxWidth: 380,
              alignItems: "center",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.3,
              shadowRadius: 20,
              elevation: 12,
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: "rgba(139, 92, 246, 0.12)",
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <Ionicons name="sparkles" size={28} color="#8B5CF6" />
            </View>

            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 18,
                fontWeight: "700",
                marginBottom: 8,
                textAlign: "center",
              }}
            >
              {t("admin.ai_enrich_title")}
            </Text>

            <Text
              style={{
                color: "#8B8FA3",
                fontSize: 13,
                lineHeight: 20,
                marginBottom: 24,
                textAlign: "center",
              }}
            >
              {t("admin.ai_enrich_msg")}
            </Text>

            <View style={{ width: "100%" }}>
              <TouchableOpacity
                onPress={handleConfirmBulkEnrich}
                disabled={isBulkEnriching}
                style={{
                  backgroundColor: "#8B5CF6",
                  paddingVertical: 12,
                  borderRadius: 14,
                  alignItems: "center",
                  marginBottom: 10,
                  flexDirection: "row",
                  justifyContent: "center",
                  shadowColor: "#8B5CF6",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.25,
                  shadowRadius: 8,
                }}
              >
                {isBulkEnriching ? (
                  <ActivityIndicator
                    color="#FFFFFF"
                    style={{ marginRight: 8 }}
                  />
                ) : (
                  <Ionicons
                    name="sparkles"
                    size={16}
                    color="#FFFFFF"
                    style={{ marginRight: 8 }}
                  />
                )}
                <Text
                  style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "600" }}
                >
                  {t("admin.ai_enrich_start")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowEnrichModal(false)}
                disabled={isBulkEnriching}
                style={{
                  backgroundColor: "transparent",
                  paddingVertical: 12,
                  borderRadius: 14,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: "#22293F",
                }}
              >
                <Text
                  style={{ color: "#5A5F7A", fontSize: 14, fontWeight: "500" }}
                >
                  {t("common.cancel")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Role Management Modal */}
      <Modal visible={isRoleModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.roleModalContent}>
            <View style={styles.roleModalHeader}>
              <Text style={styles.roleModalTitle}>
                {t("librarian.manage_admins")}
              </Text>
              <Text style={styles.roleModalUser}>{selectedUser?.fullName}</Text>
            </View>

            <View style={styles.roleOptions}>
              {[
                {
                  role: "MEMBER" as UserRole,
                  label: t("roles.member"),
                  icon: "person-outline",
                },
                {
                  role: "LIBRARIAN" as UserRole,
                  label: t("roles.librarian"),
                  icon: "library-outline",
                },
                {
                  role: "ADMIN" as UserRole,
                  label: t("roles.admin"),
                  icon: "shield-checkmark-outline",
                },
              ]
                .filter((r) => profile?.is_super_admin || r.role === "MEMBER")
                .map((r) => (
                  <TouchableOpacity
                    key={r.role}
                    style={[
                      styles.roleOption,
                      selectedUser?.role === r.role &&
                        styles.roleOptionSelected,
                    ]}
                    onPress={() => {
                      if (updateRole.isPending) return;
                      confirmUpdateRole(selectedUser, r.role);
                    }}
                    disabled={updateRole.isPending}
                  >
                    <View
                      style={[
                        styles.roleIconBox,
                        selectedUser?.role === r.role &&
                          styles.roleIconBoxSelected,
                      ]}
                    >
                      {updateRole.isPending && selectedUser?.role !== r.role ? (
                        <ActivityIndicator size="small" color="#3A75F2" />
                      ) : (
                        <Ionicons
                          name={r.icon as any}
                          size={20}
                          color={
                            selectedUser?.role === r.role
                              ? "#FFFFFF"
                              : "#8A8F9E"
                          }
                        />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.roleOptionText,
                        selectedUser?.role === r.role &&
                          styles.roleOptionTextSelected,
                      ]}
                    >
                      {r.label}
                    </Text>
                    {selectedUser?.role === r.role && !updateRole.isPending && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color="#3A75F2"
                      />
                    )}
                    {updateRole.isPending && selectedUser?.role === r.role && (
                      <ActivityIndicator size="small" color="#3A75F2" />
                    )}
                  </TouchableOpacity>
                ))}
            </View>

            <TouchableOpacity
              onPress={() => setIsRoleModalVisible(false)}
              style={styles.roleCancelBtn}
            >
              <Text style={styles.roleCancelText}>{t("common.cancel")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal - Premium Look */}
      <Modal visible={isDeleteModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.roleModalContent,
              { borderTopWidth: 4, borderTopColor: "#FF4757" },
            ]}
          >
            <View style={styles.roleModalHeader}>
              <View
                style={[
                  styles.roleIconBox,
                  {
                    backgroundColor: "rgba(255, 71, 87, 0.12)",
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    marginBottom: 20,
                  },
                ]}
              >
                <Ionicons name="trash" size={32} color="#FF4757" />
              </View>
              <Text style={styles.roleModalTitle}>{t("common.confirm")}</Text>
              <Text
                style={[
                  styles.roleModalUser,
                  {
                    color: "#8A8F9E",
                    textAlign: "center",
                    paddingHorizontal: 20,
                    lineHeight: 22,
                  },
                ]}
              >
                {t(
                  "admin.delete_confirm_with_undo",
                  "Người dùng sẽ bị xóa. Bạn có 5 giây để hoàn tác sau khi xác nhận.",
                )}
              </Text>
              <View
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  padding: 16,
                  borderRadius: 12,
                  marginTop: 20,
                  width: "100%",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ color: "#FFFFFF", fontWeight: "bold", fontSize: 16 }}
                >
                  {userToDelete?.fullName}
                </Text>
                <Text style={{ color: "#5A5F7A", fontSize: 12, marginTop: 4 }}>
                  {userToDelete?.email}
                </Text>
              </View>
            </View>

            <View style={{ gap: 12, marginTop: 8 }}>
              <TouchableOpacity
                onPress={() => confirmDeleteUser(userToDelete)}
                disabled={deleteUser.isPending}
                style={[
                  styles.roleOption,
                  { backgroundColor: "#FF4757", justifyContent: "center" },
                ]}
              >
                <Text
                  style={[
                    styles.roleOptionText,
                    { color: "#FFFFFF", flex: 0, fontWeight: "700" },
                  ]}
                >
                  {t("common.delete")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setIsDeleteModalVisible(false)}
                disabled={deleteUser.isPending}
                style={styles.roleCancelBtn}
              >
                <Text style={styles.roleCancelText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const UserCard = ({
  item,
  onEdit,
  onDelete,
  onToggleLock,
  isLocking,
  currentUserId,
  profile,
}: {
  item: AdminUser;
  onEdit: () => void;
  onDelete: () => void;
  onToggleLock: () => void;
  isLocking?: boolean;
  currentUserId?: string;
  profile?: any;
}) => {
  const { t } = useTranslation();
  const isSelf = item.id === currentUserId;

  return (
    <Animated.View
      entering={FadeInUp.delay(100)}
      style={[styles.userCard, item.isLocked && { opacity: 0.8 }]}
    >
      <View style={styles.userAvatar}>
        {item.avatarUrl ? (
          <Image source={{ uri: item.avatarUrl }} style={styles.avatarImg} />
        ) : (
          <Text style={styles.avatarText}>
            {item.fullName?.charAt(0) || "U"}
          </Text>
        )}
        <View
          style={[
            styles.statusIndicator,
            {
              backgroundColor: item.isLocked
                ? "#94A3B8"
                : item.role === "ADMIN"
                  ? "#FFD43B"
                  : "#4CD137",
            },
          ]}
        />
      </View>
      <View style={styles.userInfo}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={styles.userName} numberOfLines={1}>
            {item.fullName || item.email}
          </Text>
          {item.isLocked && (
            <Ionicons
              name="lock-closed"
              size={12}
              color="#FF4757"
              style={{ marginLeft: 4 }}
            />
          )}
        </View>
        <View style={styles.userMeta}>
          <View
            style={[
              styles.roleBadge,
              item.isSuperAdmin && {
                backgroundColor: "rgba(168, 85, 247, 0.1)",
              },
            ]}
          >
            <Text
              style={[
                styles.roleText,
                item.isSuperAdmin && { color: "#A855F7" },
              ]}
            >
              {item.isSuperAdmin
                ? t("roles.super_admin").toUpperCase()
                : item.role
                  ? t(`roles.${item.role.toLowerCase()}`)?.toUpperCase()
                  : ""}
            </Text>
          </View>
          {item.email && (
            <Text style={styles.userEmail} numberOfLines={1}>
              {item.email}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.userCardActions}>
        {!isSelf && !item.isSuperAdmin && (
          <>
            {(profile?.is_super_admin ||
              (item.role !== "ADMIN" && item.role !== "LIBRARIAN")) && (
              <TouchableOpacity
                onPress={onToggleLock}
                style={[
                  styles.editBtn,
                  {
                    backgroundColor: item.isLocked
                      ? "rgba(245, 158, 11, 0.15)"
                      : "rgba(58, 117, 242, 0.1)",
                  },
                ]}
                activeOpacity={0.7}
                disabled={isLocking}
              >
                {isLocking ? (
                  <ActivityIndicator size="small" color="#F59E0B" />
                ) : (
                  <Ionicons
                    name={
                      item.isLocked
                        ? "lock-open-outline"
                        : "lock-closed-outline"
                    }
                    size={18}
                    color="#F59E0B"
                  />
                )}
              </TouchableOpacity>
            )}

            {profile?.is_super_admin && (
              <TouchableOpacity
                onPress={onEdit}
                style={styles.editBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="settings-outline" size={18} color="#3A75F2" />
              </TouchableOpacity>
            )}

            {(profile?.is_super_admin ||
              (item.role !== "ADMIN" && item.role !== "LIBRARIAN")) && (
              <TouchableOpacity
                onPress={onDelete}
                style={styles.deleteBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
              </TouchableOpacity>
            )}
          </>
        )}
        {(item.isSuperAdmin ||
          (!profile?.is_super_admin &&
            (item.role === "ADMIN" || item.role === "LIBRARIAN"))) && (
          <View style={[styles.editBtn, { backgroundColor: "transparent" }]}>
            <Ionicons
              name={item.isSuperAdmin ? "shield-checkmark" : "shield-outline"}
              size={18}
              color={item.isSuperAdmin ? "#A855F7" : "#3A75F2"}
            />
          </View>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0F1A" },
  scroll: { paddingBottom: 92 },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  subtitle: {
    fontSize: 14,
    color: "#8A8F9E",
    marginTop: 4,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  welcome: { color: "#8A8F9E", fontSize: 13, marginBottom: 2 },
  name: { color: "#FFFFFF", fontSize: 18, fontWeight: "bold" },
  notifBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(58, 117, 242, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  avatarWrapper: {
    position: "relative",
    marginLeft: 12,
  },
  cameraOverlayBtn: {
    position: "absolute",
    bottom: -1,
    right: -1,
    backgroundColor: "#3A75F2",
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#0F121D",
  },
  avatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#3A75F2",
    overflow: "hidden",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
  },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#1F263B",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#3A75F2",
    fontWeight: "bold",
    fontSize: 16,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 80,
    paddingRight: 20,
  },
  menuContent: {
    width: 200,
    backgroundColor: "#171B2B",
    borderRadius: 12,
    padding: 6,
    borderWidth: 1,
    borderColor: "#1F263B",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  menuHeader: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
    marginBottom: 4,
  },
  menuUserTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "bold",
  },
  menuUserSub: {
    color: "#8A8F9E",
    fontSize: 10,
    marginTop: 1,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
    gap: 10,
  },
  menuItemText: {
    color: "#E1E4ED",
    fontSize: 13,
    fontWeight: "500",
  },
  menuDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginVertical: 4,
  },
  signOutItem: {
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    marginBottom: 8,
    columnGap: 6,
    rowGap: 6,
  },
  statCard: {
    borderRadius: 10,
    padding: 9,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    minHeight: 58,
  },
  statTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  statLabel: {
    fontSize: 9,
    color: "#FFFFFF",
    fontWeight: "700",
    opacity: 0.9,
  },
  toolsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    columnGap: 6,
    rowGap: 6,
    marginBottom: 16,
  },
  toolTile: {
    minHeight: 54,
    backgroundColor: "#151929",
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    justifyContent: "space-between",
  },
  toolIcon: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  toolLabel: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
  userList: { paddingHorizontal: 20 },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#151929",
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1F263B",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    position: "relative",
  },
  statusIndicator: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#151929",
  },
  userInfo: { flex: 1 },
  userMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  userEmail: {
    color: "#5A5F7A",
    fontSize: 12,
    flex: 1,
  },
  userName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 4,
  },
  roleBadge: {
    backgroundColor: "rgba(58, 117, 242, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  roleText: { color: "#3A75F2", fontSize: 10, fontWeight: "700" },
  userCardActions: {
    flexDirection: "row",
    gap: 8,
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#1F263B",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "rgba(255, 107, 107, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { color: "#8A8F9E", textAlign: "center", marginTop: 20 },
  spacer40: { height: 40 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "flex-end",
  },
  roleModalContent: {
    backgroundColor: "#171B2B",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    borderWidth: 1,
    borderColor: "#22293F",
  },
  roleModalHeader: {
    marginBottom: 24,
    alignItems: "center",
  },
  roleModalTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 4,
  },
  roleModalUser: {
    color: "#3A75F2",
    fontSize: 14,
    fontWeight: "500",
  },
  roleOptions: {
    gap: 12,
    marginBottom: 24,
  },
  roleOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1F263B",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "transparent",
  },
  roleOptionSelected: {
    borderColor: "rgba(58, 117, 242, 0.3)",
    backgroundColor: "rgba(58, 117, 242, 0.05)",
  },
  roleIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(138, 143, 158, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  roleIconBoxSelected: {
    backgroundColor: "#3A75F2",
  },
  roleOptionText: {
    flex: 1,
    color: "#8A8F9E",
    fontSize: 16,
    fontWeight: "600",
  },
  roleOptionTextSelected: {
    color: "#FFFFFF",
  },
  roleCancelBtn: {
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  roleCancelText: {
    color: "#8A8F9E",
    fontSize: 16,
    fontWeight: "bold",
  },
});
