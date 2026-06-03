import React, { useState } from "react";
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from "react-native-reanimated";
import { haptics } from "../core/haptics";

type PremiumTabBarItemProps = {
  route: any;
  options: any;
  label: React.ReactNode;
  isFocused: boolean;
  isHovered: boolean;
  compact: boolean;
  navigation: BottomTabBarProps["navigation"];
};

function PremiumTabBarItem({
  route,
  options,
  label,
  isFocused,
  isHovered,
  compact,
  navigation,
}: PremiumTabBarItemProps) {
  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(isHovered ? 1.15 : 1) }],
  }));

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
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={options.tabBarAccessibilityLabel}
      testID={options.tabBarTestID}
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.tabItem, compact && styles.tabItemCompact]}
    >
      <View
        style={
          isFocused
            ? [styles.activeIndicator, compact && styles.activeIndicatorCompact]
            : null
        }
      />
      <Animated.View style={iconAnimatedStyle}>
        {options.tabBarIcon &&
          options.tabBarIcon({
            focused: isFocused,
            color: isFocused ? "#4F8EF7" : "#8B8FA3",
            size: compact ? 20 : 21,
          })}
      </Animated.View>
      {!compact && (
        <Text
          style={[styles.label, { color: isFocused ? "#4F8EF7" : "#8B8FA3" }]}
          numberOfLines={1}
        >
          {label as string}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export const PremiumTabBar = ({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) => {
  const { width } = useWindowDimensions();
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const expand = useSharedValue(0); // 0 to 1 for hover expansion
  const [isHovered, setIsHovered] = useState(false);
  const ALLOWED_ROUTES = [
    "index",
    "search",
    "audiobooks",
    "audiobooks/index",
    "profile",
    "logistics",
    "inventory",
    "system",
    "reports",
    "config",
    "audit",
    "security-logs",
    "borrows",
    "books",
    "insights",
  ];

  const visibleRoutes = state.routes.filter((route) => {
    const { options } = descriptors[route.key];
    const routeName = route.name.toLowerCase();
    return (
      ALLOWED_ROUTES.includes(routeName) &&
      (options as any).href !== null &&
      typeof options.tabBarIcon === "function"
    );
  });
  const isNarrowViewport = width < 640;
  const compact =
    Platform.OS !== "web" || isNarrowViewport || visibleRoutes.length >= 4;
  const balanced = visibleRoutes.length <= 3;
  const compactWidth = Math.max(
    220,
    Math.min(width - 24, visibleRoutes.length * 72 + 28),
  );

  const animatedStyle = useAnimatedStyle(() => {
    const minHeight = compact ? 48 : 56;
    const maxHeight = Platform.OS === "web" ? (compact ? 54 : 68) : minHeight;
    return {
      transform: [{ translateY: translateY.value }],
      opacity: opacity.value,
      height: withSpring(
        interpolate(expand.value, [0, 1], [minHeight, maxHeight]),
        {
          damping: 12,
        },
      ),
      borderColor: withSpring(
        isHovered ? "rgba(79, 142, 247, 0.6)" : "rgba(255, 255, 255, 0.2)",
        { damping: 12 },
      ),
    };
  });

  const contentAnimatedStyle = useAnimatedStyle(() => {
    const minPadding = compact ? 8 : 10;
    const maxPadding = Platform.OS === "web" ? (compact ? 14 : 36) : minPadding;
    return {
      paddingHorizontal: withSpring(
        interpolate(expand.value, [0, 1], [minPadding, maxPadding]),
        { damping: 12 },
      ),
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
    translateY.value = withSpring(0, { damping: 15 });
    opacity.value = withSpring(1, { damping: 15 });
    expand.value = withSpring(0, { damping: 15 });
  };

  // Global Mouse Tracking for Web (Proximity Detection)
  const webHoverHandlers =
    Platform.OS === "web"
      ? ({
          onMouseEnter: handleHoverIn,
          onMouseLeave: handleHoverOut,
        } as any)
      : {};

  return (
    <View
      style={[styles.hitZone, compact && styles.hitZoneCompact]}
      pointerEvents="box-none" // Allow clicks to pass through to content behind
    >
      <Animated.View
        style={[
          styles.container,
          compact && styles.containerCompact,
          balanced && styles.containerBalanced,
          compact && { width: compactWidth },
          animatedStyle,
        ]}
        {...webHoverHandlers}
      >
        <BlurView
          intensity={Platform.OS === "ios" ? 85 : 95}
          tint="dark"
          style={styles.blurContainer}
        >
          {/* Top Edge Glow - Sharper and more vibrant */}
          <LinearGradient
            colors={["rgba(79, 142, 247, 0.6)", "rgba(79, 142, 247, 0)"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.topGlow}
          />

          <Animated.View
            style={[
              styles.content,
              compact && styles.contentCompact,
              contentAnimatedStyle,
            ]}
          >
            {visibleRoutes.map((route, index) => {
              const { options } = descriptors[route.key];
              const rawLabel =
                options.tabBarLabel !== undefined
                  ? options.tabBarLabel
                  : options.title !== undefined
                    ? options.title
                    : route.name;
              const label =
                typeof rawLabel === "function"
                  ? options.title || route.name
                  : rawLabel;

              const isFocused =
                state.index ===
                state.routes.findIndex((r) => r.key === route.key);

              return (
                <React.Fragment key={route.key}>
                  {/* Vertical Gradient Separator */}
                  {!compact && index > 0 && index < visibleRoutes.length && (
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

                  <PremiumTabBarItem
                    route={route}
                    options={options}
                    label={label}
                    isFocused={isFocused}
                    isHovered={isHovered}
                    compact={compact}
                    navigation={navigation}
                  />
                </React.Fragment>
              );
            })}
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
    height: Platform.OS === "web" ? 76 : 64,
    justifyContent: "flex-end",
    paddingBottom: Platform.OS === "web" ? 8 : 8,
    zIndex: 9999,
  },
  hitZoneCompact: {
    height: Platform.OS === "web" ? 68 : 60,
    paddingBottom: Platform.OS === "web" ? 8 : 6,
  },
  container: {
    alignSelf: "center",
    width: "88%",
    maxWidth: 520,
    height: 48,
    borderRadius: 24,
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
        boxShadow:
          "0 10px 40px rgba(0,0,0,0.6), inset 0 0 10px rgba(79, 142, 247, 0.1)",
      },
    }),
  },
  containerCompact: {
    width: "92%",
    maxWidth: 520,
    borderRadius: 24,
  },
  containerBalanced: {
    width: Platform.OS === "web" ? "72%" : "76%",
    maxWidth: 340,
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
    paddingHorizontal: 8,
  },
  contentCompact: {
    justifyContent: "space-between",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingVertical: 0,
  },
  tabItemCompact: {
    minWidth: 0,
    paddingVertical: 0,
  },
  activeIndicator: {
    position: "absolute",
    top: 0,
    width: 24,
    height: 2,
    backgroundColor: "#4F8EF7",
    borderRadius: 2,
    shadowColor: "#4F8EF7",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  activeIndicatorCompact: {
    top: 0,
    width: 18,
    height: 2,
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
