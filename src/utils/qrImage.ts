import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

export type QrSaveResult = 'saved' | 'denied' | 'shared';

// Browsers download the PNG instead of saving to a photo library, so the wording differs.
export const SAVE_QR_LABEL = Platform.OS === 'web' ? 'Download QR image' : 'Save QR to Photos';
export const QR_SHARED_MESSAGE =
  Platform.OS === 'web'
    ? 'QR image downloaded. Check your Downloads folder.'
    : 'QR image ready. Choose where to save or share it.';

// Barcodes are short enough to always be a 21-module (version 1) QR, so 4 modules of white
// border is about 19% of the code. Scanners need that border, and it must be part of the
// image itself: a saved or shared PNG has no card padding around it, and on a dark background
// (e.g. WhatsApp dark mode) a code without it cannot be read.
export function qrQuietZone(size: number): number {
  return Math.round(size * 0.19);
}

// Browsers have no file system or photo library API, so on web we trigger a normal download.
function downloadPngOnWeb(base64: string, barcode: string): void {
  const a = document.createElement('a');
  a.href = `data:image/png;base64,${base64}`;
  a.download = `${barcode}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// expo-media-library is loaded lazily: Expo Go does not ship its native module, and a static
// import would crash every screen that mentions it. Without it we fall back to the share sheet.
async function saveToPhotos(uri: string): Promise<'saved' | 'denied' | null> {
  try {
    const MediaLibrary = await import('expo-media-library');
    const perm = await MediaLibrary.requestPermissionsAsync(true);
    if (!perm.granted) return 'denied';
    await MediaLibrary.saveToLibraryAsync(uri);
    return 'saved';
  } catch {
    return null;
  }
}

function writePng(base64: string, barcode: string): File {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const file = new File(Paths.cache, `${barcode}.png`);
  file.write(bytes);
  return file;
}

export async function shareQrPng(base64: string, barcode: string): Promise<'shared'> {
  if (Platform.OS === 'web') {
    downloadPngOnWeb(base64, barcode);
    return 'shared';
  }
  const file = writePng(base64, barcode);
  const Sharing = await import('expo-sharing');
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing images is not supported on this device');
  }
  await Sharing.shareAsync(file.uri, { mimeType: 'image/png', dialogTitle: 'Save or share QR label' });
  return 'shared';
}

export async function saveQrPng(base64: string, barcode: string): Promise<QrSaveResult> {
  if (Platform.OS === 'web') return shareQrPng(base64, barcode);
  const file = writePng(base64, barcode);
  const result = await saveToPhotos(file.uri);
  if (result) return result;
  return shareQrPng(base64, barcode);
}
