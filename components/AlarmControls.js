import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Keyboard, Image
} from 'react-native';
import Slider from '@react-native-community/slider';
import * as Location from 'expo-location';

// Pre-load the icon to ensure it's available
const iconSource = require('../assets/images/icon.png');

export default function AlarmControls({
  destination,
  setDestination,
  location,
  alarmRadius,
  setAlarmRadius,
  tracking,
  startTracking,
  stopTracking,
  getDistanceMeters,
  theme,
  colors
}) {
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!search.trim() || searching) return;
    setSearching(true);
    try {
      const geocoded = await Location.geocodeAsync(search.trim());
      if (geocoded.length > 0) {
        const { latitude, longitude } = geocoded[0];
        setDestination({ latitude, longitude });
        setSearch('');
        Keyboard.dismiss();
      } else {
        alert('Location not found!');
      }
    } catch (e) {
      alert('Error searching for location.');
    } finally {
      setSearching(false);
    }
  };

  const formatDistance = (meters) =>
    meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`;

  const distance = destination && location
    ? formatDistance(getDistanceMeters(location, destination).toFixed(0))
    : null;

  return (
    <View style={[
      styles.card,
      colors ? { backgroundColor: colors.card, borderColor: colors.border } : {}
    ]}>
      <View style={styles.headerContainer}>
        <Image 
          source={iconSource}
          style={styles.logo}
          resizeMode="contain"
          defaultSource={iconSource}
          onError={(error) => {
            console.warn('Logo loading error:', error);
          }}
        />
        <Text style={[
          styles.header,
          colors ? { color: colors.text } : {}
        ]}>
          TraveRing
        </Text>
      </View>
      <View style={{ height: 18 }} />
      <View style={[
        styles.searchRow,
        colors ? { backgroundColor: colors.input, borderColor: colors.border } : {}
      ]}>
        <TextInput
          style={[
            styles.searchInput,
            colors ? { color: colors.text } : {}
          ]}
          placeholder="Search destination address"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          returnKeyType="search"
          onSubmitEditing={handleSearch}
          editable={!searching}
          placeholderTextColor={theme === "dark" ? "#888" : "#999"}
        />
        <TouchableOpacity
          onPress={handleSearch}
          disabled={searching}
          style={[
            styles.searchBtn,
            colors ? { backgroundColor: colors.accent } : {}
          ]}
          activeOpacity={0.7}
        >
          {searching
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={{ color: "#fff", fontWeight: "bold" }}>Go</Text>}
        </TouchableOpacity>
      </View>
      <Text style={[
        styles.instructions,
        colors ? { color: colors.faintText } : {}
      ]}>
        Tap the map or search an address to select your stop
      </Text>
      {!!destination && (
        <Text style={[
          styles.confirmed,
          colors ? { color: colors.accent } : {}
        ]}>
          📍 Stop set! <Text style={{ fontWeight: 'bold' }}>Distance:</Text>
          <Text> {distance}</Text>
        </Text>
      )}
      <View style={styles.row}>
        <Text style={[
          { marginRight: 10 },
          colors ? { color: colors.text } : {}
        ]}>Alarm Radius:</Text>
        <Slider
          style={{ flex: 1, marginHorizontal: 8 }}
          minimumValue={10}
          maximumValue={50000}
          step={10}
          value={alarmRadius}
          onValueChange={val => setAlarmRadius(Math.round(val))}
          minimumTrackTintColor={colors ? colors.accent : "#2F80ED"}
          maximumTrackTintColor={theme === "dark" ? "#555" : "#ccc"}
          thumbTintColor={theme === "dark" ? "#aaa" : "#F2994A"}
        />
        <Text style={[
          { width: 70, textAlign: 'center' },
          colors ? { color: colors.text } : {}
        ]}>
          {alarmRadius >= 1000
            ? (alarmRadius / 1000).toFixed(1) + ' km'
            : alarmRadius + ' m'}
        </Text>
      </View>
      <View style={styles.btnRow}>
        <TouchableOpacity
          style={[
            styles.button,
            tracking ? styles.buttonDisabled : [styles.buttonActive, colors ? { backgroundColor: colors.buttonBg } : {}]
          ]}
          onPress={startTracking}
          disabled={tracking}
          activeOpacity={0.82}
        >
          <Text style={styles.buttonText}>{tracking ? 'Tracking…' : 'Start Alarm'}</Text>
        </TouchableOpacity>
        {tracking &&
          <TouchableOpacity
            style={[styles.button, styles.buttonStop, colors ? { backgroundColor: colors.buttonStop } : {}]}
            onPress={stopTracking}
            activeOpacity={0.82}
          >
            <Text style={styles.buttonText}>Stop</Text>
          </TouchableOpacity>
        }
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    margin: 18,
    borderRadius: 16,
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 12,
    elevation: 3,
    alignItems: 'stretch',
    justifyContent: 'center',
    marginBottom: 20,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  logo: {
    width: 32,
    height: 32,
    marginRight: 8,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 0,
    marginTop: 1,
    letterSpacing: 1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  searchInput: {
    flex: 1,
    height: 44,
    paddingHorizontal: 10,
    fontSize: 17,
    backgroundColor: "transparent",
    borderWidth: 0,
    letterSpacing: 0.1,
  },
  searchBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    marginLeft: 3,
  },
  instructions: {
    marginBottom: 8,
    fontSize: 12,
    textAlign: 'center',
    fontWeight: "400",
    marginTop: -3,
  },
  confirmed: {
    marginBottom: 6,
    fontWeight: '700',
    fontSize: 15,
    textAlign: 'center'
  },
  row: { flexDirection: 'row', alignItems: 'center', marginVertical: 10 },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    alignItems: 'center',
  },
  button: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    marginHorizontal: 6,
    borderRadius: 9,
    backgroundColor: '#28a745',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    marginTop: 3,
    elevation: 2,
  },
  buttonActive: {},
  buttonDisabled: { backgroundColor: '#AAB8B8' },
  buttonStop: {},
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});
