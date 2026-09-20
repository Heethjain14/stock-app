import { Redirect, Stack, useSegments, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { session, loading } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync().catch(() => {});
  }, [loading]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fff',
        }}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const onLogin = (segments as string[])[0] === 'login';

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="scan" />
        <Stack.Screen name="create-qr" />
        <Stack.Screen name="records" />
        <Stack.Screen name="stock-updater" />
        <Stack.Screen name="item/[id]" />
      </Stack>
      {!session && !onLogin ? <Redirect href={"/login" as Href} /> : null}
      {session && onLogin ? <Redirect href="/" /> : null}
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
