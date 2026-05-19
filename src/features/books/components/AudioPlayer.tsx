import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider"; // Cần cài thêm nếu chưa có, tạm thời dùng view nếu chưa cài
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useTranslation } from "react-i18next";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface AudioPlayerProps {
  url: string;
  title: string;
  author: string;
  narrator?: string | null;
  coverUrl: string;
  onClose: () => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  url,
  title,
  author,
  narrator,
  coverUrl,
  onClose,
}) => {
  const { t } = useTranslation();
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [sleepTimer, setSleepTimer] = useState<number | null>(null); // minutes
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<number | null>(
    null,
  ); // seconds
  const playbackKey = `playback_position_${url}`;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setupAudio();
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Sleep Timer Logic
  useEffect(() => {
    if (sleepTimerRemaining !== null && sleepTimerRemaining > 0) {
      timerRef.current = setInterval(() => {
        setSleepTimerRemaining((prev) => {
          if (prev !== null && prev <= 1) {
            handlePlayPause(true); // Force pause
            clearInterval(timerRef.current!);
            return null;
          }
          return prev !== null ? prev - 1 : null;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sleepTimerRemaining]);

  const handleSetTimer = () => {
    const options = [
      { label: t("audiobooks.turn_off_timer", "Tắt hẹn giờ"), value: null },
      { label: `15 ${t("audiobooks.minutes_short", "phút")}`, value: 15 },
      { label: `30 ${t("audiobooks.minutes_short", "phút")}`, value: 30 },
      { label: `60 ${t("audiobooks.minutes_short", "phút")}`, value: 60 },
      { label: t("audiobooks.end_of_chapter", "Hết chương"), value: "end" },
    ];

    Alert.alert(
      t("audiobooks.sleep_timer", "Hẹn giờ tắt"),
      t("audiobooks.select_timer_desc", "Chọn thời gian tự động dừng phát"),
      options.map((opt) => ({
        text: opt.label,
        onPress: () => {
          if (opt.value === null) {
            setSleepTimer(null);
            setSleepTimerRemaining(null);
          } else if (typeof opt.value === "number") {
            setSleepTimer(opt.value);
            setSleepTimerRemaining(opt.value * 60);
          }
        },
      })),
    );
  };

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  async function setupAudio() {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: true,
      });

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true, rate: playbackSpeed, shouldCorrectPitch: true },
        onPlaybackStatusUpdate,
      );

      // Restore position if exists
      const savedPosition = await AsyncStorage.getItem(playbackKey);
      if (savedPosition) {
        await newSound.setPositionAsync(parseInt(savedPosition));
      }

      setSound(newSound);
      setIsPlaying(true);
      setLoading(false);
    } catch (error) {
      console.error("Error loading sound", error);
      setLoading(false);
    }
  }

  const changeSpeed = async () => {
    if (!sound) return;
    const speeds = [1.0, 1.25, 1.5, 2.0, 0.75];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    const nextSpeed = speeds[nextIndex];

    await sound.setRateAsync(nextSpeed, true);
    setPlaybackSpeed(nextSpeed);
  };

  const onPlaybackStatusUpdate = async (status: any) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis);
      setDuration(status.durationMillis || 0);
      setIsPlaying(status.isPlaying);

      // Save position periodically (every 5 seconds)
      if (status.positionMillis % 5000 < 500) {
        await AsyncStorage.setItem(
          playbackKey,
          status.positionMillis.toString(),
        );
      }

      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
        await AsyncStorage.removeItem(playbackKey);
      }
    }
  };

  const handlePlayPause = async (forcePause?: boolean) => {
    if (!sound) return;
    if (isPlaying || forcePause) {
      await sound.pauseAsync();
      if (forcePause) setIsPlaying(false);
    } else {
      await sound.playAsync();
    }
  };

  const formatTime = (millis: number) => {
    const totalSeconds = millis / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  const handleSeek = async (value: number) => {
    if (sound) {
      await sound.setPositionAsync(value);
    }
  };

  return (
    <View style={styles.container}>
      <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="chevron-down" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t("audiobooks.now_playing", "Đang phát")}
        </Text>
        <TouchableOpacity style={styles.closeBtn}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.coverContainer}>
          <Image
            source={coverUrl ? { uri: coverUrl } : undefined}
            style={styles.cover}
          />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.5)"]}
            style={styles.coverOverlay}
          />
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.author}>{author}</Text>
          {narrator && (
            <View style={styles.narratorBadge}>
              <Ionicons name="mic-outline" size={14} color="#6E45E2" />
              <Text style={styles.narratorText}>{narrator}</Text>
            </View>
          )}
        </View>

        <View style={styles.sliderContainer}>
          {/* Tạm thời dùng View làm slider nếu chưa cài slider library */}
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width:
                    duration > 0 ? `${(position / duration) * 100}%` : "0%",
                },
              ]}
            />
          </View>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatTime(position)}</Text>
            <Text style={styles.timeText}>{formatTime(duration)}</Text>
          </View>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity style={styles.secondaryBtn}>
            <Ionicons name="play-back" size={32} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handlePlayPause()}
            style={styles.mainBtn}
          >
            <LinearGradient
              colors={["#3A75F2", "#6E45E2"]}
              style={styles.mainBtnGradient}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Ionicons
                  name={isPlaying ? "pause" : "play"}
                  size={40}
                  color="#FFFFFF"
                />
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn}>
            <Ionicons name="play-forward" size={32} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.bottomActions}>
          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="list" size={20} color="#8A8F9E" />
            <Text style={styles.actionText}>
              {t("audiobooks.chapters", "Chương")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleSetTimer}>
            <Ionicons
              name={sleepTimerRemaining ? "timer" : "timer-outline"}
              size={20}
              color={sleepTimerRemaining ? "#3A75F2" : "#8A8F9E"}
            />
            <Text
              style={[
                styles.actionText,
                sleepTimerRemaining ? { color: "#3A75F2" } : null,
              ]}
            >
              {sleepTimerRemaining
                ? formatCountdown(sleepTimerRemaining)
                : t("audiobooks.timer_label", "Hẹn giờ")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => changeSpeed()}
          >
            <Ionicons
              name="speedometer-outline"
              size={20}
              color={playbackSpeed > 1.0 ? "#3A75F2" : "#8A8F9E"}
            />
            <Text
              style={[
                styles.actionText,
                playbackSpeed > 1.0 ? { color: "#3A75F2" } : null,
              ]}
            >
              {playbackSpeed}x
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "rgba(15, 18, 29, 0.95)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  closeBtn: {
    padding: 8,
  },
  content: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 30,
  },
  coverContainer: {
    width: SCREEN_WIDTH * 0.75,
    height: SCREEN_WIDTH * 0.75,
    borderRadius: 30,
    overflow: "hidden",
    marginTop: 20,
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  cover: {
    width: "100%",
    height: "100%",
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  infoContainer: {
    alignItems: "center",
    marginTop: 40,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
  },
  author: {
    color: "#8A8F9E",
    fontSize: 16,
    marginTop: 8,
  },
  narratorBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    backgroundColor: "rgba(110, 69, 226, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  narratorText: {
    color: "#A58BFF",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 6,
  },
  sliderContainer: {
    width: "100%",
    marginTop: 40,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 2,
    width: "100%",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#3A75F2",
    borderRadius: 2,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  timeText: {
    color: "#8A8F9E",
    fontSize: 12,
    fontWeight: "600",
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 40,
  },
  mainBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    elevation: 10,
    shadowColor: "#3A75F2",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  mainBtnGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtn: {
    padding: 10,
  },
  bottomActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginTop: "auto",
    marginBottom: 50,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  actionBtn: {
    alignItems: "center",
    gap: 6,
  },
  actionText: {
    color: "#8A8F9E",
    fontSize: 11,
    fontWeight: "600",
  },
});
