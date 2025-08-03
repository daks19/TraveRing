import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, Alert, Vibration, Button, TextInput, Platform } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';

export default function App() {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [destination, setDestination] = useState(null);
  const [alarmRadius, setAlarmRadius] = useState('500');
  const [tracking, setTracking] = useState(false);
  const alarmTriggered = useRef(false);
  const soundObject = useRef(new Audio.Sound());

  // 1. On mount: request permissions and get initial location
  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Permission to access location was denied');
          return;
        }
        let initialLocation = await Location.getCurrentPositionAsync({});
        setLocation(initialLocation.coords);
        if (Platform.OS === 'ios') {
          await Notifications.requestPermissionsAsync();
        }
      } catch (e) {
        setErrorMsg('Error getting location: ' + e.message);
      }
    })();
  }, []);

  // 2. Load alarm sound on mount
  useEffect(() => {
    const loadSound = async () => {
      try {
        await soundObject.current.loadAsync(require('./assets/alarm.mp3'));
      } catch (e) {
        console.warn('Error loading sound', e);
      }
    };
    loadSound();
    return () => {
      soundObject.current.unloadAsync();
    };
  }, []);

  // 3. Location tracking effect
  useEffect(() => {
    let subscription = null;

    if (tracking && destination) {
      (async () => {
        try {
          subscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.Highest,
              timeInterval: 5000,
              distanceInterval: 5,
              mayShowUserSettingsDialog: true,
            },
            (loc) => {
              setLocation(loc.coords);
              const distance = getDistanceMeters(loc.coords, destination);
              if (distance <= parseInt(alarmRadius, 10)) {
                triggerAlarm();
              }
            }
          );
        } catch (e) {
          setErrorMsg('Error watching location: ' + e.message);
        }
      })();
    }

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
    // runs whenever tracking/destination/alarmRadius change
  }, [tracking, destination, alarmRadius]);

  // Haversine formula for distance
  const getDistanceMeters = (start, end) => {
    const toRad = (x) => (x * Math.PI) / 180;
    const R = 6378137;
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

  // Handle map press to select destination
  const handleMapPress = (e) => {
    setDestination(e.nativeEvent.coordinate);
    alarmTriggered.current = false;
  };

  // Start tracking
  const startTracking = () => {
    if (!destination) {
      Alert.alert('Set destination', 'Please tap on the map to select your destination before starting the alarm.');
      return;
    }
    if (isNaN(parseInt(alarmRadius, 10)) || parseInt(alarmRadius, 10) <= 0) {
      Alert.alert('Invalid radius', 'Please enter a valid distance in meters for the alarm radius.');
      return;
    }
    setTracking(true);
    alarmTriggered.current = false;
  };

  // Trigger alarm
  const triggerAlarm = async () => {
    if (alarmTriggered.current) return;
    alarmTriggered.current = true;
    Vibration.vibrate(2000);
    try {
      await soundObject.current.replayAsync();
    } catch (e) {
      console.warn('Could not play sound', e);
    }
    // Uncomment below ONLY if local notifications work in Expo Go
    // try {
    //   await Notifications.scheduleNotificationAsync({
    //     content: {
    //       title: "Travering Alarm",
    //       body: "You're approaching your stop! Get ready!",
    //       sound: true,
    //       priority: Notifications.AndroidNotificationPriority.HIGH,
    //     },
    //     trigger: null,
    //   });
    // } catch (e) {
    //   console.warn('Could not schedule notification', e);
    // }
    Alert.alert("Alarm", "You're near your destination!", [
      {
        text: "OK",
        onPress: () => {
          alarmTriggered.current = false;
          setTracking(false);
        },
      },
    ]);
  };

  // UI:

  if (errorMsg) {
    return (
      <View style={styles.center}>
        <Text>{errorMsg}</Text>
      </View>
    );
  }

  if (!location) {
    return (
      <View style={styles.center}>
        <Text>Waiting for location permission or GPS fix...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        showsUserLocation={true}
        followsUserLocation={true}
        onPress={handleMapPress}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}>
        {destination && <Marker coordinate={destination} title="Destination" />}
      </MapView>

      <View style={styles.controls}>
        <Text>Tap on map to select your stop</Text>
        <View style={styles.row}>
          <Text>Alarm Radius (meters): </Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={alarmRadius}
            onChangeText={setAlarmRadius}
          />
        </View>
        <Button title={tracking ? "Tracking..." : "Start Alarm"} onPress={startTracking} disabled={tracking} />
      </View>
    </View>
  );
}

// styles:
const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  map: { flex: 3 },
  controls: { flex: 2, padding: 15, backgroundColor: '#fff', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', marginVertical: 10 },
  input: { borderColor: '#aaa', borderWidth: 1, paddingHorizontal: 8, width: 80, height: 40, borderRadius: 5 },
});     
// h        h        h        h        h        h        h        h        h        h        h        h        