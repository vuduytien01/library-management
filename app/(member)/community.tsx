import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  ScrollView,
  Alert,
} from "react-native";
import { useLibrary, useBookClubs } from "../../src/hooks/useLibrary";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "../../src/store/useAuthStore";
import { useTranslation } from "react-i18next";
import { InlineUndoButton } from "../../src/components/InlineUndoButton";

const { width } = Dimensions.get("window");

// Performance: Memoized Feed Item
const FeedItem = React.memo(({ activity, onPress, timeAgo }: any) => {
  const { t } = useTranslation();
  return (
    <TouchableOpacity
      style={styles.feedItem}
      onPress={() => onPress(activity.bookIsbn)}
      accessibilityRole="button"
      accessibilityLabel={`${activity.userName} ${activity.type === "BORROW" ? t("community.just_borrowed") : t("community.just_reviewed")} ${activity.bookTitle}`}
      accessibilityHint={t("a11y.view_book_hint")}
    >
      <View
        style={styles.feedAvatar}
        importantForAccessibility="no-hide-descendants"
      >
        {activity.avatarUrl ? (
          <Image
            source={
              activity.avatarUrl ? { uri: activity.avatarUrl } : undefined
            }
            style={styles.avatarImg}
          />
        ) : (
          <View
            style={[
              styles.avatarPlaceholder,
              {
                backgroundColor:
                  activity.type === "BORROW" ? "#3A75F2" : "#F59E0B",
              },
            ]}
          >
            <Text style={styles.avatarText}>
              {activity.userName?.charAt(0)}
            </Text>
          </View>
        )}
        <View style={styles.levelBadgeMini}>
          <Text style={styles.levelBadgeText}>
            {t("common.level_short", "Lvl")} {activity.userLevel || 1}
          </Text>
        </View>
      </View>
      <View style={styles.feedContent}>
        <Text style={styles.feedText} numberOfLines={2}>
          <Text style={styles.userName}>{activity.userName}</Text>
          <Text style={styles.actionText}>
            {activity.type === "BORROW"
              ? t("community.just_borrowed")
              : t("community.just_reviewed")}
          </Text>
          <Text style={styles.bookName}>{activity.bookTitle}</Text>
          {activity.type === "REVIEW" && (
            <Text style={styles.ratingText}> {activity.rating}★</Text>
          )}
        </Text>
        <Text
          style={styles.feedTime}
          accessibilityLabel={t("a11y.time_label", "Time: {{time}}", {
            time: timeAgo(activity.timestamp),
          })}
        >
          {timeAgo(activity.timestamp)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#3D4260" />
    </TouchableOpacity>
  );
});

// Leaderboard Item Component
const LeaderboardItem = React.memo(({ user, index, isCurrentUser }: any) => {
  const { t } = useTranslation();
  const isTop3 = index < 3;
  const rankColors = ["#F59E0B", "#9CA3AF", "#D97706"]; // Gold, Silver, Bronze
  const rankColor = isTop3 ? rankColors[index] : "#3D4260";

  return (
    <View style={[styles.lbItem, isCurrentUser && styles.lbItemCurrent]}>
      <View style={styles.lbRankContainer}>
        {isTop3 ? (
          <Ionicons name="trophy" size={20} color={rankColor} />
        ) : (
          <Text style={styles.lbRank}>{index + 1}</Text>
        )}
      </View>
      <View
        style={[
          styles.lbAvatarContainer,
          isTop3 && { borderColor: rankColor, borderWidth: 2 },
        ]}
      >
        <Image
          source={{
            uri:
              user.avatarUrl ||
              `https://ui-avatars.com/api/?name=${user.fullName}&background=3A75F2&color=fff`,
          }}
          style={styles.lbAvatar}
        />
      </View>
      <View style={styles.lbInfo}>
        <Text style={[styles.lbName, isCurrentUser && styles.lbNameCurrent]}>
          {user.fullName} {isCurrentUser && `(${t("community.you")})`}
        </Text>
        <Text style={styles.lbLevel}>
          {t("community.level")} {user.level || 1} •{" "}
          {t("roles." + (user.role || "member").toLowerCase())}
        </Text>
      </View>
      <View style={styles.lbScore}>
        <Text style={styles.lbXp}>{user.xp || 0}</Text>
        <Text style={styles.lbXpLabel}>XP</Text>
      </View>
    </View>
  );
});

export default function CommunityFeedPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const currentUser = useAuthStore((state) => state.profile);
  const { feed, bookClubs: clubHooks, gamification } = useLibrary();
  const {
    data: feedData,
    isLoading: isFeedLoading,
    refetch,
    isRefetching,
  } = feed.getCommunityFeed();
  const { data: leaderboardData, isLoading: isLeaderboardLoading } =
    gamification.getLeaderboard(50);
  const [activeTab, setActiveTab] = useState<"FEED" | "CLUBS" | "LEADERBOARD">(
    "FEED",
  );
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [newClubName, setNewClubName] = useState("");
  const [newClubDesc, setNewClubDesc] = useState("");

  const { list: listClubs, create: createClub, join: joinClub } = clubHooks;
  const { data: clubs, isLoading: isClubsLoading } = listClubs();

  const handleCreateClub = async () => {
    if (!newClubName.trim()) return;
    try {
      await createClub.mutateAsync({
        name: newClubName,
        description: newClubDesc,
      });
      setIsCreateModalVisible(false);
      setNewClubName("");
      setNewClubDesc("");
      Alert.alert(t("common.success"), t("clubs.created"));
    } catch (error) {
      Alert.alert(t("common.error"), t("clubs.create_failed"));
    }
  };

  const handleJoinClub = async (clubId: string) => {
    try {
      await joinClub.mutateAsync(clubId);
      Alert.alert(t("common.success"), t("clubs.joined"));
    } catch (error) {
      Alert.alert(t("common.error"), t("clubs.join_failed"));
    }
  };

  const timeAgo = useCallback(
    (date: string) => {
      const seconds = Math.floor(
        (new Date().getTime() - new Date(date).getTime()) / 1000,
      );
      if (seconds < 60) return t("community.just_now");
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return t("community.minutes_ago", { minutes });
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return t("community.hours_ago", { hours });
      const days = Math.floor(hours / 24);
      return t("community.days_ago", { days });
    },
    [t],
  );

  const handleNavigate = useCallback(
    (isbn: string) => {
      router.push(`/(member)/book/${isbn}` as any);
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: any) => (
      <FeedItem activity={item} onPress={handleNavigate} timeAgo={timeAgo} />
    ),
    [handleNavigate, timeAgo],
  );

  const Header = useMemo(
    () => (
      <View style={styles.header}>
        <View style={styles.headerTitleContainer} accessibilityRole="header">
          <Ionicons
            name="people"
            size={28}
            color="#4F8EF7"
            accessibilityElementsHidden={true}
          />
          <Text style={styles.headerTitle}>{t("community.title")}</Text>
        </View>
        <Text style={styles.headerSubtitle}>{t("community.subtitle")}</Text>
      </View>
    ),
    [t],
  );

  const EmptyState = useMemo(
    () => (
      <View style={styles.emptyContainer} accessibilityLiveRegion="polite">
        <Ionicons name="chatbubbles-outline" size={64} color="#1E2540" />
        <Text style={styles.emptyFeed}>{t("community.empty_feed")}</Text>
        <Text style={styles.emptyFeedSub}>{t("community.empty_feed_sub")}</Text>
      </View>
    ),
    [t],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F1A" />

      {Header}

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "FEED" && styles.activeTab]}
          onPress={() => setActiveTab("FEED")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "FEED" && styles.activeTabText,
            ]}
          >
            {t("community.activity")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "CLUBS" && styles.activeTab]}
          onPress={() => setActiveTab("CLUBS")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "CLUBS" && styles.activeTabText,
            ]}
          >
            {t("community.clubs")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "LEADERBOARD" && styles.activeTab]}
          onPress={() => setActiveTab("LEADERBOARD")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "LEADERBOARD" && styles.activeTabText,
            ]}
          >
            {t("community.leaderboard")}
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === "FEED" ? (
        <FlatList
          data={feedData}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            isFeedLoading ? (
              <ActivityIndicator
                color="#4F8EF7"
                style={{ marginTop: 40 }}
                size="large"
              />
            ) : (
              EmptyState
            )
          }
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#4F8EF7"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      ) : activeTab === "CLUBS" ? (
        <View style={{ flex: 1 }}>
          <FlatList
            data={clubs}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.contentContainer}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.clubCard}
                onPress={() => router.push(`/(member)/club/${item.id}` as any)}
              >
                <LinearGradient
                  colors={["#1E2540", "#171B2B"]}
                  style={styles.clubGradient}
                >
                  <View style={styles.clubInfo}>
                    <Text style={styles.clubName}>{item.name}</Text>
                    <Text style={styles.clubDesc} numberOfLines={2}>
                      {item.description}
                    </Text>
                    <View style={styles.clubStats}>
                      <Ionicons name="people" size={14} color="#8A8F9E" />
                      <Text style={styles.clubStatText}>
                        {t("community.members_count", {
                          count: item.member_count || 0,
                        })}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.joinBtn}
                    onPress={() => handleJoinClub(item.id)}
                  >
                    <Text style={styles.joinBtnText}>
                      {t("community.join")}
                    </Text>
                  </TouchableOpacity>
                </LinearGradient>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              isClubsLoading ? (
                <ActivityIndicator color="#4F8EF7" />
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyFeed}>
                    {t("community.no_clubs_yet")}
                  </Text>
                  <TouchableOpacity
                    style={styles.createFirstBtn}
                    onPress={() => setIsCreateModalVisible(true)}
                  >
                    <Text style={styles.createFirstBtnText}>
                      {t("community.create_first_club")}
                    </Text>
                  </TouchableOpacity>
                </View>
              )
            }
          />
          <TouchableOpacity
            style={styles.fab}
            onPress={() => setIsCreateModalVisible(true)}
          >
            <Ionicons name="add" size={30} color="white" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {leaderboardData && currentUser && (
            <LinearGradient
              colors={["#4F8EF7", "#3A75F2"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.myRankBanner}
            >
              <View style={styles.lbAvatarContainer}>
                <Image
                  source={{
                    uri:
                      currentUser.avatarUrl ||
                      `https://ui-avatars.com/api/?name=${currentUser.fullName}&background=fff&color=3A75F2`,
                  }}
                  style={styles.lbAvatar}
                />
              </View>
              <View style={styles.lbInfo}>
                <Text style={styles.myRankTitle}>
                  {t("community.your_rank")}
                </Text>
                <Text style={styles.myRankName}>{currentUser.fullName}</Text>
              </View>
              <View style={styles.lbScore}>
                <Text style={styles.myRankXp}>
                  #
                  {leaderboardData.findIndex(
                    (u: any) => u.id === currentUser.id,
                  ) + 1 || "?"}
                </Text>
                <Text style={styles.myRankXpLabel}>
                  {t("community.rank", "RANK")}
                </Text>
              </View>
            </LinearGradient>
          )}

          <View style={styles.leaderboardHeader}>
            <View>
              <Text style={styles.leaderboardHeaderTitle}>
                {t("community.leaderboard_title")}
              </Text>
              <Text style={styles.leaderboardHeaderSubtitle}>
                {t("community.leaderboard_subtitle")}
              </Text>
            </View>
            <Ionicons name="trophy-outline" size={24} color="#F59E0B" />
          </View>
          <FlatList
            data={leaderboardData}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <LeaderboardItem
                user={item}
                index={index}
                isCurrentUser={currentUser?.id === item.id}
              />
            )}
            ListEmptyComponent={
              isLeaderboardLoading ? (
                <ActivityIndicator color="#4F8EF7" style={{ marginTop: 40 }} />
              ) : (
                EmptyState
              )
            }
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}

      {/* Create Club Modal */}
      <Modal visible={isCreateModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {t("community.create_new_club")}
              </Text>
              <TouchableOpacity onPress={() => setIsCreateModalVisible(false)}>
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>{t("community.club_name")}</Text>
              <TextInput
                style={styles.input}
                value={newClubName}
                onChangeText={setNewClubName}
                placeholder={t("community.club_name_placeholder")}
                placeholderTextColor="#5A5F7A"
              />
              <Text style={styles.inputLabel}>
                {t("community.description")}
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={newClubDesc}
                onChangeText={setNewClubDesc}
                multiline
                placeholder={t("community.club_desc_placeholder")}
                placeholderTextColor="#5A5F7A"
              />
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleCreateClub}
              >
                <Text style={styles.saveBtnText}>
                  {t("community.create_now")}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0B0F1A",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    backgroundColor: "#0B0F1A",
    borderBottomWidth: 1,
    borderBottomColor: "#1E2540",
  },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    marginLeft: 10,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#8A8F9E",
    marginTop: 2,
  },
  container: {
    flex: 1,
    backgroundColor: "#0B0F1A",
  },
  contentContainer: {
    paddingVertical: 20,
  },
  feedList: {
    marginHorizontal: 16,
    backgroundColor: "#171B2B",
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1F263B",
  },
  feedItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  feedAvatar: {
    marginRight: 16,
  },
  avatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 20,
  },
  levelBadgeMini: {
    position: "absolute",
    bottom: -4,
    right: -4,
    backgroundColor: "#3A75F2",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#171B2B",
  },
  levelBadgeText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "900",
  },
  feedContent: {
    flex: 1,
    marginRight: 12,
  },
  feedText: {
    fontSize: 14,
    color: "#8A8F9E",
    lineHeight: 20,
  },
  userName: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  actionText: {
    color: "#8A8F9E",
  },
  bookName: {
    color: "#4F8EF7",
    fontWeight: "600",
  },
  ratingText: {
    color: "#F59E0B",
    fontWeight: "bold",
  },
  feedTime: {
    fontSize: 12,
    color: "#5A5F7A",
    marginTop: 6,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    paddingHorizontal: 30,
  },
  emptyFeed: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 20,
  },
  emptyFeedSub: {
    color: "#5A5F7A",
    fontSize: 14,
    textAlign: "center",
    marginTop: 10,
    lineHeight: 20,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#0B0F1A",
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1E2540",
  },
  tab: {
    paddingVertical: 15,
    marginRight: 25,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: "#4F8EF7",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#5A5F7A",
    letterSpacing: 1,
  },
  activeTabText: {
    color: "#4F8EF7",
  },
  clubCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1F263B",
  },
  clubGradient: {
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  clubInfo: {
    flex: 1,
    marginRight: 15,
  },
  clubName: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  clubDesc: {
    color: "#8A8F9E",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  clubStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  clubStatText: {
    color: "#5A5F7A",
    fontSize: 12,
    fontWeight: "500",
  },
  joinBtn: {
    backgroundColor: "rgba(79, 142, 247, 0.1)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(79, 142, 247, 0.3)",
  },
  joinBtnText: {
    color: "#4F8EF7",
    fontSize: 12,
    fontWeight: "bold",
  },
  fab: {
    position: "absolute",
    bottom: 30,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#4F8EF7",
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowColor: "#4F8EF7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  createFirstBtn: {
    marginTop: 20,
    backgroundColor: "#4F8EF7",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
  },
  createFirstBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  lbItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  lbItemCurrent: {
    backgroundColor: "rgba(58, 117, 242, 0.1)",
  },
  lbRankContainer: {
    width: 30,
    alignItems: "center",
    marginRight: 10,
  },
  lbRank: {
    color: "#8A8F9E",
    fontSize: 16,
    fontWeight: "bold",
  },
  lbAvatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 15,
    padding: 2,
  },
  lbAvatar: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
    backgroundColor: "#171B2B",
  },
  lbInfo: {
    flex: 1,
  },
  lbName: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "bold",
    marginBottom: 4,
  },
  lbNameCurrent: {
    color: "#4F8EF7",
  },
  lbLevel: {
    color: "#8A8F9E",
    fontSize: 12,
  },
  lbScore: {
    alignItems: "flex-end",
  },
  lbXp: {
    color: "#F59E0B",
    fontSize: 16,
    fontWeight: "bold",
  },
  lbXpLabel: {
    color: "#5A5F7A",
    fontSize: 10,
    fontWeight: "bold",
  },
  leaderboardHeader: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#171B2B",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  leaderboardHeaderTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  leaderboardHeaderSubtitle: {
    color: "#8A8F9E",
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#0B0F1A",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    maxHeight: "80%",
    borderTopWidth: 1,
    borderColor: "#1F263B",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
  },
  modalBody: {
    marginBottom: 20,
  },
  inputLabel: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: "#171B2B",
    borderRadius: 16,
    padding: 16,
    color: "#FFFFFF",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#1F263B",
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  saveBtn: {
    backgroundColor: "#4F8EF7",
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 30,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  myRankBanner: {
    margin: 20,
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#3A75F2",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  myRankTitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  myRankName: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  myRankXp: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
  },
  myRankXpLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 10,
    fontWeight: "bold",
  },
});
