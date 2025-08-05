import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

export default function RecentDestinations({ 
  onDestinationSelect, 
  theme, 
  colors,
  currentLocation 
}) {
  const [recentDestinations, setRecentDestinations] = useState([]);
  const [isVisible, setIsVisible] = useState(false);

  // Load recent destinations from storage
  useEffect(() => {
    loadRecentDestinations();
  }, []);

  const loadRecentDestinations = async () => {
    try {
      const stored = await AsyncStorage.getItem('recentDestinations');
      if (stored) {
        setRecentDestinations(JSON.parse(stored));
      }
    } catch (error) {
      console.warn('Error loading recent destinations:', error);
    }
  };

  const saveRecentDestinations = async (destinations) => {
    try {
      await AsyncStorage.setItem('recentDestinations', JSON.stringify(destinations));
    } catch (error) {
      console.warn('Error saving recent destinations:', error);
    }
  };

  // Add a new destination to recent list
  const addRecentDestination = async (destination, name = null) => {
    try {
      let destinationName = name;
      
      // If no name provided, try to get address from coordinates
      if (!destinationName) {
        try {
          const reverseGeocode = await Location.reverseGeocodeAsync({
            latitude: destination.latitude,
            longitude: destination.longitude
          });
          
          if (reverseGeocode.length > 0) {
            const address = reverseGeocode[0];
            destinationName = `${address.street || ''} ${address.city || ''}`.trim() || 
                            `${destination.latitude.toFixed(4)}, ${destination.longitude.toFixed(4)}`;
          }
        } catch (e) {
          destinationName = `${destination.latitude.toFixed(4)}, ${destination.longitude.toFixed(4)}`;
        }
      }

      const newDestination = {
        id: Date.now().toString(),
        coordinate: destination,
        name: destinationName,
        timestamp: new Date().toISOString()
      };

      // Remove duplicates (within 100m radius)
      const filtered = recentDestinations.filter(item => {
        const distance = getDistanceMeters(item.coordinate, destination);
        return distance > 100; // Only keep if more than 100m away
      });

      // Add new destination at the beginning and limit to 10 items
      const updated = [newDestination, ...filtered].slice(0, 10);
      
      setRecentDestinations(updated);
      await saveRecentDestinations(updated);
    } catch (error) {
      console.warn('Error adding recent destination:', error);
    }
  };

  // Calculate distance between two coordinates
  const getDistanceMeters = (start, end) => {
    if (!start || !end) return 0;
    const toRad = (x) => (x * Math.PI) / 180;
    const R = 6378137; // Earth's radius in meters
    const dLat = toRad(end.latitude - start.latitude);
    const dLon = toRad(end.longitude - start.longitude);
    const lat1 = toRad(start.latitude);
    const lat2 = toRad(end.latitude);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Format distance for display
  const formatDistance = (meters) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(meters)} m`;
  };

  // Handle destination selection
  const handleDestinationPress = (destination) => {
    onDestinationSelect(destination.coordinate);
    setIsVisible(false);
  };

  // Remove destination from recent list
  const removeDestination = (id) => {
    Alert.alert(
      'Remove Destination',
      'Are you sure you want to remove this destination from your recent list?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const updated = recentDestinations.filter(item => item.id !== id);
            setRecentDestinations(updated);
            await saveRecentDestinations(updated);
          }
        }
      ]
    );
  };

  // Clear all recent destinations
  const clearAll = () => {
    Alert.alert(
      'Clear All',
      'Are you sure you want to clear all recent destinations?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            setRecentDestinations([]);
            await saveRecentDestinations([]);
          }
        }
      ]
    );
  };

  const renderDestinationItem = ({ item }) => {
    const distance = currentLocation ? 
      formatDistance(getDistanceMeters(currentLocation, item.coordinate)) : '';
    
    const timeAgo = getTimeAgo(item.timestamp);

    return (
      <TouchableOpacity
        style={[styles.destinationItem, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => handleDestinationPress(item)}
        onLongPress={() => removeDestination(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.destinationInfo}>
          <Text style={[styles.destinationName, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.destinationMeta}>
            <Text style={[styles.metaText, { color: colors.faintText }]}>
              {timeAgo}
            </Text>
            {distance && (
              <Text style={[styles.metaText, { color: colors.faintText }]}>
                • {distance} away
              </Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={[styles.removeButton, { backgroundColor: colors.buttonStop + '20' }]}
          onPress={() => removeDestination(item.id)}
        >
          <Text style={[styles.removeButtonText, { color: colors.buttonStop }]}>×</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const getTimeAgo = (timestamp) => {
    const now = new Date();
    const past = new Date(timestamp);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return past.toLocaleDateString();
  };

  // Expose the addRecentDestination function
  RecentDestinations.addRecentDestination = addRecentDestination;

  if (!isVisible || recentDestinations.length === 0) {
    return (
      <TouchableOpacity
        style={[styles.toggleButton, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => setIsVisible(!isVisible)}
      >
        <Text style={[styles.toggleButtonText, { color: colors.text }]}>
          📍 Recent Destinations ({recentDestinations.length})
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setIsVisible(false)}>
          <Text style={[styles.collapseButton, { color: colors.accent }]}>▼</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Recent Destinations</Text>
        <TouchableOpacity onPress={clearAll}>
          <Text style={[styles.clearButton, { color: colors.buttonStop }]}>Clear All</Text>
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={recentDestinations}
        renderItem={renderDestinationItem}
        keyExtractor={(item) => item.id}
        style={styles.list}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    maxHeight: 300,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  toggleButton: {
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  toggleButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  collapseButton: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  clearButton: {
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    maxHeight: 240,
  },
  destinationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  destinationInfo: {
    flex: 1,
  },
  destinationName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  destinationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    marginRight: 8,
  },
  removeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  separator: {
    height: 1,
    marginHorizontal: 16,
  },
});
