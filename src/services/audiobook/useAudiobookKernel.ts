import { useState, useEffect, useRef, useCallback } from "react";
import { Audio, AVPlaybackStatus } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { booksService } from "../../features/books/books.service";

interface AudiobookStatus {
  isPlaying: boolean;
  position: number;
  duration: number;
  rate: number;
  currentChapter: number | null;
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  sleepRemaining: number | null;
}


export const useAudiobookKernel = (bookId?: string) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [status, setStatus] = useState<AudiobookStatus>({
    isPlaying: false,
    position: 0,
    duration: 0,
    rate: 1.0,
    currentChapter: null,
    isLoaded: false,
    isLoading: false,
    error: null,
    sleepRemaining: null,
  });

  const sleepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentChapterRef = useRef<number | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
      if (sleepTimerRef.current) {
        clearInterval(sleepTimerRef.current);
      }
    };
  }, []);

  const onPlaybackStatusUpdate = (playbackStatus: AVPlaybackStatus) => {
    if (!playbackStatus.isLoaded || !isMounted.current) return;

    setStatus((prev) => ({
      ...prev,
      isPlaying: playbackStatus.isPlaying,
      position: playbackStatus.positionMillis,
      duration: playbackStatus.durationMillis || 0,
      isLoaded: true,
    }));

    // Persistence: Save position every 10 seconds
    if (
      playbackStatus.positionMillis % 10000 < 500 &&
      bookId &&
      currentChapterRef.current
    ) {
      AsyncStorage.setItem(
        `audio_pos_${bookId}_${currentChapterRef.current}`,
        playbackStatus.positionMillis.toString(),
      );
      AsyncStorage.setItem(
        `audio_chapter_${bookId}`,
        currentChapterRef.current.toString(),
      );
    }
  };

  const load = useCallback(
    async (book: any, chapterIdx: number) => {
      if (!book || !isMounted.current) return;

      currentChapterRef.current = chapterIdx;

      // Unload existing sound using ref
      if (soundRef.current) {
        try {
          await soundRef.current.unloadAsync();
        } catch (e) {
          console.warn("[Kernel] Unload error:", e);
        }
        soundRef.current = null;
        setSound(null);
      }

      const audioUrl = booksService.getChapterUrl(book, chapterIdx);
      if (!audioUrl) {
        setStatus(prev => ({ ...prev, error: "Invalid audio URL" }));
        return;
      }

      setStatus((prev) => ({
        ...prev,
        isLoaded: false,
        isLoading: true,
        error: null,
      }));

      try {
        const savedPos = await AsyncStorage.getItem(
          `audio_pos_${book.id}_${chapterIdx}`,
        );
        const savedSpeed = await AsyncStorage.getItem(`audio_speed_${book.id}`);

        const initialPos = savedPos ? parseInt(savedPos) : 0;
        const initialSpeed = savedSpeed ? parseFloat(savedSpeed) : 1.0;

        console.log(`[Kernel] Loading: ${audioUrl}`);

        // 15s Timeout for loading
        const loadPromise = Audio.Sound.createAsync(
          { uri: audioUrl },
          {
            shouldPlay: true,
            rate: initialSpeed,
            shouldCorrectPitch: true,
            positionMillis: initialPos,
          },
          onPlaybackStatusUpdate,
        );

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Loading timeout (15s)")), 15000)
        );

        const { sound: newSound } = (await Promise.race([
          loadPromise,
          timeoutPromise,
        ])) as { sound: Audio.Sound };

        if (!isMounted.current) {
          await newSound.unloadAsync();
          return;
        }

        soundRef.current = newSound;
        setSound(newSound);
        setStatus((prev) => ({
          ...prev,
          rate: initialSpeed,
          currentChapter: chapterIdx,
          position: initialPos,
          isLoaded: true,
          isLoading: false,
          error: null,
        }));
      } catch (error: any) {
        console.error("[Kernel] Failed to load sound:", error);
        if (isMounted.current) {
          setStatus((prev) => ({
            ...prev,
            isLoaded: false,
            isLoading: false,
            error: error.message || "Failed to load audio",
          }));
        }
      }
    },
    [bookId],
  );

  const toggle = async () => {
    if (!sound) return;
    if (status.isPlaying) {
      await sound.pauseAsync();
    } else {
      await sound.playAsync();
    }
  };

  const seek = async (millis: number) => {
    if (sound) {
      await sound.setPositionAsync(millis);
    }
  };

  const setRate = async (rate: number) => {
    if (sound) {
      await sound.setRateAsync(rate, true);
      setStatus((prev) => ({ ...prev, rate }));
      if (bookId) {
        await AsyncStorage.setItem(`audio_speed_${bookId}`, rate.toString());
      }
    }
  };

  const setSleepTimer = (minutes: number | null) => {
    if (sleepTimerRef.current) {
      clearInterval(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }

    if (minutes === null) {
      setStatus((prev) => ({ ...prev, sleepRemaining: null }));
      return;
    }

    const seconds = minutes * 60;
    setStatus((prev) => ({ ...prev, sleepRemaining: seconds }));

    sleepTimerRef.current = setInterval(() => {
      setStatus((prev) => {
        if (prev.sleepRemaining !== null && prev.sleepRemaining <= 1) {
          if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
          sound?.pauseAsync();
          return { ...prev, sleepRemaining: null };
        }
        return {
          ...prev,
          sleepRemaining: prev.sleepRemaining ? prev.sleepRemaining - 1 : null,
        };
      });
    }, 1000);
  };

  return {
    status,
    load,
    toggle,
    seek,
    setRate,
    setSleepTimer,
  };
};
