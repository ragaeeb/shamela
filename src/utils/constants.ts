/**
 * The default version number for master metadata.
 * @constant {number}
 */
export const DEFAULT_MASTER_METADATA_VERSION = 0;

/**
 * Placeholder value used to represent unknown or missing data.
 * @constant {string}
 */
export const UNKNOWN_VALUE_PLACEHOLDER = '99999';

/**
 * Default rules to sanitize page content.
 */
export const DEFAULT_SANITIZATION_RULES: Record<string, string> = {
    '<img[^>]*>>': '',
    舄: '',
    '﵌': 'صلى الله عليه وآله وسلم',
};
