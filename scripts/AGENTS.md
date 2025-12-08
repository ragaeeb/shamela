# Shamela Database Reverse Engineering - AI Agent Guide

This document provides comprehensive documentation for AI agents working on the Shamela database reverse engineering project. It covers the project structure, database schema discoveries, character encoding algorithm, and important assumptions/validations.

## Project Overview

The Shamela Library (المكتبة الشاملة) is a popular Arabic Islamic text library application. This project reverse engineers the custom encoding used in their SQLite databases to extract and decode narrator (راجم/narrator) biographical data.

### Key Files

```
scripts/
├── shamela-decoder.ts       # Core Shamela decoding module (custom encoding)
├── shamela-decoder.test.ts  # Unit tests for decoder (46 tests)
├── export-narrators.ts      # Narrator biography export script
├── export-narrators.test.ts # Unit tests for narrator export (20 tests)
└── export-roots.ts          # Arabic root morphology export script

database/
├── service/
│   ├── S1.db               # Narrator database (18,989 narrators, custom encoding)
│   ├── S2.db               # Arabic roots database (3.2M mappings, Windows-1256)
│   ├── hadeeth.db          # Hadith service mappings (7,246 refs)
│   ├── trajim.db           # Biography/narrator service (empty mapping)
│   └── tafseer.db          # Tafsir service database
├── book/
│   └── {id}/{id}.db        # Individual book content databases
├── store/
│   └── page/               # Lucene full-text search index files
├── narrators-export.json   # Exported narrator data
├── roots-map.json          # Token→root lookup map (83MB)
└── roots-export.min.json   # Full root mappings array (139MB)
```

## Database Schema Discoveries

### S1.db - Narrator Database

The main narrator data is stored in table `b` with single-letter column names:

| Column | Type | Description |
|--------|------|-------------|
| `i` | INTEGER | Narrator ID (primary key) |
| `s` | BLOB | Short name (Shamela-encoded) |
| `l` | BLOB | Long name with lineage (Shamela-encoded) |
| `d` | INTEGER | Death year in Hijri calendar (nullable) |
| `a` | BLOB | Biography text (Shamela-encoded) |
| `b` | BLOB | Structured metadata (Shamela-encoded) |

**Statistics:**
- Total narrators: 18,989
- With death year: 9,190 (48%)
- Without death year: 9,799 (52%)

### Service Tables Structure

Service databases (hadeeth.db, trajim.db) use a common schema for mapping global IDs:

```sql
CREATE TABLE service (
    key_id INTEGER,  -- Global reference ID
    book_id INTEGER, -- Book identifier
    page_id INTEGER  -- Page within book
);
```

**Important Discovery:** The `trajim.db/service` table is EMPTY in this database snapshot. The global reference IDs in biographies (e.g., `464293`) cannot be resolved without this mapping data.

### Book Content Databases

Individual book databases (`database/book/{id}/{id}.db`) contain:

- `page` table: `(id, part, page, number, services)`
- `title` table: `(id, page, parent)`

Book page IDs are local (1-indexed within each book), not global.

### Page Content Markers: The 舄 Character (U+8204)

**Discovery:** Some book page content starts with the Chinese character **舄** (U+8204, meaning "shoe" in Chinese). This has no Arabic/Islamic meaning and is a **decoding artifact**.

**Origin:** The character comes from a 2-byte marker `0x82 0x04` that was incorrectly decoded as UTF-16:
```python
bytes([0x04, 0x82]).decode('utf-16-le')  # → '舄' (U+8204)
```

**Pattern Analysis:**

| Has 舄 prefix | Page type | Example |
|---------------|-----------|---------|
| ✅ Yes | Introduction/Editorial | المقدمة section pages |
| ❌ No | Primary content | Hadith content, chapter headings |

**Hypothesis:** `0x82 0x04` is a **page-type marker**:
- `0x82` = Format/control byte
- `0x04` = Type indicator (4 = editorial/introduction)

This distinguishes **editorial pages** (prefaces, publishing info, editor's notes) from **primary book content** (actual hadith text, chapters).

**Handling Recommendation:**
```typescript
// Strip the marker but preserve as metadata
const parsePage = (rawContent: string) => ({
    content: rawContent.replace(/^舄/, ''),
    isEditorial: rawContent.startsWith('舄'),
});
```

**Examples from Sahih Bukhari (book 1681):**
```json
// Page 1 (introduction) - HAS marker
{"content": "舄<span data-type=\"title\">(هذا نص التقرير)</span>..."}

// Page 2 (introduction) - HAS marker  
{"content": "舄﷽\\rالحمد للَّه رفع منار السنة..."}

// Page 9 (chapter heading) - NO marker
{"content": "﷽\\rقَالَ الشَّيْخُ الإِمَامُ الْحَافِظُ أَبُو عَبْدِ اللَّهِ..."}

// Page 10 (hadith content) - NO marker
{"content": "١ - حَدَّثَنَا الْحُمَيْدِيُّ..."}
```


### S2.db - Arabic Root Morphology Database

Maps inflected Arabic words to their trilateral/quadrilateral roots:

| Column | Type | Description |
|--------|------|-------------|
| `token` | BLOB | Inflected Arabic word (Windows-1256 encoded) |
| `root` | BLOB | Root form(s), comma-separated (Windows-1256 encoded) |

**Statistics:**
- Total token mappings: 3,249,267
- Unique roots: 13,824
- Tokens with multiple roots: 479,251 (14.7%)
- Maximum roots per token: 18

**Encoding:** Uses standard **Windows-1256** (Arabic codepage), not the custom Shamela encoding.

**Sample mappings:**
| Token | Root(s) |
|-------|--------|
| آباء | ءبو |
| آباءكم | ءبو |
| آتاك | ءتي, ءتو, ءتت |

## Character Encoding Algorithm

### Encoding Type

The Shamela encoding is a **substitution cipher** where each byte maps to:
1. An Arabic character
2. A control/structural marker
3. A numeral or punctuation

### Key Mapping Categories

#### Core Arabic Letters
```typescript
0x43: 'ن',    // nun - from بن pattern
0x45: 'ل',    // lam - from الله pattern
0x46: 'م',    // mim
0x47: 'ه',    // ha
0x68: 'ا',    // alif
0x74: 'ب',    // ba
0x77: 'د',    // dal
0xfe: 'ع',    // ayn - CRITICAL: appears frequently
```

#### Hamza Variants
```typescript
0x62: 'آ',    // alif with madda (آدم)
0x66: 'أ',    // alif with hamza above (أبي)
0x67: 'إ',    // alif with hamza below (إياس)
0x63: 'ؤ',    // waw with hamza
0x9e: 'ئ',    // ya with hamza
```

#### Context-Sensitive Mappings

**0x6b has dual meaning:**
- In names: Uses 0x59 for ك (kaf) instead
- In biography/metadata: Acts as newline separator
- In metadata field labels: Acts as `:` (colon)

**0x59 vs 0x6b:**
```typescript
// 0x59 = 'ك' (kaf) - used in names like حكيم, زكريا
// 0x6b = '\n' (separator) - structural, never in names
```

#### Control Bytes (Stripped)
```typescript
0x14: '',     // Control prefix
0x4a: '',     // Section start marker (JJ pattern)
0x4b: '',     // Diacritic suffix
0x7f: '',     // DEL control
0xc0: '',     // Header start
```

#### Numerals (Book References)
```typescript
0xf0: '0',  0xf1: '1',  0xf2: '2',  0xf3: '3',  0xf4: '4',
0xf5: '5',  0xf6: '6',  0xf7: '7',  0xf8: '8',  0xf9: '9',
0x61: '/',  // Volume/page separator
```

### Metadata-Specific Handling

Metadata uses a dedicated character map that overrides:
```typescript
0x6b: ':',    // Field separator (الشهرة: بردان)
0x94: '',     // Strip in headers (prevents وو artifacts)
```

Post-processing cleanup:
1. Remove leading `:` from start
2. Remove `:` after newlines

## Global Reference IDs

### Discovery

Biographies contain 6-digit reference IDs like:
```
تهذيب التهذيب (1/ 65)
 464293
```

### Analysis Results

These are **global page reference IDs** stored in the `service` tables:
- `key_id` → `(book_id, page_id)` mapping
- Used by Shamela app for internal navigation
- Different books have different ID ranges

**Pattern observations:**
- IDs increase roughly with page number within a book
- Different volumes/editions may have non-contiguous ID ranges
- IDs are assigned by Shamela server, not a simple hash formula

**Limitation:** Without the populated `trajim.db/service` table, these IDs cannot be resolved to actual book/page references.

## Validation Approach

### Known Narrator Verification

Validated against shamela.ws/narrator/{id}:

| ID | Expected Name | Status |
|----|---------------|--------|
| 4210 | عبيد الله بن موسى بن أبي المختار | ✓ Pass |
| 5495 | البخاري | ✓ Pass |
| 3 | آدم بن أبي إياس | ✓ Pass |
| 48 | إبراهيم بن سالم بن أبي أمية | ✓ Pass |

### Coverage Statistics

| Field | Fully Decoded | With Unmapped Bytes |
|-------|---------------|---------------------|
| Short Names | 18,989 (100%) | 0 (0%) |
| Long Names | 18,989 (100%) | 0 (0%) |
| Biographies | 18,700 (98.5%) | 289 (1.5%) |
| Metadata | 18,924 (99.7%) | 65 (0.3%) |

### Unmapped Byte Handling

Unmapped bytes are preserved as hex placeholders: `[XX]`
- Allows identification of remaining mappings needed
- Does not corrupt surrounding text
- Can be filtered/processed in post-processing

## Assumptions

1. **Encoding is deterministic**: Each byte always maps to the same character
2. **Context-independence**: Most mappings are context-free (exception: 0x6b)
3. **No compression**: Data is not compressed, pure substitution
4. **UTF-8 output**: Decoded text is valid UTF-8 Arabic
5. **Structural markers are stripped**: 0x4a, 0x4b, etc. carry no display value

## Common Patterns

### بن (son of) Pattern
`0x74 0x43` → `بن` (very frequent in names)

### الله (Allah) Pattern  
`0x68 0x45 0x45 0x47` → `الله`

### Book Reference Pattern
`0x4d [digits] 0x61 [digits] 0x5d` → `(vol/ page)`

### Hijri Year Abbreviation
`0x47 0xfc` → `هـ` (tatweel after ha)

## Testing Guidelines

Run all tests:
```bash
bun test scripts/
```

Test coverage areas:
1. Character mapping verification
2. Edge cases (null input, empty arrays)
3. Known narrator pattern decoding
4. Unmapped byte detection utilities
5. Metadata cleanup functions

## Export Scripts

### export-narrators.ts
Exports narrator biographies from S1.db using the custom Shamela decoding.

```bash
bun run scripts/export-narrators.ts
# Output: database/narrators-export.json
```

### export-roots.ts
Exports Arabic root morphology from S2.db using Windows-1256 decoding.

```bash
bun run scripts/export-roots.ts
# Output: database/roots-map.json (83MB)
# Output: database/roots-export.min.json (139MB)
```

## Future Work

1. **Complete character mapping**: Address remaining 289 biographies with unmapped bytes
2. **Service table population**: Obtain populated `trajim.db/service` for ID resolution
3. **Citation formatting**: Optionally wrap book citations in `[]` brackets
4. **Export format options**: JSON-LD, CSV, or other structured formats
5. **Hadith references export**: Export the 7,246 hadith page reference mappings
6. **Book content export**: Decode and export individual book page content

---

## Mistakes Made & Lessons Learned

This section documents the debugging journey, including wrong assumptions and corrections. This is valuable for understanding how the decoding was developed iteratively.

### Mistake #1: Missing 0xfe → 'ع' (Ayn) Mapping

**Problem:** Names containing 'ع' (ayn) like عبيد الله were showing `[fe]` placeholder.

**Discovery:** When verifying narrator ID 4210 (عبيد الله بن موسى), the output showed `[fe]بيد الله` instead of `عبيد الله`.

**Fix:** Added `0xfe: 'ع'` to SHAMELA_CHAR_MAP.

**Lesson:** The ayn character is extremely common in Arabic names. This was a critical gap that affected many narrators.

---

### Mistake #2: Wrong Initial Mapping for 0xfc

**Initial Assumption:** 0xfc mapped to some specific character.

**Problem:** Hijri year abbreviations like "هـ" were not rendering correctly. The `ه` was appearing but the tatweel (ـ) was missing or wrong.

**Investigation:** Compared website display of death years (e.g., "220هـ") with decoded output.

**Fix:** Remapped `0xfc` to `'ـ'` (U+0640 ARABIC TATWEEL).

**Pattern:** `0x47 0xfc` → `هـ` (ha + tatweel for Hijri abbreviation)

---

### Mistake #3: Dual Meaning of 0x6b

**Initial Assumption:** 0x6b was a single character (initially mapped to kaf 'ك').

**Problem #1:** Biographies had unexpected kaf characters appearing as structural separators.

**Problem #2:** Metadata fields like `الشهرة: بردان` weren't parsing correctly.

**Discovery Process:**
1. Noticed 0x6b never appeared in short/long names
2. Names used 0x59 for kaf instead
3. 0x6b only appeared in biography and metadata fields
4. In biographies, it acted as line separator (`\n`)
5. In metadata, it acted as field label terminator (`:`)

**Solution:** Created TWO character maps:
- `SHAMELA_CHAR_MAP`: `0x6b: '\n'` for biography text
- `METADATA_CHAR_MAP`: `0x6b: ':'` for metadata fields

**Lesson:** Same byte can have different meanings in different contexts. Don't assume one-to-one mapping across all data types.

---

### Mistake #4: Citation Brackets Assumption

**Initial Assumption:** Book citations should appear as `[تهذيب التهذيب (1/ 65)]` with brackets.

**Investigation:** Searched for bracket bytes in the raw data. Found none.

**Discovery:** The brackets `[]` are added by the shamela.ws website's **display logic**, not stored in the database.

**Decision:** Left citations without brackets since they're a presentation layer concern.

**Lesson:** Web display may add formatting that isn't in the source data. Verify against raw bytes, not just rendered HTML.

---

### Mistake #5: Assuming Service Tables Were Populated

**Initial Assumption:** The `trajim.db/service` table would contain mappings to resolve global reference IDs (like `464293`).

**Discovery:** The table exists but is **completely empty** in this database snapshot.

**Impact:** Cannot resolve global page IDs to `(book_id, page_id)` pairs. The 6-digit reference numbers remain opaque.

**Workaround:** Kept IDs as-is in the output. Documented as a known limitation.

**Lesson:** Always verify table contents, not just schema. An empty table is useless regardless of its structure.

---

### Mistake #6: 0x94 Causing "وو" Artifacts in Metadata

**Problem:** Metadata headers were showing duplicate waw characters (`وو`) or other artifacts.

**Investigation:** Byte 0x94 appeared frequently in metadata headers but not in content.

**Discovery:** 0x94 is a control/header byte that should be stripped in metadata context.

**Fix:** Added `0x94: ''` to METADATA_CHAR_MAP.

**Lesson:** Control bytes may need context-specific handling. What works for body text may not work for headers.

---

### Mistake #7: Leading Colons in Metadata Output

**Problem:** Decoded metadata started with `:` or had `:` after newlines.

**Cause:** The structural separator 0x6b was being converted to `:` but sometimes appeared at line starts.

**Fix:** Added post-processing to clean up:
```typescript
result = result.replace(/^:\s*/, '');     // Remove leading ":"
result = result.replace(/\n:\s*/g, '\n'); // Remove ":" after newlines
```

**Lesson:** Raw decoding isn't enough. Post-processing cleanup is often needed for clean output.

---

### Mistake #8: Bun TextDecoder Doesn't Support Windows-1256

**Initial Approach:** Used `new TextDecoder("windows-1256")` for S2.db decoding.

**Error:** `RangeError: Unsupported encoding label "windows-1256"`

**Discovery:** Bun/Node's TextDecoder only supports a limited set of encodings.

**Fix:** Implemented manual Windows-1256 → Unicode mapping table (128 character mappings for 0x80-0xFF range).

**Lesson:** Don't assume standard APIs support all encodings. Have a fallback plan for legacy codepages.

---

### Mistake #9: Test File Using Invalid Hex Pattern `[gh]`

**Problem:** A test was checking for unmapped bytes using pattern `[gh]` which isn't valid hex.

**Error:** Test expected metadata count of 1 but got 0 because the regex `/\[[0-9a-f]{2}\]/i` didn't match `[gh]`.

**Fix:** Changed test to use valid hex `[12]` instead of `[gh]`.

**Lesson:** Hex digits are 0-9 and a-f only. 'g' and 'h' are not hex.

---

### Mistake #10: Main Function Running During Import

**Problem:** Tests were printing export output because `main()` was called unconditionally at module load.

**Initial Code:**
```typescript
main();  // Always runs, even when imported
```

**Fix:**
```typescript
if (import.meta.main) {
    main();  // Only runs when executed directly
}
```

**Lesson:** Guard main execution with `import.meta.main` check for modules that will be imported for testing.

---

## Wrong Assumptions That Were Corrected

| Assumption | Reality | Impact |
|------------|---------|--------|
| All bytes map 1:1 to characters | 0x6b has context-dependent meaning | Required multiple character maps |
| Brackets around citations come from DB | Added by website display logic | No change needed in decoding |
| trajim.db/service has data | Table is empty | Cannot resolve global IDs |
| TextDecoder supports Windows-1256 | Not in Bun | Had to implement manual decoder |
| S2.db uses same encoding as S1.db | S2 uses Windows-1256, S1 uses custom | Different decoders needed |
| All waw variants map to same byte | Multiple bytes (0x9c, 0x60, 0x94, 0xab) | Complex mapping table |

---

## Debugging Techniques That Worked

### 1. Hex Placeholder Preservation
Keeping unmapped bytes as `[XX]` placeholders allowed:
- Seeing partial decoding progress
- Identifying exactly which bytes needed mapping
- Not corrupting surrounding decoded text

### 2. Ground Truth Comparison
Using shamela.ws/narrator/{id} as verification source:
- Provided correct expected output
- Enabled automated verification tests
- Caught subtle encoding errors

### 3. Pattern Frequency Analysis
Analyzing byte pair frequencies revealed:
- `0x74 0x43` (بن) was extremely common → validated early
- Rare bytes could be deprioritized
- Control bytes had distinctive patterns (0x4a 0x4a)

### 4. Iterative Refinement
Started with basic mapping, then:
1. Ran on sample data
2. Identified placeholders in output
3. Compared with expected text
4. Added/fixed mappings
5. Repeat

### 5. Separate Test Cases for Different Data Types
Created distinct tests for:
- Short names (simpler)
- Long names (with lineage)
- Biographies (with citations)
- Metadata (with field labels)

This revealed that metadata needed special handling.

---

## Test Count Summary

| Test File | Tests | Coverage |
|-----------|-------|----------|
| shamela-decoder.test.ts | 46 | Character maps, decode functions, utilities |
| export-narrators.test.ts | 20 | Transform, validation, null handling |
| export-roots.test.ts | 35 | Windows-1256 decoding, root parsing, stats |
| **Total** | **101** | All exported functions |
