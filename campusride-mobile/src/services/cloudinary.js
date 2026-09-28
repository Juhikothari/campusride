// campusride-mobile/src/services/cloudinary.js
// Cloudinary upload service with automatic retry, exponential backoff, and error recovery

const CLOUD_NAME = 'dhkui5t39';
const UPLOAD_PRESET = 'kyc_upload';

export async function uploadToCloudinaryWithRetry(uri, options = {}) {
  const { maxRetries = 3, type = 'image', onProgress } = options;

  if (!uri || typeof uri !== 'string') {
    throw new Error('Invalid image URI provided for upload');
  }

  // Already a remote URL (Cloudinary or HTTPS)
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return uri;
  }

  const filename = uri.split('/').pop() || `upload_${Date.now()}.jpg`;
  const fileExt = filename.split('.').pop()?.toLowerCase() || 'jpg';
  const mimeType = fileExt === 'png' ? 'image/png' : fileExt === 'pdf' ? 'application/pdf' : 'image/jpeg';

  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (onProgress) onProgress({ attempt, maxRetries, status: 'uploading' });

      const formData = new FormData();
      formData.append('file', {
        uri,
        name: filename,
        type: mimeType,
      });
      formData.append('upload_preset', UPLOAD_PRESET);

      const controller = new AbortController();
      const timeoutTimer = setTimeout(() => controller.abort(), 25000); // 25s timeout

      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${type === 'pdf' ? 'raw' : 'image'}/upload`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutTimer));

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.error) {
        const errMsg = data.error?.message || `HTTP ${res.status}: Upload failed`;
        throw new Error(errMsg);
      }

      if (data.secure_url) {
        if (onProgress) onProgress({ attempt, maxRetries, status: 'success' });
        return data.secure_url;
      }

      throw new Error('Cloudinary response missing secure_url');
    } catch (err) {
      lastError = err;
      console.warn(`Cloudinary upload attempt ${attempt}/${maxRetries} failed:`, err.message);

      if (attempt < maxRetries) {
        // Exponential backoff: 800ms, 1600ms
        const delayMs = attempt * 800;
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }

  const finalError = new Error(
    `Failed to upload document after ${maxRetries} attempts. ${lastError?.message || 'Check your internet connection.'}`
  );
  finalError.isUploadError = true;
  throw finalError;
}

export default uploadToCloudinaryWithRetry;
