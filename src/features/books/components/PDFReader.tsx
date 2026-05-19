import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native";

import { WebView } from "react-native-webview"; // Cần cài react-native-webview
import { Ionicons } from "@expo/vector-icons";
import * as Sharing from "expo-sharing";
import { membersService } from "../../members/member-service";
import NetInfo from "@react-native-community/netinfo";

interface PDFReaderProps {
  url: string;
  title: string;
  isbn?: string; // Add ISBN to link annotations
  onClose: () => void;
}

export const PDFReader: React.FC<PDFReaderProps> = ({
  url,
  title,
  isbn,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [localUri, setLocalUri] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  React.useEffect(() => {
    const checkLocalAndNetwork = async () => {
      const netState = await NetInfo.fetch();
      setIsOffline(!netState.isConnected);

      if (isbn) {
        const local = await membersService.getLocalUri(isbn);
        if (local) setLocalUri(local);
      }
    };
    checkLocalAndNetwork();
  }, [isbn]);

  const finalUrl = localUri || url;
  const isLocal = !!localUri;

  // PDF Viewer URL (sử dụng Google Docs Viewer làm proxy cho mobile WebView nếu không có native PDF component)
  // Lưu ý: Google Viewer KHÔNG hoạt động với file cục bộ hoặc khi ngoại tuyến
  const viewerUrl =
    isLocal || isOffline
      ? finalUrl
      : `https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(url)}`;

  const handleOpenExternally = async () => {
    if (isLocal) {
      await Sharing.shareAsync(localUri!);
    } else {
      Alert.alert(
        "Chưa tải về",
        "Bạn cần tải sách về máy để mở bằng ứng dụng bên ngoài.",
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => setShowNoteInput(true)}
        >
          <Ionicons name="create-outline" size={24} color="#3A75F2" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={handleOpenExternally}
          accessibilityLabel="Mở bằng ứng dụng khác"
        >
          <Ionicons name="open-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {showNoteInput && (
        <View style={styles.noteModalOverlay}>
          <View style={styles.noteModalCard}>
            <Text style={styles.noteModalTitle}>Thêm ghi chú cộng đồng</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="Bạn muốn chia sẻ điều gì về đoạn này?"
              placeholderTextColor="#5A5F7A"
              value={noteText}
              onChangeText={setNoteText}
              multiline
              autoFocus
            />
            <View style={styles.noteModalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowNoteInput(false)}
              >
                <Text style={styles.cancelBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, !noteText.trim() && styles.disabledBtn]}
                disabled={!noteText.trim() || isSubmitting}
                onPress={async () => {
                  if (!isbn) return;
                  setIsSubmitting(true);
                  try {
                    // We'll need to use the hook or service here
                    // Since this is a component, it's better to pass an onAddAnnotation prop or use the service directly
                    await membersService.createAnnotation({
                      book_isbn: isbn,
                      content: noteText.trim(),
                      location: { page: "current" },
                      color: "#3A75F2",
                      is_public: true,
                    });
                    setNoteText("");
                    setShowNoteInput(false);
                  } catch (err) {
                    console.error("Save note error:", err);
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.saveBtnText}>Chia sẻ</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <View style={styles.webViewContainer}>
        <WebView
          source={{ uri: viewerUrl }}
          style={styles.webView}
          onLoadEnd={() => setLoading(false)}
          scalesPageToFit={true}
        />
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3A75F2" />
            <Text style={styles.loadingText}>Đang tải tài liệu...</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F121D",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1F263B",
  },
  backBtn: {
    padding: 8,
  },
  title: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
    marginHorizontal: 12,
  },
  actionBtn: {
    padding: 8,
  },
  webViewContainer: {
    flex: 1,
  },
  webView: {
    flex: 1,
    backgroundColor: "#0F121D",
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0F121D",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#8A8F9E",
    marginTop: 12,
    fontSize: 14,
  },
  noteModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    zIndex: 100,
  },
  noteModalCard: {
    width: "100%",
    backgroundColor: "#171B2B",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "#1F263B",
  },
  noteModalTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  noteInput: {
    backgroundColor: "#0F121D",
    borderRadius: 12,
    padding: 16,
    color: "#FFFFFF",
    fontSize: 14,
    height: 120,
    textAlignVertical: "top",
    marginBottom: 20,
  },
  noteModalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  cancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  cancelBtnText: {
    color: "#8A8F9E",
    fontSize: 14,
    fontWeight: "600",
  },
  saveBtn: {
    backgroundColor: "#3A75F2",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  disabledBtn: {
    opacity: 0.5,
  },
});
