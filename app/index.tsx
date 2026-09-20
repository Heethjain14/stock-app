import React, { useCallback, useRef, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { getDashboardStats } from '../src/api/stock';
import {
  AppHeader,
  Badge,
  Button,
  Card,
  Divider,
  IconButton,
  InlineBanner,
  ListRow,
  Screen,
  SectionLabel,
  StatTile,
} from '../src/components/ui';
import { colors, layout, radii, spacing, typography } from '../src/theme';

type Stats = Awaited<ReturnType<typeof getDashboardStats>>;

export default function Home() {
  const router = useRouter();
  const { user, role, signOut } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setError(null);
    try {
      const next = await getDashboardStats();
      if (id === requestId.current) setStats(next);
    } catch (e: any) {
      if (id === requestId.current) setError(e?.message ?? 'Could not load stock summary.');
    } finally {
      if (id === requestId.current) setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const confirmSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          Promise.resolve(signOut()).catch((e: any) =>
            Alert.alert('Could not sign out', e?.message ?? 'Please try again.'),
          );
        },
      },
    ]);
  };

  const go = (href: string) => router.push(href as Href);
  const goRecords = (filter?: 'low' | 'out' | 'pending') =>
    go(filter ? `/records?filter=${filter}` : '/records');

  const val = (n: number | undefined): string | number => (stats ? (n ?? 0) : '-');

  return (
    <Screen
      padded={false}
      header={
        <AppHeader
          title="StockApp"
          subtitle={user?.email ?? undefined}
          right={
            <>
              {role ? <Badge label={role === 'admin' ? 'Admin' : 'Staff'} tone="info" /> : null}
              <IconButton
                icon="log-out-outline"
                accessibilityLabel="Sign out"
                onPress={confirmSignOut}
              />
            </>
          }
        />
      }
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View>
          <SectionLabel>Stock overview</SectionLabel>
          {error ? (
            <View style={styles.errorBox}>
              <InlineBanner tone="error" title="Could not load summary" message={error} />
              <Button title="Try again" variant="secondary" icon="refresh" onPress={onRefresh} />
            </View>
          ) : null}
          <View style={styles.grid}>
            <View style={styles.gridRow}>
              <StatTile
                label="Total items"
                value={val(stats?.totalItems)}
                icon="shirt-outline"
                tone="primary"
                onPress={() => goRecords()}
              />
              <StatTile
                label="Low stock"
                value={val(stats?.lowStock)}
                icon="trending-down-outline"
                tone="warning"
                onPress={() => goRecords('low')}
              />
            </View>
            <View style={styles.gridRow}>
              <StatTile
                label="Out of stock"
                value={val(stats?.outOfStock)}
                icon="close-circle-outline"
                tone="danger"
                onPress={() => goRecords('out')}
              />
              <StatTile
                label="Not received"
                value={val(stats?.notReceived)}
                icon="time-outline"
                tone="neutral"
                onPress={() => goRecords('pending')}
              />
            </View>
          </View>
        </View>

        <View>
          <SectionLabel>Actions</SectionLabel>
          <View style={styles.actions}>
            <Card
              onPress={() => go('/scan')}
              accessibilityLabel="Scan QR"
              padding={spacing.xl}
              style={styles.scanCard}
            >
              <View style={styles.scanRow}>
                <View style={styles.scanIcon}>
                  <Ionicons name="qr-code-outline" size={30} color={colors.onPrimary} />
                </View>
                <View style={styles.scanTexts}>
                  <Text style={styles.scanTitle}>Scan QR</Text>
                  <Text style={styles.scanDesc}>
                    Scan an item label to receive stock or update its quantity.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color={colors.onPrimary} />
              </View>
            </Card>

            <Card padding={0}>
              <ListRow
                title="New item"
                subtitle="Create an item and generate its QR label"
                leadingIcon="add-circle-outline"
                onPress={() => go('/create-qr')}
              />
              <Divider />
              <ListRow
                title="Records"
                subtitle="Browse, search and filter all stock"
                leadingIcon="list-outline"
                onPress={() => goRecords()}
              />
            </Card>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  errorBox: { gap: spacing.sm, marginBottom: spacing.md },
  grid: { gap: spacing.md },
  gridRow: { flexDirection: 'row', gap: spacing.md },
  actions: { gap: spacing.md },
  scanCard: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  scanRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  scanIcon: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: colors.primaryPressed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanTexts: { flex: 1, gap: spacing.xs },
  scanTitle: { ...typography.title, color: colors.onPrimary },
  scanDesc: { ...typography.caption, color: colors.primaryTint },
});
