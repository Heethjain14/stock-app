import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../theme';

export type SectionLabelProps = { children: string; right?: React.ReactNode };

export function SectionLabel({ children, right }: SectionLabelProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.text} accessibilityRole="header">
        {children}
      </Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  text: { ...typography.label, color: colors.textSecondary },
});
