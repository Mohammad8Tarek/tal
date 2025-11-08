import { jsPDF } from 'jspdf';
// FIX: Changed from side-effect import to default import for ES module compatibility.
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { ExportSettings } from '../context/ExportSettingsContext';
import { defaultLogoBase64 } from '../logo';


// --- Helper Functions ---

/**
 * A simple heuristic to check if a string contains Arabic characters.
 */
const containsArabic = (text: string) => /[\u0600-\u06FF]/.test(text);

/**
 * Reverses a string to simulate RTL rendering in jsPDF.
 * This is a workaround for jsPDF's limited RTL support.
 */
const processRtlText = (text: string): string => {
    if (!containsArabic(text)) return text;
    // This is a simple reversal, more complex logic might be needed for mixed strings.
    return text.split('').reverse().join('');
};

const processDataForRtl = (data: any[][], language: 'en' | 'ar') => {
    if (language !== 'ar') return data;
    return data.map(row => row.map(cell => {
        if (typeof cell === 'string') return processRtlText(cell);
        return cell;
    }));
};

// --- Excel Export ---

interface ExcelExportOptions {
    headers: string[];
    data: any[][];
    sheetName?: string;
    filename: string;
    settings: ExportSettings;
}

export const exportToExcel = ({ headers, data, sheetName = 'Sheet1', filename, settings }: ExcelExportOptions) => {
    const ws_data = [headers, ...data];
    const ws = XLSX.utils.aoa_to_sheet(ws_data);

    // Auto-fit columns
    const colWidths = headers.map((_, i) => ({
        wch: Math.max(
            headers[i]?.length || 0,
            ...data.map(row => row[i]?.toString().length || 0)
        ) + 2 // Add padding
    }));
    ws['!cols'] = colWidths;

    // Styling
    const thinBorder = {
        top: { style: "thin", color: { rgb: "D3D3D3" } },
        bottom: { style: "thin", color: { rgb: "D3D3D3" } },
        left: { style: "thin", color: { rgb: "D3D3D3" } },
        right: { style: "thin", color: { rgb: "D3D3D3" } },
    };

    const headerStyle = {
        // Note: Custom fonts like Poppins are not reliably supported in XLSX.js. Sticking to standard styles.
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: settings.headerColor.replace('#', '') } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: thinBorder,
    };
    const evenRowStyle = { fill: { fgColor: { rgb: "F7F7F7" } } };
    const oddRowStyle = { fill: { fgColor: { rgb: "FFFFFF" } } };
    const cellStyle = { 
        alignment: { horizontal: 'center', vertical: 'center' },
        border: thinBorder,
    };

    // Apply styles
    const range = XLSX.utils.decode_range(ws['!ref']!);
    for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell_address = { c: C, r: R };
            const cell_ref = XLSX.utils.encode_cell(cell_address);
            if (!ws[cell_ref]) continue;

            if (R === 0) { // Header row
                ws[cell_ref].s = headerStyle;
            } else { // Data rows
                ws[cell_ref].s = { ...(R % 2 === 0 ? evenRowStyle : oddRowStyle), ...cellStyle };
            }
        }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    XLSX.writeFile(wb, filename, { bookType: 'xlsx', type: 'binary' });
};


// --- PDF Export ---

interface PdfExportOptions {
    headers: string[];
    data: any[][];
    title: string;
    filename: string;
    settings: ExportSettings;
    language: 'en' | 'ar';
}

export const exportToPdf = ({ headers, data, title, filename, settings, language }: PdfExportOptions) => {
    const doc = new jsPDF({ orientation: 'p', unit: 'cm', format: 'a4' });
    
    // jsPDF doesn't support web fonts directly. For full Arabic support, a font like 'Amiri'
    // would need to be manually added to the jsPDF instance, which requires its .ttf file.
    // As a workaround, we set the font and process text for RTL.
    if (language === 'ar') {
        doc.setFont('Helvetica'); // A built-in font
    }
    
    const logoData = settings.customLogo || defaultLogoBase64;
    const processedHeaders = language === 'ar' ? headers.map(processRtlText) : headers;
    const processedData = processDataForRtl(data, language);
    const tableHeaderColor = settings.headerColor;

    // FIX: Changed from `doc.autoTable` to the functional call `autoTable(doc, ...)`
    // to work correctly with ES module imports.
    autoTable(doc, {
        head: [processedHeaders],
        body: processedData,
        startY: 3.5,
        margin: { top: 3.5, right: 1, bottom: 2, left: 1 },
        theme: 'grid',
        headStyles: {
            fillColor: tableHeaderColor,
            textColor: '#FFFFFF',
            fontStyle: 'bold',
            halign: 'center',
        },
        styles: {
            font: 'Helvetica',
            fontSize: 9,
            cellPadding: 0.2,
            halign: language === 'ar' ? 'right' : 'center',
        },
        alternateRowStyles: {
            fillColor: '#f9fafb'
        },
        didDrawPage: (data: any) => {
            // Header
            try {
                doc.addImage(logoData, 'PNG', 18, 0.5, 2, 2); // logo
            } catch (e) {
                console.error("Could not add logo to PDF.", e);
            }
            doc.setFontSize(16);
            doc.setTextColor('#334155');
            const systemName = 'Tal Avenue Staff Housing';
            doc.text(language === 'ar' ? processRtlText(systemName) : systemName, 1, 1.5);

            doc.setFontSize(12);
            doc.setTextColor('#475569');
            const reportTitle = language === 'ar' ? processRtlText(title) : title;
            doc.text(reportTitle, 1, 2.5);
            
            doc.setFontSize(9);
            const exportDate = new Date().toLocaleString();
            const dateText = language === 'ar' ? processRtlText(exportDate) : exportDate;
            doc.text(dateText, 1, 3);
            

            // Footer
            const pageCount = doc.internal.getNumberOfPages();
            doc.setFontSize(8);
            doc.setTextColor('#64748b');
            const footerText = '© Tal Avenue System';
            const pageStr = `Page ${data.pageNumber} of ${pageCount}`;
            
            doc.text(language === 'ar' ? processRtlText(footerText) : footerText, 1, 29);
            doc.text(pageStr, 20, 29, { align: 'right' });
        },
    });

    doc.save(filename);
};