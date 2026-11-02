import React, { useState, useEffect } from 'react';
import {
  extractGoogleDriveFileId,
  getGoogleDriveThumbnailUrl,
  getGoogleDriveAlternativeUrl,
  DEFAULT_COURSE_THUMBNAIL,
  DEFAULT_RESOURCE_THUMBNAIL
} from '../utils/thumbnailUtils';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string | null;
  fallbackType?: 'course' | 'resource';
  fallbackSrc?: string;
  alt: string;
}

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  fallbackType = 'resource',
  fallbackSrc,
  alt,
  className = '',
  ...rest
}) => {
  const defaultFallback = fallbackSrc || (fallbackType === 'course' ? DEFAULT_COURSE_THUMBNAIL : DEFAULT_RESOURCE_THUMBNAIL);

  const [currentSrc, setCurrentSrc] = useState<string>(() => {
    if (!src || !src.trim()) return defaultFallback;
    const driveId = extractGoogleDriveFileId(src);
    if (driveId) {
      return getGoogleDriveThumbnailUrl(driveId);
    }
    return src.trim();
  });

  const [errorStep, setErrorStep] = useState<number>(0);

  // Sync state if prop changes
  useEffect(() => {
    if (!src || !src.trim()) {
      setCurrentSrc(defaultFallback);
      setErrorStep(2);
      return;
    }
    const driveId = extractGoogleDriveFileId(src);
    if (driveId) {
      setCurrentSrc(getGoogleDriveThumbnailUrl(driveId));
    } else {
      setCurrentSrc(src.trim());
    }
    setErrorStep(0);
  }, [src, defaultFallback]);

  const handleError = () => {
    const driveId = src ? extractGoogleDriveFileId(src) : null;

    if (driveId && errorStep === 0) {
      // Step 1: Try Google Drive alternative CDN
      setErrorStep(1);
      setCurrentSrc(getGoogleDriveAlternativeUrl(driveId));
    } else if (errorStep < 2) {
      // Step 2: Fall back to clean domain-specific fallback thumbnail
      setErrorStep(2);
      setCurrentSrc(defaultFallback);
    }
  };

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      onError={handleError}
      loading="lazy"
      {...rest}
    />
  );
};
