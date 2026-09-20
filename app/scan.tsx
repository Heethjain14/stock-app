import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, type Href } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getItemByBarcode, StockApiError } from '../src/api/stock';
import { CameraScanner } from '../src/components/CameraScanner';
import {
  Button,
  Card,
  ErrorState,
  IconButton,
  InlineBanner,
  LoadingState,
  Screen,
  TextField,
} from '../src/components/ui';
import { useScanPermission } from '../src/hooks/useScanPermission';
import { colors, layout, radii, spacing, typography } from '../src/theme';
import { isStockBarcode } from '../src/utils/generateId';

type Phase = 'scanning' | 'lookup' | 'unknown' | 'error';

const WINDOW = 260;
const BRACKET = 32;
const BRACKET_W = 4;
const SCRIM = 'rgba(0,0,0,0.6)';
const OVERLAY_TEXT = '#FFFFFF';
const BANNER_MS = 2500;
const SAME_CODE_MS = 1500;

export default function Scan() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useScanPermission();
  const [phase, setPhase] = useState<Phase>('scanning');
  const [torch, setTorch] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraKey, setCameraKey] = useState(0);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');

  const busy = useRef(false);
  const lastCode = useRef<{ data: string; at: number } | null>(null);
  const lastBarcode = useRef<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  const showNotice = useCallback((text: string) => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), BANNER_MS);
  }, []);

  const rearm = useCallback(() => {
    busy.current = false;
    lastCode.current = null;
    lastBarcode.current = null;
    setErrorMessage('');
    setPhase('scanning');
  }, []);

  // Re-arm when returning from the updater (or any other screen).
  useFocusEffect(
    useCallback(() => {
      rearm();
      return () => {
        setTorch(false);
      };
    }, [rearm]),
  );

  const lookup = useCallback(async (barcode: string) => {
    busy.current = true;
    lastBarcode.current = barcode;
    setPhase('lookup');
    setNotice(null);
    try {
      const item = await getItemByBarcode(barcode);
      if (!mounted.current) return;
      if (item) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        router.push(`/stock-updater?id=${item.id}` as Href);
        // Stay locked until the screen regains focus (useFocusEffect re-arms).
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        setPhase('unknown');
      }
    } catch (e) {
      if (!mounted.current) return;
      setErrorMessage(
        e instanceof StockApiError ? e.message : 'Could not look up that label. Please try again.',
      );
      setPhase('error');
    }
  }, []);

  const onCode = useCallback(
    (data: string) => {
      if (busy.current) return;
      const now = Date.now();
      const last = lastCode.current;
      if (last && last.data === data && now - last.at < SAME_CODE_MS) return;
      lastCode.current = { data, at: now };

      if (!isStockBarcode(data)) {
        showNotice('Not a StockApp label');
        return;
      }
      lookup(data);
    },
    [lookup, showNotice],
  );

  const submitManual = useCallback(() => {
    const code = manualCode.trim().toUpperCase();
    if (!isStockBarcode(code)) {
      showNotice('Not a StockApp label code');
      return;
    }
    setManualOpen(false);
    setManualCode('');
    lookup(code);
  }, [manualCode, lookup, showNotice]);

  const retryCamera = useCallback(() => {
    setCameraError(null);
    setCameraKey((k) => k + 1);
  }, []);

  if (!permission) {
    return (
      <Screen>
        <LoadingState message="Checking camera access" />
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen>
        <View style={styles.permissionWrap}>
          <View style={styles.permissionHeader}>
            <IconButton
              icon="close"
              accessibilityLabel="Close scanner"
              onPress={() => router.back()}
            />
          </View>
          <Card style={styles.permissionCard}>
            <Text style={styles.permissionTitle}>Camera access needed</Text>
            <Text style={styles.permissionBody}>
              {permission.canAskAgain
                ? 'StockApp uses the camera only to read the QR labels on your items.'
                : 'Camera access is turned off for StockApp. Enable it in your device settings to scan labels.'}
            </Text>
            <View style={styles.permissionActions}>
              {permission.canAskAgain ? (
                <Button title="Grant permission" icon="camera" onPress={requestPermission} />
              ) : null}
              <Button
                title="Open settings"
                icon="settings-outline"
                variant={permission.canAskAgain ? 'secondary' : 'primary'}
                onPress={() => Linking.openSettings().catch(() => {})}
              />
            </View>
          </Card>
        </View>
      </Screen>
    );
  }

  const armed = phase === 'scanning';

  return (
    <View style={styles.root}>
      <CameraScanner
        key={cameraKey}
        armed={armed}
        torch={torch}
        onCode={onCode}
        onError={setCameraError}
      />

      {/* Scrim with a clear window */}
      <View style={styles.scrimLayer} pointerEvents="none">
        <View style={styles.scrim} />
        <View style={styles.middleRow}>
          <View style={styles.scrim} />
          <View style={styles.window}>
            <View style={[styles.bracket, styles.tl]} />
            <View style={[styles.bracket, styles.tr]} />
            <View style={[styles.bracket, styles.bl]} />
            <View style={[styles.bracket, styles.br]} />
          </View>
          <View style={styles.scrim} />
        </View>
        <View style={styles.scrim} />
      </View>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton
          icon="close"
          color={OVERLAY_TEXT}
          accessibilityLabel="Close scanner"
          onPress={() => router.back()}
          style={styles.headerBtn}
        />
        <Text style={styles.headerTitle}>Scan label</Text>
        <IconButton
          icon={torch ? 'flashlight' : 'flashlight-outline'}
          color={OVERLAY_TEXT}
          accessibilityLabel={torch ? 'Turn flashlight off' : 'Turn flashlight on'}
          onPress={() => setTorch((t) => !t)}
          style={[styles.headerBtn, torch && styles.headerBtnActive]}
        />
      </View>

      {/* Hint + transient banner */}
      <View style={styles.hintArea} pointerEvents="none">
        <Text style={styles.hint}>Point at an item&apos;s QR label</Text>
      </View>

      {notice && phase === 'scanning' ? (
        <View style={[styles.noticeWrap, { top: insets.top + 64 }]} pointerEvents="none">
          <InlineBanner tone="warning" message={notice} />
        </View>
      ) : null}

      {/* Bottom status cards */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.bottom, { paddingBottom: insets.bottom + spacing.lg }]}
      >
        {phase === 'scanning' && cameraError ? (
          <Card style={styles.stacked}>
            <Text style={styles.cardTitle}>Camera unavailable</Text>
            <Text style={styles.cardBody}>{cameraError}</Text>
            <View style={styles.cardActions}>
              <Button title="Try again" icon="refresh" onPress={retryCamera} />
            </View>
          </Card>
        ) : null}

        {phase === 'scanning' && manualOpen ? (
          <Card style={styles.stacked}>
            <TextField
              label="Label code"
              value={manualCode}
              onChangeText={setManualCode}
              placeholder="STOCK-TOP-AB12"
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              returnKeyType="go"
              onSubmitEditing={submitManual}
            />
            <View style={styles.cardActions}>
              <Button title="Cancel" variant="secondary" onPress={() => setManualOpen(false)} />
              <Button title="Look up" icon="search" onPress={submitManual} />
            </View>
          </Card>
        ) : null}

        {phase === 'scanning' && !manualOpen ? (
          <Button
            title="Type code instead"
            icon="keypad-outline"
            variant="secondary"
            fullWidth
            onPress={() => setManualOpen(true)}
          />
        ) : null}

        {phase === 'lookup' ? (
          <View style={styles.lookupPill}>
            <LoadingState message="Looking up item…" />
          </View>
        ) : null}

        {phase === 'unknown' ? (
          <Card>
            <Text style={styles.cardTitle}>Unknown label</Text>
            <Text style={styles.cardBody}>This QR isn&apos;t in your inventory.</Text>
            <View style={styles.cardActions}>
              <Button title="Scan again" variant="secondary" onPress={rearm} />
              <Button
                title="Create item"
                icon="add"
                onPress={() => router.push('/create-qr' as Href)}
              />
            </View>
          </Card>
        ) : null}

        {phase === 'error' ? (
          <Card>
            <ErrorState
              title="Lookup failed"
              message={errorMessage}
              retryLabel="Retry"
              onRetry={() => {
                const code = lastBarcode.current;
                if (code) lookup(code);
                else rearm();
              }}
            />
            <View style={styles.errorFooter}>
              <Button title="Scan again" variant="ghost" onPress={rearm} />
            </View>
          </Card>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const CORNER_RADIUS = radii.lg;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  scrimLayer: { ...StyleSheet.absoluteFill },
  scrim: { flex: 1, backgroundColor: SCRIM },
  middleRow: { height: WINDOW, flexDirection: 'row' },
  window: { width: WINDOW, height: WINDOW },
  bracket: {
    position: 'absolute',
    width: BRACKET,
    height: BRACKET,
    borderColor: OVERLAY_TEXT,
  },
  tl: {
    top: 0,
    left: 0,
    borderTopWidth: BRACKET_W,
    borderLeftWidth: BRACKET_W,
    borderTopLeftRadius: CORNER_RADIUS,
  },
  tr: {
    top: 0,
    right: 0,
    borderTopWidth: BRACKET_W,
    borderRightWidth: BRACKET_W,
    borderTopRightRadius: CORNER_RADIUS,
  },
  bl: {
    bottom: 0,
    left: 0,
    borderBottomWidth: BRACKET_W,
    borderLeftWidth: BRACKET_W,
    borderBottomLeftRadius: CORNER_RADIUS,
  },
  br: {
    bottom: 0,
    right: 0,
    borderBottomWidth: BRACKET_W,
    borderRightWidth: BRACKET_W,
    borderBottomRightRadius: CORNER_RADIUS,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPadding,
  },
  headerBtn: { backgroundColor: 'rgba(0,0,0,0.45)' },
  headerBtnActive: { backgroundColor: colors.primary },
  headerTitle: { ...typography.heading, color: OVERLAY_TEXT },
  hintArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    marginTop: WINDOW / 2 + spacing.lg,
    alignItems: 'center',
    paddingHorizontal: layout.screenPadding,
  },
  hint: { ...typography.body, color: OVERLAY_TEXT, textAlign: 'center' },
  noticeWrap: {
    position: 'absolute',
    left: layout.screenPadding,
    right: layout.screenPadding,
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: layout.screenPadding,
  },
  lookupPill: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingVertical: spacing.sm,
  },
  stacked: { marginBottom: spacing.md },
  cardTitle: { ...typography.title, color: colors.text },
  cardBody: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  cardActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  errorFooter: { alignItems: 'center', marginTop: -spacing.md },
  permissionWrap: { flex: 1 },
  permissionHeader: { alignItems: 'flex-start', paddingTop: spacing.sm },
  permissionCard: { marginTop: spacing.xl },
  permissionTitle: { ...typography.title, color: colors.text },
  permissionBody: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm },
  permissionActions: { gap: spacing.md, marginTop: spacing.lg },
});
