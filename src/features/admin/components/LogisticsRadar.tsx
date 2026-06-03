import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { ProgressChart } from 'react-native-chart-kit';

const screenWidth = Dimensions.get("window").width;

interface LogisticsRadarProps {
  data: {
    labels: string[];
    data: number[];
  };
  title: string;
}

export const LogisticsRadar: React.FC<LogisticsRadarProps> = ({ data, title }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <ProgressChart
        data={data}
        width={screenWidth - 40}
        height={220}
        strokeWidth={16}
        radius={32}
        chartConfig={{
          backgroundColor: "#151929",
          backgroundGradientFrom: "#151929",
          backgroundGradientTo: "#0B0F1A",
          color: (opacity = 1) => `rgba(58, 117, 242, ${opacity})`,
          labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
        }}
        hideLegend={false}
        style={styles.chart}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#151929',
    borderRadius: 20,
    padding: 20,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#1E2540',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  chart: {
    borderRadius: 16,
    marginLeft: -10,
  }
});
