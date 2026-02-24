import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { runOnJS } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import DashboardScreen from '../screens/DashboardScreen';
import PatientDetailScreen from '../screens/PatientDetailScreen';
import TrendsScreen from '../screens/TrendsScreen';
import RemindersScreen from '../screens/RemindersScreen';
import SecurityScreen from '../screens/SecurityScreen';
import LabUploadScreen from '../screens/LabUploadScreen';
import Colors from '../constants/colors';
import Typography from '../constants/typography';

const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const TrendsStack = createNativeStackNavigator();

const TAB_ORDER = ['Home', 'Trends', 'Reminders', 'Settings'];

/**
 * Wraps a tab screen with horizontal swipe detection
 * so users can swipe left/right to navigate between tabs.
 */
function SwipeTabWrapper({ children, tabName }) {
  const navigation = useNavigation();
  const currentIndex = TAB_ORDER.indexOf(tabName);

  const navigateTab = useCallback((direction) => {
    const nextIndex = currentIndex + direction;
    if (nextIndex >= 0 && nextIndex < TAB_ORDER.length) {
      navigation.navigate(TAB_ORDER[nextIndex]);
    }
  }, [currentIndex, navigation]);

  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-25, 25])
    .failOffsetY([-15, 15])
    .onEnd((event) => {
      'worklet';
      const { translationX, velocityX } = event;
      // Require sufficient distance OR velocity for a swipe
      const isSwipe = Math.abs(translationX) > 60 || Math.abs(velocityX) > 500;
      if (isSwipe) {
        if (translationX < 0) {
          runOnJS(navigateTab)(1); // Swipe left → next tab
        } else {
          runOnJS(navigateTab)(-1); // Swipe right → previous tab
        }
      }
    });

  return (
    <GestureDetector gesture={swipeGesture}>
      <Animated.View style={{ flex: 1 }}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

function HomeStackNavigator() {
  return (
    <SwipeTabWrapper tabName="Home">
      <HomeStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <HomeStack.Screen name="DashboardMain" component={DashboardScreen} />
        <HomeStack.Screen name="PatientDetail" component={PatientDetailScreen} />
        <HomeStack.Screen name="LabUpload" component={LabUploadScreen} />
      </HomeStack.Navigator>
    </SwipeTabWrapper>
  );
}

function TrendsStackNavigator() {
  return (
    <SwipeTabWrapper tabName="Trends">
      <TrendsStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <TrendsStack.Screen name="TrendsMain" component={TrendsScreen} />
        <TrendsStack.Screen name="PatientDetail" component={PatientDetailScreen} />
      </TrendsStack.Navigator>
    </SwipeTabWrapper>
  );
}

function RemindersWrapper() {
  return (
    <SwipeTabWrapper tabName="Reminders">
      <RemindersScreen />
    </SwipeTabWrapper>
  );
}

function SettingsWrapper() {
  return (
    <SwipeTabWrapper tabName="Settings">
      <SecurityScreen />
    </SwipeTabWrapper>
  );
}

const TAB_CONFIG = [
  { name: 'Home', icon: 'home', iconOutline: 'home-outline', label: 'Home' },
  { name: 'Trends', icon: 'trending-up', iconOutline: 'trending-up-outline', label: 'Trends' },
  { name: 'Reminders', icon: 'calendar', iconOutline: 'calendar-outline', label: 'Reminders' },
  { name: 'Settings', icon: 'shield-checkmark', iconOutline: 'shield-checkmark-outline', label: 'Settings' },
];

function CustomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const config = TAB_CONFIG[index];

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <View
            key={route.key}
            style={styles.tabItem}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
          >
            <View
              style={styles.tabTouchable}
              onTouchEnd={onPress}
            >
              {isFocused && <View style={styles.activeIndicator} />}
              <Ionicons
                name={isFocused ? config.icon : config.iconOutline}
                size={22}
                color={isFocused ? Colors.teal : Colors.textMuted}
              />
              <Text style={[
                styles.tabLabel,
                { color: isFocused ? Colors.tealDark : Colors.textMuted },
                isFocused && styles.tabLabelActive,
              ]}>
                {config.label}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function TabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home" component={HomeStackNavigator} />
      <Tab.Screen name="Trends" component={TrendsStackNavigator} />
      <Tab.Screen name="Reminders" component={RemindersWrapper} />
      <Tab.Screen name="Settings" component={SettingsWrapper} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 8,
    shadowColor: Colors.navy,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
  },
  tabTouchable: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 16,
    borderRadius: 16,
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    top: -8,
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.teal,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 3,
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    fontWeight: '700',
  },
});
