import React from 'react';
import Animated, { 
  FadeIn,
  FadeInDown, 
  FadeInRight, 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
} from 'react-native-reanimated';
import { Pressable, ViewStyle, StyleProp } from 'react-native';

interface AnimatedWrapperProps {
  children: React.ReactNode;
  index?: number;
  type?: 'fade' | 'slide-down' | 'slide-right' | 'scale';
  delay?: number;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  scaleOnPress?: boolean;
}

export const AnimatedWrapper: React.FC<AnimatedWrapperProps> = ({ 
  children, 
  index = 0, 
  type = 'slide-down', 
  delay = 100, 
  style,
  onPress,
  scaleOnPress = true
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (scaleOnPress) {
      scale.value = withSpring(0.96);
    }
  };

  const handlePressOut = () => {
    if (scaleOnPress) {
      scale.value = withSpring(1);
    }
  };

  const getEntranceAnimation = () => {
    switch (type) {
      case 'fade':
        return FadeInDown.delay(index * delay).duration(500);
      case 'scale':
        return FadeIn.delay(index * delay).duration(400);
      case 'slide-right':
        return FadeInRight.delay(index * delay).springify();
      case 'slide-down':
      default:
        return FadeInDown.delay(index * delay).springify().damping(12);
    }
  };

  if (onPress) {
    return (
      <Animated.View 
        entering={getEntranceAnimation()} 
        style={[style, animatedStyle]}
      >
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={({ pressed }) => [
            { opacity: pressed ? 0.9 : 1 }
          ]}
        >
          {children}
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View 
      entering={getEntranceAnimation()} 
      style={style}
    >
      {children}
    </Animated.View>
  );
};
