import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface DigitalMembershipPassProps {
  member: {
    id: string;
    fullName: string;
    level: number;
    xp: number;
  };
}

const { width } = Dimensions.get('window');
const PASS_WIDTH = Math.min(width * 0.85, 420);
const PASS_HEIGHT = PASS_WIDTH * 0.62;

export const DigitalMembershipPass: React.FC<DigitalMembershipPassProps> = ({ member }) => {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1A2138', '#0F121D']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* Card Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Ionicons name="library" size={24} color="#3A75F2" />
            <Text style={styles.logoText}>BiblioTech</Text>
          </View>
          <View style={styles.chipContainer}>
            <Text style={styles.chipText}>{t('member.premium_member')}</Text>
          </View>
        </View>

        {/* Card Body */}
        <View style={styles.body}>
          <View style={styles.infoSection}>
            <Text style={styles.label}>{t('member.member_name')}</Text>
            <Text style={styles.name} numberOfLines={1}>{member.fullName}</Text>
            
            <View style={styles.metaRow}>
              <View>
                <Text style={styles.label}>{t('member.level')}</Text>
                <Text style={styles.value}>{member.level}</Text>
              </View>
              <View style={{ marginLeft: 24 }}>
                <Text style={styles.label}>{t('member.xp')}</Text>
                <Text style={styles.value}>{member.xp}</Text>
              </View>
            </View>
          </View>

          <View style={styles.qrSection}>
            <View style={styles.qrBorder}>
              <QRCode
                value={member.id}
                size={70}
                color="#FFFFFF"
                backgroundColor="transparent"
              />
            </View>
            <Text style={styles.idLabel}>{t('member.id')}: {member.id.substring(0, 8)}</Text>
          </View>
        </View>

        {/* Card Footer Decoration */}
        <View style={styles.footer}>
          <View style={styles.hologram} />
          <Text style={styles.validText}>{t('member.valid_thru')}</Text>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  card: {
    width: PASS_WIDTH,
    height: PASS_HEIGHT,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1F263B',
    justifyContent: 'space-between',
    overflow: 'hidden'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  chipContainer: {
    backgroundColor: 'rgba(58, 117, 242, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(58, 117, 242, 0.2)',
  },
  chipText: {
    color: '#3A75F2',
    fontSize: 10,
    fontWeight: 'bold',
  },
  body: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoSection: {
    flex: 1,
  },
  label: {
    color: '#5A5F7A',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  name: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
  },
  value: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  qrSection: {
    alignItems: 'center',
  },
  qrBorder: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F263B',
  },
  idLabel: {
    color: '#5A5F7A',
    fontSize: 8,
    marginTop: 6,
    fontFamily: 'monospace'
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hologram: {
    width: 30,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(58, 117, 242, 0.2)',
  },
  validText: {
    color: '#3A75F2',
    fontSize: 10,
    fontWeight: '500',
    opacity: 0.8,
  }
});
