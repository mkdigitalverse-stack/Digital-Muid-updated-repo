/**
 * DigitalMuid Thumbnail & Image Normalization Utility
 *
 * Provides backward-compatible direct image resolution for:
 * 1. Google Drive sharing/viewer links (converts HTML preview URLs to direct CDN images).
 * 2. Unsplash and custom CDN image URLs.
 * 3. Graceful fallback thumbnails for Courses and Resources when an image fails to load.
 */

export const DEFAULT_COURSE_THUMBNAIL =
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80';

export const DEFAULT_RESOURCE_THUMBNAIL =
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80';

/**
 * Extracts a Google Drive file ID from various sharing, preview, or direct URL formats.
 *
 * Supported formats:
 * - https://drive.google.com/file/d/{FILE_ID}/view?usp=sharing
 * - https://drive.google.com/file/d/{FILE_ID}/view
 * - https://drive.google.com/file/d/{FILE_ID}
 * - https://drive.google.com/open?id={FILE_ID}
 * - https://drive.google.com/uc?id={FILE_ID}
 * - https://drive.google.com/uc?export=view&id={FILE_ID}
 * - https://drive.google.com/uc?export=download&id={FILE_ID}
 * - https://docs.google.com/file/d/{FILE_ID}/edit
 * - https://lh3.googleusercontent.com/d/{FILE_ID}
 * - https://drive.google.com/thumbnail?id={FILE_ID}
 */
export function extractGoogleDriveFileId(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const clean = url.trim();

  // Pattern 1: /file/d/{FILE_ID} or /d/{FILE_ID}
  const fileDMatch = clean.match(/(?:drive|docs)\.google\.com\/(?:file\/d\/|d\/)([a-zA-Z0-9_-]+)/i);
  if (fileDMatch && fileDMatch[1]) {
    return fileDMatch[1];
  }

  // Pattern 2: id={FILE_ID} query parameter on google.com domains
  if (/google\.com/i.test(clean)) {
    const idParamMatch = clean.match(/[?&]id=([a-zA-Z0-9_-]+)/i);
    if (idParamMatch && idParamMatch[1]) {
      return idParamMatch[1];
    }
  }

  // Pattern 3: googleusercontent.com/d/{FILE_ID}
  const lh3Match = clean.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/i);
  if (lh3Match && lh3Match[1]) {
    return lh3Match[1];
  }

  return null;
}

/**
 * Converts a Google Drive file ID into the high-reliability direct CDN image URL.
 * Google's thumbnail endpoint returns the raw image binary with CORS and optimal scaling.
 */
export function getGoogleDriveThumbnailUrl(fileId: string, size = 1000): string {
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${size}`;
}

/**
 * Secondary fallback Google Drive direct CDN URL.
 */
export function getGoogleDriveAlternativeUrl(fileId: string): string {
  return `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}`;
}

/**
 * Normalizes any thumbnail URL into a browser-renderable direct image URL.
 * If the link is a Google Drive sharing URL, converts it to Google's direct image CDN.
 * If the link is empty or invalid, returns an authoritative fallback image.
 */
export function normalizeThumbnailUrl(
  url: string | null | undefined,
  type: 'course' | 'resource' = 'resource'
): string {
  const fallback = type === 'course' ? DEFAULT_COURSE_THUMBNAIL : DEFAULT_RESOURCE_THUMBNAIL;
  if (!url || typeof url !== 'string' || !url.trim()) {
    return fallback;
  }

  const clean = url.trim();

  // Check if it is a Google Drive link
  const driveFileId = extractGoogleDriveFileId(clean);
  if (driveFileId) {
    return getGoogleDriveThumbnailUrl(driveFileId);
  }

  // If already a valid http(s) URL or relative data path
  if (/^(https?:|\/|data:image\/)/i.test(clean)) {
    return clean;
  }

  return fallback;
}
