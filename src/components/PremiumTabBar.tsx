import React, { useState, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
  Dimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useTranslation } from "react-i18next";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  interpolate
} from "react-native-reanimated";
import { haptics } from "../core/haptics";

const { width } = Dimensions.get("window");

export const PremiumTabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  const { t } = useTranslation();
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const expand = useSharedValue(0); // 0 to 1 for hover expansion
  const [isHovered, setIsHovered] = useState(false);

  // Initial animation on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isHovered) {
        translateY.value = withSpring(Platform.OS === 'web' ? 80 : 0, { damping: 15 });
        opacity.value = withSpring(0.6, { damping: 15 });
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
      opacity: opacity.value,
      height: withSpring(interpolate(expand.value, [0, 1], [70, 85]), { damping: 12 }),
      marginHorizontal: withSpring(interpolate(expand.value, [0, 1], [16, 8]), { damping: 12 }),
      borderColor: withSpring(isHovered ? "rgba(79, 142, 247, 0.6)" : "rgba(255, 255, 255, 0.2)", { damping: 12 }),
    };
  });

  const contentAnimatedStyle = useAnimatedStyle(() => {
    return {
      paddingHorizontal: withSpring(interpolate(expand.value, [0, 1], [10, 45]), { damping: 12 }),
    };
  });

  const handleHoverIn = () => {
    setIsHovered(true);
    translateY.value = withSpring(0, { damping: 12, stiffness: 90 });
    opacity.value = withSpring(1, { damping: 12 });
    expand.value = withSpring(1, { damping: 12 });
  };

  const handleHoverOut = () => {
    setIsHovered(false);
    translateY.value = withSpring(Platform.OS === 'web' ? 80 : 0, { damping: 15 });
    opacity.value = withSpring(0.6, { damping: 15 });
    expand.value = withSpring(0, { damping: 15 });
  };

  // Global Mouse Tracking for Web (Proximity Detection)
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleMouseMove = (e: MouseEvent) => {
      const threshold = window.innerHeight - 400; // Increased proximity threshold to 400px (was 300)
      if (e.clientY > threshold) {
        if (!isHovered) handleHoverIn();
      } else {
        if (isHovered) handleHoverOut();
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isHovered]);

  return (
    <View 
      style={styles.hitZone}
      pointerEvents="box-none" // Allow clicks to pass through to content behind
    >
      <Animated.View style={[styles.container, animatedStyle]}>
        <BlurView intensity={Platform.OS === 'ios' ? 85 : 95} tint="dark" style={styles.blurContainer}>
          {/* Top Edge Glow - Sharper and more vibrant */}
          <LinearGradient
            colors={["rgba(79, 142, 247, 0.6)", "rgba(79, 142, 247, 0)"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.topGlow}
          />

          <Animated.View style={[styles.content, contentAnimatedStyle]}>
            {(() => {
              // 1. Pre-filter visible routes
              const ALLOWED_ROUTES = [
                "index", "search", "audiobooks", "audiobooks/index", "profile", // Member - Core only
                "logistics", "inventory", "system", "reports", "config", "audit", "security-logs", // Admin
                "borrows", "books", "insights" // Librarian
              ];

              const visibleRoutes = state.routes.filter(route => {
                const { options } = descriptors[route.key];
                const routeName = route.name.toLowerCase();
                return ALLOWED_ROUTES.includes(routeName) && (options as any).href !== null;
              });

              return visibleRoutes.map((route, index) => {
                const { options } = descriptors[route.key];
                const label =
                  options.tabBarLabel !== undefined
                    ? options.tabBarLabel
                    : options.title !== undefined
                    ? options.title
                    : route.name;

                const isFocused = state.index === state.routes.findIndex(r => r.key === route.key);

              const onPress = () => {
                haptics.light();
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              };

              const onLongPress = () => {
                navigation.emit({
                  type: "tabLongPress",
                  target: route.key,
                });
              };

              return (
                <React.Fragment key={route.key}>
                  {/* Vertical Gradient Separator */}
                  {index > 0 && index < visibleRoutes.length && (
                    <View style={styles.separatorContainer}>
                      <LinearGradient
                        colors={[
                          "rgba(255, 255, 255, 0)",
                          "rgba(255, 255, 255, 0.2)",
                          "rgba(255, 255, 255, 0)",
                        ]}
                        style={styles.separator}
                      />
                    </View>
                  )}

                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityState={isFocused ? { selected: true } : {}}
                    accessibilityLabel={options.tabBarAccessibilityLabel}
                    testID={(options as any).tabBarTestID}
                    onPress={onPress}
                    onLongPress={onLongPress}
                    style={styles.tabItem}
                  >
                    <View style={isFocused ? styles.activeIndicator : null} />
                    <Animated.View style={useAnimatedStyle(() => ({
                      transform: [{ scale: withSpring(isHovered ? 1.15 : 1) }]
                    }))}>
                      {options.tabBarIcon &&
                        options.tabBarIcon({
                          focused: isFocused,
                          color: isFocused ? "#4F8EF7" : "#8B8FA3",
                          size: 24,
                        })}
                    </Animated.View>
                    <Text
                      style={[
                        styles.label,
                        { color: isFocused ? "#4F8EF7" : "#8B8FA3" },
                      ]}
                      numberOfLines={1}
                    >
                      {label as string}
                    </Text>
                  </TouchableOpacity>
                </React.Fragment>
              );
            });
          })()}
          </Animated.View>
        </BlurView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  hitZone: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 350, // Significantly larger hit area (up from 200)
    justifyContent: "flex-end",
    paddingBottom: 20,
    zIndex: 9999,
  },
  container: {
    marginHorizontal: 16,
    height: 70,
    borderRadius: 35,
    overflow: "hidden",
    backgroundColor: "rgba(11, 15, 26, 0.9)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.15)", // Sharper border
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
      web: {
        // @ts-ignore
        boxShadow: "0 10px 40px rgba(0,0,0,0.6), inset 0 0 10px rgba(79, 142, 247, 0.1)",
      }
    }),
  },
  blurContainer: {
    flex: 1,
    borderRadius: 35,
  },
  topGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  activeIndicator: {
    position: "absolute",
    top: -4,
    width: 30,
    height: 3,
    backgroundColor: "#4F8EF7",
    borderRadius: 2,
    shadowColor: "#4F8EF7",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: "800",
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  separatorContainer: {
    width: 1,
    height: "50%",
    justifyContent: "center",
  },
  separator: {
    flex: 1,
    width: 1,
  },
});
