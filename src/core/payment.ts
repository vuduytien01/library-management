import * as CryptoJS from 'crypto-js';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';
import { membersService } from '../features/members/member-service';
import { haptics } from './haptics';

const SYSTEM_HMAC_SECRET = 'library_system_secure_secret_2026';

/**
 * Wallet & Digital Pass integration
 */
export const payment = {
  // Existing payment logic
  generateVietQR: (bankId: string, accountNo: string, amount: number, description: string, accountName: string = 'LIBRARY SYSTEM') => {
    const encodedName = encodeURIComponent(accountName);
    const encodedDesc = encodeURIComponent(description);
    return `https://img.vietqr.io/image/${bankId}-${accountNo}-compact.jpg?amount=${amount}&addInfo=${encodedDesc}&accountName=${encodedName}`;
  },

  signPaymentRequest: (data: object): string => {
    const message = JSON.stringify(data);
    return CryptoJS.HmacSHA256(message, SYSTEM_HMAC_SECRET).toString();
  },

  verifyPaymentSignature: (data: object, signature: string): boolean => {
    const expectedSignature = payment.signPaymentRequest(data);
    return expectedSignature === signature;
  },

  // Wallet logic moved from membersService
  addToAppleWallet: async (profile: any, cardImageUri: string) => {
    haptics.medium();
    if (Platform.OS === 'web') {
      try {
        const link = document.createElement('a');
        link.href = cardImageUri;
        link.download = `bibliotech_apple_pass_${profile?.id?.substring(0, 8) || 'pass'}.png`;
        link.click();
        Alert.alert('Thành công', 'Đã lưu thẻ thành viên vào thiết bị (Apple Pass)!');
        return true;
      } catch (e) {
        Alert.alert('Thông báo', 'Không thể tải xuống trên trình duyệt');
        return false;
      }
    }
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(cardImageUri, { dialogTitle: 'Thêm thẻ vào Apple Wallet' });
        return true;
      } else {
        Alert.alert('Thông báo', 'Tính năng chia sẻ không khả dụng trên thiết bị này');
        return false;
      }
    } catch (e) {
      Alert.alert('Lỗi', 'Không thể lưu thẻ');
      return false;
    }
  },

  addToGoogleWallet: async (profile: any, cardImageUri: string) => {
    haptics.medium();
    if (Platform.OS === 'web') {
      try {
        const link = document.createElement('a');
        link.href = cardImageUri;
        link.download = `bibliotech_google_pass_${profile?.id?.substring(0, 8) || 'pass'}.png`;
        link.click();
        Alert.alert('Thành công', 'Đã lưu thẻ thành viên vào thiết bị (Google Pass)!');
        return true;
      } catch (e) {
        Alert.alert('Thông báo', 'Không thể tải xuống trên trình duyệt');
        return false;
      }
    }
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(cardImageUri, { dialogTitle: 'Lưu thẻ vào Google Wallet' });
        return true;
      } else {
        Alert.alert('Thông báo', 'Tính năng chia sẻ không khả dụng trên thiết bị này');
        return false;
      }
    } catch (e) {
      Alert.alert('Lỗi', 'Không thể lưu thẻ');
      return false;
    }
  }
};

