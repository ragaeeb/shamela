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
 * Default rules to map characters from page content.
 */
export const DEFAULT_MAPPING_RULES: Record<string, string> = {
    '<img[^>]*>>': '',
    舄: '',
    '﵀': 'رَحِمَهُ ٱللَّٰهُ',
    '﵁': 'رضي الله عنه',
    '﵂': 'رَضِيَ ٱللَّٰهُ عَنْهَا',
    '﵃': 'رَضِيَ اللَّهُ عَنْهُمْ',
    '﵄': 'رَضِيَ ٱللَّٰهُ عَنْهُمَا',
    '﵅': 'رَضِيَ اللَّهُ عَنْهُنَّ',
    '﵇': 'عَلَيْهِ ٱلسَّلَٰمُ',
    '﵈': 'عَلَيْهِمُ السَّلامُ',
    '﵊': 'عليه الصلاة والسلام',
    '﵌': 'صلى الله عليه وآله وسلم',
    '﵍': 'عَلَيْهِ ٱلسَّلَٰمُ',
    '﵎': 'تبارك وتعالى',
    '﵏': 'رَحِمَهُمُ ٱللَّٰهُ',
    '﷽': 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ',
    '﷿': 'عَزَّ وَجَلَّ',
};
