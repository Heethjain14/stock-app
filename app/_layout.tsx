import { Redirect, Stack, useSegments, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { Button } from '../src/components/ui';
import { colors, spacing, typography } from '../src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { session, loading, stuck, retry } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync().catch(() => {});
  }, [loading]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        {stuck ? (
          <>
            <Text style={styles.stuckTitle}>Taking longer than usual</Text>
            <Text style={styles.stuckBody}>
              Still waiting to hear back from the server. This can happen on a slow connection, or
              right after the app has been idle for a while.
            </Text>
            <Button title="Retry" icon="refresh" onPress={retry} style={styles.retryButton} />
          </>
        ) : (
          <ActivityIndicator size="large" />
        )}
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

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  stuckTitle: { ...typography.title, color: colors.text, textAlign: 'center' },
  stuckBody: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  retryButton: { marginTop: spacing.md, alignSelf: 'center' },
});
