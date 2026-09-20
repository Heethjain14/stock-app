import { CameraView } from 'expo-camera';
import React from 'react';
import { StyleSheet } from 'react-native';
import type { CameraScannerProps } from './cameraScannerTypes';

export function CameraScanner({ armed, torch, onCode }: CameraScannerProps) {
  return (
    <CameraView
      style={StyleSheet.absoluteFill}
      facing="back"
      enableTorch={torch}
      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      onBarcodeScanned={armed ? ({ data }) => onCode(data) : undefined}
    />
  );
}
