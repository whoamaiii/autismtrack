# Bundled Model Instructions

This folder is for the Kreativium 4B model file that gets bundled with the APK.

## How to Download the Model

1. **Accept the model license** (required):
   - Go to: https://huggingface.co/litert-community/Gemma3-4B-IT
   - Click "Access repository" and accept the license terms
   - You need a Hugging Face account

2. **Download the Model File**:
   - Direct link: https://huggingface.co/litert-community/Gemma3-4B-IT/resolve/main/gemma3-4b-it-int4-web.task
   - Or use curl/wget with authentication:
   ```bash
   # First, create a read token at https://huggingface.co/settings/tokens
   curl -L -H "Authorization: Bearer YOUR_HF_TOKEN" \
     https://huggingface.co/litert-community/Gemma3-4B-IT/resolve/main/gemma3-4b-it-int4-web.task \
     -o gemma3-4b-it-int4-web.task
   ```

3. **Place the Model Here**:
   - Copy `gemma3-4b-it-int4-web.task` to this `models/` folder
   - File size should be approximately 2.56 GB

4. **Build the APK**:
   ```bash
   cd /path/to/autismtrack
   npm run build && npx cap sync android
   cd android && ./gradlew assembleDebug
   ```

## Important Notes

- **File Name**: Must be exactly `gemma3-4b-it-int4-web.task`
- **File Size**: ~2.56 GB (2,560,000,000 bytes)
- **APK Size**: The resulting APK will be approximately 2.6 GB
- **License**: You must accept the model license before downloading

## How It Works

When the app launches:
1. It checks if the model is bundled in APK assets
2. If found, it automatically extracts to app storage (required by MediaPipe)
3. The model is then ready for on-device inference

This is a one-time extraction that happens on first launch.
