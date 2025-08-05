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
import { Asset } from 'expo-asset';

// Configure audio session for the app
Audio.setAudioModeAsync({
  allowsRecordingIOS: false,
  staysActiveInBackground: true,
  interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DUCK_OTHERS,
  playsInSilentModeIOS: true,
  shouldDuckAndroid: true,
  interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DUCK_OTHERS,
  playThroughEarpieceAndroid: false,
});

import MapSection from './components/MapSection';
import AlarmControls from './components/AlarmControls';
import ErrorBoundary from './components/ErrorBoundary';
import RecentDestinations from './components/RecentDestinations';


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

  // Initialize sound with better error handling and retry logic
  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;
    
    const loadSound = async () => {
      if (retryCount >= maxRetries) {
        console.warn('Maximum sound loading retries reached');
        return;
      }
      
      try {
        console.log('Attempting to load sound (attempt ' + (retryCount + 1) + ')');
        
        // Ensure sound is unloaded before attempting to load
        try {
          const status = await soundObject.current.getStatusAsync();
          if (status.isLoaded) {
            await soundObject.current.unloadAsync();
          }
        } catch (e) {
          // Ignore errors during unloading
        }
        
        // Preload asset to ensure it's available
        const soundAsset = Asset.fromModule(require('./assets/alarm.mp3'));
        await soundAsset.downloadAsync();
        
        // Load the sound with full options
        await soundObject.current.loadAsync(
          require('./assets/alarm.mp3'),
          {
            isLooping: false,
            isMuted: false,
            volume: 1.0,
            rate: 1.0,
            shouldCorrectPitch: true
          }
        );
        
        // Verify loading was successful
        const loadedStatus = await soundObject.current.getStatusAsync();
        if (loadedStatus.isLoaded) {
          console.log('Sound loaded successfully!');
        } else {
          throw new Error('Sound loaded but status shows not loaded');
        }
      } catch (e) {
        console.warn('Error loading sound (attempt ' + (retryCount + 1) + '):', e);
        retryCount++;
        
        // Wait a moment before retrying
        if (isMounted && retryCount < maxRetries) {
          setTimeout(loadSound, 1000);
        }
      }
    };
    
    loadSound();
    
    return () => {
      isMounted = false;
      // Safely unload the sound when component unmounts
      try {
        soundObject.current.unloadAsync();
      } catch (e) {
        console.warn('Error unloading sound:', e);
      }
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
    let isMounted = true;
    
    if (tracking && destination) {
      (async () => {
        try {
          // First check if permissions are granted
          let { status } = await Location.getForegroundPermissionsAsync();
          if (status !== 'granted') {
            status = (await Location.requestForegroundPermissionsAsync()).status;
            if (status !== 'granted') {
              if (isMounted) setErrorMsg('Location permission is required for tracking');
              return;
            }
          }
          
          // Request background permissions for Android
          if (Platform.OS === 'android') {
            const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
            console.log('Background location permission:', bgStatus);
          }
          
          // Start the location watcher
          subscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.Highest,
              timeInterval: 5000,
              distanceInterval: 5,
              mayShowUserSettingsDialog: true,
            },
            (loc) => {
              if (!isMounted) return;
              
              try {
                if (!loc || !loc.coords) {
                  console.warn('Invalid location data received');
                  return;
                }
                
                setLocation(loc.coords);
                
                if (!destination) {
                  console.warn('Destination is undefined in watchPosition callback');
                  return;
                }
                
                const distance = getDistanceMeters(loc.coords, destination);
                
                if (distance <= alarmRadius && !alarmTriggered.current) {
                  triggerAlarm();
                }
              } catch (callbackError) {
                console.error('Error in location callback:', callbackError);
              }
            }
          );
        } catch (e) {
          console.error('Location watch error:', e);
          if (isMounted) {
            setErrorMsg('Error watching location: ' + (e.message || 'Unknown error'));
          }
        }
      })();
    }
    
    return () => {
      isMounted = false;
      if (subscription) {
        try {
          subscription.remove();
        } catch (e) {
          console.warn('Error removing location subscription:', e);
        }
      }
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
    
    // Save to recent destinations
    try {
      RecentDestinations.addRecentDestination(e.nativeEvent.coordinate);
    } catch (error) {
      console.warn('Error adding to recent destinations:', error);
    }
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
    // Prevent multiple triggers
    if (alarmTriggered.current) return;
    
    try {
      alarmTriggered.current = true;
      setAlarmCount((c) => c + 1);
      
      // Trigger vibration and handle possible permission issues
      try {
        Vibration.vibrate([500, 300, 500, 300, 500, 300, 500], false);
      } catch (vibrationError) {
        console.warn('Vibration error:', vibrationError);
      }
      
      // Attempt to play sound with multiple fallbacks
      let soundPlayed = false;
      
      // First attempt: Use the existing sound object
      try { 
        const soundStatus = await soundObject.current.getStatusAsync();
        if (soundStatus.isLoaded) {
          await soundObject.current.setPositionAsync(0);
          await soundObject.current.playAsync();
          soundPlayed = true;
          console.log('Sound played successfully using existing sound object');
        }
      } catch (soundError) {
        console.warn('Sound playback error with existing sound object:', soundError);
      }
      
      // Second attempt: Reload and play if first attempt failed
      if (!soundPlayed) {
        try {
          // First unload to clear any issues
          await soundObject.current.unloadAsync().catch(() => {});
          
          // Try loading with Asset.fromModule first
          const soundAsset = Asset.fromModule(require('./assets/alarm.mp3'));
          await soundAsset.downloadAsync();
          
          await soundObject.current.loadAsync(require('./assets/alarm.mp3'));
          await soundObject.current.playAsync();
          soundPlayed = true;
          console.log('Sound played successfully after reloading');
        } catch (reloadError) {
          console.warn('Sound reload error:', reloadError);
        }
      }
      
      // Third attempt: Create a new sound object if all else fails
      if (!soundPlayed) {
        try {
          const { sound } = await Audio.Sound.createAsync(
            require('./assets/alarm.mp3'),
            { shouldPlay: true }
          );
          sound.setOnPlaybackStatusUpdate(status => {
            if (status.didJustFinish) {
              sound.unloadAsync().catch(() => {});
            }
          });
          soundPlayed = true;
          console.log('Sound played successfully with new sound object');
        } catch (newSoundError) {
          console.warn('New sound object error:', newSoundError);
        }
      }
      
      // Final fallback: Use notifications system if all sound methods fail
      if (!soundPlayed) {
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'TraveRing Alert',
              body: 'You have arrived at your destination!',
              sound: true,
              priority: Notifications.AndroidNotificationPriority.MAX,
            },
            trigger: null, // Show immediately
          });
          console.log('Used notifications as sound fallback');
        } catch (notifyError) {
          console.warn('Notification error:', notifyError);
        }
      }
      
      // Show the alert to the user
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
              } catch (e) {
                console.warn('Error stopping sound:', e);
              }
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
              } catch (e) {
                console.warn('Error stopping sound:', e);
              }
              setAlarmCount(0);
            },
            style: "destructive"
          },
        ],
        { cancelable: false }
      );
    } catch (error) {
      console.error('Error in triggerAlarm:', error);
      // Reset the alarm triggered state in case of error
      alarmTriggered.current = false;
    }
  };

  if (errorMsg) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <StatusBar barStyle={theme === "dark" ? "light-content" : "dark-content"} />
        <Text style={[styles.errorText, { color: colors.buttonStop }]}>{errorMsg}</Text>
        <TouchableOpacity
          style={{
            backgroundColor: colors.accent,
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderRadius: 10,
            marginTop: 20
          }}
          onPress={() => {
            setErrorMsg(null);
            (async () => {
              try {
                let { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                  setErrorMsg('Permission to access location was denied');
                  return;
                }
                let initialLocation = await Location.getCurrentPositionAsync({});
                setLocation(initialLocation.coords);
              } catch (e) {
                setErrorMsg('Error getting location: ' + e.message);
              }
            })();
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (!location) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <StatusBar barStyle={theme === "dark" ? "light-content" : "dark-content"} />
        <Text style={[styles.infoText, { color: colors.text }]}>Waiting for location permission or GPS fix...</Text>
        <Text style={{ color: colors.faintText, marginTop: 10, textAlign: 'center' }}>
          Make sure location services are enabled and the app has permission
        </Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
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
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginRight: 18, marginTop: 15 }}>
              <TouchableOpacity
                onPress={() => setForceScheme(forceScheme === "dark" ? "light" : "dark")}
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 14,
                  paddingVertical: 6,
                  paddingHorizontal: 15,
                  borderWidth: 1,
                  borderColor: colors.border,
                  marginBottom: 12,
                  alignItems: 'center'
                }}
                activeOpacity={0.7}
              >
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "bold" }}>
                  {theme === 'dark' ? "🌙 DARK" : "☀️ LIGHT"}
                </Text>
              </TouchableOpacity>
            </View>
            <RecentDestinations
              onDestinationSelect={setDestination}
              theme={theme}
              colors={colors}
              currentLocation={location}
            />
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
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  errorText: { fontSize: 18, fontWeight: '600', textAlign: 'center', padding: 12 },
  infoText: { fontSize: 17, textAlign: 'center' },
});
//