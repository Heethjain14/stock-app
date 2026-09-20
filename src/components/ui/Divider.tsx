import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../../theme';

export type DividerProps = { style?: StyleProp<ViewStyle> };

export function Divider({ style }: DividerProps) {
  return <View style={[styles.line, style]} accessibilityElementsHidden importantForAccessibility="no" />;
}

const styles = StyleSheet.create({
  line: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, alignSelf: 'stretch' },
});
