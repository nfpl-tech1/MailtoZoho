/**
 * HTML Table Parser Utility for IRN-DRN Tracker
 * Extracts tables from HTML content and converts them to structured JSON
 */

const { parse } = require('node-html-parser');

/**
 * Check if a text looks more like data than a header
 */
function looksLikeData(text) {
    // Contains 5+ consecutive digits
    if (/\d{5,}/.test(text)) {
        return true;
    }
    // Contains date-like patterns
    if (/\d{4}[/-]\d{2}[/-]\d{2}/.test(text)) {
        return true;
    }
    // Contains colon followed by numbers
    if (/:\s*\d+/.test(text)) {
        return true;
    }
    return false;
}

/**
 * Extract all tables from HTML content
 */
function extractTablesFromHtml(htmlContent) {
    const root = parse(htmlContent);
    const tables = root.querySelectorAll('table');
    
    return tables.map(table => {
        const rows = table.querySelectorAll('tr');
        return rows.map(row => {
            const cells = row.querySelectorAll('td, th');
            return cells.map(cell => ({
                text: cell.text.trim(),
                isHeader: cell.tagName.toLowerCase() === 'th'
            }));
        }).filter(row => row.length > 0);
    }).filter(table => table.length > 0);
}

/**
 * Sanitize headers - handle empty, duplicate, or invalid headers
 */
function sanitizeHeaders(headers) {
    const sanitized = [];
    const seen = {};

    for (let idx = 0; idx < headers.length; idx++) {
        let cleanHeader = (headers[idx] || '').trim();

        // If empty, use generic name
        if (!cleanHeader) {
            cleanHeader = `Column_${idx + 1}`;
        }

        // Handle duplicates by adding a suffix
        if (seen[cleanHeader] !== undefined) {
            seen[cleanHeader]++;
            cleanHeader = `${cleanHeader}_${seen[cleanHeader]}`;
        } else {
            seen[cleanHeader] = 0;
        }

        sanitized.push(cleanHeader);
    }

    return sanitized;
}

/**
 * Convert tables to JSON format
 */
function tablesToJson(tables, useGenericHeaders = false) {
    const result = [];

    for (let tableIdx = 0; tableIdx < tables.length; tableIdx++) {
        const table = tables[tableIdx];
        if (!table || table.length === 0) continue;

        // Determine if we should use generic headers
        let shouldUseGeneric = useGenericHeaders;

        // Auto-detect if first row looks like data rather than headers
        if (!shouldUseGeneric && table.length > 0) {
            const firstRowCells = table[0].map(cell => cell.text);
            if (firstRowCells.some(cell => looksLikeData(cell))) {
                shouldUseGeneric = true;
            }
        }

        let headers = null;
        let dataStartIdx = 0;

        if (shouldUseGeneric) {
            // Use generic column names and include all rows as data
            const numColumns = table[0].length;
            headers = Array.from({ length: numColumns }, (_, i) => `Column_${i + 1}`);
            dataStartIdx = 0;
        } else if (table.length > 0) {
            // Check if first row is all headers
            if (table[0].every(cell => cell.isHeader)) {
                headers = table[0].map(cell => cell.text);
                dataStartIdx = 1;
            } else {
                // Use first row as headers
                headers = table[0].map(cell => cell.text);
                dataStartIdx = 1;
            }
        }

        // If we still don't have headers, create generic ones
        if (!headers && table.length > 0) {
            headers = Array.from({ length: table[0].length }, (_, i) => `Column_${i + 1}`);
            dataStartIdx = 0;
        }

        // Sanitize headers
        const sanitizedHeaders = sanitizeHeaders(headers);

        // Convert rows to dictionaries
        const tableData = [];
        for (let i = dataStartIdx; i < table.length; i++) {
            const row = table[i];
            const rowDict = {};
            
            for (let cellIdx = 0; cellIdx < row.length; cellIdx++) {
                const header = cellIdx < sanitizedHeaders.length 
                    ? sanitizedHeaders[cellIdx] 
                    : `Column_${cellIdx + 1}`;
                rowDict[header] = row[cellIdx].text;
            }
            
            tableData.push(rowDict);
        }

        result.push({
            tableIndex: tableIdx,
            headers: sanitizedHeaders,
            data: tableData,
            rowCount: tableData.length
        });
    }

    return result;
}

/**
 * One-step function to extract and parse tables from HTML
 */
function extractAndParseTables(htmlContent) {
    const tables = extractTablesFromHtml(htmlContent);
    const parsedTables = tablesToJson(tables);

    return {
        tableCount: parsedTables.length,
        tables: parsedTables
    };
}

module.exports = {
    extractTablesFromHtml,
    tablesToJson,
    extractAndParseTables,
    looksLikeData,
    sanitizeHeaders
};
