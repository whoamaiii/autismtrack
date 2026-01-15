package com.kreativium.neurologg;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.StatFs;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.mediapipe.tasks.genai.llminference.LlmInference;
import com.google.mediapipe.tasks.genai.llminference.LlmInference.LlmInferenceOptions;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.net.UnknownHostException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Capacitor plugin for running Kreativium 4B locally using MediaPipe LLM Inference.
 * Provides model download, loading, and text generation capabilities.
 */
@CapacitorPlugin(name = "Kreativium")
public class KreativiumPlugin extends Plugin {
    private static final String TAG = "KreativiumPlugin";

    // Model configuration
    // Model from LiteRT Community on Hugging Face (official MediaPipe-compatible format)
    // NOTE: This is a gated model - requires accepting the model license on Hugging Face
    private static final String MODEL_FILENAME = "gemma3-4b-it-int4-web.task";
    private static final String MODEL_URL = "https://huggingface.co/litert-community/Gemma3-4B-IT/resolve/main/gemma3-4b-it-int4-web.task";
    private static final long EXPECTED_MODEL_SIZE = 2560000000L; // ~2.56GB (actual size)

    // Bundled model configuration (for private/sideloaded distribution)
    // Place model file in: android/app/src/main/assets/models/gemma3-4b-it-int4-web.task
    private static final String BUNDLED_MODEL_ASSET_PATH = "models/" + MODEL_FILENAME;

    // Model size validation bounds (allow 5% variance)
    private static final long MIN_VALID_MODEL_SIZE = 2_400_000_000L; // 2.4GB minimum
    private static final long MAX_VALID_MODEL_SIZE = 2_700_000_000L; // 2.7GB maximum

    // Download configuration
    private static final int MAX_REDIRECTS = 5;
    private static final int BUFFER_SIZE = 65536; // 64KB for faster downloads
    private static final long PROGRESS_INTERVAL_MS = 250; // Max 4 progress updates per second
    private static final long PROGRESS_BYTES_THRESHOLD = 102400; // 100KB between updates

    // Retry configuration
    private static final int MAX_RETRIES = 3;
    private static final long INITIAL_RETRY_DELAY_MS = 1000; // 1 second
    private static final long MAX_RETRY_DELAY_MS = 30000; // 30 seconds

    // Thread-safe state variables
    private volatile LlmInference llmInference;
    private volatile boolean isModelLoaded = false;
    private final AtomicBoolean isDownloading = new AtomicBoolean(false);
    private final AtomicBoolean isExtracting = new AtomicBoolean(false);
    private volatile float downloadProgress = 0f;
    private volatile HttpURLConnection activeConnection = null;
    private volatile long downloadStartTime = 0;
    private volatile long totalBytesToDownload = 0;

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    /**
     * Debug logging helper - uses Android's isLoggable to check if DEBUG logging is enabled
     * Enable with: adb shell setprop log.tag.KreativiumPlugin DEBUG
     */
    private void logDebug(String message) {
        if (Log.isLoggable(TAG, Log.DEBUG)) {
            Log.d(TAG, message);
        }
    }

    /**
     * Cleanup resources when plugin is destroyed
     */
    @Override
    protected void handleOnDestroy() {
        // Cancel any in-progress download or extraction
        isDownloading.set(false);
        isExtracting.set(false);
        if (activeConnection != null) {
            try {
                activeConnection.disconnect();
            } catch (Exception ignored) {}
            activeConnection = null;
        }

        // Shutdown executor
        executor.shutdownNow();

        // Close model
        LlmInference inference = llmInference;
        if (inference != null) {
            try {
                inference.close();
            } catch (Exception ignored) {}
            llmInference = null;
        }
        isModelLoaded = false;

        super.handleOnDestroy();
    }

    /**
     * Check if network is available
     */
    @PluginMethod
    public void checkNetworkStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("connected", isNetworkAvailable());
        result.put("isWifi", isWifiConnected());
        call.resolve(result);
    }

    /**
     * Check if network is available
     */
    private boolean isNetworkAvailable() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getContext()
                    .getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return false;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                NetworkCapabilities caps = cm.getNetworkCapabilities(cm.getActiveNetwork());
                return caps != null && (
                        caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
                        caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ||
                        caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)
                );
            } else {
                android.net.NetworkInfo activeNetwork = cm.getActiveNetworkInfo();
                return activeNetwork != null && activeNetwork.isConnectedOrConnecting();
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not check network status: " + e.getMessage());
            return true; // Assume connected if we can't check
        }
    }

    /**
     * Check if connected via WiFi
     */
    private boolean isWifiConnected() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getContext()
                    .getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return false;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                NetworkCapabilities caps = cm.getNetworkCapabilities(cm.getActiveNetwork());
                return caps != null && caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI);
            } else {
                android.net.NetworkInfo activeNetwork = cm.getActiveNetworkInfo();
                return activeNetwork != null && activeNetwork.getType() == ConnectivityManager.TYPE_WIFI;
            }
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Check if model is bundled in APK assets
     */
    private boolean isBundledModelAvailable() {
        try {
            String[] assets = getContext().getAssets().list("models");
            if (assets != null) {
                for (String asset : assets) {
                    if (MODEL_FILENAME.equals(asset)) {
                        return true;
                    }
                }
            }
        } catch (IOException e) {
            Log.w(TAG, "Could not check bundled assets: " + e.getMessage());
        }
        return false;
    }

    /**
     * Extract bundled model from APK assets to app storage
     * This is needed because MediaPipe requires a file path, not an asset stream
     */
    private void extractBundledModel(PluginCall call) {
        // Prevent concurrent extractions
        if (!isExtracting.compareAndSet(false, true)) {
            call.reject("Extraction already in progress");
            return;
        }

        if (!isBundledModelAvailable()) {
            isExtracting.set(false);
            call.reject("No bundled model found in APK");
            return;
        }

        File modelFile = getModelFile();
        if (isValidModelFile(modelFile)) {
            isExtracting.set(false);
            // Already extracted
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("extracted", false);
            result.put("message", "Model already extracted");
            result.put("path", modelFile.getAbsolutePath());
            call.resolve(result);
            return;
        }

        // Check available disk space before extraction
        try {
            StatFs stat = new StatFs(getContext().getFilesDir().getPath());
            long availableBytes = stat.getAvailableBytes();
            long requiredBytes = (long) (EXPECTED_MODEL_SIZE * 1.1); // 10% buffer

            if (availableBytes < requiredBytes) {
                isExtracting.set(false);
                call.reject("Insufficient storage space for extraction. Need " +
                        formatBytes(requiredBytes) + ", have " +
                        formatBytes(availableBytes));
                return;
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not check disk space before extraction: " + e.getMessage());
        }

        executor.execute(() -> {
            File tempFile = new File(modelFile.getAbsolutePath() + ".extracting");

            try {
                Log.i(TAG, "Extracting bundled model from APK assets...");

                // Ensure models directory exists
                File modelsDir = modelFile.getParentFile();
                if (modelsDir != null && !modelsDir.exists()) {
                    if (!modelsDir.mkdirs()) {
                        Log.w(TAG, "Failed to create models directory");
                    }
                }

                // Delete any previous failed extraction attempt
                if (tempFile.exists()) {
                    tempFile.delete();
                }

                // Copy from assets to TEMP file first (atomic operation)
                try (InputStream in = getContext().getAssets().open(BUNDLED_MODEL_ASSET_PATH);
                     OutputStream out = new FileOutputStream(tempFile)) {

                    byte[] buffer = new byte[BUFFER_SIZE];
                    int bytesRead;
                    long totalCopied = 0;

                    while ((bytesRead = in.read(buffer)) != -1) {
                        out.write(buffer, 0, bytesRead);
                        totalCopied += bytesRead;

                        // Update progress (approximate since we don't know asset size)
                        downloadProgress = Math.min(0.99f, (float) totalCopied / EXPECTED_MODEL_SIZE);
                    }
                    out.flush();
                }

                // Validate extracted size before renaming
                long extractedSize = tempFile.length();
                if (extractedSize < MIN_VALID_MODEL_SIZE) {
                    tempFile.delete();
                    throw new IOException("Extracted file too small (" + formatBytes(extractedSize) +
                            "). Expected at least " + formatBytes(MIN_VALID_MODEL_SIZE));
                }

                // Atomic rename: temp -> final
                if (modelFile.exists()) {
                    modelFile.delete();
                }
                if (!tempFile.renameTo(modelFile)) {
                    // Fallback to copy if rename fails (cross-filesystem)
                    saveModelFile(tempFile, modelFile);
                }

                downloadProgress = 1.0f;
                isExtracting.set(false);
                Log.i(TAG, "Model extraction complete: " + modelFile.getAbsolutePath());

                mainHandler.post(() -> {
                    JSObject result = new JSObject();
                    result.put("success", true);
                    result.put("extracted", true);  // Important: mark as newly extracted
                    result.put("path", modelFile.getAbsolutePath());
                    result.put("size", modelFile.length());
                    call.resolve(result);
                });

            } catch (IOException e) {
                Log.e(TAG, "Failed to extract bundled model", e);

                // Clean up partial extraction
                if (tempFile.exists()) {
                    tempFile.delete();
                    logDebug("Deleted partial extraction: " + tempFile.getAbsolutePath());
                }

                downloadProgress = 0f;
                isExtracting.set(false);
                mainHandler.post(() -> call.reject("Failed to extract model: " + e.getMessage()));
            }
        });
    }

    /**
     * Check if bundled model exists and extract if needed (plugin method)
     */
    @PluginMethod
    public void extractBundledModelIfNeeded(PluginCall call) {
        File modelFile;
        try {
            modelFile = getModelFile();
        } catch (RuntimeException e) {
            call.reject("Cannot access model storage: " + e.getMessage());
            return;
        }

        // If model already exists and is valid, just return success
        if (isValidModelFile(modelFile)) {
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("extracted", false);
            result.put("message", "Model already available");
            result.put("path", modelFile.getAbsolutePath());
            call.resolve(result);
            return;
        }

        // Check if bundled model is available
        if (!isBundledModelAvailable()) {
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("bundled", false);
            result.put("message", "No bundled model found, download required");
            call.resolve(result);
            return;
        }

        // Extract bundled model
        extractBundledModel(call);
    }

    /**
     * Check if the model file exists on device with proper size validation
     */
    @PluginMethod
    public void isModelDownloaded(PluginCall call) {
        File modelFile;
        try {
            modelFile = getModelFile();
        } catch (RuntimeException e) {
            call.reject("Cannot access model storage: " + e.getMessage());
            return;
        }

        boolean exists = isValidModelFile(modelFile);

        // Check if bundled model is available but not yet extracted
        boolean bundledAvailable = !exists && isBundledModelAvailable();

        JSObject result = new JSObject();
        result.put("downloaded", exists);
        result.put("bundledAvailable", bundledAvailable);
        result.put("path", modelFile.getAbsolutePath());
        if (exists) {
            result.put("size", modelFile.length());
        }

        // Check for partial download
        File tempFile = new File(modelFile.getAbsolutePath() + ".tmp");
        if (tempFile.exists()) {
            result.put("partialDownload", true);
            result.put("partialSize", tempFile.length());
        }

        call.resolve(result);
    }

    /**
     * Check if the model is currently loaded and ready for inference
     */
    @PluginMethod
    public void isModelLoaded(PluginCall call) {
        JSObject result = new JSObject();
        result.put("loaded", isModelLoaded);
        call.resolve(result);
    }

    /**
     * Get current model status including download progress and ETA
     */
    @PluginMethod
    public void getModelStatus(PluginCall call) {
        File modelFile;
        try {
            modelFile = getModelFile();
        } catch (RuntimeException e) {
            // Return a status indicating storage is unavailable
            JSObject result = new JSObject();
            result.put("downloaded", false);
            result.put("bundledAvailable", false);
            result.put("loaded", false);
            result.put("downloading", false);
            result.put("extracting", false);
            result.put("downloadProgress", 0);
            result.put("error", "Storage unavailable: " + e.getMessage());
            call.resolve(result);
            return;
        }
        boolean downloaded = isValidModelFile(modelFile);

        // Check if bundled model is available but not yet extracted
        boolean bundledAvailable = !downloaded && isBundledModelAvailable();

        JSObject result = new JSObject();
        result.put("downloaded", downloaded);
        result.put("bundledAvailable", bundledAvailable);
        result.put("loaded", isModelLoaded);
        result.put("downloading", isDownloading.get());
        result.put("extracting", isExtracting.get());
        result.put("downloadProgress", downloadProgress);

        if (downloaded) {
            result.put("modelSize", modelFile.length());
        }

        // Add ETA if downloading
        if (isDownloading.get() && downloadStartTime > 0 && downloadProgress > 0.01f) {
            long elapsedMs = System.currentTimeMillis() - downloadStartTime;
            float progressRatio = downloadProgress;

            // Calculate ETA based on current progress
            if (progressRatio > 0) {
                long estimatedTotalMs = (long) (elapsedMs / progressRatio);
                long remainingMs = estimatedTotalMs - elapsedMs;
                result.put("etaSeconds", Math.max(0, remainingMs / 1000));

                // Calculate download speed (bytes per second)
                long downloadedBytes = (long) (totalBytesToDownload * progressRatio);
                if (elapsedMs > 0) {
                    long bytesPerSecond = (downloadedBytes * 1000) / elapsedMs;
                    result.put("speedBytesPerSec", bytesPerSecond);
                }
            }
        }

        call.resolve(result);
    }

    /**
     * Download the Kreativium 4B model file with retry and resume support
     */
    @PluginMethod
    public void downloadModel(PluginCall call) {
        // Atomic check-and-set to prevent concurrent downloads
        if (!isDownloading.compareAndSet(false, true)) {
            call.reject("Download already in progress");
            return;
        }

        // Check network connectivity
        if (!isNetworkAvailable()) {
            isDownloading.set(false);
            call.reject("No network connection. Please connect to the internet and try again.");
            return;
        }

        File modelFile;
        try {
            modelFile = getModelFile();
        } catch (RuntimeException e) {
            isDownloading.set(false);
            call.reject("Cannot access model storage: " + e.getMessage());
            return;
        }

        if (isValidModelFile(modelFile)) {
            isDownloading.set(false);
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "Model already downloaded");
            call.resolve(result);
            return;
        }

        // Check available disk space before starting download
        try {
            StatFs stat = new StatFs(getContext().getFilesDir().getPath());
            long availableBytes = stat.getAvailableBytes();
            long requiredBytes = (long) (EXPECTED_MODEL_SIZE * 1.1); // 10% buffer

            if (availableBytes < requiredBytes) {
                isDownloading.set(false);
                call.reject("Insufficient storage space. Need " +
                        formatBytes(requiredBytes) + ", have " +
                        formatBytes(availableBytes));
                return;
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not check disk space: " + e.getMessage());
        }

        // Get optional HF token
        String hfToken = call.getString("hfToken");
        if (hfToken == null || hfToken.isEmpty()) {
            hfToken = getStoredHfToken();
        }

        downloadProgress = 0f;
        downloadStartTime = System.currentTimeMillis();
        totalBytesToDownload = EXPECTED_MODEL_SIZE;

        final String tokenToUse = hfToken;

        executor.execute(() -> {
            try {
                downloadModelWithRetry(call, tokenToUse);
            } catch (Exception e) {
                Log.e(TAG, "Download failed", e);
                isDownloading.set(false);
                activeConnection = null;
                downloadStartTime = 0;

                // Clean up partial download on error (unless it's resumable)
                // Keep temp file for resume if it's a transient error
                if (!isTransientError(e)) {
                    File tempFile = new File(modelFile.getAbsolutePath() + ".tmp");
                    if (tempFile.exists()) {
                        tempFile.delete();
                    }
                }

                mainHandler.post(() -> call.reject("Download failed: " + e.getMessage()));
            }
        });
    }

    /**
     * Check if an exception is a transient error that might succeed on retry
     */
    private boolean isTransientError(Exception e) {
        if (e instanceof SocketTimeoutException || e instanceof UnknownHostException) {
            return true;
        }
        if (e instanceof IOException && e.getMessage() != null) {
            String msg = e.getMessage().toLowerCase();
            return msg.contains("timeout") ||
                   msg.contains("reset") ||
                   msg.contains("connection") ||
                   msg.contains("http 500") ||
                   msg.contains("http 502") ||
                   msg.contains("http 503") ||
                   msg.contains("http 504") ||
                   msg.contains("server error");
        }
        return false;
    }

    /**
     * Download model with automatic retry for transient errors
     */
    private void downloadModelWithRetry(PluginCall call, String hfToken) throws IOException {
        int attempts = 0;
        IOException lastException = null;

        while (attempts < MAX_RETRIES && isDownloading.get()) {
            try {
                downloadModelFile(call, hfToken);
                return; // Success!
            } catch (IOException e) {
                lastException = e;
                attempts++;

                // Don't retry for auth errors or permanent failures
                if (!isTransientError(e)) {
                    throw e;
                }

                if (attempts < MAX_RETRIES && isDownloading.get()) {
                    // Exponential backoff with jitter
                    long delay = Math.min(
                            INITIAL_RETRY_DELAY_MS * (long) Math.pow(2, attempts - 1),
                            MAX_RETRY_DELAY_MS
                    );
                    delay += (long) (Math.random() * 1000); // Add jitter

                    logDebug("Download attempt " + attempts + " failed, retrying in " + delay + "ms: " + e.getMessage());

                    try {
                        Thread.sleep(delay);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new IOException("Download interrupted");
                    }
                }
            }
        }

        throw lastException != null ? lastException : new IOException("Download failed after " + MAX_RETRIES + " attempts");
    }

    /**
     * Cancel an ongoing download
     */
    @PluginMethod
    public void cancelDownload(PluginCall call) {
        if (isDownloading.compareAndSet(true, false)) {
            downloadStartTime = 0;

            // Disconnect active connection
            HttpURLConnection conn = activeConnection;
            if (conn != null) {
                try {
                    conn.disconnect();
                } catch (Exception e) {
                    Log.w(TAG, "Error disconnecting: " + e.getMessage());
                }
                activeConnection = null;
            }

            // Delete the temp file (ignore storage errors during cancel)
            try {
                File modelFile = getModelFile();
                File tempFile = new File(modelFile.getAbsolutePath() + ".tmp");
                if (tempFile.exists()) {
                    tempFile.delete();
                    logDebug("Deleted partial download: " + tempFile.getAbsolutePath());
                }
            } catch (RuntimeException e) {
                Log.w(TAG, "Could not clean up temp file: " + e.getMessage());
            }

            JSObject result = new JSObject();
            result.put("cancelled", true);
            call.resolve(result);
        } else {
            call.reject("No download in progress");
        }
    }

    /**
     * Load the model into memory for inference
     */
    @PluginMethod
    public void loadModel(PluginCall call) {
        if (isModelLoaded && llmInference != null) {
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "Model already loaded");
            call.resolve(result);
            return;
        }

        File modelFile = getModelFile();
        if (!modelFile.exists()) {
            call.reject("Model file not found. Please download it first.");
            return;
        }

        if (!isValidModelFile(modelFile)) {
            call.reject("Model file appears corrupted. Please delete and re-download.");
            return;
        }

        executor.execute(() -> {
            try {
                logDebug("Loading model from: " + modelFile.getAbsolutePath());

                LlmInferenceOptions options = LlmInferenceOptions.builder()
                    .setModelPath(modelFile.getAbsolutePath())
                    .setMaxTokens(4096)
                    .build();

                LlmInference newInference = LlmInference.createFromOptions(
                    getContext(),
                    options
                );

                llmInference = newInference;
                isModelLoaded = true;

                mainHandler.post(() -> {
                    JSObject result = new JSObject();
                    result.put("success", true);
                    result.put("message", "Model loaded successfully");
                    call.resolve(result);
                });

            } catch (Exception e) {
                Log.e(TAG, "Failed to load model", e);
                mainHandler.post(() -> call.reject("Failed to load model: " + e.getMessage()));
            }
        });
    }

    /**
     * Unload the model from memory
     */
    @PluginMethod
    public void unloadModel(PluginCall call) {
        executor.execute(() -> {
            LlmInference inference = llmInference;
            if (inference != null) {
                try {
                    inference.close();
                } catch (Exception e) {
                    Log.w(TAG, "Error closing model: " + e.getMessage());
                }
                llmInference = null;
            }
            isModelLoaded = false;

            mainHandler.post(() -> {
                JSObject result = new JSObject();
                result.put("success", true);
                call.resolve(result);
            });
        });
    }

    /**
     * Generate a response using the loaded model
     */
    @PluginMethod
    public void generateResponse(PluginCall call) {
        String prompt = call.getString("prompt");

        if (prompt == null || prompt.isEmpty()) {
            call.reject("Prompt is required");
            return;
        }

        if (!isModelLoaded) {
            call.reject("Model not loaded. Call loadModel() first.");
            return;
        }

        executor.execute(() -> {
            LlmInference inference = llmInference;
            if (inference == null) {
                mainHandler.post(() -> call.reject("Model was unloaded. Please reload the model."));
                return;
            }

            try {
                logDebug("Generating response for prompt length: " + prompt.length());
                long startTime = System.currentTimeMillis();

                String response = inference.generateResponse(prompt);

                long endTime = System.currentTimeMillis();
                long duration = endTime - startTime;

                logDebug("Generated response in " + duration + "ms");

                mainHandler.post(() -> {
                    JSObject result = new JSObject();
                    result.put("response", response);
                    result.put("durationMs", duration);
                    call.resolve(result);
                });

            } catch (Exception e) {
                Log.e(TAG, "Generation failed", e);
                mainHandler.post(() -> call.reject("Generation failed: " + e.getMessage()));
            }
        });
    }

    /**
     * Delete the downloaded model file
     */
    @PluginMethod
    public void deleteModel(PluginCall call) {
        executor.execute(() -> {
            LlmInference inference = llmInference;
            if (inference != null) {
                try {
                    inference.close();
                } catch (Exception e) {
                    Log.w(TAG, "Error closing model: " + e.getMessage());
                }
                llmInference = null;
                isModelLoaded = false;
            }

            File modelFile = getModelFile();
            boolean deleted = false;

            if (modelFile.exists()) {
                deleted = modelFile.delete();
            }

            // Clean up temp files (both download .tmp and extraction .extracting)
            File tempFile = new File(modelFile.getAbsolutePath() + ".tmp");
            if (tempFile.exists()) {
                tempFile.delete();
            }
            File extractingFile = new File(modelFile.getAbsolutePath() + ".extracting");
            if (extractingFile.exists()) {
                extractingFile.delete();
            }

            final boolean wasDeleted = deleted;
            mainHandler.post(() -> {
                JSObject result = new JSObject();
                result.put("deleted", wasDeleted);
                call.resolve(result);
            });
        });
    }

    /**
     * Check if a model file is valid
     */
    private boolean isValidModelFile(File modelFile) {
        if (!modelFile.exists()) {
            return false;
        }
        long size = modelFile.length();
        return size >= MIN_VALID_MODEL_SIZE && size <= MAX_VALID_MODEL_SIZE;
    }

    /**
     * Get model file path, creating directory if needed
     * @throws RuntimeException if directory cannot be created
     */
    private File getModelFile() {
        File modelsDir = new File(getContext().getFilesDir(), "models");
        if (!modelsDir.exists()) {
            if (!modelsDir.mkdirs()) {
                // Check if another thread created it concurrently
                if (!modelsDir.exists()) {
                    throw new RuntimeException("Cannot create models directory at " + modelsDir.getAbsolutePath() +
                            ". Check storage permissions and available space.");
                }
            }
        }
        // Verify directory is writable
        if (!modelsDir.canWrite()) {
            throw new RuntimeException("Models directory is not writable: " + modelsDir.getAbsolutePath());
        }
        return new File(modelsDir, MODEL_FILENAME);
    }

    /**
     * Get stored Hugging Face token
     */
    private String getStoredHfToken() {
        try {
            return getContext().getSharedPreferences("kreativium_prefs", 0)
                    .getString("hf_token", null);
        } catch (Exception e) {
            Log.w(TAG, "Failed to read HF token: " + e.getMessage());
            return null;
        }
    }

    /**
     * Format bytes to human-readable string
     */
    private String formatBytes(long bytes) {
        if (bytes >= 1_000_000_000L) {
            return String.format("%.1f GB", bytes / 1_000_000_000.0);
        } else if (bytes >= 1_000_000L) {
            return String.format("%.1f MB", bytes / 1_000_000.0);
        } else {
            return bytes + " bytes";
        }
    }

    /**
     * Validate Hugging Face token format
     * Valid tokens start with 'hf_' followed by alphanumeric characters
     * @return null if valid, error message if invalid
     */
    private String validateHfToken(String token) {
        if (token == null || token.trim().isEmpty()) {
            return "Token cannot be empty";
        }

        String trimmedToken = token.trim();

        // Check for correct prefix
        if (!trimmedToken.startsWith("hf_")) {
            return "Token must start with 'hf_'. Get your token from huggingface.co/settings/tokens";
        }

        // Check minimum length (hf_ + at least some characters)
        if (trimmedToken.length() < 10) {
            return "Token appears too short. Check that you copied it completely.";
        }

        // Check for valid characters (alphanumeric after hf_)
        String tokenBody = trimmedToken.substring(3);
        if (!tokenBody.matches("^[a-zA-Z0-9]+$")) {
            return "Token contains invalid characters. Only letters and numbers are allowed.";
        }

        return null; // Valid
    }

    /**
     * Store Hugging Face token
     */
    @PluginMethod
    public void setHfToken(PluginCall call) {
        String token = call.getString("token");
        if (token == null || token.isEmpty()) {
            call.reject("Token is required");
            return;
        }

        // Validate token format
        String validationError = validateHfToken(token);
        if (validationError != null) {
            call.reject(validationError);
            return;
        }

        try {
            getContext().getSharedPreferences("kreativium_prefs", 0)
                    .edit()
                    .putString("hf_token", token.trim())
                    .apply();

            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to save token: " + e.getMessage());
        }
    }

    /**
     * Clear stored Hugging Face token
     */
    @PluginMethod
    public void clearHfToken(PluginCall call) {
        try {
            getContext().getSharedPreferences("kreativium_prefs", 0)
                    .edit()
                    .remove("hf_token")
                    .apply();

            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to clear token: " + e.getMessage());
        }
    }

    /**
     * Setup HTTP connection with proper headers
     */
    private void setupConnection(HttpURLConnection connection, String hfToken) {
        connection.setRequestProperty("User-Agent", "NeuroLoggPro/1.0 (Android; Kreativium4BDownload)");
        connection.setRequestProperty("Accept", "application/octet-stream");
        connection.setConnectTimeout(60000);
        connection.setReadTimeout(600000);

        if (hfToken != null && !hfToken.isEmpty()) {
            connection.setRequestProperty("Authorization", "Bearer " + hfToken);
        }
    }

    /**
     * Setup connection with Range header for resume
     */
    private void setupConnectionWithRange(HttpURLConnection connection, String hfToken, long startByte) {
        setupConnection(connection, hfToken);
        if (startByte > 0) {
            connection.setRequestProperty("Range", "bytes=" + startByte + "-");
        }
    }

    /**
     * Read HTTP error response
     */
    private String readErrorResponse(HttpURLConnection connection, int responseCode) {
        String errorMessage = "Server returned HTTP " + responseCode;

        if (responseCode == 401) {
            return "Authentication required. Please provide a valid Hugging Face token.";
        } else if (responseCode == 403) {
            return "Access denied. Please accept the model license on Hugging Face and provide a valid token.";
        }

        try (InputStream errorStream = connection.getErrorStream()) {
            if (errorStream != null) {
                byte[] buffer = new byte[1024];
                int len = errorStream.read(buffer);
                if (len > 0) {
                    String body = new String(buffer, 0, Math.min(len, 200));
                    errorMessage += ": " + body.trim();
                }
            }
        } catch (Exception ignored) {}

        return errorMessage;
    }

    /**
     * Save model file with fallback for cross-filesystem moves
     */
    private void saveModelFile(File tempFile, File modelFile) throws IOException {
        if (modelFile.exists()) {
            if (!modelFile.delete()) {
                Log.w(TAG, "Could not delete existing model file");
            }
        }

        if (tempFile.renameTo(modelFile)) {
            return;
        }

        logDebug("Rename failed, falling back to copy");
        try (InputStream in = new FileInputStream(tempFile);
             OutputStream out = new FileOutputStream(modelFile)) {

            byte[] buffer = new byte[BUFFER_SIZE];
            int bytesRead;
            while ((bytesRead = in.read(buffer)) != -1) {
                out.write(buffer, 0, bytesRead);
            }
            out.flush();
        }

        if (!tempFile.delete()) {
            Log.w(TAG, "Could not delete temp file after copy");
        }
    }

    /**
     * Download model file with progress, resume support, and proper error handling
     */
    private void downloadModelFile(PluginCall call, String hfToken) throws IOException {
        File modelFile = getModelFile();
        File tempFile = new File(modelFile.getAbsolutePath() + ".tmp");

        // Check for existing partial download for resume
        long existingBytes = 0;
        if (tempFile.exists()) {
            existingBytes = tempFile.length();
            logDebug("Found partial download: " + formatBytes(existingBytes));
        }

        URL url = new URL(MODEL_URL);
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        activeConnection = connection;

        connection.setRequestMethod("GET");
        setupConnectionWithRange(connection, hfToken, existingBytes);

        int responseCode = connection.getResponseCode();
        int redirectCount = 0;

        // Handle redirects
        while ((responseCode == HttpURLConnection.HTTP_MOVED_TEMP ||
                responseCode == HttpURLConnection.HTTP_MOVED_PERM ||
                responseCode == 307 || responseCode == 308) &&
               redirectCount < MAX_REDIRECTS) {

            String newUrl = connection.getHeaderField("Location");
            if (newUrl == null) {
                throw new IOException("Redirect without Location header");
            }

            connection.disconnect();
            connection = (HttpURLConnection) new URL(newUrl).openConnection();
            activeConnection = connection;

            connection.setRequestMethod("GET");
            setupConnectionWithRange(connection, hfToken, existingBytes);

            responseCode = connection.getResponseCode();
            redirectCount++;
        }

        if (redirectCount >= MAX_REDIRECTS) {
            activeConnection = null;
            throw new IOException("Too many redirects (max " + MAX_REDIRECTS + ")");
        }

        // Check if resume is supported (206 Partial Content)
        boolean resuming = responseCode == 206 && existingBytes > 0;
        if (!resuming && responseCode != HttpURLConnection.HTTP_OK) {
            String errorMessage = readErrorResponse(connection, responseCode);
            activeConnection = null;
            throw new IOException(errorMessage);
        }

        // If server doesn't support range and we have partial data, start fresh
        if (responseCode == HttpURLConnection.HTTP_OK && existingBytes > 0) {
            logDebug("Server doesn't support resume, starting fresh download");
            existingBytes = 0;
            tempFile.delete();
        }

        long contentLength = connection.getContentLengthLong();
        totalBytesToDownload = resuming ?
                existingBytes + contentLength :
                (contentLength > 0 ? contentLength : EXPECTED_MODEL_SIZE);

        // Update progress for resumed downloads
        if (resuming) {
            downloadProgress = (float) existingBytes / totalBytesToDownload;
            logDebug("Resuming download from " + formatBytes(existingBytes) +
                    " (" + Math.round(downloadProgress * 100) + "%)");
        }

        try (InputStream inputStream = connection.getInputStream();
             FileOutputStream outputStream = resuming ?
                     new FileOutputStream(tempFile, true) : // Append mode for resume
                     new FileOutputStream(tempFile)) {

            byte[] buffer = new byte[BUFFER_SIZE];
            long downloadedBytes = existingBytes;
            int bytesRead;
            long lastProgressUpdate = downloadedBytes;
            long lastProgressTime = System.currentTimeMillis();

            while ((bytesRead = inputStream.read(buffer)) != -1) {
                if (!isDownloading.get()) {
                    activeConnection = null;
                    return;
                }

                outputStream.write(buffer, 0, bytesRead);
                downloadedBytes += bytesRead;

                long now = System.currentTimeMillis();
                if (downloadedBytes - lastProgressUpdate > PROGRESS_BYTES_THRESHOLD &&
                    now - lastProgressTime >= PROGRESS_INTERVAL_MS) {

                    downloadProgress = Math.min(1.0f, Math.max(0f, (float) downloadedBytes / totalBytesToDownload));
                    lastProgressUpdate = downloadedBytes;
                    lastProgressTime = now;

                    final float progress = downloadProgress;
                    final long downloaded = downloadedBytes;
                    final long total = totalBytesToDownload;

                    // Calculate ETA
                    long elapsedMs = now - downloadStartTime;
                    long etaMs = progress > 0 ? (long) ((elapsedMs / progress) * (1 - progress)) : 0;

                    mainHandler.post(() -> {
                        JSObject progressData = new JSObject();
                        progressData.put("progress", progress);
                        progressData.put("downloadedBytes", downloaded);
                        progressData.put("totalBytes", total);
                        progressData.put("etaSeconds", etaMs / 1000);
                        notifyListeners("downloadProgress", progressData);
                    });
                }
            }

            outputStream.flush();
        }

        activeConnection = null;

        // Validate downloaded file
        long downloadedSize = tempFile.length();
        if (downloadedSize < MIN_VALID_MODEL_SIZE) {
            tempFile.delete();
            throw new IOException("Downloaded file too small (" + formatBytes(downloadedSize) +
                    "). Expected at least " + formatBytes(MIN_VALID_MODEL_SIZE));
        }

        // Save model file
        try {
            saveModelFile(tempFile, modelFile);
        } catch (IOException e) {
            tempFile.delete();
            throw new IOException("Failed to save model file: " + e.getMessage());
        }

        isDownloading.set(false);
        downloadProgress = 1.0f;
        downloadStartTime = 0;

        mainHandler.post(() -> {
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("path", modelFile.getAbsolutePath());
            result.put("size", modelFile.length());
            call.resolve(result);
        });
    }
}
