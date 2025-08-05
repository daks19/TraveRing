import { registerRootComponent } from 'expo';
import { LogBox } from 'react-native';
import App from './App';

// Ignore specific harmless warnings
LogBox.ignoreLogs([
  'Sending `onAnimatedValueUpdate` with no listeners registered',
  'Non-serializable values were found in the navigation state',
  'ViewPropTypes will be removed from React Native',
  'Animated: `useNativeDriver` was not specified',
  'Setting a timer for a long period of time'
]);

// Register the main component
registerRootComponent(App);
