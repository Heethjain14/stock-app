import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../theme';

export type LoadingStateProps = { message?: string };

export function LoadingState({ message = 'Loading' }: LoadingStateProps) {
  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel={message}>
      <ActivityIndicator size="small" color={colors.primary} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl, gap: spacing.md },
  text: { ...typography.caption, color: colors.textSecondary },
});
