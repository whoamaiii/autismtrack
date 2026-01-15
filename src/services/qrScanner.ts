/**
 * QR Scanner Service
 * Wraps @capacitor-mlkit/barcode-scanning for cross-platform QR code scanning
 */

import { isNative } from '../utils/platform';
import type { BarcodeScannerPlugin } from '@capacitor-mlkit/barcode-scanning';

let BarcodeScanner: BarcodeScannerPlugin | null = null;

/**
 * Initialize the barcode scanner plugin
 * Must be called before using other functions
 */
async function initializePlugin(): Promise<boolean> {
  if (BarcodeScanner) return true;

  try {
    const module = await import('@capacitor-mlkit/barcode-scanning');
    BarcodeScanner = module.BarcodeScanner;
    return true;
  } catch (error) {
    console.warn('[QRScanner] Failed to load barcode scanner plugin:', error);
    return false;
  }
}

/**
 * Check if QR scanning is supported on this platform
 */
export async function isQrScannerSupported(): Promise<boolean> {
  // Only supported on native platforms
  if (!isNative()) {
    return false;
  }

  const initialized = await initializePlugin();
  if (!initialized || !BarcodeScanner) return false;

  try {
    const result = await BarcodeScanner.isSupported();
    return result.supported;
  } catch (error) {
    console.error('[QRScanner] Error checking support:', error);
    return false;
  }
}

/**
 * Check and request camera permissions for scanning
 */
export async function requestQrScannerPermission(): Promise<'granted' | 'denied' | 'unavailable'> {
  if (!isNative()) {
    return 'unavailable';
  }

  const initialized = await initializePlugin();
  if (!initialized || !BarcodeScanner) return 'unavailable';

  try {
    // Check current permission status
    const status = await BarcodeScanner.checkPermissions();

    if (status.camera === 'granted' || status.camera === 'limited') {
      return 'granted';
    }

    if (status.camera === 'denied') {
      return 'denied';
    }

    // Request permission
    const requestResult = await BarcodeScanner.requestPermissions();
    return requestResult.camera === 'granted' || requestResult.camera === 'limited'
      ? 'granted'
      : 'denied';
  } catch (error) {
    console.error('[QRScanner] Permission error:', error);
    return 'unavailable';
  }
}

/**
 * Ensure Google Barcode Scanner module is available (Android only)
 * ML Kit uses a separate module that may need to be downloaded
 */
export async function ensureGoogleModuleAvailable(): Promise<boolean> {
  const initialized = await initializePlugin();
  if (!initialized || !BarcodeScanner) return false;

  try {
    const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();

    if (!available) {
      // Trigger module download
      await BarcodeScanner.installGoogleBarcodeScannerModule();
      return true;
    }

    return true;
  } catch (error) {
    // This may fail on iOS or if module is already available
    console.warn('[QRScanner] Module check/install:', error);
    return true; // Assume available and try scanning anyway
  }
}

export interface QrScanResult {
  success: boolean;
  data?: string;
  error?: string;
  errorCode?: 'PERMISSION_DENIED' | 'NOT_SUPPORTED' | 'CANCELLED' | 'NO_CODE_FOUND' | 'SCAN_ERROR';
}

/**
 * Scan for a QR code
 * Opens the camera and scans for QR codes
 */
export async function scanQrCode(): Promise<QrScanResult> {
  // Check platform support
  if (!isNative()) {
    return {
      success: false,
      error: 'QR scanning is only available on native platforms',
      errorCode: 'NOT_SUPPORTED',
    };
  }

  const initialized = await initializePlugin();
  if (!initialized || !BarcodeScanner) {
    return {
      success: false,
      error: 'QR scanner plugin not available',
      errorCode: 'NOT_SUPPORTED',
    };
  }

  // Check/request permissions
  const permission = await requestQrScannerPermission();
  if (permission === 'denied') {
    return {
      success: false,
      error: 'Camera permission denied. Please enable camera access in settings.',
      errorCode: 'PERMISSION_DENIED',
    };
  }

  if (permission === 'unavailable') {
    return {
      success: false,
      error: 'Camera not available',
      errorCode: 'NOT_SUPPORTED',
    };
  }

  // Ensure Google module is available (Android)
  await ensureGoogleModuleAvailable();

  try {
    // Import the BarcodeFormat enum for QR_CODE
    const { BarcodeFormat } = await import('@capacitor-mlkit/barcode-scanning');

    // Scan for QR codes only
    const result = await BarcodeScanner.scan({
      formats: [BarcodeFormat.QrCode],
    });

    if (!result.barcodes || result.barcodes.length === 0) {
      return {
        success: false,
        error: 'No QR code found',
        errorCode: 'NO_CODE_FOUND',
      };
    }

    // Return the first QR code found
    const qrCode = result.barcodes[0];
    const data = qrCode.rawValue ?? qrCode.displayValue;
    return {
      success: true,
      data,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check for user cancellation
    if (errorMessage.includes('cancel') || errorMessage.includes('Cancel')) {
      return {
        success: false,
        error: 'Scan cancelled',
        errorCode: 'CANCELLED',
      };
    }

    console.error('[QRScanner] Scan error:', error);
    return {
      success: false,
      error: `Scan failed: ${errorMessage}`,
      errorCode: 'SCAN_ERROR',
    };
  }
}
