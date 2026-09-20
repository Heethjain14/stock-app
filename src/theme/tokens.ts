import type { TextStyle, ViewStyle } from 'react-native';

export const colors = {
  background: '#F6F5F2',
  surface: '#FFFFFF',
  surfaceMuted: '#F0EEE9',
  text: '#16181D',
  textSecondary: '#5B616B',
  textMuted: '#8A8F98',
  border: '#E6E3DC',
  primary: '#1F3A5F',
  primaryPressed: '#172C48',
  primaryTint: '#E8EDF4',
  onPrimary: '#FFFFFF',
  success: '#2E7D5B',
  successTint: '#E5F2EC',
  warning: '#A9701A',
  warningTint: '#FBF0DC',
  danger: '#B3372F',
  dangerPressed: '#962C25',
  dangerTint: '#F9E6E4',
  overlay: 'rgba(22,24,29,0.4)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radii = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const layout = { screenPadding: 16, minTouch: 44, maxContentWidth: 640 } as const;

export const typography = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  heading: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
} as const satisfies Record<string, TextStyle>;

export const shadows = {
  none: {},
  sm: {
    shadowColor: '#16181D',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  md: {
    shadowColor: '#16181D',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
} as const satisfies Record<string, ViewStyle>;

export type ColorToken = keyof typeof colors;
export type TypographyVariant = keyof typeof typography;
export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

export const toneColors: Record<Tone, { fg: string; bg: string }> = {
  neutral: { fg: colors.textSecondary, bg: colors.surfaceMuted },
  primary: { fg: colors.primary, bg: colors.primaryTint },
  success: { fg: colors.success, bg: colors.successTint },
  warning: { fg: colors.warning, bg: colors.warningTint },
  danger: { fg: colors.danger, bg: colors.dangerTint },
};
