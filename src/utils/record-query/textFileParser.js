/**
 * Text File Parser Utility for Record Query
 * Parses the outbound file attachment to extract BE Number, Query Date, and Query
 * 
 * Sample content formats:
 * 
 * Format 1 (continuous - no delimiters):
 * FINNSA1593723226112025203122025IRN FOR BIS PLEASE Query Raised By : 10XXXXXX Group: 2H
 * 
 * Format 2 (delimited with special chars like ↔ or other separators):
 * F↔INNSA1↔5936667↔26112025↔3↔02122025↔IF IMPORTED GLOVES ARE USED...
 * 
 * Pattern breakdown:
 * - F or FINNSA1 or F+location_code prefix (e.g., FINBOM4, FINNSA1, FINMAA6)
 * - 7 digit BE Number (e.g., 5937232)
 * - 8 digit first date DDMMYYYY (e.g., 26112025)
 * - separator (could be '2', '3', or delimiter)
 * - 8 digit Query Date DDMMYYYY (e.g., 03122025)
 * - Query text until 'Query Raised By'
 */

// Month names for date formatting
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Format date from DDMMYYYY to dd-MMM-yyyy
 * @param {string} dateStr - Date string in DDMMYYYY format
 * @returns {string} - Date in dd-MMM-yyyy format (e.g., "03-Dec-2025")
 */
function formatQueryDate(dateStr) {
    if (!dateStr || dateStr.length !== 8) {
        console.log(`   ⚠️ Invalid date string: ${dateStr}`);
        return null;
    }

    const day = dateStr.substring(0, 2);
    const month = parseInt(dateStr.substring(2, 4), 10);
    const year = dateStr.substring(4, 8);

    if (month < 1 || month > 12) {
        console.log(`   ⚠️ Invalid month in date: ${dateStr}`);
        return null;
    }

    const monthName = MONTHS[month - 1];
    return `${day}-${monthName}-${year}`;
}

/**
 * Remove all non-alphanumeric characters except spaces to normalize the line
 * This helps handle various delimiter formats
 */
function normalizeContent(content) {
    // Remove common delimiters and control characters, keep alphanumerics and spaces
    // Also preserve important punctuation for query text
    return content
        .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
        .replace(/↔/g, '')  // Remove arrow delimiter
        .replace(/\u0014/g, '') // Remove specific control char
        .replace(/[^\w\s:.,!?()-]/g, ''); // Keep word chars, spaces, and basic punctuation
}

/**
 * Parse the FINNSA1/INNSA1 line to extract data - handles both continuous and delimited formats
 * @param {string} line - The line containing the data
 * @returns {Object|null} - Extracted data or null if parsing fails
 */
function parseDataLine(line) {
    // First, try to normalize the line by removing delimiters
    const normalizedLine = normalizeContent(line);

    console.log(`   📝 Normalized line: ${normalizedLine.substring(0, 80)}...`);

    // Find location marker in normalized content
    // Supports: INNSA1, INBOM4, INMAA6, etc. (IN + 3 letters + 1 alphanumeric)
    const markerMatch = normalizedLine.match(/[FH]?IN[A-Z]{3}[A-Z0-9]/i);
    if (!markerMatch) {
        return null;
    }

    const markerIndex = normalizedLine.indexOf(markerMatch[0]);
    const afterMarker = normalizedLine.substring(markerIndex + markerMatch[0].length);

    console.log(`   📝 After marker: ${afterMarker.substring(0, 60)}...`);

    // Try multiple parsing strategies
    let result = null;

    // Strategy 1: Continuous format - 7 digit BE + 8 digit date + single digit separator + 8 digit date + query
    result = parseContinuousFormat(afterMarker);
    if (result) return result;

    // Strategy 2: Extract numbers and text separately
    result = parseExtractedFormat(afterMarker);
    if (result) return result;

    console.log(`   ⚠️ Could not match any known pattern`);
    return null;
}

/**
 * Parse continuous format: BE(7) + DATE1(8) + SEP(1) + DATE2(8) + QUERY
 */
function parseContinuousFormat(afterMarker) {
    // Pattern: 7 digit BE number + 8 digit date1 + single digit (2 or 3) + 8 digit date2 + query text
    const dataPattern = /^(\d{7})(\d{8})(\d)(\d{8})(.+?)(?:\s*Query Raised By|$)/i;
    const match = afterMarker.match(dataPattern);

    if (!match) {
        return null;
    }

    const beNumber = match[1];
    const date1 = match[2]; // First date (can be ignored)
    const separator = match[3]; // Usually '2' or '3'
    const queryDateRaw = match[4];
    const queryText = match[5].trim();

    const queryDate = formatQueryDate(queryDateRaw);

    console.log(`   ✓ BE Number: ${beNumber}`);
    console.log(`   ✓ Query Date (raw): ${queryDateRaw} -> ${queryDate}`);
    console.log(`   ✓ Query: ${queryText}`);

    return {
        beNumber,
        queryDate,
        queryDateRaw,
        query: queryText
    };
}

/**
 * Parse by extracting all 7-digit and 8-digit numbers separately
 */
function parseExtractedFormat(afterMarker) {
    // Find all 7-digit numbers (potential BE numbers)
    const beMatches = afterMarker.match(/\d{7}/g);
    if (!beMatches || beMatches.length === 0) {
        console.log(`   ⚠️ No 7-digit BE number found`);
        return null;
    }
    const beNumber = beMatches[0];

    // Find all 8-digit numbers (potential dates)
    const dateMatches = afterMarker.match(/\d{8}/g);
    if (!dateMatches || dateMatches.length < 2) {
        console.log(`   ⚠️ Not enough 8-digit dates found`);
        return null;
    }

    // Second 8-digit number is typically the query date
    const queryDateRaw = dateMatches[1];
    const queryDate = formatQueryDate(queryDateRaw);

    // Find query text - everything after the second date until "Query Raised By"
    const secondDateIndex = afterMarker.indexOf(queryDateRaw) + 8;
    let queryText = afterMarker.substring(secondDateIndex);

    // Remove "Query Raised By" and everything after
    const queryRaisedIndex = queryText.toLowerCase().indexOf('query raised by');
    if (queryRaisedIndex !== -1) {
        queryText = queryText.substring(0, queryRaisedIndex);
    }

    queryText = queryText.trim();

    // Clean up query text - remove leading numbers/separators
    queryText = queryText.replace(/^[\d\s]+/, '').trim();

    if (!queryText) {
        console.log(`   ⚠️ Query text is empty after extraction`);
        return null;
    }

    console.log(`   ✓ BE Number (extracted): ${beNumber}`);
    console.log(`   ✓ Query Date (extracted): ${queryDateRaw} -> ${queryDate}`);
    console.log(`   ✓ Query (extracted): ${queryText}`);

    return {
        beNumber,
        queryDate,
        queryDateRaw,
        query: queryText
    };
}

/**
 * Parse the complete text file content
 * @param {string} content - The text file content
 * @returns {Object} - Parsed data with beNumber, queryDate, query
 */
function parseTextFile(content) {
    console.log(`\n📄 Parsing text file content...`);
    console.log(`   Content length: ${content.length} characters`);

    // Split content into lines
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    console.log(`   Total lines: ${lines.length}`);

    let parsedData = null;

    // First pass: look for lines containing INNSA1
    for (const line of lines) {
        // Check for INNSA1 in both original and normalized content
        if (line.match(/IN[A-Z]{3}[A-Z0-9]/i) || normalizeContent(line).match(/IN[A-Z]{3}[A-Z0-9]/i)) {
            // Skip header lines (HREC lines)
            if (line.startsWith('HREC') || normalizeContent(line).startsWith('HREC')) {
                console.log(`   Skipping header line: ${line.substring(0, 50)}...`);
                continue;
            }

            console.log(`   Found data line: ${line.substring(0, 80)}...`);
            parsedData = parseDataLine(line);
            if (parsedData) {
                break;
            }
        }
    }

    // Second pass: if no INNSA1 line found, try to find F line with data pattern
    if (!parsedData) {
        for (const line of lines) {
            const normalized = normalizeContent(line);
            // Look for lines starting with F followed by location code or data
            if ((normalized.startsWith('F') || normalized.match(/^FIN[A-Z]{3}[A-Z0-9]/i)) && !normalized.startsWith('FREC')) {
                console.log(`   Trying F-line: ${normalized.substring(0, 80)}...`);
                parsedData = parseDataLine(line);
                if (parsedData) {
                    break;
                }
            }
        }
    }

    if (!parsedData) {
        console.log(`   ❌ Failed to parse text file content`);
        return {
            success: false,
            error: 'Could not parse text file - Location code pattern (e.g., INNSA1, INBOM4) not found or invalid format',
            beNumber: null,
            queryDate: null,
            query: null
        };
    }

    return {
        success: true,
        beNumber: parsedData.beNumber,
        queryDate: parsedData.queryDate,
        queryDateRaw: parsedData.queryDateRaw,
        query: parsedData.query
    };
}

/**
 * Validate parsed data
 * @param {Object} parsedData - The parsed data object
 * @returns {Object} - Validation result with isValid and errors
 */
function validateParsedData(parsedData) {
    const errors = [];

    if (!parsedData.beNumber || parsedData.beNumber.length !== 7) {
        errors.push('Invalid BE Number - must be 7 digits');
    }

    if (!parsedData.queryDate) {
        errors.push('Invalid Query Date');
    }

    if (!parsedData.query || parsedData.query.trim().length === 0) {
        errors.push('Query text is empty');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

module.exports = {
    parseTextFile,
    formatQueryDate,
    parseDataLine,
    validateParsedData,
    normalizeContent
};
