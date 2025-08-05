import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

export default function MapSection({ location, destination, onMapPress, theme, colors }) {
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(null);

  // Ensure location is valid before rendering map
  if (!location || !location.latitude || !location.longitude) {
    return (
      <View style={[styles.mapWrapper, styles.center, colors ? { backgroundColor: colors.card } : {}]}>
        <ActivityIndicator size="large" color={colors?.accent || "#2F80ED"} />
        <Text style={{ marginTop: 10, color: colors?.text || "#222" }}>Waiting for location...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.mapWrapper, colors ? { backgroundColor: colors.card } : {}]}>
      {mapError ? (
        <View style={[styles.center, { flex: 1 }]}>
          <Text style={{ color: colors?.buttonStop || 'red' }}>Map error: {mapError}</Text>
        </View>
      ) : (
        <MapView
          style={styles.map}
          showsUserLocation={true}
          followsUserLocation={true}
          onPress={onMapPress}
          onMapReady={() => setMapReady(true)}
          onError={(e) => setMapError(e.nativeEvent?.error || 'Unknown map error')}
          initialRegion={{
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
          }}
        >
          {destination && (
            <Marker
              coordinate={destination}
              pinColor="orange"
              title="Destination"
              description="Your selected stop"
            />
          )}
        </MapView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrapper: {
    flex: 1,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    overflow: 'hidden',
    minHeight: 220,
    marginBottom: 0,
  },
  map: {
    flex: 1,
    minHeight: 220,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  }
});
//