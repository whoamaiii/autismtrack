package com.kreativium.neurologg;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.Executor;

/**
 * BiometricPlugin - Native biometric authentication for Android
 *
 * Supports fingerprint, face recognition, and iris scanning
 * Uses AndroidX Biometric library for backward compatibility (API 23+)
 */
@CapacitorPlugin(name = "Biometric")
public class BiometricPlugin extends Plugin {
    private static final String TAG = "BiometricPlugin";

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private BiometricPrompt currentPrompt;

    // Authenticator types for different security levels
    private static final int BIOMETRIC_STRONG = BiometricManager.Authenticators.BIOMETRIC_STRONG;
    private static final int BIOMETRIC_WEAK = BiometricManager.Authenticators.BIOMETRIC_WEAK;
    private static final int DEVICE_CREDENTIAL = BiometricManager.Authenticators.DEVICE_CREDENTIAL;

    /**
     * Check if biometric authentication is available on this device
     */
    @PluginMethod
    public void isAvailable(PluginCall call) {
        Context context = getContext();
        BiometricManager biometricManager = BiometricManager.from(context);

        // Check for strong biometrics first (fingerprint, face with depth sensor)
        int canAuthStrong = biometricManager.canAuthenticate(BIOMETRIC_STRONG);
        // Fallback to weak biometrics (2D face recognition)
        int canAuthWeak = biometricManager.canAuthenticate(BIOMETRIC_WEAK);
        // Check for any biometric
        int canAuthAny = biometricManager.canAuthenticate(BIOMETRIC_STRONG | BIOMETRIC_WEAK);

        JSObject result = new JSObject();
        result.put("available", canAuthAny == BiometricManager.BIOMETRIC_SUCCESS);
        result.put("strongAvailable", canAuthStrong == BiometricManager.BIOMETRIC_SUCCESS);
        result.put("biometryType", getBiometryTypeString(canAuthStrong, canAuthWeak));
        result.put("errorCode", getErrorCodeString(canAuthAny));
        result.put("errorMessage", getErrorMessage(canAuthAny));

        call.resolve(result);
    }

    /**
     * Check if biometric is enrolled (hardware exists but may not be set up)
     */
    @PluginMethod
    public void checkEnrollment(PluginCall call) {
        Context context = getContext();
        BiometricManager biometricManager = BiometricManager.from(context);

        int canAuth = biometricManager.canAuthenticate(BIOMETRIC_STRONG | BIOMETRIC_WEAK);

        JSObject result = new JSObject();
        result.put("hardwareAvailable", canAuth != BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE);
        result.put("enrolled", canAuth == BiometricManager.BIOMETRIC_SUCCESS);
        result.put("needsEnrollment", canAuth == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED);
        result.put("errorCode", getErrorCodeString(canAuth));

        call.resolve(result);
    }

    /**
     * Authenticate user with biometric prompt
     */
    @PluginMethod
    public void authenticate(PluginCall call) {
        String title = call.getString("title", "Biometric Authentication");
        String subtitle = call.getString("subtitle", "");
        String description = call.getString("description", "");
        String negativeButtonText = call.getString("negativeButtonText", "Cancel");
        boolean allowDeviceCredential = call.getBoolean("allowDeviceCredential", false);

        // Must run on UI thread
        mainHandler.post(() -> {
            try {
                FragmentActivity activity = getActivity();
                if (activity == null) {
                    call.reject("Activity not available", "ACTIVITY_UNAVAILABLE");
                    return;
                }

                Executor executor = ContextCompat.getMainExecutor(getContext());

                BiometricPrompt.AuthenticationCallback callback = new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                        super.onAuthenticationSucceeded(result);
                        Log.d(TAG, "Authentication succeeded");

                        JSObject response = new JSObject();
                        response.put("success", true);
                        response.put("authenticationType", getAuthenticationType(result));
                        response.put("timestamp", System.currentTimeMillis());
                        call.resolve(response);
                    }

                    @Override
                    public void onAuthenticationFailed() {
                        super.onAuthenticationFailed();
                        Log.d(TAG, "Authentication failed (wrong biometric)");
                        // Don't reject here - user can try again
                        // Only called when biometric didn't match
                    }

                    @Override
                    public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                        super.onAuthenticationError(errorCode, errString);
                        Log.d(TAG, "Authentication error: " + errorCode + " - " + errString);

                        JSObject response = new JSObject();
                        response.put("success", false);
                        response.put("errorCode", mapErrorCode(errorCode));
                        response.put("errorMessage", errString.toString());
                        response.put("timestamp", System.currentTimeMillis());
                        call.resolve(response); // Resolve with error info instead of rejecting
                    }
                };

                currentPrompt = new BiometricPrompt(activity, executor, callback);

                BiometricPrompt.PromptInfo.Builder builder = new BiometricPrompt.PromptInfo.Builder()
                    .setTitle(title)
                    .setSubtitle(subtitle)
                    .setDescription(description);

                if (allowDeviceCredential) {
                    // Allow PIN/pattern/password as fallback
                    builder.setAllowedAuthenticators(BIOMETRIC_STRONG | BIOMETRIC_WEAK | DEVICE_CREDENTIAL);
                } else {
                    builder.setNegativeButtonText(negativeButtonText);
                    builder.setAllowedAuthenticators(BIOMETRIC_STRONG | BIOMETRIC_WEAK);
                }

                BiometricPrompt.PromptInfo promptInfo = builder.build();
                currentPrompt.authenticate(promptInfo);

            } catch (Exception e) {
                Log.e(TAG, "Error showing biometric prompt", e);
                call.reject("Failed to show biometric prompt: " + e.getMessage(), "PROMPT_FAILED");
            }
        });
    }

    /**
     * Cancel an in-progress authentication
     */
    @PluginMethod
    public void cancelAuthentication(PluginCall call) {
        if (currentPrompt != null) {
            mainHandler.post(() -> {
                currentPrompt.cancelAuthentication();
                currentPrompt = null;
            });
        }

        JSObject result = new JSObject();
        result.put("cancelled", true);
        call.resolve(result);
    }

    /**
     * Get the type of biometry available
     */
    private String getBiometryTypeString(int strongResult, int weakResult) {
        if (strongResult == BiometricManager.BIOMETRIC_SUCCESS) {
            // Strong biometric available (fingerprint, 3D face, iris)
            return "strong";
        } else if (weakResult == BiometricManager.BIOMETRIC_SUCCESS) {
            // Only weak biometric available (2D face)
            return "weak";
        } else if (strongResult == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED ||
                   weakResult == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED) {
            return "not_enrolled";
        } else if (strongResult == BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE &&
                   weakResult == BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE) {
            return "none";
        } else {
            return "unknown";
        }
    }

    /**
     * Get error code string from BiometricManager result
     */
    private String getErrorCodeString(int result) {
        switch (result) {
            case BiometricManager.BIOMETRIC_SUCCESS:
                return null;
            case BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE:
                return "NO_HARDWARE";
            case BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE:
                return "HW_UNAVAILABLE";
            case BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED:
                return "NONE_ENROLLED";
            case BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED:
                return "SECURITY_UPDATE_REQUIRED";
            case BiometricManager.BIOMETRIC_STATUS_UNKNOWN:
            default:
                return "UNKNOWN";
        }
    }

    /**
     * Get human-readable error message
     */
    private String getErrorMessage(int result) {
        switch (result) {
            case BiometricManager.BIOMETRIC_SUCCESS:
                return null;
            case BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE:
                return "No biometric hardware available on this device";
            case BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE:
                return "Biometric hardware is currently unavailable";
            case BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED:
                return "No biometric credentials are enrolled. Please set up fingerprint or face recognition in device settings.";
            case BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED:
                return "A security update is required before biometric authentication can be used";
            default:
                return "Unknown biometric status";
        }
    }

    /**
     * Map BiometricPrompt error codes to our error codes
     */
    private String mapErrorCode(int errorCode) {
        switch (errorCode) {
            case BiometricPrompt.ERROR_CANCELED:
                return "CANCELLED";
            case BiometricPrompt.ERROR_USER_CANCELED:
                return "USER_CANCELLED";
            case BiometricPrompt.ERROR_NEGATIVE_BUTTON:
                return "NEGATIVE_BUTTON";
            case BiometricPrompt.ERROR_LOCKOUT:
                return "LOCKOUT";
            case BiometricPrompt.ERROR_LOCKOUT_PERMANENT:
                return "LOCKOUT_PERMANENT";
            case BiometricPrompt.ERROR_NO_BIOMETRICS:
                return "NO_BIOMETRICS";
            case BiometricPrompt.ERROR_NO_DEVICE_CREDENTIAL:
                return "NO_DEVICE_CREDENTIAL";
            case BiometricPrompt.ERROR_HW_NOT_PRESENT:
                return "HW_NOT_PRESENT";
            case BiometricPrompt.ERROR_HW_UNAVAILABLE:
                return "HW_UNAVAILABLE";
            case BiometricPrompt.ERROR_TIMEOUT:
                return "TIMEOUT";
            case BiometricPrompt.ERROR_UNABLE_TO_PROCESS:
                return "UNABLE_TO_PROCESS";
            case BiometricPrompt.ERROR_VENDOR:
                return "VENDOR_ERROR";
            default:
                return "UNKNOWN_ERROR";
        }
    }

    /**
     * Get authentication type from result
     */
    private String getAuthenticationType(BiometricPrompt.AuthenticationResult result) {
        int authType = result.getAuthenticationType();
        switch (authType) {
            case BiometricPrompt.AUTHENTICATION_RESULT_TYPE_BIOMETRIC:
                return "biometric";
            case BiometricPrompt.AUTHENTICATION_RESULT_TYPE_DEVICE_CREDENTIAL:
                return "device_credential";
            default:
                return "unknown";
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (currentPrompt != null) {
            currentPrompt.cancelAuthentication();
            currentPrompt = null;
        }
        super.handleOnDestroy();
    }
}
