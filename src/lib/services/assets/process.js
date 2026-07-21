import { validateAssetDimensions } from '$lib/services/assets/dimensions';
import { transformFile } from '$lib/services/integrations/media-libraries/default';
import { formatFileName } from '$lib/services/utils/file';

/**
 * @import { SharedMediaLibraryOptions } from '$lib/types/public';
 */

/**
 * @typedef {object} ProcessFileResult
 * @property {File} file Processed file.
 * @property {File | undefined} originalFile Pre-transformation file if a transformation was
 * applied.
 * @property {boolean} oversized Whether the file exceeds the maximum allowed size.
 * @property {boolean} wrongDimensions Whether the image fails the field’s aspect-ratio/resolution
 * constraints.
 */

/**
 * Process a file by applying slugification, dimension validation, transformation, and size
 * validation.
 * @param {File} file File to process.
 * @param {SharedMediaLibraryOptions} [options] Processing options.
 * @returns {Promise<ProcessFileResult>} Result of processing the file.
 */
export const processFile = async (file, options = {}) => {
  const {
    slugify_filename: slugifyFilename = false,
    transformations,
    max_file_size: maxFileSize = Infinity,
  } = options;

  if (slugifyFilename) {
    const { name, type, lastModified } = file;
    const newName = formatFileName(name, { slugificationEnabled: true });

    file = new File([file], newName, { type, lastModified });
  }

  const preTransformFile = file;

  // Enforce aspect-ratio/resolution on the original (pre-transform) file — transforms resize images
  // down, which would defeat a resolution floor. Reject before transforming to fail fast.
  if (!(await validateAssetDimensions(preTransformFile, options))) {
    return { file, originalFile: undefined, oversized: false, wrongDimensions: true };
  }

  if (transformations) {
    file = await transformFile(file, transformations);
  }

  return {
    file,
    originalFile: file !== preTransformFile ? preTransformFile : undefined,
    oversized: file.size > maxFileSize,
    wrongDimensions: false,
  };
};
