import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { TouchableOpacity, StyleSheet, Text, View } from 'react-native';

import HomeScreen from '../screens/HomeScreen';
import CreateRoomScreen from '../screens/CreateRoomScreen';
import MyTripsScreen from '../screens/MyTripsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ChatRoomScreen from '../screens/ChatRoomScreen';
import ManageRoomScreen from '../screens/ManageRoomScreen';
import KakaoMapScreen from '../screens/KakaoMapScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function PlusButton({ onPress }) {
  return (
    <TouchableOpacity style={styles.plusButton} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.plusText}>+</Text>
    </TouchableOpacity>
  );
}

function MainTabs({ currentUser, onLogout }) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '500', marginBottom: 2 },
      }}
    >
      <Tab.Screen
        name="Home"
        options={{
          tabBarLabel: '홈',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 20, color: focused ? '#2563EB' : '#9CA3AF' }}>🏠</Text>
          ),
        }}
      >
        {(props) => <HomeScreen {...props} route={{ ...props.route, params: { ...props.route.params, currentUser } }} />}
      </Tab.Screen>

      <Tab.Screen
        name="CreateRoomTab"
        options={{
          tabBarLabel: '',
          tabBarIcon: () => null,
          tabBarButton: (props) => (
            <PlusButton onPress={props.onPress} />
          ),
        }}
      >
        {(props) => <CreateRoomScreen {...props} route={{ ...props.route, params: { ...props.route.params, currentUser } }} />}
      </Tab.Screen>

      <Tab.Screen
        name="MyTrips"
        options={{
          tabBarLabel: '내 여정',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 20, color: focused ? '#2563EB' : '#9CA3AF' }}>📋</Text>
          ),
        }}
      >
        {(props) => <MyTripsScreen {...props} route={{ ...props.route, params: { ...props.route.params, currentUser } }} />}
      </Tab.Screen>

      <Tab.Screen
        name="Profile"
        options={{
          tabBarLabel: '프로필',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 20, color: focused ? '#2563EB' : '#9CA3AF' }}>👤</Text>
          ),
        }}
      >
        {(props) => <ProfileScreen {...props} route={{ ...props.route, params: { ...props.route.params, currentUser } }} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function AppNavigator({ currentUser, onLogout }) {
  const Tabs = (props) => <MainTabs {...props} currentUser={currentUser} onLogout={onLogout} />;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={Tabs} />
      <Stack.Screen
        name="ChatRoom"
        component={ChatRoomScreen}
        options={{ headerShown: true, title: '채팅', headerBackTitle: '뒤로' }}
      />
      <Stack.Screen
        name="ManageRoom"
        component={ManageRoomScreen}
        options={{ headerShown: true, title: '방 관리', headerBackTitle: '뒤로' }}
      />
      <Stack.Screen
        name="CreateRoom"
        options={{ headerShown: true, title: '방 만들기', headerBackTitle: '취소', presentation: 'modal' }}
      >
        {(props) => <CreateRoomScreen {...props} route={{ ...props.route, params: { ...props.route.params, currentUser } }} />}
      </Stack.Screen>
      <Stack.Screen
        name="KakaoMap"
        component={KakaoMapScreen}
        options={{ headerShown: true, title: '경로 보기', headerBackTitle: '뒤로' }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 62,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EAEAEA',
    elevation: 0,
    shadowOpacity: 0,
  },
  plusButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  plusText: { color: '#FFFFFF', fontSize: 28, fontWeight: '300', lineHeight: 32 },
});
