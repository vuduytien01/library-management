import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { membersService } from '../member-service';
import { DownloadedFile } from '../members.types';
import { haptics } from '../../../core/haptics';

interface DownloadButtonProps {
  id: string;
  title: string;
  url?: string;
  type: 'EPUB' | 'MP3';
}

export const DownloadButton: React.FC<DownloadButtonProps> = ({ id, title, url, type }) => {
  const [downloadedFile, setDownloadedFile] = useState<DownloadedFile | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    checkStatus();
  }, [id]);

  const checkStatus = async () => {
    const downloads = await membersService.getDownloads();
    const file = downloads.find((d: DownloadedFile) => d.id === id && d.type === type);
    setDownloadedFile(file || null);
  };

  const handleDownload = async () => {
    if (!url) return;
    
    if (downloadedFile) {
      haptics.warning();
      await membersService.deleteDownload(id);
      setDownloadedFile(null);
      return;
    }

    haptics.light();
    setIsDownloading(true);
    try {
      const file = await membersService.downloadFile(id, title, url, type, (p) => {
        setProgress(p);
      });
      haptics.success();
      setDownloadedFile(file);
    } catch (error) {
      haptics.error();
      console.error('Download failed:', error);
    } finally {
      setIsDownloading(false);
      setProgress(0);
    }
  };

  if (!url) return null;

  const accessibilityLabel = downloadedFile 
    ? `Tài liệu ${title} đã tải xuống. Nhấn để xóa.` 
    : `Tải xuống tài liệu ${title} định dạng ${type}.`;

  return (
    <TouchableOpacity 
      style={[
        styles.container, 
        downloadedFile && styles.downloadedContainer
      ]} 
      onPress={handleDownload}
      disabled={isDownloading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{
        busy: isDownloading,
        checked: !!downloadedFile
      }}
      accessibilityHint={downloadedFile ? "Nhấn để xóa file khỏi thiết bị" : "Nhấn để tải sách về đọc offline"}
    >
      {isDownloading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
        </View>
      ) : (
        <View style={styles.row}>
          <Ionicons 
            name={downloadedFile ? "cloud-done" : "cloud-download"} 
            size={20} 
            color="#FFFFFF" 
          />
          <Text style={styles.text}>
            {downloadedFile ? 'Offline Available' : `Download ${type}`}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#3A75F2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 150,
  },
  downloadedContainer: {
    backgroundColor: '#10B981',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 8,
  },
  progressText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 8,
  },
});

