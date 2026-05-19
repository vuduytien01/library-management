import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { membersService } from "../../src/features/members/member-service";
import { DownloadedFile } from "../../src/features/members/members.types";
import { useUndoStore } from "../../src/store/useUndoStore";

export default function DownloadsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [downloads, setDownloads] = useState<DownloadedFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadDownloads = async () => {
    setIsLoading(true);
    try {
      const data = await membersService.getDownloads();
      setDownloads(data || []);
    } catch (e) {
      console.warn("Failed to load downloads:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const clearAll = async () => {
    const previousDownloads = [...downloads];

    useUndoStore.getState().queueAction({
      message: t("admin.clear_downloads_pending"),
      onCommit: async () => {
        await membersService.clearAll();
      },
      onUndo: () => {
        setDownloads(previousDownloads);
      },
    });

    setDownloads([]);
  };

  useEffect(() => {
    loadDownloads();
  }, []);

  const handleDelete = (id: string) => {
    const fileToDelete = downloads.find((d) => d.id === id);
    if (!fileToDelete) return;

    const previousDownloads = [...downloads];

    useUndoStore.getState().queueAction({
      message: t("admin.delete_download_pending", {
        title: fileToDelete.title,
      }),
      onCommit: async () => {
        await membersService.deleteDownload(id);
      },
      onUndo: () => {
        setDownloads(previousDownloads);
      },
    });

    setDownloads(downloads.filter((d) => d.id !== id));
  };

  const renderItem = ({ item }: { item: DownloadedFile }) => {
    return (
      <View style={styles.downloadItem}>
        <View style={styles.iconBox}>
          <Ionicons
            name={item.type === "MP3" ? "musical-notes" : "document-text"}
            size={22}
            color="#3A75F2"
          />
        </View>

        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.subtitle}>
            {item.type} •{" "}
            {item.downloaded_at
              ? new Date(item.downloaded_at).toLocaleDateString("vi-VN")
              : "N/A"}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => handleDelete(item.id)}
          style={styles.deleteBtn}
          accessibilityLabel="Xóa tệp"
        >
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() =>
            router.canGoBack()
              ? router.back()
              : router.push("/(member)/settings")
          }
          style={styles.backBtn}
          accessibilityLabel="Quay lại"
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tệp đã tải xuống</Text>
        {downloads.length > 0 && (
          <TouchableOpacity onPress={clearAll} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>Xóa tất cả</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3A75F2" />
        </View>
      ) : (
        <FlatList
          data={downloads}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconWrapper}>
                <Ionicons name="download-outline" size={48} color="#5A5F7A" />
              </View>
              <Text style={styles.emptyText}>
                Không có tệp nào được tải xuống
              </Text>
              <TouchableOpacity
                style={styles.browseBtn}
                onPress={() => router.push("/(member)/search")}
              >
                <Text style={styles.browseBtnText}>Khám phá sách ngay</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F121D" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: "#171B2B",
    borderBottomWidth: 1,
    borderBottomColor: "#1E2540",
  },
  backBtn: { marginRight: 16 },
  headerTitle: { color: "white", fontSize: 18, fontWeight: "700", flex: 1 },
  clearBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  clearBtnText: { color: "#FF6B6B", fontSize: 14, fontWeight: "600" },
  list: { padding: 20 },
  downloadItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#171B2B",
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1E2540",
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(58, 117, 242, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  info: { flex: 1 },
  title: { color: "white", fontSize: 15, fontWeight: "700", marginBottom: 4 },
  subtitle: { color: "#8A8F9E", fontSize: 12 },
  deleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 80,
    paddingHorizontal: 24,
  },
  emptyIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  emptyText: {
    color: "#8A8F9E",
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 24,
    textAlign: "center",
  },
  browseBtn: {
    backgroundColor: "#3A75F2",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: "#3A75F2",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  browseBtnText: { color: "white", fontSize: 14, fontWeight: "600" },
});
