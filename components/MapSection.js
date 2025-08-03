import React from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

export default function MapSection({ location, destination, onMapPress, theme, colors }) {
  return (
    <View style={[styles.mapWrapper, colors ? { backgroundColor: colors.card } : {}]}>
      <MapView
        style={styles.map}
        showsUserLocation={true}
        followsUserLocation={true}
        onPress={onMapPress}
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
  }
});
//