import { describe, expect, it } from 'bun:test';
import * as content from '../dist/content.js';
import type {
    Author,
    Book,
    BookData,
    BookMetadata,
    Category,
    ConfigureOptions,
    DenormalizedAuthor,
    DenormalizedBook,
    DenormalizedCategory,
    DownloadBookOptions,
    DownloadMasterOptions,
    GetBookMetadataOptions,
    GetBookMetadataResponsePayload,
    GetMasterMetadataResponsePayload,
    Line,
    Logger,
    MasterData,
    NormalizeTitleSpanOptions,
    Page,
    ShamelaConfig,
    Title,
} from '../dist/index.js';
// Verify main entry point
import * as shamela from '../dist/index.js';
import * as transform from '../dist/transform.js';
// Verify sub-exports
import * as constants from '../dist/utils/constants.js';

describe('Build Exports Validation', () => {
    it('should export all expected functions from the main bundle', () => {
        // API
        expect(shamela.getBook).toBeFunction();
        expect(shamela.getBookMetadata).toBeFunction();
        expect(shamela.downloadBook).toBeFunction();
        expect(shamela.getMaster).toBeFunction();
        expect(shamela.getMasterMetadata).toBeFunction();
        expect(shamela.downloadMasterDatabase).toBeFunction();
        expect(shamela.getCoverUrl).toBeFunction();

        // Config
        expect(shamela.configure).toBeFunction();
        expect(shamela.getConfig).toBeFunction();
        expect(shamela.getConfigValue).toBeFunction();
        expect(shamela.requireConfigValue).toBeFunction();
        expect(shamela.resetConfig).toBeFunction();

        // Content
        expect(shamela.parseContentRobust).toBeFunction();
        expect(shamela.mapPageCharacterContent).toBeFunction();
        expect(shamela.splitPageBodyFromFooter).toBeFunction();
        expect(shamela.removeArabicNumericPageMarkers).toBeFunction();
        expect(shamela.removeTagsExceptSpan).toBeFunction();
        expect(shamela.normalizeHtml).toBeFunction();
        expect(shamela.normalizeLineEndings).toBeFunction();
        expect(shamela.stripHtmlTags).toBeFunction();
        expect(shamela.htmlToMarkdown).toBeFunction();
        expect(shamela.normalizeTitleSpans).toBeFunction();
        expect(shamela.moveContentAfterLineBreakIntoSpan).toBeFunction();
        expect(shamela.convertContentToMarkdown).toBeFunction();

        // Transform
        expect(shamela.denormalizeBooks).toBeFunction();

        // Utils
        expect(shamela.buildUrl).toBeFunction();
        expect(shamela.httpsGet).toBeFunction();

        // Constants
        expect(shamela.DEFAULT_MAPPING_RULES).toBeDefined();
        expect(shamela.FOOTNOTE_MARKER).toBeString();
        expect(shamela.UNKNOWN_VALUE_PLACEHOLDER).toBeString();
    });

    it('should export expected values from the constants entry point', () => {
        expect(constants.DEFAULT_MAPPING_RULES).toBeDefined();
        expect(constants.FOOTNOTE_MARKER).toBeString();
        expect(constants.UNKNOWN_VALUE_PLACEHOLDER).toBeString();
        expect(constants.DEFAULT_MASTER_METADATA_VERSION).toBeNumber();
    });

    it('should export browser-safe utilities from the content entry point', () => {
        expect(content.parseContentRobust).toBeFunction();
        expect(content.mapPageCharacterContent).toBeFunction();
        expect(content.convertContentToMarkdown).toBeFunction();
        // Verify it doesn't accidentally include heavy dependencies (indirect check)
        expect((content as any).getBook).toBeUndefined();
    });

    it('should export denormalization utilities from the transform entry point', () => {
        expect(transform.denormalizeBooks).toBeFunction();
    });

    it('should have valid type definitions for all public interfaces', () => {
        // These are no-op assignments to verify types are exported and usable
        const _author: Author = {} as any;
        const _book: Book = {} as any;
        const _bookData: BookData = {} as any;
        const _bookMeta: BookMetadata = {} as any;
        const _category: Category = {} as any;
        const _confOpt: ConfigureOptions = {} as any;
        const _denormAuth: DenormalizedAuthor = {} as any;
        const _denormBook: DenormalizedBook = {} as any;
        const _denormCat: DenormalizedCategory = {} as any;
        const _dlBookOpt: DownloadBookOptions = {} as any;
        const _dlMasterOpt: DownloadMasterOptions = {} as any;
        const _getMetaOpt: GetBookMetadataOptions = {} as any;
        const _getBookMetaResp: GetBookMetadataResponsePayload = {} as any;
        const _getMastMetaResp: GetMasterMetadataResponsePayload = {} as any;
        const _line: Line = {} as any;
        const _logger: Logger = {} as any;
        const _masterData: MasterData = {} as any;
        const _normSpanOpt: NormalizeTitleSpanOptions = {} as any;
        const _page: Page = {} as any;
        const _config: ShamelaConfig = {} as any;
        const _title: Title = {} as any;

        expect(_author).toBeDefined();
        expect(_book).toBeDefined();
        expect(_bookData).toBeDefined();
        expect(_bookMeta).toBeDefined();
        expect(_category).toBeDefined();
        expect(_confOpt).toBeDefined();
        expect(_denormAuth).toBeDefined();
        expect(_denormBook).toBeDefined();
        expect(_denormCat).toBeDefined();
        expect(_dlBookOpt).toBeDefined();
        expect(_dlMasterOpt).toBeDefined();
        expect(_getMetaOpt).toBeDefined();
        expect(_getBookMetaResp).toBeDefined();
        expect(_getMastMetaResp).toBeDefined();
        expect(_line).toBeDefined();
        expect(_logger).toBeDefined();
        expect(_masterData).toBeDefined();
        expect(_normSpanOpt).toBeDefined();
        expect(_page).toBeDefined();
        expect(_config).toBeDefined();
        expect(_title).toBeDefined();
    });
});
