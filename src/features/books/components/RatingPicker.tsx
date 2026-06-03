import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface RatingPickerProps {
  rating: number;
  onRatingChange: (rating: number) => void;
  maxRating?: number;
  size?: number;
  color?: string;
  disabled?: boolean;
}

export const RatingPicker: React.FC<RatingPickerProps> = ({
  rating,
  onRatingChange,
  maxRating = 5,
  size = 24,
  color = '#F59E0B',
  disabled = false
}) => {
  return (
    <View style={styles.container}>
      {[...Array(maxRating)].map((_, index) => {
        const starValue = index + 1;
        return (
          <TouchableOpacity
            key={index}
            disabled={disabled}
            onPress={() => onRatingChange(starValue)}
            activeOpacity={0.7}
            style={styles.star}
          >
            <Ionicons
              name={starValue <= rating ? 'star' : 'star-outline'}
              size={size}
              color={starValue <= rating ? color : '#3D4260'}
            />
          </TouchableOpacity>
        );
      })}
      <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  star: {
    padding: 2,
  },
  ratingText: {
    color: '#8B8FA3',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  }
});
