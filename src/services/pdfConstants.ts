/**
 * PDF Layout Constants for Kreativium reports
 * Centralizes all magic numbers for consistent PDF styling
 */

export const PDF_LAYOUT = {
    // Page margins
    margin: 20,

    // Font sizes (in points)
    fonts: {
        title: 22,
        sectionHeading: 14,
        subHeading: 11,
        body: 10,
        small: 9,
        footer: 8,
    },

    // Vertical spacing (in points)
    spacing: {
        afterTitle: 10,
        sectionGap: 15,
        afterHeading: 8,
        afterSubHeading: 6,
        lineHeight: 5,
        listItemGap: 2,
        afterParagraph: 12,
    },

    // Colors as RGB arrays
    colors: {
        textPrimary: [30, 41, 59] as const,     // Slate 800
        textSecondary: [100, 116, 139] as const, // Slate 500
        textMuted: [150, 150, 150] as const,     // Gray

        backgroundLight: [241, 245, 249] as const, // Slate 100

        accentPrimary: [79, 70, 229] as const,    // Indigo/Purple
        accentDanger: [220, 38, 38] as const,     // Red
        accentSuccess: [34, 197, 94] as const,    // Green
        accentCyan: [6, 182, 212] as const,       // Cyan
    },

    // Page break thresholds
    pageBreak: {
        minRemainingSpace: 60,  // Minimum space before forced page break
        tableMinSpace: 50,      // Minimum space before table
    },

    // Table settings
    table: {
        maxRowsPerPage: 25,  // Chunk large tables for pagination
        cellPadding: 4,
        headerPadding: 5,
    },

    // Chart dimensions
    charts: {
        width: 170,           // Chart width (pageWidth - 2 * margin)
        height: 80,           // Chart height
        lineChartHeight: 60,  // Arousal trend chart
        barChartHeight: 50,   // Trigger frequency chart
        barWidth: 30,         // Bar chart bar width
        labelOffset: 15,      // Space for axis labels
    },
} as const;

// Type helpers for color arrays
export type RGBColor = readonly [number, number, number];
export type PDFLayout = typeof PDF_LAYOUT;
