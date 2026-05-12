import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { BlurView } from "expo-blur";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { notificationService } from "../core/notifications";
import { useAuthStore } from "../store/useAuthStore";

interface NotificationCenterProps {
  visible: boolean;
  onClose: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  visible,
  onClose,
}) => {
  const profile = useAuthStore((state) => state.profile);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"ALL" | "SYSTEM" | "CLUB">("ALL");
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (visible && profile?.id) {
      loadNotifications();
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible, profile?.id]);

  const loadNotifications = async () => {
    if (!profile?.id) return;
    setLoading(true);
    const data = await notificationService.getNotifications(profile.id);
    setNotifications(data);
    setLoading(false);
  };

  const markAsRead = async (id: string) => {
    const success = await notificationService.markAsRead(id);
    if (success) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
    }
  };

  const handleMarkAllRead = async () => {
    if (!profile?.id) return;
    const success = await notificationService.markAllAsRead(profile.id);
    if (success) {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "DUE_SOON":
        return { name: "time", color: "#F59E0B" };
      case "OVERDUE":
        return { name: "alert-circle", color: "#EF4444" };
      case "XP_GAIN":
        return { name: "flash", color: "#3A75F2" };
      case "LEVEL_UP":
        return { name: "trending-up", color: "#10B981" };
      case "BADGE":
        return { name: "trophy", color: "#F59E0B" };
      case "BROADCAST":
        return { name: "megaphone", color: "#3A75F2" };
      case "CLUB_MESSAGE":
      case "MESSAGE":
        return { name: "chatbubbles", color: "#8B5CF6" };
      default:
        return { name: "notifications", color: "#10B981" };
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === "ALL") return true;
    if (activeTab === "SYSTEM")
      return [
        "DUE_SOON",
        "OVERDUE",
        "XP_GAIN",
        "LEVEL_UP",
        "BADGE",
        "BROADCAST",
      ].includes(n.type);
    if (activeTab === "CLUB")
      return ["CLUB_MESSAGE", "MESSAGE"].includes(n.type);
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.dismissArea}
          onPress={onClose}
          activeOpacity={1}
        />
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
          <BlurView intensity={90} tint="dark" style={styles.blurContainer}>
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Thông báo</Text>
                {unreadCount > 0 && (
                  <Text style={styles.subtitle}>
                    Bạn có {unreadCount} thông báo chưa đọc
                  </Text>
                )}
              </View>
              <View style={styles.headerActions}>
                {unreadCount > 0 && (
                  <TouchableOpacity
                    onPress={handleMarkAllRead}
                    style={styles.markAllBtn}
                  >
                    <Ionicons name="checkmark-done" size={18} color="#3A75F2" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Tab Selector */}
            <View style={styles.tabContainer}>
              {(["ALL", "SYSTEM", "CLUB"] as const).map((tab) => (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={[styles.tab, activeTab === tab && styles.activeTab]}
                >
                  <Text
                    style={[
                      styles.tabText,
                      activeTab === tab && styles.activeTabText,
                    ]}
                  >
                    {tab === "ALL"
                      ? "Tất cả"
                      : tab === "SYSTEM"
                        ? "Hệ thống"
                        : "Câu lạc bộ"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {loading && notifications.length === 0 ? (
              <View style={styles.emptyContainer}>
                <ActivityIndicator color="#3A75F2" />
                <Text style={styles.emptyText}>Đang tải...</Text>
              </View>
            ) : filteredNotifications.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name="notifications-off-outline"
                  size={48}
                  color="#3D4260"
                />
                <Text style={styles.emptyText}>
                  Chưa có thông báo nào trong mục này
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredNotifications}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                  const icon = getIcon(item.type);
                  return (
                    <TouchableOpacity
                      style={[
                        styles.notiItem,
                        !item.is_read && styles.unreadItem,
                      ]}
                      onPress={() => markAsRead(item.id)}
                    >
                      <View
                        style={[
                          styles.iconBox,
                          { backgroundColor: `${icon.color}20` },
                        ]}
                      >
                        <Ionicons
                          name={icon.name as any}
                          size={20}
                          color={icon.color}
                        />
                      </View>
                      <View style={styles.notiContent}>
                        <View style={styles.notiHeader}>
                          <Text style={styles.notiTitle} numberOfLines={1}>
                            {item.title}
                          </Text>
                          {!item.is_read && <View style={styles.unreadDot} />}
                        </View>
                        <Text style={styles.notiBody} numberOfLines={2}>
                          {item.body}
                        </Text>
                        <Text style={styles.notiTime}>
                          {format(
                            new Date(item.created_at),
                            "HH:mm, dd/MM/yyyy",
                            { locale: vi },
                          )}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
              />
            )}
          </BlurView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-start",
    alignItems: "center",
  },
  dismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    width: "90%",
    maxHeight: "70%",
    marginTop: 100,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  blurContainer: {
    padding: 20,
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  markAllBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(58, 117, 242, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  subtitle: {
    fontSize: 11,
    color: "#3A75F2",
    marginTop: 2,
    fontWeight: "600",
  },
  closeBtn: {
    padding: 4,
  },
  tabContainer: {
    flexDirection: "row",
    marginBottom: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: "#3A75F2",
  },
  tabText: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "600",
  },
  activeTabText: {
    color: "#FFFFFF",
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "#94A3B8",
    marginTop: 12,
    fontSize: 13,
    textAlign: "center",
  },
  listContent: {
    paddingBottom: 20,
  },
  notiItem: {
    flexDirection: "row",
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  unreadItem: {
    backgroundColor: "rgba(58, 117, 242, 0.08)",
    borderColor: "rgba(58, 117, 242, 0.2)",
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  notiContent: {
    flex: 1,
  },
  notiHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  notiTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    flex: 1,
    marginRight: 8,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#3A75F2",
  },
  notiBody: {
    fontSize: 12,
    color: "#94A3B8",
    lineHeight: 18,
    marginBottom: 6,
  },
  notiTime: {
    fontSize: 10,
    color: "#5A6376",
  },
});
