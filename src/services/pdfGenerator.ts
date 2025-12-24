import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import type { LogEntry, CrisisEvent, AnalysisResult } from '../types';
import { getModelDisplayName } from '../utils/modelUtils';
import { PDF_LAYOUT } from './pdfConstants';

// Augment jsPDF with autoTable for TypeScript
declare module 'jspdf' {
    interface jsPDF {
        lastAutoTable: { finalY: number };
    }
}

interface PDFGeneratorOptions {
    title?: string;
    includeAnalysis?: boolean;
    includeLogs?: boolean;
    includeCrisis?: boolean;
    includeCharts?: boolean;
    startDate?: Date;
    endDate?: Date;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if we need a page break and add one if necessary
 * Returns the new Y position
 */
function checkPageBreak(doc: jsPDF, currentY: number, requiredSpace: number): number {
    const pageHeight = doc.internal.pageSize.height;
    if (currentY + requiredSpace > pageHeight - PDF_LAYOUT.margin) {
        doc.addPage();
        return PDF_LAYOUT.margin;
    }
    return currentY;
}

/**
 * Draw the arousal trend line chart
 * Shows average arousal per day over time
 */
function drawArousalTrendChart(doc: jsPDF, logs: LogEntry[], startY: number, pageWidth: number): number {
    if (logs.length === 0) return startY;

    const { margin } = PDF_LAYOUT;
    const { fonts, spacing, colors, charts } = PDF_LAYOUT;
    const chartWidth = pageWidth - (margin * 2);
    const chartHeight = charts.lineChartHeight;

    // Group logs by day and calculate average arousal
    const dailyData = new Map<string, { total: number; count: number }>();
    logs.forEach(log => {
        const day = format(new Date(log.timestamp), 'yyyy-MM-dd');
        const existing = dailyData.get(day) || { total: 0, count: 0 };
        dailyData.set(day, { total: existing.total + log.arousal, count: existing.count + 1 });
    });

    const sortedDays = Array.from(dailyData.keys()).sort();
    if (sortedDays.length < 2) return startY; // Need at least 2 days for a trend

    const averages = sortedDays.map(day => {
        const data = dailyData.get(day)!;
        return { day, avg: data.total / data.count };
    });

    // Check page break
    let currentY: number = checkPageBreak(doc, startY, chartHeight + 40);

    // Section heading
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fonts.subHeading);
    doc.setTextColor(...colors.textPrimary);
    doc.text('Spenningstrend (Arousal)', margin, currentY);
    currentY += spacing.afterSubHeading;

    // Draw chart area
    const chartX = margin;
    const chartY = currentY;

    // Draw axes
    doc.setDrawColor(...colors.textSecondary);
    doc.setLineWidth(0.3);
    // Y-axis
    doc.line(chartX, chartY, chartX, chartY + chartHeight);
    // X-axis
    doc.line(chartX, chartY + chartHeight, chartX + chartWidth, chartY + chartHeight);

    // Y-axis labels (1-10)
    doc.setFontSize(7);
    doc.setTextColor(...colors.textSecondary);
    for (let i = 0; i <= 10; i += 2) {
        const y = chartY + chartHeight - (i / 10) * chartHeight;
        doc.text(i.toString(), chartX - 8, y + 2);
        // Grid line
        doc.setDrawColor(230, 230, 230);
        doc.line(chartX, y, chartX + chartWidth, y);
    }

    // Draw the trend line
    doc.setDrawColor(...colors.accentPrimary);
    doc.setLineWidth(1.5);

    const xStep = chartWidth / (averages.length - 1);
    let prevX: number = chartX;
    let prevY: number = chartY + chartHeight - (averages[0].avg / 10) * chartHeight;

    for (let i = 1; i < averages.length; i++) {
        const x = chartX + i * xStep;
        const y = chartY + chartHeight - (averages[i].avg / 10) * chartHeight;

        doc.line(prevX, prevY, x, y);
        prevX = x;
        prevY = y;
    }

    // Draw points
    doc.setFillColor(...colors.accentPrimary);
    for (let i = 0; i < averages.length; i++) {
        const x = chartX + i * xStep;
        const y = chartY + chartHeight - (averages[i].avg / 10) * chartHeight;
        doc.circle(x, y, 1.5, 'F');
    }

    // X-axis labels (show max 7 dates)
    doc.setFontSize(7);
    doc.setTextColor(...colors.textSecondary);
    const labelStep = Math.max(1, Math.floor(averages.length / 7));
    for (let i = 0; i < averages.length; i += labelStep) {
        const x = chartX + i * xStep;
        doc.text(format(new Date(averages[i].day), 'dd.MM'), x - 5, chartY + chartHeight + 8);
    }

    return chartY + chartHeight + spacing.sectionGap;
}

/**
 * Draw trigger frequency bar chart
 * Shows top 5 most common triggers
 */
function drawTriggerFrequencyChart(doc: jsPDF, logs: LogEntry[], startY: number, pageWidth: number): number {
    if (logs.length === 0) return startY;

    const { margin } = PDF_LAYOUT;
    const { fonts, spacing, colors, charts } = PDF_LAYOUT;
    const chartWidth = pageWidth - (margin * 2);
    const chartHeight = charts.barChartHeight;

    // Count trigger frequencies
    const triggerCounts = new Map<string, number>();
    logs.forEach(log => {
        [...log.sensoryTriggers, ...log.contextTriggers].forEach(trigger => {
            triggerCounts.set(trigger, (triggerCounts.get(trigger) || 0) + 1);
        });
    });

    if (triggerCounts.size === 0) return startY;

    // Get top 5 triggers
    const topTriggers = Array.from(triggerCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    if (topTriggers.length === 0) return startY;
    const maxCount = topTriggers[0][1];

    // Check page break
    let currentY: number = checkPageBreak(doc, startY, chartHeight + 40);

    // Section heading
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fonts.subHeading);
    doc.setTextColor(...colors.textPrimary);
    doc.text('Vanligste Triggere', margin, currentY);
    currentY += spacing.afterSubHeading;

    const barHeight = (chartHeight - 10) / topTriggers.length;
    const barGap = 2;

    topTriggers.forEach((trigger, index) => {
        const [name, count] = trigger;
        const barWidth = (count / maxCount) * (chartWidth - 80);
        const barY = currentY + index * (barHeight + barGap);

        // Truncate long trigger names
        const displayName = name.length > 20 ? name.substring(0, 17) + '...' : name;

        // Label
        doc.setFontSize(8);
        doc.setTextColor(...colors.textPrimary);
        doc.text(displayName, margin, barY + barHeight / 2 + 2);

        // Bar
        doc.setFillColor(...colors.accentCyan);
        doc.roundedRect(margin + 70, barY, barWidth, barHeight - barGap, 2, 2, 'F');

        // Count
        doc.setFontSize(8);
        doc.setTextColor(...colors.textSecondary);
        doc.text(count.toString(), margin + 75 + barWidth, barY + barHeight / 2 + 2);
    });

    return currentY + topTriggers.length * (barHeight + barGap) + spacing.sectionGap;
}

/**
 * Chunk array into smaller arrays for pagination
 */
function chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

// =============================================================================
// MAIN PDF GENERATOR
// =============================================================================

export const generatePDF = (
    logs: LogEntry[],
    crisisEvents: CrisisEvent[],
    analysisResult?: AnalysisResult | null,
    options: PDFGeneratorOptions = {}
) => {
    const { margin, fonts, spacing, colors, pageBreak, table } = PDF_LAYOUT;

    // 1. Initialize Document
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // Set metadata
    doc.setProperties({
        title: options.title || 'NeuroLogg Pro Rapport',
        subject: 'Atferdsanalyse og Logg',
        author: 'NeuroLogg Pro',
        creator: 'NeuroLogg Pro App'
    });

    let currentY: number = margin;

    // 2. Header
    doc.setFontSize(fonts.title);
    doc.setTextColor(...colors.textPrimary);
    doc.text(options.title || 'NeuroLogg Pro Rapport', margin, currentY);

    currentY += spacing.afterTitle;
    doc.setFontSize(fonts.body);
    doc.setTextColor(...colors.textSecondary);
    const dateRangeStr = options.startDate && options.endDate
        ? `${format(options.startDate, 'd. MMMM yyyy', { locale: nb })} - ${format(options.endDate, 'd. MMMM yyyy', { locale: nb })}`
        : `Generert: ${format(new Date(), 'd. MMMM yyyy HH:mm', { locale: nb })}`;
    doc.text(dateRangeStr, margin, currentY);

    currentY += spacing.sectionGap;

    // 3. Statistical Summary
    doc.setFontSize(fonts.sectionHeading);
    doc.setTextColor(...colors.textPrimary);
    doc.text('Statistisk Sammendrag', margin, currentY);
    currentY += spacing.afterHeading;

    const avgArousal = logs.length > 0 ? (logs.reduce((acc, log) => acc + log.arousal, 0) / logs.length).toFixed(1) : '-';
    const totalCrisis = crisisEvents.length;
    const highArousalLogs = logs.filter(l => l.arousal >= 7).length;

    const summaryData = [
        ['Antall Logger', logs.length.toString(), 'Gjennomsnittlig Spenning (Arousal)', avgArousal],
        ['Antall Krisehendelser', totalCrisis.toString(), 'Høy Spenning (>7)', `${highArousalLogs} (${logs.length > 0 ? Math.round(highArousalLogs / logs.length * 100) : 0}%)`]
    ];

    autoTable(doc, {
        startY: currentY,
        head: [],
        body: summaryData,
        theme: 'grid',
        styles: { fontSize: fonts.body, cellPadding: table.cellPadding },
        columnStyles: {
            0: { fontStyle: 'bold', fillColor: [...colors.backgroundLight] },
            2: { fontStyle: 'bold', fillColor: [...colors.backgroundLight] }
        }
    });

    currentY = doc.lastAutoTable.finalY + spacing.sectionGap;

    // 4. Charts (if enabled, default true)
    if (options.includeCharts !== false && logs.length > 0) {
        currentY = drawArousalTrendChart(doc, logs, currentY, pageWidth);
        currentY = drawTriggerFrequencyChart(doc, logs, currentY, pageWidth);
    }

    // 5. AI Analysis Result (if available)
    if (analysisResult && options.includeAnalysis !== false) {
        currentY = checkPageBreak(doc, currentY, pageBreak.minRemainingSpace);

        doc.setFontSize(fonts.sectionHeading);
        doc.setFont('helvetica', 'bold');

        const analysisTitle = analysisResult.isDeepAnalysis ? 'AI Dyp Analyse' : 'AI Atferdsanalyse';
        doc.text(analysisTitle, margin, currentY);

        // Model badge if deep analysis
        if (analysisResult.isDeepAnalysis && analysisResult.modelUsed) {
            const modelName = getModelDisplayName(analysisResult.modelUsed, 'Premium');
            doc.setFontSize(fonts.small);
            doc.setTextColor(...colors.textSecondary);
            doc.text(`(Analysert av ${modelName})`, margin + doc.getTextWidth(analysisTitle) + 5, currentY);
            doc.setTextColor(...colors.textPrimary);
        } else if (analysisResult.isDeepAnalysis) {
            doc.setFontSize(fonts.small);
            doc.setTextColor(...colors.textSecondary);
            doc.text(`(Dyp Analyse)`, margin + doc.getTextWidth(analysisTitle) + 5, currentY);
            doc.setTextColor(...colors.textPrimary);
        }

        currentY += spacing.afterHeading;

        // Summary
        doc.setFontSize(fonts.subHeading);
        doc.setFont('helvetica', 'bold');
        doc.text('Oppsummering', margin, currentY);
        currentY += spacing.afterSubHeading;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(fonts.body);
        const splitSummary = doc.splitTextToSize(analysisResult.summary, pageWidth - (margin * 2));
        doc.text(splitSummary, margin, currentY);
        currentY += (splitSummary.length * spacing.lineHeight) + spacing.afterHeading;

        // Recommendations
        if (analysisResult.recommendations && analysisResult.recommendations.length > 0) {
            currentY = checkPageBreak(doc, currentY, pageBreak.tableMinSpace);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(fonts.subHeading);
            doc.text('Anbefalinger', margin, currentY);
            currentY += spacing.afterSubHeading;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(fonts.body);
            analysisResult.recommendations.forEach(rec => {
                const bulletRec = `• ${rec}`;
                const splitRec = doc.splitTextToSize(bulletRec, pageWidth - (margin * 2));

                currentY = checkPageBreak(doc, currentY, splitRec.length * spacing.lineHeight);

                doc.text(splitRec, margin, currentY);
                currentY += (splitRec.length * spacing.lineHeight) + spacing.listItemGap;
            });
            currentY += spacing.afterHeading;
        }

        // Triggers Analysis
        currentY = checkPageBreak(doc, currentY, pageBreak.minRemainingSpace);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(fonts.subHeading);
        doc.text('Trigger Analyse', margin, currentY);
        currentY += spacing.afterSubHeading;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(fonts.body);
        const splitTrigger = doc.splitTextToSize(analysisResult.triggerAnalysis, pageWidth - (margin * 2));
        doc.text(splitTrigger, margin, currentY);
        currentY += (splitTrigger.length * spacing.lineHeight) + spacing.afterParagraph;
    }

    // 6. Crisis Log Table (with pagination)
    if (options.includeCrisis !== false && crisisEvents.length > 0) {
        currentY = checkPageBreak(doc, currentY, pageBreak.tableMinSpace);

        doc.setFontSize(fonts.sectionHeading);
        doc.setFont('helvetica', 'bold');
        doc.text('Krisehendelser', margin, currentY);
        currentY += spacing.afterHeading;

        const crisisData = crisisEvents.map(event => [
            format(new Date(event.timestamp), 'dd.MM HH:mm'),
            event.type,
            `${Math.round(event.durationSeconds / 60)} min`,
            event.peakIntensity.toString(),
            event.hasAudioRecording ? 'Ja' : 'Nei',
            event.sensoryTriggers.join(', ') || '-',
            event.strategiesUsed.join(', ') || '-'
        ]);

        // Paginate large tables
        const crisisChunks = chunkArray(crisisData, table.maxRowsPerPage);

        crisisChunks.forEach((chunk, index) => {
            if (index > 0) {
                doc.addPage();
                currentY = margin;
                doc.setFontSize(fonts.sectionHeading);
                doc.setFont('helvetica', 'bold');
                doc.text(`Krisehendelser (fortsettelse ${index + 1}/${crisisChunks.length})`, margin, currentY);
                currentY += spacing.afterHeading;
            }

            autoTable(doc, {
                startY: currentY,
                head: [['Tid', 'Type', 'Varighet', 'Intensitet', 'Audio', 'Triggere', 'Tiltak']],
                body: chunk,
                theme: 'striped',
                headStyles: { fillColor: [...colors.accentDanger], textColor: 255, fontStyle: 'bold' },
                styles: { fontSize: fonts.small },
            });

            currentY = doc.lastAutoTable.finalY + spacing.sectionGap;
        });
    }

    // 7. Detailed Logs Table (with pagination)
    if (options.includeLogs !== false && logs.length > 0) {
        currentY = checkPageBreak(doc, currentY, pageBreak.tableMinSpace);

        doc.setFontSize(fonts.sectionHeading);
        doc.setFont('helvetica', 'bold');
        doc.text('Detaljert Logg', margin, currentY);
        currentY += spacing.afterHeading;

        const logData = logs.map(log => [
            format(new Date(log.timestamp), 'dd.MM HH:mm'),
            log.context === 'home' ? 'Hjemme' : 'Skole',
            log.arousal.toString(),
            log.valence.toString(),
            log.energy.toString(),
            [...log.sensoryTriggers, ...log.contextTriggers].join(', ') || '-',
            log.strategies.join(', ') || '-'
        ]);

        // Paginate large tables
        const logChunks = chunkArray(logData, table.maxRowsPerPage);

        logChunks.forEach((chunk, index) => {
            if (index > 0) {
                doc.addPage();
                currentY = margin;
                doc.setFontSize(fonts.sectionHeading);
                doc.setFont('helvetica', 'bold');
                doc.text(`Detaljert Logg (fortsettelse ${index + 1}/${logChunks.length})`, margin, currentY);
                currentY += spacing.afterHeading;
            }

            autoTable(doc, {
                startY: currentY,
                head: [['Tid', 'Sted', 'A', 'V', 'E', 'Triggere', 'Tiltak']],
                body: chunk,
                theme: 'striped',
                headStyles: { fillColor: [...colors.accentPrimary], textColor: 255, fontStyle: 'bold' },
                styles: { fontSize: fonts.small },
            });

            currentY = doc.lastAutoTable.finalY + spacing.sectionGap;
        });
    }

    // 8. Footer (Page numbers)
    const pageCount = doc.internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(fonts.footer);
        doc.setTextColor(...colors.textMuted);
        doc.text(
            `Side ${i} av ${pageCount} - Generert av NeuroLogg Pro`,
            pageWidth / 2,
            doc.internal.pageSize.height - 10,
            { align: 'center' }
        );
    }

    // Save
    doc.save(`neurolog-pro-rapport-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
};
