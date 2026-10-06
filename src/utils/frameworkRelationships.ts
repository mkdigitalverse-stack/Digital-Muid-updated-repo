import { Framework, Article, Video, Resource } from '../types';

/**
 * Normalizes an array of ID or slug identifiers from a Framework relation field.
 */
const getNormalizedRelationArray = (raw: any): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((item) => (typeof item === 'string' ? item.trim() : typeof item === 'object' && item?.id ? String(item.id).trim() : ''))
      .filter(Boolean);
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return getNormalizedRelationArray(parsed);
    } catch {
      return [raw.trim()].filter(Boolean);
    }
  }
  return [];
};

/**
 * Checks if a Framework references a target item by UUID, ID, or slug.
 */
const isReferencedInArray = (relationList: string[], item: { id?: string; slug?: string }): boolean => {
  if (!relationList || relationList.length === 0 || !item) return false;
  const targetId = (item.id || '').trim();
  const targetSlug = (item.slug || '').trim();

  return relationList.some((ref) => {
    const cleanRef = ref.trim();
    return (targetId && cleanRef === targetId) || (targetSlug && cleanRef === targetSlug);
  });
};

/**
 * Discovers which published Frameworks reference a specific Article.
 */
export const findFrameworksForArticle = (
  article: { id?: string; slug?: string },
  frameworks: Framework[],
  isAdmin = false
): Framework[] => {
  if (!article || !Array.isArray(frameworks)) return [];

  const matched = frameworks.filter((fw) => {
    // Visibility constraint: Only published frameworks to public visitors
    if (!isAdmin && fw.status !== 'published') return false;

    const relations = [
      ...getNormalizedRelationArray(fw.relatedArticles),
      ...getNormalizedRelationArray((fw as any).related_articles)
    ];

    return isReferencedInArray(relations, article);
  });

  // Deduplicate by id / slug
  const seen = new Set<string>();
  return matched.filter((fw) => {
    const key = fw.id || fw.slug;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * Discovers which published Frameworks reference a specific Video.
 */
export const findFrameworksForVideo = (
  video: { id?: string; slug?: string },
  frameworks: Framework[],
  isAdmin = false
): Framework[] => {
  if (!video || !Array.isArray(frameworks)) return [];

  const matched = frameworks.filter((fw) => {
    // Visibility constraint: Only published frameworks to public visitors
    if (!isAdmin && fw.status !== 'published') return false;

    const relations = [
      ...getNormalizedRelationArray(fw.relatedVideos),
      ...getNormalizedRelationArray((fw as any).related_videos)
    ];

    return isReferencedInArray(relations, video);
  });

  const seen = new Set<string>();
  return matched.filter((fw) => {
    const key = fw.id || fw.slug;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * Discovers which published Frameworks reference a specific Resource.
 */
export const findFrameworksForResource = (
  resource: { id?: string; slug?: string },
  frameworks: Framework[],
  isAdmin = false
): Framework[] => {
  if (!resource || !Array.isArray(frameworks)) return [];

  const matched = frameworks.filter((fw) => {
    // Visibility constraint: Only published frameworks to public visitors
    if (!isAdmin && fw.status !== 'published') return false;

    const relations = [
      ...getNormalizedRelationArray(fw.relatedResources),
      ...getNormalizedRelationArray((fw as any).related_resources)
    ];

    return isReferencedInArray(relations, resource);
  });

  const seen = new Set<string>();
  return matched.filter((fw) => {
    const key = fw.id || fw.slug;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * Contextual recommendation: Finds other articles related to the same strategic framework(s),
 * falling back cleanly to same-category or recent published articles if needed.
 */
export const findContextualArticlesForArticle = (
  currentArticle: Article,
  frameworks: Framework[],
  allArticles: Article[],
  limit = 2,
  isAdmin = false
): Article[] => {
  if (!currentArticle || !Array.isArray(allArticles)) return [];

  const parentFrameworks = findFrameworksForArticle(currentArticle, frameworks, isAdmin);
  const resultArticles: Article[] = [];
  const seenIds = new Set<string>([currentArticle.id, currentArticle.slug]);

  // 1. Gather other articles connected to the same Framework(s)
  for (const fw of parentFrameworks) {
    const relatedRefs = [
      ...getNormalizedRelationArray(fw.relatedArticles),
      ...getNormalizedRelationArray((fw as any).related_articles)
    ];

    for (const ref of relatedRefs) {
      const found = allArticles.find(
        (a) => (a.id === ref || a.slug === ref) && (isAdmin || a.status === 'published')
      );
      if (found && !seenIds.has(found.id) && !seenIds.has(found.slug)) {
        seenIds.add(found.id);
        seenIds.add(found.slug);
        resultArticles.push(found);
        if (resultArticles.length >= limit) return resultArticles;
      }
    }
  }

  // 2. Supplement with same-category published articles
  if (resultArticles.length < limit && currentArticle.category) {
    const sameCategory = allArticles.filter(
      (a) =>
        a.category === currentArticle.category &&
        (isAdmin || a.status === 'published') &&
        !seenIds.has(a.id) &&
        !seenIds.has(a.slug)
    );
    for (const item of sameCategory) {
      seenIds.add(item.id);
      seenIds.add(item.slug);
      resultArticles.push(item);
      if (resultArticles.length >= limit) return resultArticles;
    }
  }

  // 3. Supplement with general published articles
  if (resultArticles.length < limit) {
    const general = allArticles.filter(
      (a) => (isAdmin || a.status === 'published') && !seenIds.has(a.id) && !seenIds.has(a.slug)
    );
    for (const item of general) {
      seenIds.add(item.id);
      seenIds.add(item.slug);
      resultArticles.push(item);
      if (resultArticles.length >= limit) return resultArticles;
    }
  }

  return resultArticles.slice(0, limit);
};

/**
 * Contextual recommendation: Finds other videos related to the same strategic framework(s),
 * falling back cleanly to general published videos if needed.
 */
export const findContextualVideosForVideo = (
  currentVideo: Video,
  frameworks: Framework[],
  allVideos: Video[],
  limit = 3,
  isAdmin = false
): Video[] => {
  if (!currentVideo || !Array.isArray(allVideos)) return [];

  const parentFrameworks = findFrameworksForVideo(currentVideo, frameworks, isAdmin);
  const resultVideos: Video[] = [];
  const seenIds = new Set<string>([currentVideo.id, currentVideo.slug]);

  // 1. Gather other videos connected to the same Framework(s)
  for (const fw of parentFrameworks) {
    const relatedRefs = [
      ...getNormalizedRelationArray(fw.relatedVideos),
      ...getNormalizedRelationArray((fw as any).related_videos)
    ];

    for (const ref of relatedRefs) {
      const found = allVideos.find(
        (v) => (v.id === ref || v.slug === ref) && (isAdmin || v.status === 'published' || !(v as any).status)
      );
      if (found && !seenIds.has(found.id) && !seenIds.has(found.slug)) {
        seenIds.add(found.id);
        seenIds.add(found.slug);
        resultVideos.push(found);
        if (resultVideos.length >= limit) return resultVideos;
      }
    }
  }

  // 2. Supplement with general published videos
  if (resultVideos.length < limit) {
    const general = allVideos.filter(
      (v) => (isAdmin || v.status === 'published' || !(v as any).status) && !seenIds.has(v.id) && !seenIds.has(v.slug)
    );
    for (const item of general) {
      seenIds.add(item.id);
      seenIds.add(item.slug);
      resultVideos.push(item);
      if (resultVideos.length >= limit) return resultVideos;
    }
  }

  return resultVideos.slice(0, limit);
};
