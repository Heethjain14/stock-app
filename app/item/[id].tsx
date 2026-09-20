import { saveQrPng } from '../../src/utils/qrImage';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useAuth } from '../../src/auth/AuthProvider';
import { listMovements, getItemById, StockApiError, updateItemDetails } from '../../src/api/stock';
import {
  AppHeader,
  Button,
  Card,
  ChipGroup,
  Divider,
  EmptyState,
  ErrorState,
  InlineBanner,
  LoadingState,
  SectionLabel,
  Screen,
  StockStatusBadge,
  TextField,
} from '../../src/components/ui';
import {
  CATEGORY_LABELS,
  FABRICS,
  QUALITIES,
  SEASONS,
  SIZES,
  UNITS,
  type Category,
  type Season,
} from '../../src/domain/clothing';
import { colors, radii, spacing, typography } from '../../src/theme';
import type { MovementMode, NewStockItem, StockItem, StockMovement } from '../../src/types/stock';

const MODE_LABELS: Record<MovementMode, string> = {
  receive: 'Received',
  add: 'Added',
  subtract: 'Removed',
  set: 'Set',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : `${delta}`;
}

function emptyToNull(value: string): string | null {
  const t = value.trim();
  return t.length ? t : null;
}

/** Option list that always contains the current value, even if it is a legacy/custom one. */
function withCurrent(options: readonly string[], current: string | null): string[] {
  return current && !options.includes(current) ? [...options, current] : [...options];
}

type Draft = {
  name: string;
  category: Category | null;
  size: string | null;
  color: string;
  fabric: string | null;
  season: Season | null;
  quality: string | null;
  lot_number: string;
  other_specs: string;
  unit: string;
};

function draftFromItem(item: StockItem): Draft {
  return {
    name: item.name,
    category: item.category,
    size: item.size,
    color: item.color ?? '',
    fabric: item.fabric,
    season: item.season,
    quality: item.quality,
    lot_number: item.lot_number ?? '',
    other_specs: item.other_specs ?? '',
    unit: item.unit,
  };
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} selectable>
        {value}
      </Text>
    </View>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function MovementRow({ movement, unit }: { movement: StockMovement; unit: string }) {
  const deltaColor =
    movement.delta > 0 ? colors.success : movement.delta < 0 ? colors.danger : colors.textSecondary;
  return (
    <View style={styles.moveRow}>
      <View style={styles.moveMain}>
        <Text style={styles.moveMode}>{MODE_LABELS[movement.mode] ?? movement.mode}</Text>
        <Text style={styles.moveMeta} numberOfLines={1}>
          {movement.actor_email ?? 'Unknown'}
        </Text>
        <Text style={styles.moveMeta}>{formatDate(movement.created_at)}</Text>
        {movement.note ? <Text style={styles.moveNote}>{movement.note}</Text> : null}
      </View>
      <View style={styles.moveNumbers}>
        <Text style={[styles.moveDelta, { color: deltaColor }]}>{formatDelta(movement.delta)}</Text>
        <Text style={styles.moveMeta}>
          {`Now ${movement.resulting_quantity} ${unit}`}
        </Text>
      </View>
    </View>
  );
}

export default function ItemDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  const [item, setItem] = useState<StockItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [movements, setMovements] = useState<StockMovement[] | null>(null);
  const [movementsError, setMovementsError] = useState<string | null>(null);
  const [movementsLoading, setMovementsLoading] = useState(false);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [nameError, setNameError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const saveLock = useRef(false);

  const [qrMessage, setQrMessage] = useState<{
    tone: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);
  const [qrSaving, setQrSaving] = useState(false);
  const qrRef = useRef<any>(null);
  const qrLock = useRef(false);

  const requestId = useRef(0);
  const editingRef = useRef(false);
  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);

  const loadMovements = useCallback(async (itemId: string, token: number) => {
    setMovementsLoading(true);
    try {
      const rows = await listMovements(itemId, 50);
      if (token === requestId.current) {
        setMovements(rows);
        setMovementsError(null);
      }
    } catch (e) {
      if (token === requestId.current) {
        setMovementsError(e instanceof Error ? e.message : 'Could not load the movement history.');
      }
    } finally {
      if (token === requestId.current) setMovementsLoading(false);
    }
  }, []);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!id) {
        setLoading(false);
        setNotFound(true);
        return;
      }
      const token = ++requestId.current;
      if (!opts?.silent) setLoading(true);
      setLoadError(null);
      // History loads independently so its failure never blocks the item.
      void loadMovements(id, token);
      try {
        const next = await getItemById(id);
        if (token !== requestId.current) return;
        if (!next) {
          setItem(null);
          setNotFound(true);
        } else {
          setNotFound(false);
          // Do not clobber an item being edited underneath the user's draft.
          setItem(next);
        }
      } catch (e) {
        if (token !== requestId.current) return;
        setLoadError(e instanceof Error ? e.message : 'Could not load that item.');
      } finally {
        if (token === requestId.current) setLoading(false);
      }
    },
    [id, loadMovements],
  );

  const itemLoadedRef = useRef(false);
  useEffect(() => {
    itemLoadedRef.current = item !== null;
  }, [item]);

  useFocusEffect(
    useCallback(() => {
      if (editingRef.current) return;
      void load({ silent: itemLoadedRef.current });
    }, [load]),
  );

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const startEdit = () => {
    if (!item) return;
    setDraft(draftFromItem(item));
    setNameError(undefined);
    setSaveError(null);
    setNotice(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft(null);
    setNameError(undefined);
    setSaveError(null);
  };

  const setField = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    if (key === 'name') setNameError(undefined);
  };

  const save = async () => {
    if (!item || !draft || saveLock.current) return;
    if (!draft.name.trim()) {
      setNameError('Name is required.');
      return;
    }
    if (!draft.unit) {
      setSaveError('Choose a unit.');
      return;
    }
    saveLock.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const patch: Partial<NewStockItem> = {
        name: draft.name.trim(),
        category: draft.category,
        size: draft.size,
        color: emptyToNull(draft.color),
        fabric: draft.fabric,
        season: draft.season,
        quality: draft.quality,
        lot_number: emptyToNull(draft.lot_number),
        other_specs: emptyToNull(draft.other_specs),
        unit: draft.unit,
      };
      const updated = await updateItemDetails(item.id, patch);
      setItem(updated);
      setEditing(false);
      setDraft(null);
      setNotice('Details saved.');
    } catch (e) {
      setSaveError(
        e instanceof StockApiError || e instanceof Error ? e.message : 'Could not update the item.',
      );
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  const saveQr = () => {
    if (!item || !qrRef.current || qrLock.current) return;
    qrLock.current = true;
    setQrSaving(true);
    setQrMessage(null);
    const finish = () => {
      qrLock.current = false;
      setQrSaving(false);
    };
    try {
      qrRef.current.toDataURL(async (base64Data: string) => {
        try {
          const result = await saveQrPng(base64Data, item.barcode);
          if (result === 'denied') {
            setQrMessage({
              tone: 'warning',
              text: 'Photos permission was denied, so the QR was not saved. Allow access in your device settings, or take a screenshot of the QR.',
            });
          } else {
            setQrMessage({
              tone: 'success',
              text: result === 'saved' ? 'QR saved to your Photos.' : 'QR image ready. Choose where to save or share it.',
            });
          }
        } catch (err) {
          setQrMessage({
            tone: 'error',
            text: `Could not save the QR${err instanceof Error && err.message ? `: ${err.message}` : '.'} Try again or take a screenshot.`,
          });
        } finally {
          finish();
        }
      });
    } catch {
      setQrMessage({ tone: 'error', text: 'Could not generate the QR image. Try again.' });
      finish();
    }
  };

  const details = useMemo(() => {
    if (!item) return [];
    const rows: { label: string; value: string }[] = [
      { label: 'Category', value: item.category ?? '' },
      { label: 'Size', value: item.size ?? '' },
      { label: 'Color', value: item.color ?? '' },
      { label: 'Fabric', value: item.fabric ?? '' },
      { label: 'Season', value: item.season ?? '' },
      { label: 'Quality', value: item.quality ?? '' },
      { label: 'Lot number', value: item.lot_number ?? '' },
      { label: 'Notes', value: item.other_specs ?? '' },
      { label: 'Unit', value: item.unit },
      { label: 'Low-stock threshold', value: String(item.low_stock_threshold) },
      { label: 'Created', value: formatDate(item.created_at) },
      { label: 'Last updated', value: formatDate(item.updated_at) },
    ];
    return rows.filter((r) => r.value.trim().length > 0);
  }, [item]);

  const header = (
    <AppHeader
      title={editing ? 'Edit details' : (item?.name ?? 'Item')}
      subtitle={item?.barcode}
      onBack={editing ? cancelEdit : goBack}
    />
  );

  if (loading && !item) {
    return (
      <Screen header={header}>
        <LoadingState message="Loading item" />
      </Screen>
    );
  }

  if (loadError && !item) {
    return (
      <Screen header={header}>
        <ErrorState message={loadError} onRetry={() => void load()} />
      </Screen>
    );
  }

  if (notFound || !item) {
    return (
      <Screen header={header}>
        <EmptyState
          icon="search-outline"
          title="Item not found"
          message="This item may have been removed, or the QR code is out of date."
          actionLabel="Go back"
          onAction={goBack}
        />
      </Screen>
    );
  }

  if (editing && draft) {
    return (
      <Screen scroll header={header}>
        <Card>
          <View style={styles.formStack}>
            <TextField
              label="Name"
              value={draft.name}
              onChangeText={(v) => setField('name', v)}
              error={nameError}
              autoCapitalize="words"
              maxLength={120}
            />
            <FieldGroup label="Category">
              <ChipGroup<Category>
                options={CATEGORY_LABELS}
                value={draft.category}
                onChange={(v) => setField('category', v)}
              />
            </FieldGroup>
            <FieldGroup label="Size">
              <ChipGroup<string>
                options={withCurrent(SIZES, item.size)}
                value={draft.size}
                onChange={(v) => setField('size', v)}
              />
            </FieldGroup>
            <TextField
              label="Color"
              value={draft.color}
              onChangeText={(v) => setField('color', v)}
              autoCapitalize="words"
              maxLength={60}
            />
            <FieldGroup label="Fabric">
              <ChipGroup<string>
                options={withCurrent(FABRICS, item.fabric)}
                value={draft.fabric}
                onChange={(v) => setField('fabric', v)}
              />
            </FieldGroup>
            <FieldGroup label="Season">
              <ChipGroup<Season>
                options={SEASONS}
                value={draft.season}
                onChange={(v) => setField('season', v)}
              />
            </FieldGroup>
            <FieldGroup label="Quality">
              <ChipGroup<string>
                options={withCurrent(QUALITIES, item.quality)}
                value={draft.quality}
                onChange={(v) => setField('quality', v)}
              />
            </FieldGroup>
            <TextField
              label="Lot number"
              value={draft.lot_number}
              onChangeText={(v) => setField('lot_number', v)}
              autoCapitalize="characters"
              maxLength={60}
            />
            <TextField
              label="Notes"
              value={draft.other_specs}
              onChangeText={(v) => setField('other_specs', v)}
              multiline
              maxLength={500}
            />
            <FieldGroup label="Unit">
              <ChipGroup<string>
                options={withCurrent(UNITS, item.unit)}
                value={draft.unit}
                allowDeselect={false}
                onChange={(v) => v && setField('unit', v)}
              />
            </FieldGroup>
          </View>
        </Card>
        {saveError ? <InlineBanner tone="error" message={saveError} /> : null}
        <View style={styles.actionsRow}>
          <Button title="Save changes" icon="checkmark" onPress={save} loading={saving} style={styles.flex} />
          <Button title="Cancel" variant="secondary" onPress={cancelEdit} disabled={saving} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll header={header}>
      {notice ? <InlineBanner tone="success" message={notice} /> : null}
      {loadError ? (
        <InlineBanner tone="warning" title="Showing saved data" message={`Could not refresh: ${loadError}`} />
      ) : null}

      <Card>
        <View style={styles.hero}>
          <Text style={styles.heroName}>{item.name}</Text>
          <StockStatusBadge item={item} />
          {item.quantity === null ? (
            <Text style={styles.heroPending}>Not received yet</Text>
          ) : (
            <View style={styles.qtyRow}>
              <Text style={styles.qty} accessibilityLabel={`Quantity ${item.quantity} ${item.unit}`}>
                {item.quantity}
              </Text>
              <Text style={styles.qtyUnit}>{item.unit}</Text>
            </View>
          )}
          <Button
            title="Update stock"
            icon="swap-vertical"
            fullWidth
            onPress={() => router.push(`/stock-updater?id=${item.id}` as Href)}
          />
        </View>
      </Card>

      <View>
        <SectionLabel
          right={
            isAdmin ? (
              <Button title="Edit details" icon="create-outline" variant="ghost" onPress={startEdit} />
            ) : undefined
          }
        >
          Details
        </SectionLabel>
        <Card padding={0}>
          {details.map((row, i) => (
            <React.Fragment key={row.label}>
              {i > 0 ? <Divider /> : null}
              <DetailRow label={row.label} value={row.value} />
            </React.Fragment>
          ))}
        </Card>
      </View>

      <View>
        <SectionLabel>Label</SectionLabel>
        <Card>
          <View style={styles.qrBlock}>
            <View style={styles.qrFrame}>
              <QRCode
                value={item.barcode}
                size={180}
                getRef={(r) => (qrRef.current = r)}
                backgroundColor={colors.surface}
                color={colors.text}
              />
            </View>
            <Text style={styles.barcode} selectable>
              {item.barcode}
            </Text>
            {qrMessage ? <InlineBanner tone={qrMessage.tone} message={qrMessage.text} /> : null}
            <Button
              title="Save QR to Photos"
              icon="download-outline"
              variant="secondary"
              onPress={saveQr}
              loading={qrSaving}
            />
          </View>
        </Card>
      </View>

      <View>
        <SectionLabel>Stock history</SectionLabel>
        {movementsError ? (
          <Card>
            <ErrorState
              title="History unavailable"
              message={movementsError}
              onRetry={() => id && void loadMovements(id, requestId.current)}
            />
          </Card>
        ) : movements === null || (movementsLoading && movements.length === 0) ? (
          <Card>
            <LoadingState message="Loading history" />
          </Card>
        ) : movements.length === 0 ? (
          <Card>
            <EmptyState
              icon="time-outline"
              title="No movements yet"
              message="Stock changes for this item will appear here."
            />
          </Card>
        ) : (
          <Card padding={0}>
            {movements.map((m, i) => (
              <React.Fragment key={m.id}>
                {i > 0 ? <Divider /> : null}
                <MovementRow movement={m} unit={item.unit} />
              </React.Fragment>
            ))}
          </Card>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { gap: spacing.md },
  heroName: { ...typography.title, color: colors.text },
  heroPending: { ...typography.heading, color: colors.textSecondary },
  qtyRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  qty: { ...typography.display, fontSize: 44, lineHeight: 50, color: colors.text },
  qtyUnit: { ...typography.heading, color: colors.textSecondary },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  detailLabel: { ...typography.body, color: colors.textSecondary, flexShrink: 0 },
  detailValue: { ...typography.body, color: colors.text, flex: 1, textAlign: 'right' },
  qrBlock: { alignItems: 'center', gap: spacing.md },
  qrFrame: {
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  barcode: { ...typography.heading, color: colors.text, letterSpacing: 0.5 },
  moveRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  moveMain: { flex: 1, gap: 2 },
  moveMode: { ...typography.heading, color: colors.text },
  moveMeta: { ...typography.caption, color: colors.textSecondary },
  moveNote: { ...typography.caption, color: colors.text, marginTop: spacing.xs },
  moveNumbers: { alignItems: 'flex-end', gap: 2 },
  moveDelta: { ...typography.title },
  formStack: { gap: spacing.lg },
  fieldGroup: { gap: spacing.sm },
  fieldLabel: { ...typography.label, color: colors.textSecondary },
  actionsRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'stretch' },
});
