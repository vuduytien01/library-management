import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

interface CameraScannerProps {
  onScan: (data: string, type: string) => void;
  onClose: () => void;
  title?: string;
}

export default function CameraScanner({
  onScan,
  onClose,
  title,
}: CameraScannerProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [manualIsbn, setManualIsbn] = useState("");
  const [permissionGrantedOverride, setPermissionGrantedOverride] = useState<
    boolean | null
  >(null);

  useEffect(() => {
    if (
      !permission ||
      (permission.status === "undetermined" && permission.canAskAgain)
    ) {
      requestPermission();
    }
  }, [permission]);

  const handleManualSubmit = () => {
    const cleanIsbn = manualIsbn.trim();
    if (cleanIsbn.length >= 10) {
      onScan(cleanIsbn, "manual");
    }
  };

  const isGranted =
    permissionGrantedOverride !== null
      ? permissionGrantedOverride
      : permission?.granted;
  const scanSize = Math.min(320, Math.max(220, width * 0.7));

  if (!permission) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={[styles.text, { marginTop: 12 }]}>
          {t("common.loading")}
        </Text>
      </View>
    );
  }

  if (!isGranted) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", padding: 24, backgroundColor: "#0F111A" },
        ]}
      >
        <View style={styles.permissionIconContainer}>
          <Ionicons name="camera-outline" size={80} color="#3B82F6" />
        </View>

        <Text style={styles.deniedTitle}>
          {t("messages.camera_permission_denied")}
        </Text>
        <Text style={styles.deniedSub}>
          {t("librarian.camera_denied_hint") ||
            "Ứng dụng cần quyền truy cập camera để quét mã vạch. Bạn có thể cấp quyền lại hoặc nhập mã ISBN thủ công."}
        </Text>

        <View style={styles.manualInputGroup}>
          <Text style={styles.inputLabel}>Nhập mã ISBN thủ công</Text>
          <View style={styles.manualInputContainer}>
            <TextInput
              style={styles.input}
              placeholder="9780123456789..."
              placeholderTextColor="#5A5F7A"
              keyboardType="numeric"
              value={manualIsbn}
              onChangeText={setManualIsbn}
              onSubmitEditing={handleManualSubmit}
            />
            {manualIsbn.length >= 10 && (
              <TouchableOpacity
                onPress={handleManualSubmit}
                style={styles.submitInnerBtn}
              >
                <Ionicons name="arrow-forward" size={24} color="white" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.actionButtons}>
          {permission.canAskAgain && !permission.granted ? (
            <TouchableOpacity onPress={requestPermission} style={styles.button}>
              <Text style={styles.buttonText}>
                {t("common.grant_permission")}
              </Text>
            </TouchableOpacity>
          ) : (
            permission.granted &&
            permissionGrantedOverride === false && (
              <TouchableOpacity
                onPress={() => setPermissionGrantedOverride(true)}
                style={styles.button}
              >
                <Text style={styles.buttonText}>Sử dụng Camera</Text>
              </TouchableOpacity>
            )
          )}

          <TouchableOpacity onPress={onClose} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>{t("common.close")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleBarcodeScanned = ({
    type,
    data,
  }: {
    type: string;
    data: string;
  }) => {
    if (scanned) return;
    setScanned(true);
    onScan(data, type);
    // Auto reset after 2 seconds to allow consecutive scans if needed
    setTimeout(() => setScanned(false), 2000);
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr", "ean13", "code128"],
        }}
      >
        <View style={styles.overlay}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Đóng camera"
            >
              <Ionicons name="close" size={28} color="white" />
            </TouchableOpacity>
            <Text style={styles.title} accessibilityRole="header">
              {title || t("common.scan")}
            </Text>
            <TouchableOpacity
              onPress={() => setPermissionGrantedOverride(false)}
              style={styles.manualToggleBtn}
              accessibilityRole="button"
              accessibilityLabel="Chuyển sang nhập thủ công"
            >
              <Ionicons name="keypad-outline" size={24} color="white" />
            </TouchableOpacity>
          </View>

          <View style={styles.scanAreaContainer}>
            <View
              style={[styles.scanArea, { width: scanSize, height: scanSize }]}
            >
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
              {scanned && <View style={styles.scanSuccessLine} />}
            </View>
          </View>

          <Text style={styles.hint}>{t("librarian.scan_hint")}</Text>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "space-between",
    paddingVertical: 60,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  title: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
  },
  closeBtn: {
    padding: 10,
  },
  manualToggleBtn: {
    padding: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
  },
  scanAreaContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  scanArea: {
    borderWidth: 0,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 20,
    height: 20,
    borderColor: "#3B82F6",
    borderWidth: 4,
  },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  hint: {
    color: "#8B8FA3",
    textAlign: "center",
    fontSize: 14,
    paddingHorizontal: 40,
  },
  text: {
    color: "white",
    textAlign: "center",
    marginBottom: 20,
  },
  permissionIconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 32,
  },
  deniedTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 12,
  },
  deniedSub: {
    color: "#8B8FA3",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 40,
  },
  manualInputGroup: {
    width: "100%",
    marginBottom: 40,
  },
  inputLabel: {
    color: "#8B8FA3",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
  },
  manualInputContainer: {
    backgroundColor: "#171B2B",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2D354E",
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 20,
    height: 64,
  },
  input: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  submitInnerBtn: {
    backgroundColor: "#3B82F6",
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  actionButtons: {
    width: "100%",
    gap: 16,
  },
  button: {
    backgroundColor: "#3B82F6",
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2D354E",
  },
  secondaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  settingsHint: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(139, 143, 163, 0.05)",
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  settingsText: {
    flex: 1,
    color: "#8B8FA3",
    fontSize: 14,
    lineHeight: 20,
  },
  scanSuccessLine: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "#10B981",
    shadowColor: "#10B981",
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 5,
  },
});
