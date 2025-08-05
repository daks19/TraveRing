// Error boundary component to catch crashes in production builds
import React from 'react';
import { View, Text, Button, StyleSheet, SafeAreaView } from 'react-native';

class ErrorBoundary extends React.Component {
  state = { hasError: false, errorMsg: '' };
  
  static getDerivedStateFromError(error) {
    return { hasError: true, errorMsg: error.toString() };
  }
  
  componentDidCatch(error, info) {
    console.error("App crashed:", error, info);
  }
  
  restartApp = () => {
    // Reset error state
    this.setState({ hasError: false, errorMsg: '' });
    
    // Try to flush any pending updates or cache that might be problematic
    try {
      // Clear any app-specific storage that might be causing issues
      // This is a good place to clear problematic cached data
      
      // Force immediate render cycle
      setTimeout(() => {
        this.forceUpdate();
      }, 100);
    } catch (e) {
      console.error('Error during app restart:', e);
    }
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>
            {this.state.errorMsg && this.state.errorMsg.length > 100
              ? this.state.errorMsg.substring(0, 100) + '...'
              : this.state.errorMsg}
          </Text>
          <View style={styles.buttonContainer}>
            <Button 
              title="Restart App" 
              onPress={this.restartApp} 
            />
          </View>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f8f8', // Light background that works in light/dark mode
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#e74c3c', // Error red color
  },
  errorText: {
    fontSize: 14,
    marginBottom: 25,
    textAlign: 'center',
    color: '#333',
    lineHeight: 20,
  },
  buttonContainer: {
    width: '60%',
    marginTop: 10,
  }
});

export default ErrorBoundary;
