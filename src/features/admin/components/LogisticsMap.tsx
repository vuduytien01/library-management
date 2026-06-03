import React from "react";
import { useTranslation } from "react-i18next";
import { View, StyleSheet, Platform, Text, ImageBackground } from "react-native";
import Svg, { 
  Path, 
  Circle, 
  Line, 
  Defs, 
  RadialGradient, 
  Stop, 
  Text as SvgText, 
  G, 
  Rect,
  Filter,
  FeGaussianBlur,
  FeOffset,
  FeMerge,
  FeMergeNode
} from "react-native-svg";

// Using the premium image as the background asset
const MAP_BACKGROUND = require("../../../../assets/images/logistics_map_bg.png");

interface LogisticsMapProps {
  tasks: any[];
  mapStyle?: any;
  onMarkerPress?: (task: any) => void;
  hoveredTaskId?: string | null;
}

const LogisticsMap: React.FC<LogisticsMapProps> = ({
  tasks,
  mapStyle,
  onMarkerPress,
  hoveredTaskId,
}) => {
  const { t } = useTranslation();

  const renderWebView = () => {
    const hubs: Record<string, { x: number; y: number; isCity?: boolean }> = {
      "TP. Hà Nội": { x: 210, y: 120, isCity: true },
      "TP. Hải Phòng": { x: 240, y: 140, isCity: true },
      "TP. Đà Nẵng": { x: 280, y: 320, isCity: true },
      "TP. Huế": { x: 230, y: 280, isCity: true },
      "TP. Hồ Chí Minh": { x: 200, y: 480, isCity: true },
      "TP. Cần Thơ": { x: 170, y: 520, isCity: true },
    };

    const getHubPos = (name: string) => {
      const match = Object.keys(hubs).find(h => h === name || name?.includes(h) || h.includes(name));
      return match ? hubs[match] : hubs["TP. Đà Nẵng"];
    };

    return (
      <ImageBackground source={MAP_BACKGROUND} style={styles.webContainer} imageStyle={styles.bgImage}>
        <Svg height="100%" width="100%" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid meet" style={styles.svgMap}>
          <Defs>
            <Filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
              <FeGaussianBlur in="SourceAlpha" stdDeviation="3" />
              <FeOffset dx="0" dy="0" result="offsetblur" />
              <FeMerge>
                <FeMergeNode />
                <FeMergeNode in="SourceGraphic" />
              </FeMerge>
            </Filter>
            <RadialGradient id="glowEffect" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor="#4facfe" stopOpacity="0.5" />
              <Stop offset="100%" stopColor="#4facfe" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="cityGlowEffect" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor="#ff0844" stopOpacity="0.6" />
              <Stop offset="100%" stopColor="#ff0844" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="goldGlow" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor="#fbbf24" stopOpacity="0.6" />
              <Stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
            </RadialGradient>
          </Defs>

          {/* Transparent Overlay Grid */}
          {[...Array(13)].map((_, i) => (
            <Line key={`h-${i}`} x1="0" y1={i * 50} x2="400" y2={i * 50} stroke="#ffffff" strokeWidth="0.2" opacity="0.05" />
          ))}
          {[...Array(9)].map((_, i) => (
            <Line key={`v-${i}`} x1={i * 50} y1="0" x2={i * 50} y2="600" stroke="#ffffff" strokeWidth="0.2" opacity="0.05" />
          ))}

          {/* Maritime Sovereignty - Hoàng Sa */}
          <G>
            <Circle cx="330" cy="280" r="12" fill="url(#goldGlow)" opacity="0.3" />
            <Circle cx="330" cy="280" r="2" fill="#fbbf24" />
            <SvgText x="330" y="300" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle" opacity="0.5">
              {t("admin.hoang_sa")}
            </SvgText>
          </G>

          {/* Maritime Sovereignty - Trường Sa */}
          <G>
            <Circle cx="300" cy="500" r="12" fill="url(#goldGlow)" opacity="0.3" />
            <Circle cx="300" cy="500" r="2" fill="#fbbf24" />
            <SvgText x="300" y="520" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle" opacity="0.5">
              {t("admin.truong_sa")}
            </SvgText>
          </G>

          {/* Animated Shipping Flow Arcs */}
          {tasks.map((task, i) => {
            const start = getHubPos(task.from_province || (task.from_branch && task.from_branch.name));
            const end = getHubPos(task.to_province || (task.to_branch && task.to_branch.name));
            if (!start || !end || isNaN(start.x) || isNaN(end.x)) return null;

            const isHovered = hoveredTaskId === task.id;
            const midX = (start.x + end.x) / 2 + (start.x < end.x ? 40 : -40);
            const midY = (start.y + end.y) / 2 - 30;

            return (
              <Path
                key={`flow-${task.id || i}`}
                d={`M ${start.x} ${start.y} Q ${midX} ${midY} ${end.x} ${end.y}`}
                stroke={isHovered ? "#fbbf24" : "#4facfe"}
                strokeWidth={isHovered ? 3.5 : 1.5}
                fill="none"
                strokeDasharray={isHovered ? [10, 5] : [4, 6]}
                opacity={isHovered ? 1.0 : 0.15}
              />
            );
          })}

          {/* Hub Markers Overlay */}
          {Object.entries(hubs).map(([name, pos]) => (
            <G key={name}>
              {pos.isCity && (
                <Circle cx={pos.x} cy={pos.y} r={10} fill="url(#cityGlowEffect)" />
              )}
              <Circle 
                cx={pos.x} 
                cy={pos.y} 
                r={pos.isCity ? 6 : 1.5} 
                fill={pos.isCity ? "transparent" : "#4facfe"} 
                stroke={pos.isCity ? "#ff0844" : "transparent"}
                strokeWidth={pos.isCity ? 1.5 : 0}
                opacity={pos.isCity ? 0.8 : 0.4}
              />
              <SvgText
                x={pos.x + 8}
                y={pos.y + 4}
                fill="#4facfe"
                fontSize={pos.isCity ? 9 : 6}
                fontWeight={pos.isCity ? "bold" : "normal"}
                opacity={pos.isCity ? 0.9 : 0.4}
              >
                {name}
              </SvgText>
            </G>
          ))}
        </Svg>

        <View style={styles.webLegend}>
          <Text style={styles.legendTitle}>{t("admin.logistics_command_center")}</Text>
          <View style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: "#ff0844" }]} />
            <Text style={styles.legendText}>{t("admin.central_city_hub")}</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: "#fbbf24" }]} />
            <Text style={styles.legendText}>{t("admin.sovereignty_active")}</Text>
          </View>
        </View>
      </ImageBackground>
    );
  };

  return renderWebView();
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: 600,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  webContainer: {
    flex: 1,
    height: '100%',
    width: '100%',
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1e293b',
    position: 'relative',
    backgroundColor: '#0B0F1A',
  },
  bgImage: {
    resizeMode: 'contain',
    opacity: 0.9,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  svgMap: {
    backgroundColor: 'transparent',
  },
  webLegend: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    backgroundColor: 'rgba(10, 14, 23, 0.85)',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(79, 172, 254, 0.3)',
  },
  legendTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  legendText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
});

export default LogisticsMap;
