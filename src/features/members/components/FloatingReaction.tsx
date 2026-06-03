import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withSequence,
  withDelay,
  Easing,
  runOnJS,
  withSpring
} from 'react-native-reanimated';

interface FloatingReactionProps {
  type: string;
  x: number;
}

export const FloatingReaction: React.FC<FloatingReactionProps> = ({ type, x }) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(0.5);

  const emoji = type === 'SPARKLES' ? '✨' : '🤯';

  useEffect(() => {
    opacity.value = withSequence(
      withTiming(1, { duration: 500 }),
      withDelay(1500, withTiming(0, { duration: 1000 }))
    );
    
    translateY.value = withTiming(-200, { 
      duration: 3000,
      easing: Easing.out(Easing.quad)
    });

    scale.value = withSpring(1.2);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { translateX: x },
      { scale: scale.value }
    ],
  }));

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Text style={styles.text}>{emoji}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    zIndex: 9999,
  },

  text: {
    fontSize: 32,
  },
});
