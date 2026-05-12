import { useState, useRef, useEffect } from 'react';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { useAuthStore } from '../../store/useAuthStore';

// Định nghĩa các trạng thái của Trợ lý
export type AssistantMode = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

interface Message {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export const useAiKernel = () => {
  const [mode, setMode] = useState<AssistantMode>('idle');
  const [visualizerData, setVisualizerData] = useState<number[]>(new Array(20).fill(0));
  const [messages, setMessages] = useState<Message[]>([]);
  
  const recordingRef = useRef<Audio.Recording | null>(null);
  const visualizerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Dọn dẹp khi unmount
  useEffect(() => {
    return () => {
      if (visualizerIntervalRef.current) clearInterval(visualizerIntervalRef.current);
      if (recordingRef.current) recordingRef.current.stopAndUnloadAsync();
      Speech.stop();
    };
  }, []);

  // 1. Chức năng Thu âm (Voice Input)
  const startListening = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      recordingRef.current = recording;
      setMode('listening');

      // Giả lập dữ liệu Visualizer
      visualizerIntervalRef.current = setInterval(() => {
        const newData = new Array(20).fill(0).map(() => Math.random() * 100);
        setVisualizerData(newData);
      }, 100);

    } catch (err) {
      console.error('Failed to start recording', err);
      setMode('error');
    }
  };

  const stopListening = async () => {
    if (!recordingRef.current) return;

    setMode('thinking');
    if (visualizerIntervalRef.current) clearInterval(visualizerIntervalRef.current);
    
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      console.log('Recording stopped, saved at:', uri);

      // Ở đây chúng ta sẽ gọi STT API (ví dụ: Google Whisper hoặc Gemini 1.5 Flash)
      // Hiện tại giả lập kết quả nhận diện
      const simulatedText = "Tôi muốn tìm sách về lịch sử Việt Nam";
      sendMessage(simulatedText);

    } catch (err) {
      console.error('Failed to stop recording', err);
      setMode('error');
    } finally {
      recordingRef.current = null;
    }
  };

  // 2. Chức năng Gửi tin nhắn & Phản hồi (AI Logic)
  const sendMessage = async (text: string) => {
    setMode('thinking');
    
    // Giả lập gọi Gemini API
    setTimeout(() => {
      const aiResponse = "Chào bạn! Tôi đã tìm thấy 3 cuốn sách về Lịch sử Việt Nam trong thư viện. Bạn có muốn xem danh sách không?";
      
      setMessages(prev => [
        ...prev, 
        { role: 'user', parts: [{ text }] },
        { role: 'model', parts: [{ text: aiResponse }] }
      ]);

      // Tự động phát giọng nói (TTS)
      speak(aiResponse);
    }, 1500);
  };

  // 3. Chức năng Phát giọng nói (Voice Output)
  const speak = (text: string) => {
    setMode('speaking');
    Speech.speak(text, {
      language: 'vi-VN',
      onDone: () => setMode('idle'),
      onError: () => setMode('error'),
    });
  };

  const cancel = () => {
    Speech.stop();
    setMode('idle');
  };

  return {
    mode,
    messages,
    visualizerData,
    startListening,
    stopListening,
    sendMessage,
    cancel
  };
};
