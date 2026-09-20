import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { listItems, getFilterOptions } from '../src/api/stock';
import {
  AppHeader,
  Button,
  Card,
  Chip,
  ChipGroup,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  Screen,
  SearchBar,
  SectionLabel,
  StockStatusBadge,
} from '../src/components/ui';
import { CATEGORY_LABELS, GENDERS, QUALITIES, SIZES, type Category, type Gender } from '../src/domain/clothing';
import { colors, layout, radii, spacing, typography } from '../src/theme';
import type { StockFilters, StockItem } from '../src/types/stock';

const PAGE_SIZE = 20;

type QuickFilter = 'all' | 'low' | 'out' | 'pending';
type LoadMode = 'reset' | 'silent' | 'refresh' | 'more';
type Status = 'loading' | 'ready' | 'error';

const QUICK_OPTIONS: { value: QuickFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'low', label: 'Low stock' },
  { value: 'out', label: 'Out of stock' },
  { value: 'pending', label: 'Not received' },
];

function parseQuick(param: string | string[] | undefined): QuickFilter {
  const v = Array.isArray(param) ? param[0] : param;
  return v === 'low' || v === 'out' || v === 'pending' ? v : 'all';
}

type Params = {
  filters: StockFilters;
  quick: QuickFilter;
};

type Options = { colors: string[]; lotNumbers: string[]; qualities: string[]; sizes: string[] };
const NO_OPTIONS: Options = { colors: [], lotNumbers: [], qualities: [], sizes: [] };

function mergeOptions(base: readonly string[], extra: string[], selected: string | null): string[] {
  const set = new Set<string>([...base, ...extra]);
  if (selected) set.add(selected);
  return Array.from(set);
}

function errorMessage(e: unknown): string {
  return e instanceof Error && e.message ? e.message : 'Could not load stock items.';
}

type ChipRowProps = {
  options: string[];
  value: string | null;
  onChange: (v: string | null) => void;
};

function ChipRow({ options, value, onChange }: ChipRowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.chipRow}
    >
      {options.map((o) => (
        <Chip key={o} label={o} selected={o === value} onPress={() => onChange(o === value ? null : o)} />
      ))}
    </ScrollView>
  );
}

export default function RecordsScreen() {
  const router = useRouter();
  const { filter: filterParam } = useLocalSearchParams<{ filter?: string | string[] }>();

  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [quick, setQuick] = useState<QuickFilter>(() => parseQuick(filterParam));
  const [category, setCategory] = useState<Category | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [lot, setLot] = useState<string | null>(null);
  const [quality, setQuality] = useState<string | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [options, setOptions] = useState<Options>(NO_OPTIONS);

  const [items, setItems] = useState<StockItem[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);

  // Sync the quick filter when the home screen navigates here with ?filter=...
  const [prevFilterParam, setPrevFilterParam] = useState(filterParam);
  if (prevFilterParam !== filterParam) {
    setPrevFilterParam(filterParam);
    setQuick(parseQuick(filterParam));
  }

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchText.trim()), 300);
    return () => clearTimeout(t);
  }, [searchText]);

  // Suggestions for the filter panel (best effort).
  useEffect(() => {
    let cancelled = false;
    getFilterOptions()
      .then((o) => {
        if (!cancelled) setOptions(o);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const params: Params = {
    quick,
    filters: {
      search: search || undefined,
      category,
      gender,
      size,
      color,
      lot_number: lot,
      quality,
      status: quick === 'all' ? undefined : quick,
    },
  };
  const filterKey = JSON.stringify(params);
  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  });

  const reqId = useRef(0);
  const busyRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(false);
  const pageRef = useRef(0);
  const itemsRef = useRef<StockItem[]>([]);
  const loadedKeyRef = useRef<string | null>(null);

  const load = useCallback(async (mode: LoadMode) => {
    const isMore = mode === 'more';
    if (isMore && (busyRef.current || loadingMoreRef.current || !hasMoreRef.current)) return;

    const id = ++reqId.current;
    const { filters } = paramsRef.current;
    const keyAtStart = JSON.stringify(paramsRef.current);

    if (isMore) {
      loadingMoreRef.current = true;
      setLoadingMore(true);
      setMoreError(false);
    } else {
      busyRef.current = true;
      loadingMoreRef.current = false;
      setLoadingMore(false);
      setMoreError(false);
      setErrorMsg('');
      setRefreshing(mode === 'refresh');
      if (mode === 'reset') {
        setStatus('loading');
        itemsRef.current = [];
        hasMoreRef.current = false;
        setItems([]);
      }
    }

    try {
      const page = isMore ? pageRef.current + 1 : 1;
      const res = await listItems(filters, page, PAGE_SIZE);
      if (id !== reqId.current) return; // stale: filters changed or newer load started
      const totalCount = res.total;
      const collected = res.items;
      const more = res.items.length === PAGE_SIZE && page * PAGE_SIZE < res.total;

      let next: StockItem[];
      if (isMore) {
        const seen = new Set(itemsRef.current.map((i) => i.id));
        next = [...itemsRef.current, ...collected.filter((i) => !seen.has(i.id))];
      } else {
        next = collected;
      }
      itemsRef.current = next;
      pageRef.current = page;
      hasMoreRef.current = more;
      loadedKeyRef.current = keyAtStart;
      setItems(next);
      setTotal(totalCount);
      setStatus('ready');
    } catch (e) {
      if (id !== reqId.current) return;
      if (isMore) {
        setMoreError(true);
      } else if (itemsRef.current.length === 0) {
        setErrorMsg(errorMessage(e));
        setStatus('error');
      } else {
        setErrorMsg(errorMessage(e));
      }
    } finally {
      if (id === reqId.current) {
        if (isMore) {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        } else {
          busyRef.current = false;
          setRefreshing(false);
        }
      }
    }
  }, []);

  // Runs on focus (returning from other screens) and whenever the filters change while focused.
  useFocusEffect(
    useCallback(() => {
      const sameQuery = loadedKeyRef.current === filterKey && itemsRef.current.length > 0;
      load(sameQuery ? 'silent' : 'reset');
       
    }, [filterKey, load]),
  );

  const clearAll = useCallback(() => {
    setSearchText('');
    setSearch('');
    setQuick('all');
    setCategory(null);
    setGender(null);
    setSize(null);
    setColor(null);
    setLot(null);
    setQuality(null);
  }, []);

  const activeCount =
    (quick !== 'all' ? 1 : 0) +
    [category, gender, size, color, lot, quality].filter(Boolean).length;
  const hasActiveFilters = activeCount > 0 || search.length > 0;

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/' as Href);
  }, [router]);

  const openItem = useCallback(
    (id: string) => router.push(`/item/${id}` as Href),
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: StockItem }) => {
      const meta = [item.category, item.gender, item.size, item.color].filter(Boolean).join(' · ');
      return (
        <Card onPress={() => openItem(item.id)} accessibilityLabel={`Open ${item.name}`} style={styles.item}>
          <View style={styles.itemTop}>
            <Text style={styles.itemName} numberOfLines={2}>
              {item.name}
            </Text>
            <StockStatusBadge item={item} />
          </View>
          <Text style={styles.barcode} numberOfLines={1}>
            {item.barcode}
          </Text>
          <View style={styles.itemBottom}>
            <Text style={styles.meta} numberOfLines={1}>
              {meta}
            </Text>
            {item.lot_number ? (
              <View style={styles.lotPill}>
                <Text style={styles.lotText} numberOfLines={1}>
                  {`Lot ${item.lot_number}`}
                </Text>
              </View>
            ) : null}
          </View>
        </Card>
      );
    },
    [openItem],
  );

  const countLabel = useMemo(() => `${total} ${total === 1 ? 'item' : 'items'}`, [total]);

  const sizeOptions = mergeOptions(SIZES, options.sizes, size);
  const qualityOptions = mergeOptions(QUALITIES, options.qualities, quality);
  const colorOptions = mergeOptions([], options.colors, color);
  const lotOptions = mergeOptions([], options.lotNumbers, lot);

  const header = (
    <View style={styles.listHeader}>
      <SearchBar
        value={searchText}
        onChangeText={setSearchText}
        placeholder="Search name or barcode"
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.bleed}
        contentContainerStyle={styles.chipRowBleed}
      >
        {QUICK_OPTIONS.map((o) => (
          <Chip key={o.value} label={o.label} selected={quick === o.value} onPress={() => setQuick(o.value)} />
        ))}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.bleed}
        contentContainerStyle={styles.chipRowBleed}
      >
        {CATEGORY_LABELS.map((c) => (
          <Chip
            key={c}
            label={c}
            selected={category === c}
            onPress={() => setCategory(category === c ? null : c)}
          />
        ))}
      </ScrollView>

      {showPanel ? (
        <Card style={styles.panel}>
          <View style={styles.panelGroup}>
            <SectionLabel>Gender</SectionLabel>
            <ChipGroup options={GENDERS} value={gender} onChange={setGender} />
          </View>
          <View style={styles.panelGroup}>
            <SectionLabel>Size</SectionLabel>
            <ChipGroup options={sizeOptions} value={size} onChange={setSize} />
          </View>
          <View style={styles.panelGroup}>
            <SectionLabel>Color</SectionLabel>
            {colorOptions.length > 0 ? (
              <ChipRow options={colorOptions} value={color} onChange={setColor} />
            ) : (
              <Text style={styles.hint}>No colors recorded yet</Text>
            )}
          </View>
          <View style={styles.panelGroup}>
            <SectionLabel>Lot number</SectionLabel>
            {lotOptions.length > 0 ? (
              <ChipRow options={lotOptions} value={lot} onChange={setLot} />
            ) : (
              <Text style={styles.hint}>No lot numbers recorded yet</Text>
            )}
          </View>
          <View style={styles.panelGroup}>
            <SectionLabel>Quality</SectionLabel>
            <ChipRow options={qualityOptions} value={quality} onChange={setQuality} />
          </View>
          <Button
            title="Clear all"
            variant="ghost"
            icon="close-circle-outline"
            onPress={clearAll}
            disabled={!hasActiveFilters}
          />
        </Card>
      ) : null}

      {status === 'ready' && items.length > 0 ? <Text style={styles.count}>{countLabel}</Text> : null}

      {errorMsg && status !== 'error' ? (
        <View style={styles.inlineError}>
          <Text style={styles.inlineErrorText}>{errorMsg}</Text>
          <Button title="Retry" variant="ghost" onPress={() => load('refresh')} />
        </View>
      ) : null}
    </View>
  );

  let empty: React.ReactElement | null = null;
  if (status === 'loading') {
    empty = <LoadingState message="Loading items" />;
  } else if (status === 'error') {
    empty = <ErrorState message={errorMsg} onRetry={() => load('reset')} />;
  } else if (items.length === 0) {
    empty = hasActiveFilters ? (
      <EmptyState
        icon="search-outline"
        title="No matching items"
        message="Nothing matches your search or filters. Try adjusting them."
        actionLabel="Clear filters"
        onAction={clearAll}
      />
    ) : (
      <EmptyState
        icon="shirt-outline"
        title="No items yet"
        message="Create your first item and QR code to start tracking stock."
        actionLabel="New item"
        onAction={() => router.push('/create-qr' as Href)}
      />
    );
  }

  const footer = loadingMore ? (
    <LoadingState message="Loading more" />
  ) : moreError ? (
    <View style={styles.inlineError}>
      <Text style={styles.inlineErrorText}>Could not load more items.</Text>
      <Button title="Retry" variant="ghost" onPress={() => load('more')} />
    </View>
  ) : null;

  return (
    <Screen
      header={
        <AppHeader
          title="Records"
          onBack={goBack}
          right={
            <>
              <View>
                <IconButton
                  icon={showPanel ? 'options' : 'options-outline'}
                  accessibilityLabel={
                    activeCount > 0 ? `Filters, ${activeCount} active` : 'Filters'
                  }
                  onPress={() => setShowPanel((v) => !v)}
                  filled={showPanel}
                />
                {activeCount > 0 ? (
                  <View style={styles.countBadge} pointerEvents="none">
                    <Text style={styles.countBadgeText}>{activeCount}</Text>
                  </View>
                ) : null}
              </View>
              <IconButton
                icon="add"
                accessibilityLabel="New item"
                onPress={() => router.push('/create-qr' as Href)}
                filled
              />
            </>
          }
        />
      }
    >
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        ItemSeparatorComponent={Separator}
        onEndReached={() => load('more')}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load('refresh')}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </Screen>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const mono = Platform.select({ ios: 'Menlo', default: 'monospace' });

const styles = StyleSheet.create({
  listContent: { paddingTop: spacing.xs, paddingBottom: spacing.xxl },
  listHeader: { gap: spacing.md, marginBottom: spacing.md },
  bleed: { marginHorizontal: -layout.screenPadding },
  chipRowBleed: {
    paddingHorizontal: layout.screenPadding,
    gap: spacing.sm,
    alignItems: 'center',
  },
  chipRow: { gap: spacing.sm, alignItems: 'center' },
  panel: { gap: spacing.lg },
  panelGroup: { gap: 0 },
  hint: { ...typography.caption, color: colors.textMuted },
  count: { ...typography.caption, color: colors.textSecondary },
  separator: { height: spacing.sm },
  item: { gap: spacing.sm },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  itemName: { ...typography.heading, color: colors.text, flex: 1 },
  barcode: { ...typography.caption, fontFamily: mono, color: colors.textMuted },
  itemBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  meta: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  lotPill: {
    maxWidth: '45%',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.primaryTint,
  },
  lotText: { ...typography.caption, fontWeight: '600', lineHeight: 16, color: colors.primary },
  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  inlineErrorText: { ...typography.caption, color: colors.danger, flex: 1 },
  countBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: { fontSize: 11, lineHeight: 14, fontWeight: '700', color: colors.onPrimary },
});
