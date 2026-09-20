import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { getItemById, recordMovement, StockApiError } from '../src/api/stock';
import {
  AppHeader,
  Button,
  Card,
  Chip,
  ErrorState,
  IconButton,
  InlineBanner,
  LoadingState,
  Screen,
  SegmentedControl,
  StockStatusBadge,
  TextField,
  EmptyState,
} from '../src/components/ui';
import { colors, radii, spacing, typography } from '../src/theme';
import type { MovementMode, StockItem } from '../src/types/stock';

type EditMode = 'add' | 'subtract' | 'set';

const MODE_OPTIONS = [
  { value: 'add', label: 'Add' },
  { value: 'subtract', label: 'Remove' },
  { value: 'set', label: 'Set' },
] as const;

const QUICK_STEPS = [1, 5, 10] as const;
const MAX_DIGITS = 7;

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

function parseAmount(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : null;
}

function specLine(item: StockItem): string {
  return [item.category, item.size, item.color, item.fabric]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .join(' · ');
}

async function successHaptic() {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Haptics are best-effort (unsupported on web / some devices).
  }
}

function ItemSummary({ item, quantity }: { item: StockItem; quantity: number | null }) {
  const router = useRouter();
  const specs = specLine(item);
  return (
    <Card>
      <View style={styles.summaryTop}>
        <Text style={styles.itemName} numberOfLines={2}>
          {item.name}
        </Text>
        <StockStatusBadge item={{ ...item, quantity }} />
      </View>
      <Text style={styles.barcode} selectable>
        {item.barcode}
      </Text>
      {specs ? <Text style={styles.specs}>{specs}</Text> : null}
      {item.lot_number ? <Text style={styles.specs}>{`Lot ${item.lot_number}`}</Text> : null}
      <View style={styles.qtyRow}>
        <Text style={styles.qtyLabel}>Current quantity</Text>
        <View style={styles.qtyValueRow}>
          <Text style={styles.qtyValue} accessibilityLabel={`Current quantity ${quantity ?? 'not received'}`}>
            {quantity ?? '--'}
          </Text>
          <Text style={styles.qtyUnit}>{quantity === null ? 'not received' : item.unit}</Text>
        </View>
      </View>
      <Button
        title="Details & history"
        variant="ghost"
        icon="time-outline"
        onPress={() => router.push(`/item/${item.id}` as Href)}
        style={styles.detailsButton}
      />
    </Card>
  );
}

function UpdaterForm({ item }: { item: StockItem }) {
  const router = useRouter();
  const unit = item.unit;
  const current = item.quantity;
  const isReceive = current === null;

  const [mode, setMode] = useState<EditMode>('add');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<StockItem | null>(null);
  const savingRef = useRef(false);

  const activeMode: MovementMode = isReceive ? 'receive' : mode;
  const parsed = parseAmount(amount);
  const minAmount = activeMode === 'add' || activeMode === 'subtract' ? 1 : 0;
  const valid = parsed !== null && parsed >= minAmount;
  const amountError =
    amount !== '' && parsed === null
      ? 'Enter a whole number.'
      : parsed !== null && parsed < minAmount
        ? 'Enter at least 1.'
        : undefined;

  const onAmountChange = (text: string) => {
    setAmount(text.replace(/\D/g, '').slice(0, MAX_DIGITS));
    setError(null);
  };

  const step = (delta: number) => {
    const base = parsed ?? 0;
    setAmount(String(Math.max(0, base + delta)));
    setError(null);
  };

  const onModeChange = (next: EditMode) => {
    setMode(next);
    setAmount(next === 'set' && current !== null ? String(current) : '');
    setError(null);
  };

  // Live preview of the resulting quantity.
  let preview: number | null = null;
  let previewColor: string = colors.textSecondary;
  if (valid && parsed !== null) {
    if (isReceive || mode === 'set') {
      preview = parsed;
      previewColor = colors.primary;
    } else if (mode === 'add') {
      preview = (current ?? 0) + parsed;
      previewColor = colors.success;
    } else {
      preview = Math.max(0, (current ?? 0) - parsed);
      previewColor = colors.danger;
    }
  }
  const overRemoval = !isReceive && mode === 'subtract' && valid && parsed !== null && parsed > (current ?? 0);

  const onSave = useCallback(async () => {
    if (savingRef.current || parsed === null || parsed < minAmount) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const trimmed = note.trim();
      const updated = await recordMovement(item.id, activeMode, parsed, trimmed ? trimmed : undefined);
      void successHaptic();
      setSaved(updated);
    } catch (e) {
      setError(
        e instanceof StockApiError ? e.message : 'Could not save the stock change. Please try again.',
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [activeMode, item.id, minAmount, note, parsed]);

  if (saved) {
    const newQty = saved.quantity ?? 0;
    return (
      <>
        <Card>
          <View style={styles.successWrap} accessibilityLiveRegion="polite">
            <View style={styles.successIcon}>
              <Ionicons name="checkmark" size={36} color={colors.success} />
            </View>
            <Text style={styles.successTitle}>Stock updated</Text>
            <Text style={styles.itemNameCentered} numberOfLines={2}>
              {item.name}
            </Text>
            <View style={styles.qtyValueRow}>
              <Text style={[styles.qtyValue, { color: colors.success }]}>{newQty}</Text>
              <Text style={styles.qtyUnit}>{saved.unit}</Text>
            </View>
            {current !== null ? (
              <Text style={styles.specs}>{`Was ${current} ${unit}`}</Text>
            ) : null}
          </View>
        </Card>
        <Button
          title="Scan next"
          icon="qr-code-outline"
          size="lg"
          fullWidth
          onPress={() => router.replace('/scan' as Href)}
        />
        <Button
          title="Done"
          variant="secondary"
          size="lg"
          fullWidth
          onPress={() => router.replace('/' as Href)}
        />
      </>
    );
  }

  const amountLabel = isReceive
    ? 'Received quantity'
    : mode === 'add'
      ? 'Quantity to add'
      : mode === 'subtract'
        ? 'Quantity to remove'
        : 'New quantity';

  return (
    <>
      <ItemSummary item={item} quantity={current} />

      {isReceive ? (
        <InlineBanner
          tone="info"
          title="First time receiving this item"
          message="Enter how many units arrived. This sets the starting stock."
        />
      ) : (
        <SegmentedControl options={MODE_OPTIONS} value={mode} onChange={onModeChange} />
      )}

      <View style={styles.amountBlock}>
        {isReceive ? (
          <TextField
            label={amountLabel}
            value={amount}
            onChangeText={onAmountChange}
            keyboardType="number-pad"
            inputMode="numeric"
            autoFocus
            placeholder="0"
            maxLength={MAX_DIGITS}
            editable={!saving}
            error={amountError}
            style={styles.bigInput}
            returnKeyType="done"
          />
        ) : (
          <>
            <View style={styles.stepperRow}>
              <IconButton
                icon="remove"
                accessibilityLabel="Decrease by one"
                filled
                size={28}
                disabled={saving || parsed === null || parsed <= 0}
                onPress={() => step(-1)}
                style={styles.stepBtn}
              />
              <TextField
                containerStyle={styles.flex}
                label={amountLabel}
                value={amount}
                onChangeText={onAmountChange}
                keyboardType="number-pad"
                inputMode="numeric"
                autoFocus
                placeholder="0"
                maxLength={MAX_DIGITS}
                editable={!saving}
                error={amountError}
                style={styles.bigInput}
                returnKeyType="done"
              />
              <IconButton
                icon="add"
                accessibilityLabel="Increase by one"
                filled
                size={28}
                disabled={saving}
                onPress={() => step(1)}
                style={styles.stepBtn}
              />
            </View>
            {mode !== 'set' ? (
              <View style={styles.chipRow}>
                {QUICK_STEPS.map((n) => (
                  <Chip
                    key={n}
                    label={`${mode === 'add' ? '+' : '-'}${n}`}
                    disabled={saving}
                    onPress={() => step(n)}
                    style={styles.quickChip}
                  />
                ))}
              </View>
            ) : null}
          </>
        )}
      </View>

      {preview !== null ? (
        <Text style={[styles.preview, { color: previewColor }]} accessibilityLiveRegion="polite">
          {`New quantity: ${preview} ${unit}`}
        </Text>
      ) : null}

      {overRemoval ? (
        <InlineBanner
          tone="warning"
          title="More than in stock"
          message={`Only ${current} ${unit} in stock. Removing ${parsed} will set the quantity to 0.`}
        />
      ) : null}

      <TextField
        label="Note (optional)"
        value={note}
        onChangeText={setNote}
        placeholder="e.g. Damaged, returned, recount"
        maxLength={200}
        editable={!saving}
        returnKeyType="done"
      />

      {error ? <InlineBanner tone="error" title="Could not save" message={error} /> : null}

      <Button
        title={isReceive ? 'Receive stock' : 'Save'}
        size="lg"
        fullWidth
        icon="checkmark-circle-outline"
        loading={saving}
        disabled={!valid || saving}
        onPress={onSave}
      />
    </>
  );
}

export default function StockUpdaterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [item, setItem] = useState<StockItem | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getItemById(id)
      .then((found) => {
        if (!cancelled) setItem(found);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setItem(null);
        setLoadError(e instanceof StockApiError ? e.message : 'Could not load that item.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/' as Href);
  };

  let body: React.ReactNode;
  if (loading) {
    body = <LoadingState message="Loading item" />;
  } else if (loadError) {
    body = <ErrorState message={loadError} onRetry={() => {
      setLoadError(null);
      setLoading(true);
      setAttempt((n) => n + 1);
    }} />;
  } else if (!item) {
    body = (
      <EmptyState
        icon="search-outline"
        title="Item not found"
        message="This QR code does not match any item in your stock."
        actionLabel="Scan again"
        onAction={() => router.replace('/scan' as Href)}
      />
    );
  } else {
    body = <UpdaterForm key={item.id} item={item} />;
  }

  return (
    <Screen
      scroll
      header={<AppHeader title="Update stock" onBack={goBack} />}
    >
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  summaryTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  itemName: { ...typography.title, color: colors.text, flex: 1 },
  itemNameCentered: { ...typography.heading, color: colors.text, textAlign: 'center' },
  barcode: { ...typography.caption, fontFamily: MONO, color: colors.textSecondary, marginTop: spacing.xs },
  specs: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  qtyRow: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  qtyLabel: { ...typography.label, color: colors.textSecondary },
  qtyValueRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: spacing.sm },
  qtyValue: { ...typography.display, fontSize: 48, lineHeight: 56, color: colors.text },
  qtyUnit: { ...typography.body, color: colors.textSecondary },
  detailsButton: { alignSelf: 'center', marginTop: spacing.xs },
  amountBlock: { gap: spacing.md },
  stepperRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  stepBtn: { width: 52, height: 52, borderRadius: radii.md, marginBottom: spacing.xs },
  bigInput: { ...typography.display, fontSize: 32, lineHeight: 40, textAlign: 'center', minHeight: 56 },
  chipRow: { flexDirection: 'row', gap: spacing.sm },
  quickChip: { flex: 1, minHeight: 48 },
  preview: { ...typography.heading, textAlign: 'center' },
  successWrap: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.successTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: { ...typography.title, color: colors.success },
});
