import React from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '../../theme';
import { Chip } from './Chip';

export type ChipOption<T extends string> = { value: T; label?: string };

export type ChipGroupProps<T extends string> = {
  options: readonly (T | ChipOption<T>)[];
  value: T | null;
  onChange: (value: T | null) => void;
  /** Tapping the selected chip clears it (default true). */
  allowDeselect?: boolean;
};

export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  allowDeselect = true,
}: ChipGroupProps<T>) {
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup">
      {options.map((opt) => {
        const o: ChipOption<T> = typeof opt === 'string' ? { value: opt } : opt;
        const selected = o.value === value;
        return (
          <Chip
            key={o.value}
            label={o.label ?? o.value}
            selected={selected}
            onPress={() => onChange(selected && allowDeselect ? null : o.value)}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
