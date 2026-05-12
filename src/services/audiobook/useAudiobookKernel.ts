import { useState, useEffect, useRef, useCallback } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { booksService } from '../../features/books/books.service';

export interface AudiobookStatus {
  isPlaying: boolean;
  position: number;
  duration: number;
  rate: number;
  currentChapter: number | null;
  isLoaded: boolean;
  sleepRemaining: number | null; // in seconds
}

export const useAudiobookKernel = (bookId?: string) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [status, setStatus] = useState<AudiobookStatus>({
    isPlaying: false,
    position: 0,
    duration: 0,
    rate: 1.0,
    currentChapter: null,
    isLoaded: false,
    sleepRemaining: null,
  });

  const sleepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentChapterRef = useRef<number | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (sound) {
        sound.unloadAsync();
      }
      if (sleepTimerRef.current) {
        clearInterval(sleepTimerRef.current);
      }
    };
  }, []);

  const onPlaybackStatusUpdate = (playbackStatus: AVPlaybackStatus) => {
    if (!playbackStatus.isLoaded || !isMounted.current) return;

    setStatus(prev => ({
      ...prev,
      isPlaying: playbackStatus.isPlaying,
      position: playbackStatus.positionMillis,
      duration: playbackStatus.durationMillis || 0,
      isLoaded: true,
    }));

    // Persistence: Save position every 10 seconds
    if (playbackStatus.positionMillis % 10000 < 500 && bookId && currentChapterRef.current) {
      AsyncStorage.setItem(`audio_pos_${bookId}_${currentChapterRef.current}`, playbackStatus.positionMillis.toString());
      AsyncStorage.setItem(`audio_chapter_${bookId}`, currentChapterRef.current.toString());
    }
  };

  const load = useCallback(async (book: any, chapterIdx: number) => {
    if (!book || !isMounted.current) return;

    currentChapterRef.current = chapterIdx;
    
    // Unload existing sound
    if (sound) {
      await sound.unloadAsync();
    }

    const audioUrl = booksService.getChapterUrl(book, chapterIdx);
    if (!audioUrl) return;

    try {
      const savedPos = await AsyncStorage.getItem(`audio_pos_${book.id}_${chapterIdx}`);
      const savedSpeed = await AsyncStorage.getItem(`audio_speed_${book.id}`);
      
      const initialPos = savedPos ? parseInt(savedPos) : 0;
      const initialSpeed = savedSpeed ? parseFloat(savedSpeed) : 1.0;

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { 
          shouldPlay: true, 
          rate: initialSpeed, 
          shouldCorrectPitch: true,
          positionMillis: initialPos
        },
        onPlaybackStatusUpdate
      );

      setSound(newSound);
      setStatus(prev => ({
        ...prev,
        rate: initialSpeed,
        currentChapter: chapterIdx,
        position: initialPos,
      }));
    } catch (error) {
      console.error('[AudiobookKernel] Failed to load sound:', error);
    }
  }, [sound, bookId]);

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
      setStatus(prev => ({ ...prev, rate }));
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
      setStatus(prev => ({ ...prev, sleepRemaining: null }));
      return;
    }

    const seconds = minutes * 60;
    setStatus(prev => ({ ...prev, sleepRemaining: seconds }));

    sleepTimerRef.current = setInterval(() => {
      setStatus(prev => {
        if (prev.sleepRemaining !== null && prev.sleepRemaining <= 1) {
          if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
          sound?.pauseAsync();
          return { ...prev, sleepRemaining: null };
        }
        return { ...prev, sleepRemaining: prev.sleepRemaining ? prev.sleepRemaining - 1 : null };
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
