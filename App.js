import { LogBox } from 'react-native';
LogBox.ignoreAllLogs(true);

import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet, View, Text, Alert, Vibration, Platform,
  KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard,
  StatusBar, Appearance, useColorScheme, TouchableOpacity
} from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';

import MapSection from './components/MapSection';
import AlarmControls from './components/AlarmControls';


const LIGHT_COLORS = {
  bg: '#F3F4F6',
  card: '#fff',
  text: '#222',
  faintText: '#bbb',
  accent: '#2F80ED',
  buttonBg: '#28a745',
  buttonStop: '#f94b4b',
  input: '#f8f8fb',
  border: '#e4e2f4'
};
const DARK_COLORS = {
  bg: '#18192B',
  card: '#262840',
  text: '#f0f2fc',
  faintText: '#678',
  accent: '#7BB7FF',
  buttonBg: '#47d37d',
  buttonStop: '#ff4e65',
  input: '#232544',
  border: '#363973'
};

export default function App() {
  const systemScheme = useColorScheme();
  const [forceScheme, setForceScheme] = useState(null);
  const theme = forceScheme || systemScheme || 'light';
  const colors = theme === "dark" ? DARK_COLORS : LIGHT_COLORS;

  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [destination, setDestination] = useState(null);
  const [alarmRadius, setAlarmRadius] = useState(500);
  const [tracking, setTracking] = useState(false);
  const alarmTriggered = useRef(false);
  const lastAlertDismiss = useRef(Date.now());
  const [alarmCount, setAlarmCount] = useState(0);
  const soundObject = useRef(new Audio.Sound());

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

  useEffect(() => {
    if (!tracking || !destination) return;
    let interval = setInterval(() => {
      if (!location || !destination) return;
      const distance = getDistanceMeters(location, destination);
      if (
        distance <= alarmRadius &&
        !alarmTriggered.current &&
        Date.now() - lastAlertDismiss.current > 29000
      ) {
        triggerAlarm();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [tracking, destination, alarmRadius, location]);

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
              if (distance <= alarmRadius && !alarmTriggered.current) {
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
      if (subscription) subscription.remove();
    };
  }, [tracking, destination, alarmRadius]);

  const getDistanceMeters = (start, end) => {
    if (!start || !end) return 0;
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

  const handleMapPress = (e) => {
    setDestination(e.nativeEvent.coordinate);
    alarmTriggered.current = false;
    setAlarmCount(0);
  };
  const startTracking = () => {
    if (!destination) {
      Alert.alert('Set destination', 'Please tap the map or search an address to select your destination before starting the alarm.');
      return;
    }
    if (isNaN(alarmRadius) || alarmRadius < 10) {
      Alert.alert('Invalid radius', 'Please enter a valid distance (minimum 10 meters) for the alarm radius.');
      return;
    }
    setTracking(true);
    alarmTriggered.current = false;
    setAlarmCount(0);
  };
  const stopTracking = () => {
    setTracking(false);
    alarmTriggered.current = false;
    Vibration.cancel();
    if (soundObject.current) {
      soundObject.current.stopAsync().catch(() => {});
      soundObject.current.setPositionAsync(0).catch(() => {});
    }
    setAlarmCount(0);
  };
  const triggerAlarm = async () => {
    if (alarmTriggered.current) return;
    alarmTriggered.current = true;
    setAlarmCount((c) => c + 1);
    Vibration.vibrate(2000);
    try { await soundObject.current.replayAsync(); } catch (e) {}
    Alert.alert(
      "TraveRing Alert",
      "You're near your destination!\n\n"
        + (alarmCount > 0 ? `This is alert #${alarmCount + 1}.` : ""),
      [
        {
          text: "Snooze 30s",
          onPress: async () => {
            alarmTriggered.current = false;
            Vibration.cancel();
            try {
              await soundObject.current.stopAsync();
              await soundObject.current.setPositionAsync(0);
            } catch (e) {}
            lastAlertDismiss.current = Date.now();
          },
        },
        {
          text: "Stop Alarm",
          onPress: async () => {
            alarmTriggered.current = false;
            setTracking(false);
            Vibration.cancel();
            try {
              await soundObject.current.stopAsync();
              await soundObject.current.setPositionAsync(0);
            } catch (e) {}
            setAlarmCount(0);
          },
          style: "destructive"
        },
      ],
      { cancelable: false }
    );
  };

  if (errorMsg) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <StatusBar barStyle={theme === "dark" ? "light-content" : "dark-content"} />
        <Text style={[styles.errorText, { color: colors.buttonStop }]}>{errorMsg}</Text>
      </View>
    );
  }
  if (!location) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <StatusBar barStyle={theme === "dark" ? "light-content" : "dark-content"} />
        <Text style={[styles.infoText, { color: colors.text }]}>Waiting for location permission or GPS fix...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? "padding" : undefined}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
          <StatusBar barStyle={theme === "dark" ? "light-content" : "dark-content"} />
          <MapSection
            location={location}
            destination={destination}
            onMapPress={handleMapPress}
            theme={theme}
            colors={colors}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginRight: 18, marginTop: 5 }}>
            <TouchableOpacity
              onPress={() => setForceScheme(forceScheme === "dark" ? "light" : "dark")}
              style={{
                backgroundColor: colors.card,
                borderRadius: 14,
                paddingVertical: 6,
                paddingHorizontal: 15,
                borderWidth: 1,
                borderColor: colors.border,
                marginBottom: 6,
                alignItems: 'center'
              }}
              activeOpacity={0.7}
            >
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: "bold" }}>
                {theme === 'dark' ? "🌙 DARK" : "☀️ LIGHT"}
              </Text>
            </TouchableOpacity>
          </View>
          <AlarmControls
            destination={destination}
            setDestination={setDestination}
            location={location}
            alarmRadius={alarmRadius}
            setAlarmRadius={setAlarmRadius}
            tracking={tracking}
            startTracking={startTracking}
            stopTracking={stopTracking}
            getDistanceMeters={getDistanceMeters}
            theme={theme}
            colors={colors}
          />
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  errorText: { fontSize: 18, fontWeight: '600', textAlign: 'center', padding: 12 },
  infoText: { fontSize: 17, textAlign: 'center' },
});
//