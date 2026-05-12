import React from 'react';
import { useTranslation } from 'react-i18next';

import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

interface LogisticsMapProps {
  tasks: any[];
  mapStyle: any;
  onMarkerPress?: (task: any) => void;
}

const LogisticsMap: React.FC<LogisticsMapProps> = ({ tasks, mapStyle, onMarkerPress }) => {
  const { t } = useTranslation();
  return (
    <MapView
      style={{ flex: 1 }}
      provider={PROVIDER_GOOGLE}
      customMapStyle={mapStyle}
      initialRegion={{
        latitude: 16.0,
        longitude: 106.0,
        latitudeDelta: 12,
        longitudeDelta: 12,
      }}
    >
      {tasks.map((task) => (
        <React.Fragment key={task.id}>
          <Marker
            coordinate={task.from_branch}
            title={t('admin.from_label', { name: task.from_branch.name })}
            pinColor="#3A75F2"
            onPress={() => onMarkerPress?.(task)}
          />
          <Marker
            coordinate={task.to_branch}
            title={t('admin.to_label', { name: task.to_branch.name })}
            pinColor="#EF4444"
            onPress={() => onMarkerPress?.(task)}
          />
          <Polyline
            coordinates={[task.from_branch, task.to_branch]}
            strokeColor={task.distanceTier === 'NATIONAL' ? '#F59E0B' : '#3A75F2'}
            strokeWidth={2}
            lineDashPattern={[5, 5]}
          />
        </React.Fragment>
      ))}
    </MapView>
  );
};

export default LogisticsMap;
export { Marker, Polyline, PROVIDER_GOOGLE };
