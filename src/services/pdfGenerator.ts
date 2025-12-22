import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import type { LogEntry, CrisisEvent, AnalysisResult } from '../types';

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
    startDate?: Date;
    endDate?: Date;
}

export const generatePDF = (
    logs: LogEntry[],
    crisisEvents: CrisisEvent[],
    analysisResult?: AnalysisResult | null,
    options: PDFGeneratorOptions = {}
) => {
    // 1. Initialize Document
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const margin = 20;

    // Set metadata
    doc.setProperties({
        title: options.title || 'NeuroLogg Pro Rapport',
        subject: 'Atferdsanalyse og Logg',
        author: 'NeuroLogg Pro',
        creator: 'NeuroLogg Pro App'
    });

    let currentY = margin;

    // 2. Header
    doc.setFontSize(22);
    doc.setTextColor(30, 41, 59); // Slate 800
    doc.text(options.title || 'NeuroLogg Pro Rapport', margin, currentY);

    currentY += 10;
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // Slate 500
    const dateRangeStr = options.startDate && options.endDate
        ? `${format(options.startDate, 'd. MMMM yyyy', { locale: nb })} - ${format(options.endDate, 'd. MMMM yyyy', { locale: nb })}`
        : `Generert: ${format(new Date(), 'd. MMMM yyyy HH:mm', { locale: nb })}`;
    doc.text(dateRangeStr, margin, currentY);

    currentY += 15;

    // 3. Statistical Summary
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text('Statistisk Sammendrag', margin, currentY);
    currentY += 8;

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
        styles: { fontSize: 10, cellPadding: 4 },
        columnStyles: {
            0: { fontStyle: 'bold', fillColor: [241, 245, 249] }, // Label
            2: { fontStyle: 'bold', fillColor: [241, 245, 249] }  // Label
        }
    });

    currentY = doc.lastAutoTable.finalY + 15;

    // 4. AI Analysis Result (if available)
    if (analysisResult && options.includeAnalysis !== false) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');

        const analysisTitle = analysisResult.isDeepAnalysis ? 'AI Dyp Analyse' : 'AI Atferdsanalyse';
        doc.text(analysisTitle, margin, currentY);

        // Model badge if deep analysis
        if (analysisResult.isDeepAnalysis && analysisResult.modelUsed) {
            const modelName = analysisResult.modelUsed?.split('/')[1] ?? analysisResult.modelUsed;
            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139);
            doc.text(`(Analysert av ${modelName})`, margin + doc.getTextWidth(analysisTitle) + 5, currentY);
            doc.setTextColor(30, 41, 59); // Reset color
        } else if (analysisResult.isDeepAnalysis) {
            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139);
            doc.text(`(Dyp Analyse)`, margin + doc.getTextWidth(analysisTitle) + 5, currentY);
            doc.setTextColor(30, 41, 59); // Reset color
        }

        currentY += 8;

        // Summary
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Oppsummering', margin, currentY);
        currentY += 6;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const splitSummary = doc.splitTextToSize(analysisResult.summary, pageWidth - (margin * 2));
        doc.text(splitSummary, margin, currentY);
        currentY += (splitSummary.length * 5) + 8;

        // Recommendations
        if (analysisResult.recommendations && analysisResult.recommendations.length > 0) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.text('Anbefalinger', margin, currentY);
            currentY += 6;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            analysisResult.recommendations.forEach(rec => {
                const bulletRec = `• ${rec}`;
                const splitRec = doc.splitTextToSize(bulletRec, pageWidth - (margin * 2));

                // Check page break
                if (currentY + (splitRec.length * 5) > doc.internal.pageSize.height - margin) {
                    doc.addPage();
                    currentY = margin;
                }

                doc.text(splitRec, margin, currentY);
                currentY += (splitRec.length * 5) + 2;
            });
            currentY += 8;
        }

        // Triggers Analysis
        if (currentY > doc.internal.pageSize.height - 60) { doc.addPage(); currentY = margin; }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('Trigger Analyse', margin, currentY);
        currentY += 6;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const splitTrigger = doc.splitTextToSize(analysisResult.triggerAnalysis, pageWidth - (margin * 2));
        doc.text(splitTrigger, margin, currentY);
        currentY += (splitTrigger.length * 5) + 12;
    }

    // 5. Crisis Log Table
    if (options.includeCrisis !== false && crisisEvents.length > 0) {
        // Check page break
        if (currentY > doc.internal.pageSize.height - 50) {
            doc.addPage();
            currentY = margin;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Krisehendelser', margin, currentY);
        currentY += 8;

        const crisisData = crisisEvents.map(event => [
            format(new Date(event.timestamp), 'dd.MM HH:mm'),
            event.type,
            `${event.durationSeconds / 60} min`,
            event.peakIntensity.toString(),
            event.hasAudioRecording ? 'Ja' : 'Nei',
            event.sensoryTriggers.join(', ') || '-',
            event.strategiesUsed.join(', ') || '-'
        ]);

        autoTable(doc, {
            startY: currentY,
            head: [['Tid', 'Type', 'Varighet', 'Intensitet', 'Audio', 'Triggere', 'Tiltak']],
            body: crisisData,
            theme: 'striped',
            headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold' }, // Red header
            styles: { fontSize: 9 },
        });

        currentY = doc.lastAutoTable.finalY + 15;
    }

    // 6. Detailed Logs Table
    if (options.includeLogs !== false && logs.length > 0) {
        // Check page break
        if (currentY > doc.internal.pageSize.height - 50) {
            doc.addPage();
            currentY = margin;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Detaljert Logg', margin, currentY);
        currentY += 8;

        const logData = logs.map(log => [
            format(new Date(log.timestamp), 'dd.MM HH:mm'),
            log.context === 'home' ? 'Hjemme' : 'Skole',
            log.arousal.toString(),
            log.valence.toString(),
            log.energy.toString(),
            [...log.sensoryTriggers, ...log.contextTriggers].join(', ') || '-',
            log.strategies.join(', ') || '-'
        ]);

        autoTable(doc, {
            startY: currentY,
            head: [['Tid', 'Sted', 'A', 'V', 'E', 'Triggere', 'Tiltak']], // A=Arousal, V=Valence, E=Energy
            body: logData,
            theme: 'striped',
            headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' }, // Primary/Indigo header
            styles: { fontSize: 9 },
        });
    }

    // 7. Footer (Page numbers)
    const pageCount = doc.internal.pages.length - 1; // last element is empty
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
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
