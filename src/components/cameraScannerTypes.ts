export type CameraScannerProps = {
  /** When false the camera keeps running but codes are ignored. */
  armed: boolean;
  torch: boolean;
  onCode: (data: string) => void;
  /** Camera could not start or the decoder failed (web only; native shows its own permission UI). */
  onError?: (message: string) => void;
};
