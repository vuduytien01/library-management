import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLibrary } from "../../src/hooks/useLibrary";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useUndoStore } from "../../src/store/useUndoStore";
import { InlineUndoButton } from "../../src/components/InlineUndoButton";
import { useQueryClient } from "@tanstack/react-query";

export default function LibrarianBorrows() {
  const { t } = useTranslation();
  const { borrows } = useLibrary();
  const queryClient = useQueryClient();
  const { queueAction } = useUndoStore();
  const { data: allBorrows, isLoading, refetch } = borrows.listAll();
  const approveMutation = borrows.approve;
  const rejectMutation = borrows.reject;
  const returnMutation = borrows.return;

  const [isMounted, setIsMounted] = useState(true);
  React.useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  const [filter, setFilter] = useState("PENDING");

  const filteredData =
    allBorrows?.filter((b: any) => b.status === filter) || [];

  const handleApprove = (id: string) => {
    const borrow = allBorrows?.find((b: any) => b.id === id);
    if (!borrow) return;

    // Optimistic update
    queryClient.setQueryData(["borrows_list"], (old: any) =>
      old?.filter((b: any) => b.id !== id),
    );

    queueAction({
      message: t("librarian.approve_pending", { title: borrow.book_title }),
      onCommit: async () => {
        try {
          await approveMutation.mutateAsync(id);
        } catch (err: any) {
          queryClient.invalidateQueries({ queryKey: ["borrows_list"] });
          Alert.alert(t("common.error"), err.message);
        }
      },
      onUndo: () => {
        queryClient.invalidateQueries({ queryKey: ["borrows_list"] });
      },
    });
  };

  const handleReject = (id: string) => {
    const borrow = allBorrows?.find((b: any) => b.id === id);
    if (!borrow) return;

    const runReject = (reason?: string) => {
      // Optimistic update
      queryClient.setQueryData(["borrows_list"], (old: any) =>
        old?.filter((b: any) => b.id !== id),
      );

      queueAction({
        message: t("librarian.reject_pending", { title: borrow.book_title }),
        onCommit: async () => {
          try {
            await rejectMutation.mutateAsync({
              recordId: id,
              reason: reason || t("librarian.reject_reason_default"),
            });
          } catch (err: any) {
            queryClient.invalidateQueries({ queryKey: ["borrows_list"] });
            Alert.alert(t("common.error"), err.message);
          }
        },
        onUndo: () => {
          queryClient.invalidateQueries({ queryKey: ["borrows_list"] });
        },
      });
    };

    if (Platform.OS === "web") {
      const reason = window.prompt(t("librarian.reject_reason_label"));
      if (reason !== null) runReject(reason);
    } else if (Alert.prompt) {
      Alert.prompt(
        t("librarian.reject_title"),
        t("librarian.reject_reason_label"),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.confirm"),
            onPress: (reason?: string) => runReject(reason),
          },
        ],
      );
    } else {
      runReject();
    }
  };

  const handleReturn = (isbn: string) => {
    const borrow = allBorrows?.find(
      (b: any) => b.isbn === isbn && b.status === "BORROWED",
    );

    queueAction({
      message: t("librarian.return_pending", {
        title: borrow?.book?.title || isbn,
      }),
      onCommit: async () => {
        try {
          const result = await returnMutation.mutateAsync(isbn);
          if (isMounted) {
            const msg =
              result.late_fine > 0
                ? t("librarian.return_success_fine", {
                    amount: result.late_fine.toLocaleString(),
                  })
                : t("librarian.return_success");
            Alert.alert(t("common.success"), msg);
          }
        } catch (err: any) {
          if (isMounted) Alert.alert(t("common.error"), err.message);
        }
      },
      onUndo: () => {
        // No optimistic update for return yet as it's complex,
        // but we can add one if we have a local state to hide it
      },
    });
  };

  const renderItem = ({ item }: { item: any }) => {
    const isOverdue =
      item.status === "BORROWED" &&
      item.due_date &&
      new Date(item.due_date) < new Date();
    const daysLate = isOverdue
      ? Math.floor(
          (new Date().getTime() - new Date(item.due_date).getTime()) /
            (1000 * 3600 * 24),
        )
      : 0;
    const estFine = daysLate * 2000;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.bookInfo}>
            <Text style={styles.bookTitle}>{item.book?.title}</Text>
            <Text style={styles.userInfo}>
              {t("librarian.borrower")}: {item.fullName || "N/A"}
            </Text>
            {isOverdue && (
              <Text style={styles.overdueInfo}>
                {t("librarian.overdue_msg", {
                  days: daysLate,
                  fine: estFine.toLocaleString(),
                })}
              </Text>
            )}
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(item.status) },
            ]}
          >
            <Text style={styles.statusText}>
              {t(`common.${item.status.toLowerCase()}`)}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.dateInfo}>
            <Ionicons name="calendar-outline" size={14} color="#5A5F7A" />
            <Text style={styles.dateText}>
              {item.status === "PENDING"
                ? t("librarian.request_date") + ": "
                : t("librarian.due_date") + ": "}
              {new Date(
                item.status === "PENDING" ? item.borrowed_at : item.due_date,
              ).toLocaleDateString(t("common.locale_date"))}
            </Text>
          </View>

          {item.status === "PENDING" && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.rejectBtn]}
                onPress={() => handleReject(item.id)}
              >
                <Ionicons name="close" size={20} color="#FF6B6B" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.approveBtn]}
                onPress={() => handleApprove(item.id)}
              >
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}

          {item.status === "BORROWED" && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.returnBtn]}
              onPress={() => handleReturn(item.book?.isbn)}
            >
              <Ionicons
                name="arrow-back-circle-outline"
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.btnText}>{t("librarian.return_book")}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "#F59E0B";
      case "BORROWED":
        return "#4F8EF7";
      case "RETURNED":
        return "#10B981";
      case "REJECTED":
        return "#EF4444";
      default:
        return "#5A5F7A";
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("librarian.borrows_management")}</Text>
        <TouchableOpacity onPress={() => refetch()} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={24} color="#4F8EF7" />
        </TouchableOpacity>
      </View>

      <View style={styles.filterBar}>
        {["PENDING", "BORROWED", "RETURNED", "REJECTED"].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterItem, filter === f && styles.filterActive]}
            onPress={() => setFilter(f)}
          >
            <Text
              style={[
                styles.filterText,
                filter === f && styles.filterTextActive,
              ]}
            >
              {f === "PENDING"
                ? t("common.pending")
                : f === "BORROWED"
                  ? t("librarian.borrowed")
                  : f === "RETURNED"
                    ? t("librarian.returned")
                    : t("librarian.rejected")}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator
          size="large"
          color="#4F8EF7"
          style={{ marginTop: 50 }}
        />
      ) : (
        <FlatList
          data={filteredData}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name="document-text-outline"
                size={60}
                color="#1E2540"
              />
              <Text style={styles.emptyText}>{t("librarian.no_borrows")}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0F1A",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  refreshBtn: {
    padding: 5,
  },
  filterBar: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  filterItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#151929",
    marginRight: 10,
  },
  filterActive: {
    backgroundColor: "#4F8EF7",
  },
  filterText: {
    color: "#5A5F7A",
    fontSize: 12,
    fontWeight: "600",
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  list: {
    padding: 20,
  },
  card: {
    backgroundColor: "#151929",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#1E2540",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  bookInfo: {
    flex: 1,
  },
  bookTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  userInfo: {
    fontSize: 13,
    color: "#5A5F7A",
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    height: 24,
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#1E2540",
    paddingTop: 12,
  },
  dateInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  dateText: {
    color: "#5A5F7A",
    fontSize: 12,
    marginLeft: 5,
  },
  overdueInfo: {
    fontSize: 12,
    color: "#FF6B6B",
    fontWeight: "600",
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: "row",
  },
  returnBtn: {
    backgroundColor: "#4F8EF7",
    flexDirection: "row",
    paddingHorizontal: 12,
    width: "auto",
    height: 36,
  },
  btnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "bold",
    marginLeft: 6,
  },
  actionBtn: {
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
    paddingHorizontal: 8,
  },
  approveBtn: {
    backgroundColor: "#10B981",
    width: 36,
  },
  rejectBtn: {
    borderWidth: 1,
    borderColor: "#FF6B6B",
    width: 36,
  },
  empty: {
    alignItems: "center",
    marginTop: 100,
  },
  emptyText: {
    color: "#5A5F7A",
    marginTop: 10,
    fontSize: 16,
  },
});
