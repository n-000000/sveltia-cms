import { createImageSource } from '$lib/services/utils/media/image/transform';

/**
 * @import { MediaDimensions } from '$lib/types/private';
 * @import { SharedMediaLibraryOptions } from '$lib/types/public';
 */

/** Aspect-ratio tolerance (1%), absorbing rounding differences from source image exports. */
const ASPECT_RATIO_TOLERANCE = 0.01;

/** Config keys that express a per-field pixel-dimension constraint. */
const CONSTRAINT_KEYS = ['aspect_ratio', 'min_width', 'min_height', 'max_width', 'max_height'];

/**
 * Parse an aspect ratio expressed as `"W:H"` (e.g. `"16:9"`), `"W/H"` (e.g. `"4/3"`) or a plain
 * number (e.g. `1.5`) into a numeric width÷height ratio.
 * @param {string | number} value Aspect ratio.
 * @returns {number | undefined} Ratio, or `undefined` if unparseable/non-positive.
 */
export const parseAspectRatio = (value) => {
  if (typeof value === 'number') {
    return value > 0 ? value : undefined;
  }

  if (typeof value === 'string') {
    const match = value.match(/^\s*(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)\s*$/);

    if (match) {
      const w = Number(match[1]);
      const h = Number(match[2]);

      return h > 0 ? w / h : undefined;
    }

    const n = Number(value);

    return Number.isFinite(n) && n > 0 ? n : undefined;
  }

  return undefined;
};

/**
 * Whether the given config carries any pixel-dimension constraint. Used to skip image decoding
 * entirely when no field opts in.
 * @param {SharedMediaLibraryOptions} [config] Media library / field config.
 * @returns {boolean} Whether at least one constraint is set.
 */
export const hasDimensionConstraint = (config) =>
  !!config && CONSTRAINT_KEYS.some((key) => /** @type {any} */ (config)[key] !== undefined);

/**
 * Check whether measured pixel dimensions satisfy a field’s dimension constraints. Pure and
 * synchronous, so it carries the test. Undecodable input (missing width/height) fails open — upload
 * is not blocked, matching the size/type guards that live elsewhere.
 * @param {MediaDimensions} dimensions Measured width/height.
 * @param {SharedMediaLibraryOptions} config Constraint config.
 * @returns {boolean} Whether the dimensions are acceptable.
 */
export const checkDimensions = ({ width, height }, config) => {
  if (!width || !height) {
    return true;
  }

  const {
    aspect_ratio: aspectRatio,
    min_width: minWidth,
    min_height: minHeight,
    max_width: maxWidth,
    max_height: maxHeight,
  } = /** @type {any} */ (config ?? {});

  if (aspectRatio !== undefined) {
    const target = parseAspectRatio(aspectRatio);

    if (target && Math.abs(width / height / target - 1) > ASPECT_RATIO_TOLERANCE) {
      return false;
    }
  }

  if (typeof minWidth === 'number' && width < minWidth) {
    return false;
  }

  if (typeof minHeight === 'number' && height < minHeight) {
    return false;
  }

  if (typeof maxWidth === 'number' && width > maxWidth) {
    return false;
  }

  if (typeof maxHeight === 'number' && height > maxHeight) {
    return false;
  }

  return true;
};

/**
 * Validate a file’s pixel dimensions against a field’s constraints. Only raster images are decoded;
 * files with no applicable constraint, non-images, and undecodable images all pass (fail-open).
 * @param {File} file File to validate — should be the pre-transform original, since transforms
 * resize images down and would otherwise defeat a resolution floor.
 * @param {SharedMediaLibraryOptions} [config] Constraint config.
 * @returns {Promise<boolean>} Whether the file passes.
 */
export const validateAssetDimensions = async (file, config) => {
  if (!hasDimensionConstraint(config) || !file.type.startsWith('image/')) {
    return true;
  }

  try {
    const { naturalWidth: width, naturalHeight: height } = await createImageSource({ blob: file });

    return checkDimensions({ width, height }, /** @type {SharedMediaLibraryOptions} */ (config));
  } catch {
    // ponytail: decode failure (corrupt/unsupported) → don't block; size/type checks catch it.
    return true;
  }
};
