import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUndoStore } from '../store/useUndoStore';
import { useTranslation } from 'react-i18next';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

export const UndoSnackbar = () => {
  const { t } = useTranslation();
  const currentAction = useUndoStore((state) => state.currentAction);
  const isVisible = useUndoStore((state) => state.isVisible);
  const undo = useUndoStore((state) => state.undo);
  const commit = useUndoStore((state) => state.commit);
  
  const [shouldRender, setShouldRender] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const slideAnim = useRef(new Animated.Value(120)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isVisible && currentAction) {
      if (!shouldRender) setShouldRender(true);
      const duration = currentAction.duration || 5000;
      setTimeLeft(duration / 1000);
      
      // Animate In
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 40,
        friction: 8,
      }).start();

      // Progress bar animation
      progressAnim.setValue(1);
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: duration,
        useNativeDriver: false,
      }).start();

      // Commit timer
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        handleCommit();
      }, duration);

      // Countdown interval
      const interval = setInterval(() => {
        setTimeLeft((prev) => Math.max(0, prev - 1));
      }, 1000);

      return () => {
        clearInterval(interval);
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    } else if (shouldRender) {
      // Animate Out
      Animated.timing(slideAnim, {
        toValue: 120,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setShouldRender(false);
      });
    }
  }, [isVisible, currentAction?.id]);

  const handleUndo = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    undo();
  };

  const handleCommit = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    commit();
  };

  if (!shouldRender) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <BlurView intensity={80} tint="dark" style={styles.blurWrapper}>
        <View style={styles.content}>
          <View style={styles.leftContent}>
            <View style={styles.iconContainer}>
              <Ionicons name="information-circle" size={20} color="#3A75F2" />
            </View>
            <View>
              <Text style={styles.message} numberOfLines={2}>
                {currentAction?.message}
              </Text>
              <Text style={styles.timerText}>
                {t('common.auto_commit_in', { seconds: Math.ceil(timeLeft) })}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.undoButton}
            onPress={handleUndo}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-undo" size={16} color="#FFFFFF" />
            <Text style={styles.undoText}>{t('common.undo')}</Text>
          </TouchableOpacity>
        </View>
        
        <Animated.View 
          style={[
            styles.progressBar, 
            { 
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%']
              }) 
            }
          ]} 
        />
      </BlurView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 90 : 70,
    left: 20,
    right: 20,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  blurWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(23, 27, 43, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 20,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(58, 117, 242, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  message: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  timerText: {
    color: '#8A8F9E',
    fontSize: 10,
    marginTop: 2,
  },
  undoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3A75F2',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  undoText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 3,
    backgroundColor: '#3A75F2',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
});
