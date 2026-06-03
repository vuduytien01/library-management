import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Ionicons name="warning" size={80} color="#FF6B6B" />
            </View>
            <Text style={styles.title}>Hệ thống gặp sự cố</Text>
            <Text style={styles.message}>
              Đã có lỗi xảy ra trong quá trình xử lý. Đừng lo lắng, dữ liệu của bạn vẫn an toàn.
            </Text>
            {this.state.error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{this.state.error.message}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.button} onPress={this.handleReset}>
              <Text style={styles.buttonText}>Thử lại ngay</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F1A',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  iconContainer: {
    marginBottom: 20,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    padding: 30,
    borderRadius: 80,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 15,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#5A5F7A',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  errorContainer: {
    backgroundColor: '#1E2540',
    padding: 15,
    borderRadius: 12,
    marginBottom: 30,
    width: '100%',
  },
  errorText: {
    color: '#FF6B6B',
    fontFamily: 'monospace',
    fontSize: 13,
  },
  button: {
    backgroundColor: '#4F8EF7',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#4F8EF7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ErrorBoundary;
