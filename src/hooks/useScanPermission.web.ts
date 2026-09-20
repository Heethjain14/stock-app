import { PermissionStatus, type PermissionResponse } from 'expo-camera';

// Web: the browser asks for camera access itself when the stream starts, and Permissions-API
// support for "camera" is patchy (Safari, Android WebViews), so there is nothing to gate on here.
// CameraScanner reports getUserMedia failures through onError instead.
const GRANTED: PermissionResponse = {
  status: PermissionStatus.GRANTED,
  expires: 'never',
  granted: true,
  canAskAgain: true,
};

export function useScanPermission(): [PermissionResponse, () => Promise<PermissionResponse>] {
  return [GRANTED, async () => GRANTED];
}
