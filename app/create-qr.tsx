// app/create-qr.tsx
// Flow: New item form -> createItem() -> QR success state (save to Photos / share).

import { qrQuietZone, saveQrPng, shareQrPng } from '../src/utils/qrImage';
import { router, type Href } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { StockApiError, createItem, recordMovement } from '../src/api/stock';
import {
  AppHeader,
  Button,
  Card,
  ChipGroup,
  Divider,
  InlineBanner,
  Screen,
  TextField,
} from '../src/components/ui';
import { QUALITIES } from '../src/domain/clothing';
import { colors, radii, spacing, typography } from '../src/theme';
import type { NewStockItem, StockItem } from '../src/types/stock';

const QUALITY_OPTIONS: readonly string[] = QUALITIES;
const QR_SIZE = 280; // fits a 360px-wide phone: 328px content width

type FormState = {
  name: string;
  lot_number: string;
  quality: string | null;
  color: string;
  quantity: string;
  other_specs: string;
};

const EMPTY_FORM: FormState = {
  name: '',
  lot_number: '',
  quality: null,
  color: '',
  quantity: '',
  other_specs: '',
};

const emptyToNull = (v: string): string | null => {
  const t = v.trim();
  return t.length > 0 ? t : null;
};

export default function CreateQR() {
  const [created, setCreated] = useState<StockItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<{ name?: string; quantity?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [receiveWarning, setReceiveWarning] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    tone: 'success' | 'error' | 'warning';
    text: string;
  } | null>(null);

  const submitLock = useRef(false);
  const saveLock = useRef(false);
  const qrRef = useRef<any>(null);

  function update<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
    if (key === 'name' || key === 'quantity') {
      setErrors((e) => ({ ...e, [key]: undefined }));
    }
  }

  // Step 1: validate -> create record -> show QR

  async function handleCreate() {
    if (submitLock.current) return;

    const nextErrors: { name?: string; quantity?: string } = {};
    if (!form.name.trim()) nextErrors.name = 'Name is required.';
    const qtyText = form.quantity.trim();
    const qty = qtyText ? Number(qtyText) : null;
    if (qty !== null && (!Number.isInteger(qty) || qty < 1)) {
      nextErrors.quantity = 'Enter a whole number of 1 or more, or leave blank.';
    }
    setErrors(nextErrors);
    if (nextErrors.name || nextErrors.quantity) return;

    submitLock.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const input: NewStockItem = {
        barcode: '', // generated inside createItem
        name: form.name.trim(),
        category: null,
        size: null,
        color: emptyToNull(form.color),
        fabric: null,
        season: null,
        quality: form.quality,
        lot_number: emptyToNull(form.lot_number),
        other_specs: emptyToNull(form.other_specs),
        unit: 'pcs',
      };
      let item = await createItem(input);
      setReceiveWarning(null);
      if (qty !== null) {
        // New rows must have no quantity; the first count goes through the movement log.
        try {
          item = await recordMovement(item.id, 'receive', qty);
        } catch {
          setReceiveWarning(
            'The item was created, but its quantity could not be saved. Set it by scanning the QR.',
          );
        }
      }
      setSaveMessage(null);
      setCreated(item);
    } catch (err) {
      setSubmitError(
        err instanceof StockApiError
          ? err.message
          : err instanceof Error && err.message
            ? err.message
            : 'Could not create the item. Please try again.',
      );
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  // Step 2: save QR to photos / share label

  function handleSave() {
    if (!created || !qrRef.current || saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    setSaveMessage(null);

    const finish = () => {
      saveLock.current = false;
      setSaving(false);
    };

    try {
      qrRef.current.toDataURL(async (base64Data: string) => {
        try {
          const result = await saveQrPng(base64Data, created.barcode);
          if (result === 'denied') {
            setSaveMessage({
              tone: 'warning',
              text: 'Photos permission was denied, so the QR was not saved. Allow access in your device settings, or take a screenshot of the QR.',
            });
          } else {
            setSaveMessage({
              tone: 'success',
              text: result === 'saved' ? 'QR saved to your Photos.' : 'QR image ready. Choose where to save or share it.',
            });
          }
        } catch (err) {
          console.error('[QR Save]', err);
          setSaveMessage({
            tone: 'error',
            text: `Could not save the QR${err instanceof Error && err.message ? `: ${err.message}` : '.'} Try again or take a screenshot.`,
          });
        } finally {
          finish();
        }
      });
    } catch (err) {
      console.error('[QR Save]', err);
      setSaveMessage({ tone: 'error', text: 'Could not generate the QR image. Try again.' });
      finish();
    }
  }

  function handleShare() {
    if (!created || !qrRef.current) return;
    qrRef.current.toDataURL(async (base64Data: string) => {
      try {
        await shareQrPng(base64Data, created.barcode);
      } catch (err) {
        setSaveMessage({
          tone: 'error',
          text: `Could not share the QR image${err instanceof Error && err.message ? `: ${err.message}` : '.'}`,
        });
      }
    });
  }

  function handleCreateAnother() {
    setCreated(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setSubmitError(null);
    setReceiveWarning(null);
    setSaveMessage(null);
  }

  // Render: success step

  if (created) {
    const rows: { label: string; value: string | null }[] = [
      { label: 'Name', value: created.name },
      { label: 'Lot', value: created.lot_number },
      { label: 'Quality', value: created.quality },
      { label: 'Color', value: created.color },
      { label: 'Quantity', value: created.quantity === null ? null : String(created.quantity) },
      { label: 'Notes', value: created.other_specs },
    ];
    const visible = rows.filter((r) => r.value);

    return (
      <Screen
        scroll
        header={<AppHeader title="QR ready" subtitle="Item created" />}
      >
        <InlineBanner
          tone="success"
          title="Item created"
          message={
            created.quantity === null
              ? 'Print or save this QR and attach it to the item. Scan it at receiving to set the quantity.'
              : 'Print or save this QR and attach it to the item.'
          }
        />
        {receiveWarning ? <InlineBanner tone="warning" message={receiveWarning} /> : null}

        <View style={styles.qrWrap}>
          <View style={styles.qrCard}>
            <QRCode
              value={created.barcode}
              size={QR_SIZE}
              quietZone={qrQuietZone(QR_SIZE)}
              getRef={(r) => (qrRef.current = r)}
              backgroundColor={colors.surface}
              color={colors.text}
            />
          </View>
          <Text style={styles.barcode} selectable>
            {created.barcode}
          </Text>
        </View>

        <Card padding={0}>
          {visible.map((r, i) => (
            <View key={r.label}>
              {i > 0 ? <Divider /> : null}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{r.label}</Text>
                <Text style={styles.summaryValue}>{r.value}</Text>
              </View>
            </View>
          ))}
        </Card>

        {saveMessage ? <InlineBanner tone={saveMessage.tone} message={saveMessage.text} /> : null}

        <View style={styles.actions}>
          <Button
            title="Save QR to Photos"
            icon="download-outline"
            size="lg"
            fullWidth
            loading={saving}
            onPress={handleSave}
          />
          <Button
            title="Share QR image"
            icon="share-outline"
            variant="secondary"
            fullWidth
            onPress={handleShare}
          />
          <Button
            title="Create another"
            icon="add"
            variant="secondary"
            fullWidth
            onPress={handleCreateAnother}
          />
          <Button
            title="Done"
            variant="ghost"
            fullWidth
            onPress={() => router.replace('/' as Href)}
          />
        </View>
      </Screen>
    );
  }

  // Render: form step

  return (
    <Screen
      scroll
      header={<AppHeader title="New item" onBack={() => router.back()} />}
    >
      {submitError ? <InlineBanner tone="error" title="Could not create item" message={submitError} /> : null}

      <View style={styles.section}>
        <TextField
          label="Name *"
          value={form.name}
          onChangeText={(v) => update('name', v)}
          placeholder="e.g. Slim fit chinos"
          error={errors.name}
          autoCapitalize="sentences"
          returnKeyType="next"
        />
        <TextField
          label="Lot number"
          value={form.lot_number}
          onChangeText={(v) => update('lot_number', v)}
          placeholder="e.g. LOT-2026-014"
          autoCapitalize="characters"
        />
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Quality</Text>
          <ChipGroup options={QUALITY_OPTIONS} value={form.quality} onChange={(v) => update('quality', v)} />
        </View>
        <TextField
          label="Color"
          value={form.color}
          onChangeText={(v) => update('color', v)}
          placeholder="e.g. Navy blue"
          autoCapitalize="words"
        />
        <TextField
          label="Quantity"
          value={form.quantity}
          onChangeText={(v) => update('quantity', v.replace(/[^0-9]/g, ''))}
          placeholder="Leave blank to set at receiving"
          error={errors.quantity}
          keyboardType="number-pad"
        />
        <TextField
          label="Other specs"
          value={form.other_specs}
          onChangeText={(v) => update('other_specs', v)}
          placeholder="Size, fabric, fit, supplier..."
          multiline
        />
      </View>

      <View style={styles.actions}>
        <Button
          title="Create item & generate QR"
          size="lg"
          fullWidth
          loading={submitting}
          onPress={handleCreate}
        />
        <Button title="Cancel" variant="ghost" fullWidth onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  field: { gap: spacing.sm },
  fieldLabel: { ...typography.label, color: colors.textSecondary },
  actions: { gap: spacing.sm },
  qrWrap: { alignItems: 'center', gap: spacing.md },
  qrCard: {
    backgroundColor: colors.surface,
    overflow: 'hidden', // the QR carries its own white margin
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  barcode: {
    ...typography.heading,
    color: colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  summaryLabel: { ...typography.caption, color: colors.textSecondary, width: 72 },
  summaryValue: { ...typography.body, color: colors.text, flex: 1 },
});
