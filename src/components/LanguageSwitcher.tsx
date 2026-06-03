import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { haptics } from '../core/haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/useAuthStore';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const updateLocale = useAuthStore(state => state.updateLocale);
  
  const currentLang = i18n.language;
  const isVi = currentLang === 'vi';

  const toggleLanguage = async () => {
    haptics.light();
    const nextLang = isVi ? 'en' : 'vi';
    await i18n.changeLanguage(nextLang);
    await AsyncStorage.setItem('user-language', nextLang);
    updateLocale(nextLang);
  };

  return (
    <View style={[styles.container, { top: insets.top + 5 }]}>
      <TouchableOpacity 
        onPress={toggleLanguage}
        style={styles.button}
        activeOpacity={0.8}
      >
        <Text style={styles.text}>{isVi ? '🇻🇳 VI' : '🇺🇸 EN'}</Text>
      </TouchableOpacity>
    </View>
  );
};

export const LanguageMenuToggle = () => {
  const { i18n, t } = useTranslation();
  const updateLocale = useAuthStore(state => state.updateLocale);
  const currentLang = i18n.language;
  const isVi = currentLang === 'vi';

  const toggleLanguage = async () => {
    haptics.light();
    const nextLang = isVi ? 'en' : 'vi';
    await i18n.changeLanguage(nextLang);
    await AsyncStorage.setItem('user-language', nextLang);
    updateLocale(nextLang);
  };

  return (
    <TouchableOpacity 
      onPress={toggleLanguage}
      style={menuStyles.item}
      activeOpacity={0.7}
    >
      <View style={menuStyles.leftSection}>
        <Ionicons name="globe-outline" size={18} color="#8A8F9E" />
        <Text style={menuStyles.label}>{t('common.language')}</Text>
      </View>
      <View style={menuStyles.badge}>
        <Text style={menuStyles.badgeText}>{isVi ? 'VI' : 'EN'}</Text>
      </View>
    </TouchableOpacity>
  );
};




const menuStyles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  label: {
    color: '#E1E4ED',
    fontSize: 13,
    fontWeight: '500',
  },
  badge: {
    backgroundColor: 'rgba(58, 117, 242, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: '#3A75F2',
    fontSize: 10,
    fontWeight: 'bold',
  }
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 15,
    zIndex: 9999,
  },
  button: {
    backgroundColor: 'rgba(23, 27, 43, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(79, 142, 247, 0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});
