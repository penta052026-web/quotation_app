const ExcelJS = require('exceljs');
const jsPDF = require('jspdf').jsPDF;
require('jspdf-autotable');
const path = require('path');
const fs = require('fs');
const moment = require('moment');
const Handlebars = require('handlebars');

class ExportService {
    constructor() {
        this.exportsPath = path.join(__dirname, '..', 'exports');
        this.quotationBasePath = path.join(__dirname, '..', '..', 'Quotation');
        this.pdfPath = path.join(__dirname, '..', 'pdf');
        this.bomPdfPath = path.join(this.pdfPath, 'bom');
        this.excelPath = path.join(__dirname, '..', 'excel');
        this.quotationExcelPath = path.join(this.excelPath, 'quotations');
        this.bomExcelPath = path.join(this.excelPath, 'bom');
        this.logoPath = path.join(__dirname, '..', '..', 'penta logo.png');
        this.ensureDirectories();
    }

    ensureDirectories() {
        if (!fs.existsSync(this.exportsPath)) {
            fs.mkdirSync(this.exportsPath, { recursive: true });
        }
        if (!fs.existsSync(this.pdfPath)) {
            fs.mkdirSync(this.pdfPath, { recursive: true });
        }
        if (!fs.existsSync(this.bomPdfPath)) {
            fs.mkdirSync(this.bomPdfPath, { recursive: true });
        }
        if (!fs.existsSync(this.excelPath)) {
            fs.mkdirSync(this.excelPath, { recursive: true });
        }
        if (!fs.existsSync(this.quotationExcelPath)) {
            fs.mkdirSync(this.quotationExcelPath, { recursive: true });
        }
        if (!fs.existsSync(this.bomExcelPath)) {
            fs.mkdirSync(this.bomExcelPath, { recursive: true });
        }
        if (!fs.existsSync(this.quotationBasePath)) {
            fs.mkdirSync(this.quotationBasePath, { recursive: true });
        }
    }

    // Helper method to create PQ-based folder structure
    createPQFolderStructure(quoteRef) {
        if (!quoteRef) {
            quoteRef = `PQ${moment().format('YYYYMMDD_HHmmss')}`;
        }
        
        // Always use base reference (without -REV#) for folder structure
        const baseRef = quoteRef.split('-REV')[0];
        const pqFolderPath = path.join(this.quotationBasePath, baseRef);
        const quotationFolderPath = path.join(pqFolderPath, 'Quotation');
        const bomFolderPath = path.join(pqFolderPath, 'BOM');
        
        // Create main PQ folder
        if (!fs.existsSync(pqFolderPath)) {
            fs.mkdirSync(pqFolderPath, { recursive: true });
        }
        
        // Create Quotation subfolders
        const quotationSubfolders = ['PDF', 'Excel'];
        quotationSubfolders.forEach(subfolder => {
            const subfolderPath = path.join(quotationFolderPath, subfolder);
            if (!fs.existsSync(subfolderPath)) {
                fs.mkdirSync(subfolderPath, { recursive: true });
            }
        });
        
        // Create BOM subfolders
        const bomSubfolders = ['PDF', 'Excel'];
        bomSubfolders.forEach(subfolder => {
            const subfolderPath = path.join(bomFolderPath, subfolder);
            if (!fs.existsSync(subfolderPath)) {
                fs.mkdirSync(subfolderPath, { recursive: true });
            }
        });
        
        return {
            pqFolderPath,
            quotationPdfPath: path.join(quotationFolderPath, 'PDF'),
            quotationExcelPath: path.join(quotationFolderPath, 'Excel'),
            bomPdfPath: path.join(bomFolderPath, 'PDF'),
            bomExcelPath: path.join(bomFolderPath, 'Excel')
        };
    }
    
    // Helper function to add logo to PDF pages
    addLogoToPDF(doc, x = 165, y = 15, width = 30, height = 15) {
        try {
            if (fs.existsSync(this.logoPath)) {
                // Read the logo file as base64
                const logoData = fs.readFileSync(this.logoPath, { encoding: 'base64' });
                // Add the logo image to PDF
                doc.addImage(`data:image/png;base64,${logoData}`, 'PNG', x, y, width, height);
                return true;
            } else {
                console.warn('Logo file not found at:', this.logoPath);
                // Fallback to text logo
                doc.setFontSize(18);
                doc.text('penta', x, y + 8);
                doc.setFontSize(10);
                doc.setFont('helvetica', 'italic');
                doc.text('innovative solutions', x, y + 16);
                return false;
            }
        } catch (error) {
            console.error('Error loading logo:', error);
            // Fallback to text logo
            doc.setFontSize(18);
            doc.text('penta', x, y + 8);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'italic');
            doc.text('innovative solutions', x, y + 16);
            return false;
        }
    }

    async exportToExcel(quotationData) {
        try {
            console.log('=== EXCEL EXPORT DEBUG ===');
            console.log('QuotationData keys:', Object.keys(quotationData));
            console.log('Items count:', quotationData.items?.length || 0);
            console.log('QuoteRef:', quotationData.quoteRef);
            console.log('ClientInfo:', quotationData.clientInfo);
            console.log('ProjectInfo:', quotationData.projectInfo);
            
            // Debug: Check for images in items before parsing
            if (quotationData.items && quotationData.items.length > 0) {
                quotationData.items.forEach((item, idx) => {
                    if (item.images) {
                        console.log(`Item ${idx + 1} ("${item.description}") has ${Array.isArray(item.images) ? item.images.length : 'non-array'} images`);
                    }
                });
            }
            
            const workbook = new ExcelJS.Workbook();
            
            // Create worksheets
            this.createExcelCoverPage(workbook, quotationData);
            const hierarchicalItems = this.parseHierarchicalItems(quotationData.items || []);
            console.log('Hierarchical items count:', hierarchicalItems.length);
            hierarchicalItems.forEach((item, idx) => {
                console.log(`Item ${idx + 1}: "${item.description}", parts: ${item.parts?.length || 0}, totalAmount: ${item.totalAmount}, images: ${item.images?.length || 0}`);
            });
            this.createExcelSummaryPage(workbook, quotationData, hierarchicalItems);
            
            // Create a worksheet for each item with parts
            hierarchicalItems.forEach((item, index) => {
                this.createExcelItemDetailPage(workbook, quotationData, item, index);
            });
            
            // Get quote reference
            const quoteRef = quotationData.quoteRef || `PQ${moment().format('YYYYMMDD_HHmmss')}`;
            const isRevision = quotationData.isRevision || false;
            
            // Always use base reference (without -REV#) for folder structure
            const baseRef = quoteRef.split('-REV')[0];
            
            // Create folder structure using base reference
            const folderStructure = this.createPQFolderStructure(baseRef);
            
            // Determine the target directory based on whether it's a revision
            // For revisions, use the base PQ folder + 'Revision' subfolder
            // For new quotations, use the standard Quotation Excel folder
            const targetDir = isRevision 
                ? path.join(folderStructure.pqFolderPath, 'Revision') 
                : folderStructure.quotationExcelPath;
            
            // Create the directory if it doesn't exist
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }
            
            // Generate filename with full reference (including -REV# if present)
            const filename = `quotation_${quoteRef}.xlsx`;
            const filePath = path.join(targetDir, filename);
            
            // Save the file
            await workbook.xlsx.writeFile(filePath);
            console.log(`Excel file exported successfully: ${filePath}`);
            console.log(`Excel workbook has ${workbook.worksheets.length} worksheets`);
            workbook.worksheets.forEach((ws, idx) => {
                console.log(`  Worksheet ${idx + 1}: "${ws.name}" - ${ws.rowCount} rows`);
            });
            console.log('=== END EXCEL EXPORT DEBUG ===\n');
            
            // Also save to old location for backward compatibility
            const oldFilePath = path.join(this.quotationExcelPath, filename);
            await workbook.xlsx.writeFile(oldFilePath);
            
            return filePath;
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            throw error;
        }
    }

    async exportToPDF(quotationData) {
        try {
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });
            
            // Calculate accurate total pages using estimation
            const hierarchicalItems = this.parseHierarchicalItems(quotationData.items);
            const totalPages = this.calculateAccurateTotalPages(hierarchicalItems, quotationData);
            
            // Generate all pages with accurate page numbering
            this.generatePage1(doc, quotationData, totalPages);
            this.generateQuotationSummary(doc, quotationData, totalPages);
            this.generateItemDetails(doc, quotationData, totalPages);
            
            // Get quote reference
            const quoteRef = quotationData.quoteRef || `PQ${moment().format('YYYYMMDD_HHmmss')}`;
            const isRevision = quotationData.isRevision || false;
            
            // Always use base reference (without -REV#) for folder structure
            const baseRef = quoteRef.split('-REV')[0];
            
            // Create folder structure using base reference
            const folderStructure = this.createPQFolderStructure(baseRef);
            
            // Determine the target directory based on whether it's a revision
            // For revisions, use the base PQ folder + 'Revision' subfolder
            // For new quotations, use the standard Quotation PDF folder
            const targetDir = isRevision 
                ? path.join(folderStructure.pqFolderPath, 'Revision') 
                : folderStructure.quotationPdfPath;
            
            // Create the directory if it doesn't exist
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }
            
            // Generate filename with full reference (including -REV# if present)
            const filename = `quotation_${quoteRef}.pdf`;
            const filepath = path.join(targetDir, filename);
            
            // Save PDF to file system
            const pdfBuffer = doc.output('arraybuffer');
            fs.writeFileSync(filepath, Buffer.from(pdfBuffer));
            console.log(`PDF file exported: ${filepath}`);
            
            // Also save to the main PDF folder for backward compatibility
            const oldFilepath = path.join(this.pdfPath, filename);
            fs.writeFileSync(oldFilepath, Buffer.from(pdfBuffer));
            
            return filepath;
        } catch (error) {
            console.error('Error exporting to PDF:', error);
            throw error;
        }
    }

    async exportBOMToPDF(quotationData, options = {}) {
        try {
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            // Only BOM page, with total pages = 1
            this.generateBOMPage(doc, quotationData, 1);

            // Get quote reference from options or quotation data
            const quoteRef = options.quoteRef || quotationData.quoteRef || `PQ${moment().format('YYYYMMDD_HHmmss')}`;
            
            // Always use base reference (without -REV#) for folder structure
            const baseRef = quoteRef.split('-REV')[0];
            
            // Create folder structure using base reference
            const folderStructure = this.createPQFolderStructure(baseRef);
            
            // Save to BOM PDF folder
            const targetDir = folderStructure.bomPdfPath;
            
            // Create the directory if it doesn't exist
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }

            // Generate filename with full reference (including -REV# if present)
            let ref = quoteRef;
            if (options.stripPQ && typeof ref === 'string' && ref.startsWith('PQ')) {
                ref = ref.slice(2);
            }
            const filename = `bom_${ref}.pdf`;
            const filepath = path.join(targetDir, filename);

            const pdfBuffer = doc.output('arraybuffer');
            fs.writeFileSync(filepath, Buffer.from(pdfBuffer));
            console.log(`BOM PDF exported: ${filepath}`);

            // Also save to the main BOM folder for backward compatibility
            const oldFilepath = path.join(this.bomPdfPath, filename);
            fs.writeFileSync(oldFilepath, Buffer.from(pdfBuffer));

            return filepath;
        } catch (error) {
            console.error('Error exporting BOM to PDF:', error);
            throw error;
        }
    }

    calculateTotalPages(hierarchicalItems) {
        // Page 1: Cover page
        let totalPages = 1;
        
        // Page 2: Quotation Summary
        // Estimate based on number of items (roughly 15-20 items per page)
        const summaryPages = Math.max(1, Math.ceil(hierarchicalItems.length / 15));
        totalPages += summaryPages;
        
        // Additional pages for item details (1 page per item)
        totalPages += hierarchicalItems.length;
        
        return totalPages;
    }
    
    calculateAccurateTotalPages(hierarchicalItems, quotationData) {
        // Page 1: Cover page
        let totalPages = 1;
        
        // Page 2+: Quotation Summary
        // More accurate estimation based on actual content
        const summaryItems = hierarchicalItems.length;
        const financialRows = 3 + (quotationData.pricing?.discountPercentage > 0 ? 1 : 0); // Price, VAT, Total + optional discount
        const totalSummaryRows = summaryItems + financialRows;
        
        // Estimate rows per page (accounting for headers, spacing, etc.)
        const rowsPerPage = 20; // Conservative estimate for A4
        const summaryPages = Math.max(1, Math.ceil(totalSummaryRows / rowsPerPage));
        totalPages += summaryPages;
        
        // Additional pages for item details (1 page per item)
        // This now includes both regular and additional items since they're in the same structure
        totalPages += hierarchicalItems.length;
        
        return totalPages;
    }
    
    // Helper method to set font with fallback
    setFont(doc, fontName = 'calibri', fontStyle = 'normal') {
        try {
            doc.setFont(fontName, fontStyle);
        } catch (e) {
            // Fallback to Arial if Calibri is not available
            doc.setFont('arial', fontStyle);
        }
    }

    // Helper method to set default font size to 10
    setDefaultFontSize(doc) {
        doc.setFontSize(10);
    }

    // Helper method to add multiple item images to PDF with dynamic sizing
    addItemImagesToPDF(doc, images, yPos, partsCount) {
        try {
            // Validate images array
            if (!images || !Array.isArray(images) || images.length === 0) {
                console.log('No valid images to add');
                return;
            }

            // Filter out invalid images
            const validImages = images.filter(img => {
                if (!img || typeof img !== 'string') {
                    console.warn('Invalid image data found, skipping');
                    return false;
                }
                // Check if it's a valid base64 image
                if (!img.startsWith('data:image/')) {
                    console.warn('Invalid image format, skipping');
                    return false;
                }
                return true;
            });

            if (validImages.length === 0) {
                console.log('No valid images after filtering');
                return;
            }

            // Calculate available space based on parts count and current position
            const footerSpace = 40; // Space reserved for footer
            const availableHeight = 280 - yPos - footerSpace;
            
            // Dynamic sizing based on parts count and number of images
            // More aggressive sizing to ensure images fit on same page
            let maxImageHeight;
            const imageCount = validImages.length;
            const rowsNeeded = Math.ceil(imageCount / 2); // 2 images per row max
            const spacingBetweenRows = 10;
            const totalSpacing = (rowsNeeded - 1) * spacingBetweenRows;
            const maxHeightForAllImages = availableHeight - totalSpacing;
            
            // Calculate per-image height based on number of rows
            if (partsCount <= 3) {
                // More space available, allow larger images
                maxImageHeight = Math.min(imageCount === 1 ? 100 : Math.floor(maxHeightForAllImages / rowsNeeded), 80);
            } else if (partsCount <= 6) {
                // Medium space
                maxImageHeight = Math.min(imageCount === 1 ? 70 : Math.floor(maxHeightForAllImages / rowsNeeded), 60);
            } else {
                // Limited space, make images smaller
                maxImageHeight = Math.min(imageCount === 1 ? 50 : Math.floor(maxHeightForAllImages / rowsNeeded), 40);
            }
            
            // Ensure minimum size but respect available space
            maxImageHeight = Math.max(25, Math.min(maxImageHeight, availableHeight));
            
            // Verify all images will fit
            const totalHeightNeeded = (rowsNeeded * maxImageHeight) + totalSpacing;
            if (totalHeightNeeded > availableHeight && rowsNeeded > 1) {
                // Adjust to fit: reduce image height
                maxImageHeight = Math.floor((availableHeight - totalSpacing) / rowsNeeded);
                maxImageHeight = Math.max(25, maxImageHeight); // Still maintain minimum
            }
            
            // Calculate layout
            const maxImageWidth = 170; // Page width minus margins
            const imagesPerRow = imageCount === 1 ? 1 : Math.min(2, imageCount);
            const imageWidth = imageCount === 1 ? maxImageWidth : (maxImageWidth - 10) / 2;
            const imageHeight = maxImageHeight;
            
            let currentX = 20;
            let currentY = yPos;
            
            validImages.forEach((imageData, index) => {
                if (index > 0 && index % imagesPerRow === 0) {
                    // Move to next row
                    currentY += imageHeight + 10;
                    currentX = 20;
                }
                
                // Check if we have space for this image
                if (currentY + imageHeight > 280 - footerSpace) {
                    console.log(`Skipping image ${index + 1} - not enough space`);
                    return;
                }
                
                try {
                    // Validate image data format
                    if (!imageData.startsWith('data:image/')) {
                        throw new Error('Invalid image data format');
                    }
                    
                    // Try to determine image format from data URL
                    let format = 'JPEG';
                    if (imageData.includes('data:image/png')) {
                        format = 'PNG';
                    } else if (imageData.includes('data:image/gif')) {
                        format = 'GIF';
                    }
                    
                    console.log(`Attempting to add image ${index + 1}: format=${format}, size=${imageWidth}x${imageHeight}, position=${currentX},${currentY}`);
                    
                    doc.addImage(
                        imageData,
                        format,
                        currentX,
                        currentY,
                        imageWidth,
                        imageHeight,
                        undefined,
                        'FAST'
                    );
                    
                    console.log(`Successfully added image ${index + 1} to PDF`);
                } catch (imgError) {
                    console.error(`Error adding image ${index + 1}:`, imgError);
                    console.error('Image data preview:', imageData.substring(0, 100) + '...');
                    
                    // Add fallback text for this specific image
                    this.setFont(doc, 'calibri', 'italic');
                    doc.setFontSize(8);
                    doc.text(`[Image ${index + 1} failed: ${imgError.message}]`, currentX, currentY + 10);
                }
                
                // Move to next position in row
                currentX += imageWidth + 10;
            });
            
        } catch (error) {
            console.error('Error adding images to PDF:', error);
            // Add fallback text if all images fail
            this.setFont(doc, 'calibri', 'italic');
            doc.setFontSize(10);
            doc.text('[Images could not be displayed]', 20, yPos + 10);
        }
    }

    generatePage1(doc, quotationData, totalPages = 26) {
        let yPos = 30; // Reduced top margin for tighter header spacing
        
        // Debug: Log quotation data structure
        console.log('=== QUOTATION DATA DEBUG ===');
        console.log('All Keys:', Object.keys(quotationData));
        console.log('Full Data:', JSON.stringify(quotationData, null, 2));
        console.log('Customer No variations:', {
            customerNo: quotationData.customerNo,
            customerNumber: quotationData.customerNumber,
            clientInfo: quotationData.clientInfo,
            client: quotationData.client
        });
        console.log('Inquiry No variations:', {
            inquiryNo: quotationData.inquiryNo,
            inquiryNumber: quotationData.inquiryNumber,
            inquiryRef: quotationData.inquiryRef,
            inquiryInfo: quotationData.inquiryInfo
        });
        console.log('=== END DEBUG ===');
        
        // Set default font and size
        this.setFont(doc, 'calibri', 'normal');
        this.setDefaultFontSize(doc);
        
        // Title - QUOTATION (left aligned, smaller size to match reference)
        doc.setFontSize(16);
        this.setFont(doc, 'calibri', 'bold');
        doc.text('QUOTATION', 20, yPos);
        
        // Company logo (right side) - positioned to match reference
        this.addLogoToPDF(doc, 145, yPos - 10, 45, 20);
        yPos += 25; // Reduced spacing to match other pages
        
        // Client Info and Date Section
        this.setFont(doc, 'calibri', 'normal');
        this.setDefaultFontSize(doc);
        
        const clientName = quotationData.clientInfo?.name || 'M/S Orion Building Contracting LLC';
        doc.text(clientName, 20, yPos);
        doc.text(quotationData.date || moment().format('DD.MM.YYYY'), 170, yPos);
        yPos += 5;
        doc.text('UAE', 20, yPos);
        yPos += 15; // Reduced spacing between UAE and project details
        
        // Project Details Section - match reference spacing
        this.setFont(doc, 'calibri', 'normal');
        this.setDefaultFontSize(doc);
        
        // Left column - labels in bold
        this.setFont(doc, 'calibri', 'bold');
        doc.text('Project :', 20, yPos);
        this.setFont(doc, 'calibri', 'normal');
        doc.text(quotationData.projectInfo?.name || 'ASHMOUNT SCHOOL- MUDON', 50, yPos);
        
        this.setFont(doc, 'calibri', 'bold');
        doc.text('Quote Ref.:', 20, yPos + 5);
        this.setFont(doc, 'calibri', 'normal');
        doc.text(quotationData.quoteRef || 'PQ25070025', 50, yPos + 5);
        
        this.setFont(doc, 'calibri', 'bold');
        doc.text('Customer No :', 20, yPos + 10);
        this.setFont(doc, 'calibri', 'normal');
        doc.text(quotationData.customerNo || quotationData.customerNumber || quotationData.clientInfo?.customerNo || quotationData.clientInfo?.customerNumber || quotationData.client?.customerNo || '', 50, yPos + 10);
        
        // Right column - labels in bold
        this.setFont(doc, 'calibri', 'bold');
        doc.text('Inquiry No.:', 125, yPos);
        this.setFont(doc, 'calibri', 'normal');
        doc.text(quotationData.inquiryNo || quotationData.inquiryNumber || quotationData.inquiryInfo?.inquiryNo || quotationData.inquiry?.number || quotationData.inquiryRef || '', 160, yPos);
        
        this.setFont(doc, 'calibri', 'bold');
        doc.text('Inquiry Date:', 125, yPos + 5);
        this.setFont(doc, 'calibri', 'normal');
        doc.text(quotationData.inquiryDate || quotationData.date || moment().format('DD.MM.YYYY'), 160, yPos + 5);
        
        this.setFont(doc, 'calibri', 'bold');
        doc.text('Drawing No.:', 125, yPos + 10);
        this.setFont(doc, 'calibri', 'normal');
        doc.text(quotationData.drawingNo || quotationData.projectInfo?.drawingNo || '', 160, yPos + 10);
        
        yPos += 25; // Reduced spacing after project details
        
        // Greeting - tighter spacing to match reference
        doc.text('Dear Sir or Madam,', 20, yPos);
        yPos += 8;
        
        // Introduction paragraph - exactly 2 lines
        const introText = 'We appreciate your inquiry and the opportunity to provide you with a comprehensive quotation tailored to your requirements. Please find below the details of our quotation and the terms and conditions associated with';
        const splitIntro = doc.splitTextToSize(introText, 170); // Adjusted width for 2-line layout
        doc.text(splitIntro, 20, yPos);
        yPos += splitIntro.length * 4 + 4; // Reduced spacing after introduction
        
        // Terms and Conditions - formatted as in reference
        const terms = [
            [`Delivery Time:`, quotationData.terms?.deliveryTime || '6-8 weeks for furniture and 8-12 weeks for fumecupboard and safety cabinets after receiving downpayment.'],
            [`Delivery terms:`, quotationData.terms?.deliveryTerms || 'Delivery Included'],
            [`Payment terms:`, quotationData.terms?.paymentTerms || '50% advance payment, 50% balance payment before order collection.'],
            [`Installation:`, quotationData.terms?.installation || 'Included'],
            [`Warranty:`, quotationData.terms?.warranty || '10 Years for the phenolic worktop, 1 Year for the other items'],
            [`Currency:`, quotationData.pricing?.currency || quotationData.terms?.currency || 'AED'],
            [`Offer Validity:`, quotationData.terms?.offerValidity || 'This offer valid for one month'],
            [`Exclusions:`, quotationData.terms?.exclusions || 'Civil, MEP, Ducting, Gas Works']
        ];
        
        terms.forEach(([label, value]) => {
            if (value && yPos < 210) { // Adjusted limit for better footer spacing
                this.setFont(doc, 'calibri', 'bold');
                doc.text(label, 20, yPos);
                this.setFont(doc, 'calibri', 'normal');
                const wrappedValue = doc.splitTextToSize(value, 110); // Reduced width for proper margins
                doc.text(wrappedValue, 50, yPos);
                yPos += Math.max(wrappedValue.length * 4, 5); // Reduced minimum spacing
            }
        });
        // NOTE section - single line, no wrapping
        if (yPos < 215) {
            yPos += 3;
            this.setFont(doc, 'calibri', 'bold');
            const noteText = 'NOTE THE QUOTE IS FOR STANDARD COLOR FRAME WHITE AND CARCASS WHITE COLOR';
            doc.text(noteText, 20, yPos); // Single line, no text wrapping
            yPos += 8; // Reduced spacing after NOTE
        }
        
        // Bank Details section - ensure proper spacing from footer
        if (yPos < 215) {
            this.setFont(doc, 'calibri', 'bold');
            doc.text('BANK DETAILS:', 20, yPos);
            yPos += 6;
            
            this.setFont(doc, 'calibri', 'normal');
            const bankDetailsData = [
                ['NAME', quotationData.companyInfo?.bankDetails?.name || 'PENTA FOR SCHOOLS&HOSP FURN MANF CO'],
                ['ACC NO:', quotationData.companyInfo?.bankDetails?.accountNo || '4001 575368 500'],
                ['IBAN (AED):', quotationData.companyInfo?.bankDetails?.ibanAED || 'AE62 0090 0040 0157 5368 500'],
                ['IBAN (USD):', quotationData.companyInfo?.bankDetails?.ibanUSD || 'AE07 0090 0040 0157 5368 520'],
                ['IBAN (EUR):', quotationData.companyInfo?.bankDetails?.ibanEUR || 'AE90 0090 0040 0157 5368 578'],
                ['BANK:', quotationData.companyInfo?.bankDetails?.bank || 'ARAB BANK']
            ];
            
            bankDetailsData.forEach(([label, value]) => {
                if (yPos < 240) { // Adjusted to ensure proper footer spacing
                    this.setFont(doc, 'calibri', 'bold');
                    doc.text(label, 20, yPos);
                    this.setFont(doc, 'calibri', 'normal');
                    doc.text(value, 50, yPos);
                    yPos += 5; // Increased spacing between bank detail lines for better readability
                }
            });
            yPos += 4; // Reduced space before closing section
        }
        
        // Closing paragraph - proper margins and spacing
        if (yPos < 235) { // Adjusted limit
            yPos += 4;
            const closingText = 'We stand ready to assist you with any additional requirements you may have, and we would be delighted to furnish you with a tailored quotation. Please do not hesitate to get in touch with us.';
            const splitClosing = doc.splitTextToSize(closingText, 160); // Proper A4 margins
            doc.text(splitClosing, 20, yPos);
            yPos += splitClosing.length * 4 + 4;
        }
        
        // Company signature - ensure proper spacing from footer
        if (yPos < 245) { // Adjusted limit for better footer spacing
            yPos += 4;
            doc.text('Our best regards', 20, yPos);
            yPos += 4;
            this.setFont(doc, 'calibri', 'bold');
            doc.text('PENTA for Hospitals and Schools Furniture Manufacturing LLC', 20, yPos);
            yPos += 10;
            
            this.setFont(doc, 'calibri', 'normal');
            doc.text(quotationData.companyInfo?.manager?.name || 'Ahmad Alokosh', 20, yPos);
            yPos += 4;
            doc.text(quotationData.companyInfo?.manager?.title || 'General Manager / Partner', 20, yPos);
            yPos += 4;
            doc.text(`Mob. ${quotationData.companyInfo?.manager?.mobile || '+971561184640'}`, 20, yPos);
        }
        
        // Footer - positioned to match reference with equal header/footer spacing
        this.setFont(doc, 'calibri', 'bold');
        doc.setFontSize(9);
        doc.text('PENTA For Hospitals and Schools Furniture Manufacturing L.L.C., Ajman, UAE', 105, 275, { align: 'center' });
        doc.text(`Tel : +971 6 563 2822, Email: info@penta-indust.com, www.penta-indust.com`, 105, 280, { align: 'center' });
        this.setFont(doc, 'calibri', 'normal');
        doc.text(`Page 1 of ${totalPages}`, 180, 280, { align: 'right' });
    }



    generateQuotationSummary(doc, quotationData, totalPages = 26) {
    doc.addPage();
    let yPos = 20;

    /* =========================
       HEADER (Stacked Left)
    ========================= */
    this.setFont(doc, 'calibri', 'normal');
    doc.setFontSize(10);
    
    // Stacked lines: Ref, Price, Date
    doc.text(quotationData.quoteRef || '', 20, yPos);
    doc.text(`PRICE: ${quotationData.pricing?.currency || 'AED'}`, 20, yPos + 6);
    doc.text(quotationData.date || moment().format('DD.MM.YYYY'), 20, yPos + 12);

    // Logo aligned to the right
    this.addLogoToPDF(doc, 145, yPos - 2, 45, 20);
    yPos += 30;

    /* =========================
       TITLE
    ========================= */
    this.setFont(doc, 'calibri', 'bold');
    doc.setFontSize(14);
    doc.text('QUOTATION SUMMARY', 105, yPos, { align: 'center' });
    yPos += 15;

    /* =========================
       SUMMARY DATA & TABLE
    ========================= */
    const summaryItems = this.parseHierarchicalItems(quotationData.items);
    const currency = quotationData.pricing?.currency || 'AED';

    const tableHeaders = [
        '', 
        'Item Description', 
        'Quantity', 
        `Unit amount \n(${currency})`, 
        `Total amount \n(${currency})`
    ];

    // STAGGERED ROW LOGIC:
    // Row 1: Item Data (Color)
    // Row 2: Empty Space (White)
    const staggeredData = [];
    console.log("DEBUG: My items look like this:", summaryItems);
    // summaryItems.forEach((item, index) => {
    //     staggeredData.push([
    //         `ITEM-${index + 1}`,
    //         item.description || '',
    //         item.quantity || 1,
    //         this.formatNumber(item.unitPrice || 0, 2),
    //         this.formatNumber(item.totalAmount || 0, 2)
    //     ]);
    //     staggeredData.push(['', '', '', '', '']); // Empty separator row
    // });
    summaryItems.forEach((item, index) => {
    // 1. Calculate real Unit Price if it's 0 but has parts
    let displayPrice = item.unitPrice || 0;
    
    if (displayPrice === 0 && item.parts && item.parts.length > 0) {
        // Sum up the unit prices of all parts
        displayPrice = item.parts.reduce((sum, part) => sum + (part.unitPrice || 0), 0);
    }

    // 2. Calculate real Total if it's 0
    let displayTotal = item.totalAmount || (displayPrice * (item.quantity || 1));

    staggeredData.push([
        `ITEM-${index + 1}`,
        item.description || '',
        item.quantity || 1,
        this.formatNumber(displayPrice, 2),
        this.formatNumber(displayTotal, 2)
    ]);
    
    staggeredData.push(['', '', '', '', '']); // Empty separator row
});

    const totalWidth = 170;
    const colWidths = {
        item: totalWidth * 0.10,
        desc: totalWidth * 0.60,
        qty:  totalWidth * 0.07,
        unit: totalWidth * 0.10,
        total: totalWidth * 0.13
    };

    doc.autoTable({
        head: [tableHeaders],
        body: staggeredData,
        startY: yPos,
        margin: { left: 20, right: 20 },
        theme: 'plain',
        styles: { 
            font: 'arial', 
            fontSize: 8, 
            valign: 'middle', 
            // cellPadding: 2,
            // overflow: 'visible'
            cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 }, 
    lineHeight: 1.0, // Ensures no extra "air" around characters
    overflow: 'visible'
        },
        headStyles: { 
            fontStyle: 'bold', 
            fillColor: [255, 255, 255], 
            textColor: [0, 0, 0],
            halign: 'center'
        },
        columnStyles: {
            0: { cellWidth: colWidths.item, halign: 'center', fontStyle: 'bold' },
            1: { cellWidth: colWidths.desc, halign: 'left', overflow: 'linebreak' },
            2: { cellWidth: colWidths.qty, halign: 'center' },
            3: { cellWidth: colWidths.unit, halign: 'center' },
            4: { cellWidth: colWidths.total, halign: 'center' }
        },
        didParseCell: function(data) {
            if (data.section === 'body') {
                // Color data rows (0, 2, 4...) and keep empty rows (1, 3, 5...) white
                if (data.row.index % 2 === 0) {
                    data.cell.styles.fillColor = [207, 207, 207]; // #cfcfcf
                } else {
                    data.cell.styles.fillColor = [255, 255, 255];
                    data.cell.styles.cellPadding = 2; // Shrink empty rows slightly
                    //data.cell.styles.cellPadding = { top: 0.2, bottom: 0.2 }; 
            data.cell.styles.fontSize = 2;
                }
            }
            if (data.section === 'head') {
                data.cell.styles.lineWidth = { bottom: 0.8 };
                data.cell.styles.lineColor = [0, 0, 0];
            }
        }
    });

    yPos = doc.lastAutoTable.finalY + 10;

    /* =========================
       FINANCIAL SUMMARY (BOXED)
    ========================= */


    const pricing = quotationData.pricing || {};
    const financialData = [
        [`PRICE (${currency})`, this.formatNumber(pricing.subtotal || 0, 2)],
        [`DISCOUNTED PRICE (${currency})`, this.formatNumber(pricing.discountedPrice || 0, 2)],
        [`VAT ${pricing.vatPercentage || 5}%`, this.formatNumber(pricing.vatAmount || 0, 2)],
        [`TOTAL DISCOUNTED PRICE (${currency})`, this.formatNumber(pricing.totalAmount || 0, 2)]
    ];

    // 1. Calculate height of the financial box (Rows * (FontSize + Padding))
    // Roughly 4 rows * 7mm per row = 28mm. 
    const estimatedBoxHeight = financialData.length * 8; 
    const footerStart = 270; // Safety threshold before footer text starts

    // 2. If current Y position + Box Height exceeds footer threshold, add new page
    if (yPos + estimatedBoxHeight > footerStart) {
        doc.addPage();
        yPos = 20; // Reset Y position on new page
    }

    doc.autoTable({
        body: financialData,
        startY: yPos,
        margin: { left: 20, right: 20 },
        theme: 'grid',
        styles: {
            font: 'arial', fontSize: 10, fontStyle: 'bold',
            lineColor: [0, 0, 0], lineWidth: 0.3,
            valign: 'middle', cellPadding: 2
        },
        columnStyles: {
            0: { cellWidth: colWidths.item + colWidths.desc + colWidths.qty + colWidths.unit, halign: 'left' },
            1: { cellWidth: colWidths.total, halign: 'center' }
        },
        didParseCell: function (data) {
            if (data.row.index === financialData.length - 1) {
                data.cell.styles.fillColor = [0, 0, 0];
                data.cell.styles.textColor = [255, 255, 255];
            }
        }
    });


    /* =========================
       FOOTER
    ========================= */
    const footerY = 275;
    this.setFont(doc, 'calibri', 'bold');
    doc.setFontSize(9);
    doc.text('PENTA For Hospitals and Schools Furniture Manufacturing L.L.C., Ajman, UAE', 105, footerY, { align: 'center' });
    doc.text('Tel : +971 6 563 2822, Email: info@penta-indust.com, www.penta-indust.com', 105, footerY + 5, { align: 'center' });

    this.setFont(doc, 'calibri', 'normal');
    const pageNo = doc.getCurrentPageInfo().pageNumber;
    doc.text(`Page ${pageNo} of ${totalPages}`, 190, footerY + 5, { align: 'right' });
}




    // generateItemDetails(doc, quotationData, totalPages = 26) {
    //     const hierarchicalItems = this.parseHierarchicalItems(quotationData.items);
        
    //     hierarchicalItems.forEach((item, itemIndex) => {
    //         doc.addPage();
    //         let yPos = 25;
            
    //         // Header - consistent with page 1
    //         // this.setFont(doc, 'calibri', 'bold');
    //         // doc.setFontSize(16);
    //         // doc.text('QUOTATION', 20, yPos);
            
    //         // Header - Quote info (left) parallel to logo (right)
    //         this.setFont(doc, 'calibri', 'normal');
    //         this.setDefaultFontSize(doc);
    //         doc.text(quotationData.quoteRef || 'PQ25070025', 20, yPos);
    //         doc.text(`PRICE: ${quotationData.pricing?.currency || 'AED'}`, 20, yPos + 6);
    //         doc.text(quotationData.date || moment().format('DD.MM.YYYY'), 20, yPos + 12);
            
    //         // Company logo (right side) - parallel to quote info
    //         this.addLogoToPDF(doc, 145, yPos - 5, 45, 20);
    //         yPos += 25; // Spacing after header section
            
    //         // Item header with grey background - SKIP for additional items
    //         if (!item.skipHeader) {
    //             // Calculate header dimensions
    //             const headerHeight = 8 + 8; // top padding + bottom padding (8px each)
    //             const headerWidth = 170; // Full width
    //             const headerX = 20;
    //             const headerY = yPos - 5;
                
    //             // Draw border and background
    //             doc.setFillColor(207, 207, 207); // #cfcfcf
    //             doc.setDrawColor(0, 0, 0); // Black border
    //             doc.setLineWidth(1);
    //             doc.rect(headerX, headerY, headerWidth, headerHeight, 'FD'); // Fill and draw
                
    //             // Add text
    //             this.setFont(doc, 'arial', 'bold');
    //             doc.setFontSize(13);
    //             doc.setTextColor(0, 0, 0);
    //             doc.text(`ITEM ${item.description}`, headerX + 10, headerY + 8 + 4); // 10px left padding, 8px top padding, 4px for text centering
    //             yPos += headerHeight + 5; // Header height + margin-top (5px)
    //         }
            
    //         // Parts table (no # column, only PART, UNIT, QTY)
    //         const tableHeaders = ['PART', 'UNIT', 'QTY'];
    //         const tableData = item.parts.map((part, partIndex) => [
    //             part.description,
    //             part.unit,
    //             part.quantity.toString()
    //         ]);
            
    //         doc.autoTable({
    //             head: [tableHeaders],
    //             body: tableData,
    //             startY: yPos,
    //             theme: 'grid',
    //             margin: { left: 20, right: 20 }
    //         });
            
    //         yPos = doc.lastAutoTable.finalY + 15; // margin-top: 15px for subtotal
            
    //         // Subtotal row with new styling
    //         const subtotalHeight = 8 + 8; // top + bottom padding
    //         const subtotalWidth = 170;
    //         const subtotalX = 20;
    //         const subtotalY = yPos;
            
    //         // Calculate column positions (matching table: PART 70%, UNIT 10%, QTY 20%)
    //         const partColEnd = subtotalX + (subtotalWidth * 0.70);
    //         const unitColEnd = partColEnd + (subtotalWidth * 0.10);
    //         const qtyColStart = unitColEnd;
    //         const qtyColEnd = subtotalX + subtotalWidth;
            
    //         // Draw subtotal background for PART and UNIT columns (merged)
    //         doc.setFillColor(207, 207, 207); // #cfcfcf
    //         doc.setDrawColor(0, 0, 0); // Black border
    //         doc.setLineWidth(1);
    //         doc.rect(subtotalX, subtotalY, unitColEnd - subtotalX, subtotalHeight, 'FD'); // Fill and draw for label area
            
    //         // Draw subtotal background for QTY column (amount area)
    //         doc.rect(qtyColStart, subtotalY, qtyColEnd - qtyColStart, subtotalHeight, 'FD'); // Fill and draw for amount area
            
    //         // Add subtotal text
    //         this.setFont(doc, 'arial', 'bold');
    //         doc.setFontSize(13);
    //         doc.setTextColor(0, 0, 0);
    //         doc.text('SUBTOTAL', subtotalX + 8, subtotalY + 8 + 4); // 8px left padding
            
    //         // Add amount in QTY column (right-aligned)
    //         const amountX = qtyColEnd - 8; // Right side minus padding
    //         doc.text(this.formatNumber(item.totalAmount), amountX, subtotalY + 8 + 4, { align: 'right' });
            
    //         yPos += subtotalHeight + 10;
            
    //         // Add images if present
    //         console.log(`Processing item "${item.description}" - has ${item.images ? item.images.length : 0} images`);
    //         if (item.images && item.images.length > 0) {
    //             console.log(`Adding ${item.images.length} images to PDF for item "${item.description}"`);
    //             this.addItemImagesToPDF(doc, item.images, yPos, item.parts.length);
    //         } else {
    //             console.log(`No images to add for item "${item.description}"`);
    //             // Add a placeholder text to show where images would go
    //             this.setFont(doc, 'calibri', 'italic');
    //             doc.setFontSize(8);
    //             doc.setTextColor(150, 150, 150);
    //             doc.text('[No images attached to this item]', 20, yPos + 5);
    //             doc.setTextColor(0, 0, 0); // Reset to black
    //         }
            
    //         // Footer - consistent with page 1
    //         this.setFont(doc, 'calibri', 'bold');
    //         doc.setFontSize(9);
    //         doc.text('PENTA For Hospitals and Schools Furniture Manufacturing L.L.C., Ajman, UAE', 105, 275, { align: 'center' });
    //         doc.text(`Tel : +971 6 563 2822, Email: info@penta-indust.com, www.penta-indust.com`, 105, 280, { align: 'center' });
    //         this.setFont(doc, 'calibri', 'normal');
    //         const currentPageNumber = doc.getCurrentPageInfo().pageNumber;
    //         doc.text(`Page ${currentPageNumber} of ${totalPages}`, 180, 280, { align: 'right' });
    //     });
    // }
    

    // generateItemDetails(doc, quotationData, totalPages = 26) {
    // const hierarchicalItems = this.parseHierarchicalItems(quotationData.items);
    
    // hierarchicalItems.forEach((item, itemIndex) => {
    //     doc.addPage();
    //     let yPos = 25;
        
    //     // --- Header Section ---
    //     this.setFont(doc, 'calibri', 'normal');
    //     doc.setFontSize(11); // Standard quote info size
    //     doc.setTextColor(0, 0, 0);
        
    //     doc.text(quotationData.quoteRef || 'PQ25070025', 20, yPos);
    //     doc.text(`PRICE: ${quotationData.pricing?.currency || 'AED'}`, 20, yPos + 6);
    //     doc.text(quotationData.date || '25.08.2025', 20, yPos + 12);
        
    //     // Company logo (right side)
    //     this.addLogoToPDF(doc, 135, yPos - 5, 55, 25);
    //     yPos += 30;
        
    //     // --- Item Header (Grey Bar) ---
    //     if (!item.skipHeader) {
    //         const headerHeight = 10; 
    //         const headerWidth = 170;
    //         const headerX = 20;
            
    //         doc.setFillColor(207, 207, 207); // #cfcfcf
    //         doc.rect(headerX, yPos, headerWidth, headerHeight, 'F'); 
            
    //         this.setFont(doc, 'arial', 'bold');
    //         doc.setFontSize(10.5); // Matches the condensed look in image
    //         doc.text(`ITEM    ${item.description.toUpperCase()}`, headerX + 5, yPos + 6.5);
    //         yPos += headerHeight + 5;
    //     }
        
    //     // --- Parts Table ---
    //     // Mapping data to include the "#" column from the image
    //     const tableData = item.parts.map((part, index) => [
    //         (index + 1).toString(),
    //         part.description.toUpperCase(),
    //         part.unit.toUpperCase(),
    //         part.quantity.toString()
    //     ]);
        
    //     doc.autoTable({
    //         head: [['#', 'PART', 'UNIT', 'QTY']],
    //         body: tableData,
    //         startY: yPos,
    //         margin: { left: 20, right: 20 },
    //         theme: 'plain', // Use plain to control borders manually
    //         styles: {
    //             font: 'arial',
    //             fontSize: 8.5,
    //             cellPadding: 2,
    //             textColor: [0, 0, 0],
    //         },
    //         headStyles: {
    //             fillColor: [240, 240, 240], // Light grey header
    //             fontStyle: 'bold',
    //         },
    //         columnStyles: {
    //             0: { cellWidth: 10, halign: 'center' }, // #
    //             1: { cellWidth: 'auto' },                // PART
    //             2: { cellWidth: 20, halign: 'center' }, // UNIT
    //             3: { cellWidth: 20, halign: 'center' }, // QTY
    //         },
    //         // Draw horizontal lines only to match image style
    //         didParseCell: function(data) {
    //             if (data.section === 'body') {
    //                 data.cell.styles.lineWidth = { bottom: 0.1 };
    //                 data.cell.styles.lineColor = [200, 200, 200];
    //             }
    //         }
    //     });
        
    //     yPos = doc.lastAutoTable.finalY + 2; 
        
    //     // --- Subtotal Row ---
    //     const subtotalHeight = 8;
    //     const subtotalWidth = 170;
    //     const subtotalX = 20;
        
    //     // Full grey bar for subtotal
    //     doc.setFillColor(207, 207, 207);
    //     doc.rect(subtotalX, yPos, subtotalWidth, subtotalHeight, 'F');
        
    //     this.setFont(doc, 'arial', 'bold');
    //     doc.setFontSize(9);
    //     doc.text('SUBTOTAL', subtotalX + 2, yPos + 5.5);
        
    //     // Right-aligned amount
    //     const amountText = this.formatNumber(item.totalAmount);
    //     doc.text(amountText, subtotalX + subtotalWidth - 5, yPos + 5.5, { align: 'right' });
        
    //     yPos += subtotalHeight + 15;
        
    //     // --- Images Section ---
    //     if (item.images && item.images.length > 0) {
    //         this.addItemImagesToPDF(doc, item.images, yPos, item.parts.length);
    //     }



    generateItemDetails(doc, quotationData, totalPages = 26) {
    const hierarchicalItems = this.parseHierarchicalItems(quotationData.items);
    
    hierarchicalItems.forEach((item, itemIndex) => {
        doc.addPage();
        let yPos = 25;
        
        // --- Header Section ---
        this.setFont(doc, 'calibri', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        
        doc.text(quotationData.quoteRef || 'PQ25070025', 20, yPos);
        doc.text(`PRICE: ${quotationData.pricing?.currency || 'AED'}`, 20, yPos + 6);
        doc.text(quotationData.date || '25.08.2025', 20, yPos + 12);
        
        this.addLogoToPDF(doc, 135, yPos - 5, 55, 25);
        yPos += 30;
        
        // --- Item Header (Dark Grey Bar) ---
        if (!item.skipHeader) {
            const headerHeight = 10; 
            const headerWidth = 175; // Extended width to match table
            const headerX = 18;
            
            doc.setFillColor(207, 207, 207); 
            doc.rect(headerX, yPos, headerWidth, headerHeight, 'F'); 
            
            this.setFont(doc, 'arial', 'bold');
            doc.setFontSize(11);
            // Matches "ITEM [Description]" formatting
            doc.text(`ITEM    ${item.description.toUpperCase()}`, headerX + 2, yPos + 6.5);
            yPos += headerHeight + 10; // Extra spacing before table header
        }
        
        // --- Parts Table (No internal grid lines) ---
        const tableData = item.parts.map((part, index) => [
            (index + 1).toString(),
            part.description.toUpperCase(),
            part.unit.toUpperCase(),
            part.quantity.toString()
        ]);

        doc.autoTable({
    head: [['#', 'PART', 'UNIT', 'QTY']],
    body: tableData,
    startY: yPos,
    margin: { left: 18, right: 18 },
    theme: 'plain',
    styles: {
        font: 'arial',
        fontSize: 8,
        // 1. Reduce padding (top and bottom)
        cellPadding: { top: 1, bottom: 1, left: 2, right: 2 }, 
        textColor: [0, 0, 0],
        // 2. Control line height (default is usually 1.15 or 1.2)
        lineHeight: 1.0, 
    },
    headStyles: {
        fillColor: [240, 240, 240],
        fontStyle: 'normal',
        textColor: [0, 0, 0],
        valign: 'middle',
        // 3. Ensure header padding is also tight
        cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 },
    },
    columnStyles: {
        0: { cellWidth: 10, halign: 'left' },   // # Data stays left
        1: { cellWidth: 'auto', halign: 'left' }, // PART Data stays left
        2: { cellWidth: 15, halign: 'right' },  // UNIT Data stays right
        3: { cellWidth: 15, halign: 'center' }, // QTY Data stays center
    },
    didParseCell: function(data) {
        // Apply separate styles to the Header row only
        if (data.section === 'head') {
            if (data.column.index === 2) { // UNIT Header
                data.cell.styles.halign = 'right'; // Push 'UNIT' text to the right
            }
            if (data.column.index === 3) { // QTY Header
                data.cell.styles.halign = 'right'; // Push 'QTY' text to the right
            }
        }
    }
});

        
        
        yPos = doc.lastAutoTable.finalY + 10; 
        
        // --- Subtotal Row (Dark Grey Bar) ---
        const subtotalHeight = 8;
        const subtotalWidth = 175;
        const subtotalX = 18;
        
        doc.setFillColor(207, 207, 207);
        doc.rect(subtotalX, yPos, subtotalWidth, subtotalHeight, 'F');
        
        this.setFont(doc, 'arial', 'bold');
        doc.setFontSize(10);
        doc.text('SUBTOTAL', subtotalX + 2, yPos + 5.5);
        
        // Right-aligned subtotal value
        const amountText = this.formatNumber(item.totalAmount) || '6766';
        doc.text(amountText, subtotalX + subtotalWidth - 2, yPos + 5.5, { align: 'right' });
        
        yPos += subtotalHeight + 15;
        
        // --- Images Section ---
        if (item.images && item.images.length > 0) {
            this.addItemImagesToPDF(doc, item.images, yPos, item.parts.length);
        }


        /* =========================
       FOOTER
    ========================= */
    const footerY = 275;
    this.setFont(doc, 'calibri', 'bold');
    doc.setFontSize(9);
    doc.text('PENTA For Hospitals and Schools Furniture Manufacturing L.L.C., Ajman, UAE', 105, footerY, { align: 'center' });
    doc.text('Tel : +971 6 563 2822, Email: info@penta-indust.com, www.penta-indust.com', 105, footerY + 5, { align: 'center' });

    this.setFont(doc, 'calibri', 'normal');
    const pageNo = doc.getCurrentPageInfo().pageNumber;
    doc.text(`Page ${pageNo} of ${totalPages}`, 190, footerY + 5, { align: 'right' });
    });
}
    
    
    
    
    generateAdditionalPartsPage(doc, quotationData, totalPages = 26) {
        doc.addPage();
        let yPos = 30;
        
        // Header - consistent with page 1
        // this.setFont(doc, 'calibri', 'bold');
        // doc.setFontSize(16);
        // doc.text('QUOTATION', 20, yPos);
        
        // Header - Quote info (left) parallel to logo (right)
        this.setFont(doc, 'calibri', 'normal');
        this.setDefaultFontSize(doc);
        doc.text(quotationData.quoteRef || 'PQ25070025', 20, yPos);
        doc.text(`PRICE: ${quotationData.pricing?.currency || 'AED'}`, 20, yPos + 6);
        doc.text(quotationData.date || moment().format('DD.MM.YYYY'), 20, yPos + 12);
        
        // Company logo (right side) - parallel to quote info
        this.addLogoToPDF(doc, 145, yPos - 5, 45, 20);
        yPos += 25; // Spacing after header section
        
        // Title
        doc.setFontSize(14);
        this.setFont(doc, 'calibri', 'bold');
        doc.text('ADDITIONAL PARTS', 105, yPos, { align: 'center' });
        yPos += 15;
        
        // Description
        this.setDefaultFontSize(doc);
        this.setFont(doc, 'calibri', 'normal');
        const descText = 'The following additional parts are included for reference:';
        doc.text(descText, 20, yPos);
        yPos += 15;
        
        // Additional Parts Table
        const additionalParts = quotationData.additionalParts || [];
        
        if (additionalParts.length > 0) {
            const tableHeaders = ['#', 'Description', 'Unit', 'Quantity'];
            const tableData = additionalParts.map((part, index) => [
                (index + 1).toString(),
                part.description || 'N/A',
                part.unit || 'NOS',
                part.quantity?.toString() || '1'
            ]);
            
            doc.autoTable({
                head: [tableHeaders],
                body: tableData,
                startY: yPos,
                theme: 'grid',
                headStyles: { 
                    fillColor: [245, 158, 11], // Orange theme
                    textColor: 255,
                    fontSize: 10,
                    fontStyle: 'bold',
                    halign: 'center',
                    valign: 'middle'
                },
                bodyStyles: {
                    fontSize: 9,
                    fillColor: [254, 243, 199], // Light orange background
                    valign: 'middle',
                    textColor: [0, 0, 0],
                    lineWidth: 0.5,
                    lineColor: [0, 0, 0]
                },
                columnStyles: {
                    0: { 
                        cellWidth: 20, 
                        halign: 'center',
                        cellPadding: { left: 2, right: 2, top: 3, bottom: 3 },
                        fontStyle: 'bold'
                    },
                    1: { 
                        cellWidth: 120, 
                        halign: 'left', 
                        cellPadding: { left: 5, right: 5, top: 3, bottom: 3 },
                        fontStyle: 'bold'
                    },
                    2: { 
                        cellWidth: 25, 
                        halign: 'center',
                        cellPadding: { left: 2, right: 2, top: 3, bottom: 3 }
                    },
                    3: { 
                        cellWidth: 25, 
                        halign: 'center',
                        cellPadding: { left: 2, right: 2, top: 3, bottom: 3 }
                    }
                },
                alternateRowStyles: { fillColor: [254, 243, 199] },
                margin: { left: 15, right: 15 },
                tableWidth: 'auto',
                styles: {
                    lineWidth: 0.5,
                    lineColor: [0, 0, 0]
                }
            });
            
            yPos = doc.lastAutoTable.finalY + 15;
            
            // Note about additional parts
            if (yPos < 240) {
                doc.setFontSize(9);
                this.setFont(doc, 'calibri', 'italic');
                doc.setTextColor(100, 100, 100);
                const noteText = 'Note: These additional parts are provided for reference and are not included in the quotation pricing.';
                const splitNote = doc.splitTextToSize(noteText, 170);
                doc.text(splitNote, 20, yPos);
            }
        }
        
        // Footer - consistent with page 1
        this.setFont(doc, 'calibri', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.text('PENTA For Hospitals and Schools Furniture Manufacturing L.L.C., Ajman, UAE', 105, 275, { align: 'center' });
        doc.text(`Tel : +971 6 563 2822, Email: info@penta-indust.com, www.penta-indust.com`, 105, 280, { align: 'center' });
        this.setFont(doc, 'calibri', 'normal');
        const currentPageNumber = doc.getCurrentPageInfo().pageNumber;
        doc.text(`Page ${currentPageNumber} of ${totalPages}`, 180, 280, { align: 'right' });
    }
    
    // Generate Bill of Materials from quotation data - Consolidates materials across all items
    // generateBillOfMaterials(quotationData) {
    //     const bomMap = new Map();
        
    //     if (!quotationData.items || !Array.isArray(quotationData.items)) {
    //         return [];
    //     }
        
    //     // Parse hierarchical items to get proper part structure
    //     const hierarchicalItems = this.parseHierarchicalItems(quotationData.items);
        
    //     // Aggregate parts across all items
    //     hierarchicalItems.forEach(item => {
    //         if (item.parts && Array.isArray(item.parts)) {
    //             item.parts.forEach(part => {
    //                 const partName = part.description || 'Unnamed Part';
    //                 const quantity = Number(part.quantity) || 0;
    //                 const unit = part.unit || 'NOS';
                    
    //                 if (quantity > 0) {
    //                     if (bomMap.has(partName)) {
    //                         const existing = bomMap.get(partName);
    //                         existing.totalQuantity += quantity;
    //                     } else {
    //                         bomMap.set(partName, {
    //                             partName: partName,
    //                             totalQuantity: quantity,
    //                             unit: unit
    //                         });
    //                     }
    //                 }
    //             });
    //         }
    //     });
        
    //     // Convert to array and sort alphabetically by part name
    //     const bomArray = Array.from(bomMap.values())
    //         .filter(item => item.totalQuantity > 0)
    //         .sort((a, b) => a.partName.localeCompare(b.partName));
        
    //     return bomArray;
    // }
    
    // generateBOMPage(doc, quotationData, totalPages = 26) {
    //     doc.addPage();
    //     let yPos = 20;
        
    //     // Page header - Use actual logo image
    //     this.addLogoToPDF(doc, 165, yPos - 5, 30, 15);
        
    //     // Quote reference and date
    //     doc.setFont('helvetica', 'normal');
    //     doc.setFontSize(10);
    //     doc.text(quotationData.quoteRef || 'PQ25070025', 20, yPos);
    //     doc.text(`PRICE: ${quotationData.pricing?.currency || 'AED'}`, 20, yPos + 6);
    //     doc.text(quotationData.date || moment().format('DD.MM.YYYY'), 20, yPos + 12);
    //     yPos += 40;
        
    //     // Title
    //     doc.setFontSize(14);
    //     doc.setFont('helvetica', 'bold');
    //     doc.text('BILL OF MATERIALS', 105, yPos, { align: 'center' });
    //     yPos += 15;
        
    //     // Generate BOM data
    //     const bomData = this.generateBillOfMaterials(quotationData);
        
    //     if (bomData.length === 0) {
    //         // No parts found message
    //         doc.setFontSize(12);
    //         doc.setFont('helvetica', 'normal');
    //         doc.text('No materials found in this quotation.', 105, yPos + 20, { align: 'center' });
    //     } else {
    //         // Add description paragraph
    //         doc.setFontSize(10);
    //         doc.setFont('helvetica', 'normal');
    //         const descText = 'The following table shows the consolidated quantity of materials required across all items in this quotation:';
    //         const splitDesc = doc.splitTextToSize(descText, 170);
    //         doc.text(splitDesc, 20, yPos);
    //         yPos += splitDesc.length * 4 + 10;
            
    //         // BOM Table with headers
    //         const bomHeaders = ['#', 'Material Description', 'Unit', 'Total Quantity'];
    //         const bomTableData = bomData.map((item, index) => [
    //             (index + 1 < 10 ? '0' + (index + 1) : (index + 1).toString()),
    //             item.partName,
    //             item.unit,
    //             item.totalQuantity.toString()
    //         ]);
            
    //         doc.autoTable({
    //             head: [bomHeaders],
    //             body: bomTableData,
    //             startY: yPos,
    //             theme: 'grid',
    //             headStyles: { 
    //                 fillColor: [128, 128, 128], 
    //                 textColor: 255,
    //                 fontSize: 10,
    //                 fontStyle: 'bold',
    //                 halign: 'center',
    //                 valign: 'middle'
    //             },
    //             bodyStyles: {
    //                 fontSize: 9,
    //                 fillColor: [220, 220, 220], // Light gray background to match summary
    //                 valign: 'middle',
    //                 textColor: [0, 0, 0],
    //                 lineWidth: 0.5,
    //                 lineColor: [0, 0, 0]
    //             },
    //             columnStyles: {
    //                 0: { 
    //                     cellWidth: 20, 
    //                     halign: 'center',
    //                     cellPadding: { left: 2, right: 2, top: 3, bottom: 3 },
    //                     fontStyle: 'bold'
    //                 },
    //                 1: { 
    //                     cellWidth: 105, 
    //                     halign: 'left', 
    //                     cellPadding: { left: 5, right: 5, top: 3, bottom: 3 },
    //                     fontStyle: 'bold'
    //                 },
    //                 2: { 
    //                     cellWidth: 20, 
    //                     halign: 'center',
    //                     cellPadding: { left: 2, right: 2, top: 3, bottom: 3 }
    //                 },
    //                 3: { 
    //                     cellWidth: 25, 
    //                     halign: 'center',
    //                     cellPadding: { left: 2, right: 2, top: 3, bottom: 3 }
    //                 }
    //             },
    //             alternateRowStyles: { fillColor: [220, 220, 220] }, // Keep same gray for all rows
    //             margin: { left: 15, right: 15 },
    //             tableWidth: 'auto',
    //             styles: {
    //                 lineWidth: 0.5,
    //                 lineColor: [0, 0, 0]
    //             }
    //         });
            
    //         yPos = doc.lastAutoTable.finalY + 15;
            
    //         // Summary statistics with better formatting
    //         doc.setFillColor(240, 240, 240);
    //         doc.rect(20, yPos - 3, 170, 25, 'F');
            
    //         doc.setFontSize(11);
    //         doc.setFont('helvetica', 'bold');
    //         doc.setTextColor(0, 0, 0);
    //         doc.text('MATERIAL SUMMARY:', 25, yPos + 5);
            
    //         doc.setFont('helvetica', 'normal');
    //         doc.setFontSize(10);
    //         const totalUnique = bomData.length;
    //         const totalQuantity = bomData.reduce((sum, item) => sum + item.totalQuantity, 0);
            
    //         doc.text(`• Total unique materials: ${totalUnique}`, 25, yPos + 12);
    //         doc.text(`• Total quantity of all materials: ${totalQuantity}`, 25, yPos + 18);
            
    //         yPos += 30;
            
    //         // Note about material consolidation
    //         if (yPos < 240) {
    //             doc.setFontSize(9);
    //             doc.setFont('helvetica', 'italic');
    //             doc.setTextColor(100, 100, 100);
    //             const noteText = 'Note: This Bill of Materials consolidates identical materials across all items, showing the total quantity required for the entire project.';
    //             const splitNote = doc.splitTextToSize(noteText, 170);
    //             doc.text(splitNote, 20, yPos);
    //         }
    //     }
        
    //     // Footer
    //     doc.setTextColor(0, 0, 0);
    //     doc.setFontSize(9);
    //     doc.setFont('helvetica', 'normal');
    //     doc.text('PENTA For Hospitals and Schools Furniture Manufacturing L.L.C., Ajman, UAE', 105, 280, { align: 'center' });
    //     doc.text(`Tel : +971 6 563 2822, Email: info@penta-indust.com, www.penta-indust.com`, 105, 285, { align: 'center' });
    //     const currentPageNumber = doc.getCurrentPageInfo().pageNumber;
    //     doc.text(`Page ${currentPageNumber} of ${totalPages}`, 190, 290, { align: 'right' });
    // }







    generateBillOfMaterials(quotationData) {
    const bomMap = new Map();
    
    if (!quotationData.items || !Array.isArray(quotationData.items)) {
        return [];
    }
    
    // Parse hierarchical items to get proper part structure
    const hierarchicalItems = this.parseHierarchicalItems(quotationData.items);
    
    // Aggregate parts across all items
    hierarchicalItems.forEach(item => {
        // We look for parts just like we did in the Summary
        if (item.parts && Array.isArray(item.parts)) {
            item.parts.forEach(part => {
                const partName = part.description || 'Unnamed Part';
                // LOGIC SYNC: Multiply part quantity by the parent item quantity
                const parentQty = Number(item.quantity) || 1;
                const partQty = Number(part.quantity) || 0;
                const totalPartQty = partQty * parentQty; 
                
                const unit = part.unit || 'Pcs';
                
                if (totalPartQty > 0) {
                    if (bomMap.has(partName)) {
                        const existing = bomMap.get(partName);
                        existing.totalQuantity += totalPartQty;
                    } else {
                        bomMap.set(partName, {
                            partName: partName,
                            totalQuantity: totalPartQty,
                            unit: unit
                        });
                    }
                }
            });
        }
    });
    
    return Array.from(bomMap.values())
        .filter(item => item.totalQuantity > 0)
        .sort((a, b) => a.partName.localeCompare(b.partName));
}


// generateBOMPage(doc, quotationData, totalPages = 1) {
//     // 1. Initial Setup (Removing doc.addPage() from the top to fix blank page 1)
//     let yPos = 20;
//     const margin = 20;
//     const pageHeight = doc.internal.pageSize.height;
//     const footerThreshold = 265; // The point where we must stop adding content

//     /* =========================
//        HEADER, LOGO & TITLE
//     ========================= */
//     this.setFont(doc, 'calibri', 'normal');
//     doc.setFontSize(10);
//     doc.text(quotationData.quoteRef || '', margin, yPos);
//     doc.text(`PRICE: ${quotationData.pricing?.currency || 'USD'}`, margin, yPos + 6);
//     doc.text(quotationData.date || moment().format('DD.MM.YYYY'), margin, yPos + 12);
//     this.addLogoToPDF(doc, 145, yPos - 2, 45, 20);

//     yPos += 35;
//     this.setFont(doc, 'calibri', 'bold');
//     doc.setFontSize(14);
//     doc.text('BILL OF MATERIALS', 105, yPos, { align: 'center' });
//     yPos += 15;

//     /* =========================
//        BOM TABLE
//     ========================= */
//     const bomData = this.generateBillOfMaterials(quotationData);
    
//     if (bomData.length > 0) {
//         const bomHeaders = ['#', 'Material Description', 'Unit', 'Total Quantity'];
//         const bomTableData = bomData.map((item, index) => [
//             (index + 1).toString().padStart(2, '0'),
//             item.partName,
//             item.unit,
//             item.totalQuantity.toString()
//         ]);

//         doc.autoTable({
//             head: [bomHeaders],
//             body: bomTableData,
//             startY: yPos,
//             margin: { left: margin, right: margin },
//             theme: 'plain',
//             styles: { font: 'arial', fontSize: 8, valign: 'middle', cellPadding: 3 },
//             headStyles: { 
//                 fillColor: [255, 255, 255], 
//                 textColor: [0, 0, 0], 
//                 fontStyle: 'bold', 
//                 halign: 'center',
//                 lineWidth: { bottom: 0.5 },
//                 lineColor: [0, 0, 0]
//             },
//             columnStyles: {
//                 0: { cellWidth: 15, halign: 'center' },
//                 1: { cellWidth: 110, halign: 'left' },
//                 2: { cellWidth: 20, halign: 'center' },
//                 3: { cellWidth: 25, halign: 'center' }
//             },
//             didParseCell: (data) => {
//                 if (data.section === 'body') {
//                     data.cell.styles.fillColor = [240, 240, 240]; 
//                 }
//             }
//         });

//         // Update yPos to the end of the table
//         yPos = doc.lastAutoTable.finalY + 10;

//         /* =========================
//            OVERLAP PREVENTION LOGIC
//         ========================= */
//         const summaryBoxHeight = 30; // Height of the gray box
//         const noteHeight = 15;       // Height of the italic note
//         const requiredSpace = summaryBoxHeight + noteHeight + 10;

//         // If current position + summary space hits the footer, add a new page
//         if (yPos + requiredSpace > footerThreshold) {
//             doc.addPage();
//             yPos = 20; // Reset to top of new page
//         }

//         /* =========================
//            MATERIAL SUMMARY BOX
//         ========================= */
//         const totalUnique = bomData.length;
//         const totalQty = bomData.reduce((sum, i) => sum + i.totalQuantity, 0);

//         doc.setFillColor(245, 245, 245);
//         doc.rect(margin, yPos, 170, 25, 'F');

//         this.setFont(doc, 'calibri', 'bold');
//         doc.setFontSize(10);
//         doc.text('MATERIAL SUMMARY:', margin + 5, yPos + 7);

//         this.setFont(doc, 'calibri', 'normal');
//         doc.text(`• Total unique materials: ${totalUnique}`, margin + 5, yPos + 14);
//         doc.text(`• Total quantity of all materials: ${totalQty}`, margin + 5, yPos + 21);

//         /* =========================
//            ITALIC NOTE (Positioned below Summary)
//         ========================= */
//         yPos += 32; // Move below the summary box
//         this.setFont(doc, 'calibri', 'italic');
//         doc.setFontSize(9);
//         doc.setTextColor(100, 100, 100);
//         const note = "Note: This Bill of Materials consolidates identical materials across all items, showing the total quantity required for the entire project.";
//         doc.text(doc.splitTextToSize(note, 170), margin, yPos);
//     }

//     /* =========================
//        FOOTER (Fixed at the Bottom)
//     ========================= */
//     this.addFooterToPage(doc, totalPages);
// }



// generateBOMPage(doc, quotationData, totalPages = 1) {
//     // 1. Setup initial position for content
//     // We start lower to leave room for the header that we will draw later
//     let yPos = 55; 
//     const margin = 20;
//     const footerThreshold = 260; // Point to trigger a page break

//     /* =========================
//        1. GENERATE DYNAMIC CONTENT (TABLE)
//     ========================= */
//     const bomData = this.generateBillOfMaterials(quotationData);
    
//     if (bomData.length > 0) {
//         const bomHeaders = ['#', 'Material Description', 'Unit', 'Total Quantity'];
//         const bomTableData = bomData.map((item, index) => [
//             (index + 1).toString().padStart(2, '0'),
//             item.partName,
//             item.unit,
//             item.totalQuantity.toString()
//         ]);

//         doc.autoTable({
//             head: [bomHeaders],
//             body: bomTableData,
//             startY: yPos,
//             margin: { left: margin, right: margin },
//             theme: 'plain',
//             styles: { font: 'arial', fontSize: 8, valign: 'middle', cellPadding: 3 },
//             headStyles: { 
//                 fillColor: [255, 255, 255], 
//                 textColor: [0, 0, 0], 
//                 fontStyle: 'bold', 
//                 halign: 'center',
//                 lineWidth: { bottom: 0.5 },
//                 lineColor: [0, 0, 0]
//             },
//             columnStyles: {
//                 0: { cellWidth: 15, halign: 'center' },
//                 1: { cellWidth: 110, halign: 'left' },
//                 2: { cellWidth: 20, halign: 'center' },
//                 3: { cellWidth: 25, halign: 'center' }
//             },
//             didParseCell: (data) => {
//                 if (data.section === 'body') {
//                     data.cell.styles.fillColor = [240, 240, 240]; 
//                 }
//             }
//         });

//         yPos = doc.lastAutoTable.finalY + 10;

//         /* =========================
//            2. OVERLAP CHECK FOR SUMMARY BOX
//         ========================= */
//         const requiredSpace = 50; // Height for Summary Box + Note
//         if (yPos + requiredSpace > footerThreshold) {
//             doc.addPage();
//             yPos = 55; // Start at the same lowered position on new page
//         }

//         // Draw Material Summary Box
//         const totalUnique = bomData.length;
//         const totalQty = bomData.reduce((sum, i) => sum + i.totalQuantity, 0);

//         doc.setFillColor(245, 245, 245);
//         doc.rect(margin, yPos, 170, 25, 'F');

//         this.setFont(doc, 'calibri', 'bold');
//         doc.setFontSize(10);
//         doc.text('MATERIAL SUMMARY:', margin + 5, yPos + 8);

//         this.setFont(doc, 'calibri', 'normal');
//         doc.text(`• Total unique materials: ${totalUnique}`, margin + 5, yPos + 15);
//         doc.text(`• Total quantity of all materials: ${totalQty}`, margin + 5, yPos + 22);

//         // Draw Italic Note
//         yPos += 35;
//         this.setFont(doc, 'calibri', 'italic');
//         doc.setFontSize(9);
//         doc.setTextColor(100, 100, 100);
//         const note = "Note: This Bill of Materials consolidates identical materials across all items, showing the total quantity required for the entire project.";
//         doc.text(doc.splitTextToSize(note, 170), margin, yPos);
//     }

//     /* =========================
//        3. APPLY HEADER & FOOTER TO ALL PAGES
//     ========================= */
//     const finalTotalPages = doc.internal.getNumberOfPages();
    
//     for (let i = 1; i <= finalTotalPages; i++) {
//         doc.setPage(i);
        
//         // --- HEADER ---
//         this.setFont(doc, 'calibri', 'normal');
//         doc.setFontSize(10);
//         doc.setTextColor(0, 0, 0);
//         doc.text(quotationData.quoteRef || '', margin, 20);
//         doc.text(`PRICE: ${quotationData.pricing?.currency || 'USD'}`, margin, 26);
//         doc.text(quotationData.date || moment().format('DD.MM.YYYY'), margin, 32);
        
//         this.addLogoToPDF(doc, 145, 18, 45, 20);

//         this.setFont(doc, 'calibri', 'bold');
//         doc.setFontSize(14);
//         doc.text('BILL OF MATERIALS', 105, 45, { align: 'center' });

//         // --- FOOTER ---
//         const footerY = 280;
//         doc.setFontSize(9);
//         this.setFont(doc, 'calibri', 'bold');
//         doc.text('PENTA For Hospitals and Schools Furniture Manufacturing L.L.C., Ajman, UAE', 105, footerY, { align: 'center' });
        
//         this.setFont(doc, 'calibri', 'normal');
//         doc.text('Tel : +971 6 563 2822, Email: info@penta-indust.com, www.penta-indust.com', 105, footerY + 5, { align: 'center' });
        
//         doc.text(`Page ${i} of ${finalTotalPages}`, 190, footerY + 10, { align: 'right' });
//     }
// }


// generateBOMPage(doc, quotationData, totalPages = 1) {
//     // 1. Setup initial position
//     // Start at 55 to leave room for the repeated header info
//     let yPos = 55; 
//     const margin = 20;
//     const footerThreshold = 260; 

//     /* =========================
//        1. DYNAMIC CONTENT START
//     ========================= */
//     // Place the Title here so it only appears ONCE at the top of the data
//     this.setFont(doc, 'calibri', 'bold');
//     doc.setFontSize(14);
//     doc.text('BILL OF MATERIALS', 105, 45, { align: 'center' });
    
//     // Note: Since the title is at Y=45, our table startY (yPos) stays at 55
//     const bomData = this.generateBillOfMaterials(quotationData);
    
//     if (bomData.length > 0) {
//         const bomHeaders = ['#', 'Material Description', 'Unit', 'Total Quantity'];
//         const bomTableData = bomData.map((item, index) => [
//             (index + 1).toString().padStart(2, '0'),
//             item.partName,
//             item.unit,
//             item.totalQuantity.toString()
//         ]);

//         doc.autoTable({
//             head: [bomHeaders],
//             body: bomTableData,
//             startY: yPos,
//             margin: { left: margin, right: margin },
//             theme: 'plain',
//             styles: { font: 'arial', fontSize: 8, valign: 'middle', cellPadding: 3 },
//             headStyles: { 
//                 fillColor: [255, 255, 255], 
//                 textColor: [0, 0, 0], 
//                 fontStyle: 'bold', 
//                 halign: 'center',
//                 lineWidth: { bottom: 0.5 },
//                 lineColor: [0, 0, 0]
//             },
//             columnStyles: {
//                 0: { cellWidth: 15, halign: 'center' },
//                 1: { cellWidth: 110, halign: 'left' },
//                 2: { cellWidth: 20, halign: 'center' },
//                 3: { cellWidth: 25, halign: 'center' }
//             },
//             didParseCell: (data) => {
//                 if (data.section === 'body') {
//                     data.cell.styles.fillColor = [240, 240, 240]; 
//                 }
//             }
//         });

//         yPos = doc.lastAutoTable.finalY + 10;

//         /* =========================
//            2. OVERLAP CHECK & SUMMARY
//         ========================= */
//         const requiredSpace = 50; 
//         if (yPos + requiredSpace > footerThreshold) {
//             doc.addPage();
//             yPos = 55; 
//         }

//         // Summary Box
//         doc.setFillColor(245, 245, 245);
//         doc.rect(margin, yPos, 170, 25, 'F');
//         this.setFont(doc, 'calibri', 'bold');
//         doc.setFontSize(10);
//         doc.text('MATERIAL SUMMARY:', margin + 5, yPos + 8);
//         this.setFont(doc, 'calibri', 'normal');
//         doc.text(`• Total unique materials: ${bomData.length}`, margin + 5, yPos + 15);
//         doc.text(`• Total quantity of all materials: ${bomData.reduce((sum, i) => sum + i.totalQuantity, 0)}`, margin + 5, yPos + 22);

//         // Italic Note
//         yPos += 35;
//         this.setFont(doc, 'calibri', 'italic');
//         doc.setFontSize(9);
//         doc.setTextColor(100, 100, 100);
//         const note = "Note: This Bill of Materials consolidates identical materials across all items, showing the total quantity required for the entire project.";
//         doc.text(doc.splitTextToSize(note, 170), margin, yPos);
//     }

//     /* =========================
//        3. REPEATED HEADER & FOOTER
//     ========================= */
//     const finalTotalPages = doc.internal.getNumberOfPages();
    
//     for (let i = 1; i <= finalTotalPages; i++) {
//         doc.setPage(i);
        
//         // --- HEADER (Repeats on every page) ---
//         this.setFont(doc, 'calibri', 'normal');
//         doc.setFontSize(10);
//         doc.setTextColor(0, 0, 0);
//         doc.text(quotationData.quoteRef || '', margin, 20);
//         doc.text(`PRICE: ${quotationData.pricing?.currency || 'USD'}`, margin, 26);
//         doc.text(quotationData.date || moment().format('DD.MM.YYYY'), margin, 32);
//         this.addLogoToPDF(doc, 145, 18, 45, 20);

//         // --- FOOTER (Repeats on every page) ---
//         const footerY = 280;
//         doc.setFontSize(9);
//         this.setFont(doc, 'calibri', 'bold');
//         doc.text('PENTA For Hospitals and Schools Furniture Manufacturing L.L.C., Ajman, UAE', 105, footerY, { align: 'center' });
//         this.setFont(doc, 'calibri', 'normal');
//         doc.text('Tel : +971 6 563 2822, Email: info@penta-indust.com, www.penta-indust.com', 105, footerY + 5, { align: 'center' });
//         doc.text(`Page ${i} of ${finalTotalPages}`, 190, footerY + 10, { align: 'right' });
//     }
// }


generateBOMPage(doc, quotationData, totalPages = 1) {
    const margin = 20;
    const headerHeight = 55; // The space needed for Logo/Ref on EVERY page
    let yPos = headerHeight; 

    /* =========================
       1. DYNAMIC CONTENT START
    ========================= */
    // Title appears ONLY on the first page
    this.setFont(doc, 'calibri', 'bold');
    doc.setFontSize(14);
    doc.text('BILL OF MATERIALS', 105, 45, { align: 'center' });

    const bomData = this.generateBillOfMaterials(quotationData);
    
    if (bomData.length > 0) {
        const bomHeaders = ['#', 'Material Description', 'Unit', 'Total Quantity'];
        const bomTableData = bomData.map((item, index) => [
            (index + 1).toString().padStart(2, '0'),
            item.partName,
            item.unit,
            item.totalQuantity.toString()
        ]);

        doc.autoTable({
            head: [bomHeaders],
            body: bomTableData,
            startY: yPos,
            margin: { left: margin, right: margin, top: headerHeight }, // CRITICAL: This prevents table rows from hitting header on Page 2+
            theme: 'plain',
            styles: { font: 'arial', fontSize: 8, valign: 'middle', cellPadding: 3 },
            headStyles: { 
                fillColor: [255, 255, 255], 
                textColor: [0, 0, 0], 
                fontStyle: 'bold', 
                halign: 'center',
                lineWidth: { bottom: 0.5 },
                lineColor: [0, 0, 0]
            },
            columnStyles: {
                0: { cellWidth: 15, halign: 'center' },
                1: { cellWidth: 110, halign: 'left' },
                2: { cellWidth: 20, halign: 'center' },
                3: { cellWidth: 25, halign: 'center' }
            },
            didParseCell: (data) => {
                if (data.section === 'body') {
                    data.cell.styles.fillColor = [240, 240, 240]; 
                }
            }
        });

        yPos = doc.lastAutoTable.finalY + 10;

        /* =========================
           2. OVERLAP CHECK FOR SUMMARY BOX
        ========================= */
        const footerThreshold = 260; 
        const requiredSpace = 50; 

        if (yPos + requiredSpace > footerThreshold) {
            doc.addPage();
            yPos = headerHeight; // RESET yPos to below the header on the new page
        }

        // Draw Material Summary Box
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, yPos, 170, 25, 'F');
        this.setFont(doc, 'calibri', 'bold');
        doc.setFontSize(10);
        doc.text('MATERIAL SUMMARY:', margin + 5, yPos + 8);
        this.setFont(doc, 'calibri', 'normal');
        doc.text(`• Total unique materials: ${bomData.length}`, margin + 5, yPos + 15);
        doc.text(`• Total quantity of all materials: ${bomData.reduce((sum, i) => sum + i.totalQuantity, 0)}`, margin + 5, yPos + 22);

        // Draw Italic Note
        yPos += 35;
        this.setFont(doc, 'calibri', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        const note = "Note: This Bill of Materials consolidates identical materials across all items, showing the total quantity required for the entire project.";
        doc.text(doc.splitTextToSize(note, 170), margin, yPos);
    }

    /* =========================
       3. REPEATED HEADER & FOOTER
    ========================= */
    const finalTotalPages = doc.internal.getNumberOfPages();
    
    for (let i = 1; i <= finalTotalPages; i++) {
        doc.setPage(i);
        
        // --- HEADER ---
        this.setFont(doc, 'calibri', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text(quotationData.quoteRef || '', margin, 20);
        doc.text(`PRICE: ${quotationData.pricing?.currency || 'USD'}`, margin, 26);
        doc.text(quotationData.date || moment().format('DD.MM.YYYY'), margin, 32);
        this.addLogoToPDF(doc, 145, 18, 45, 20);

        // --- FOOTER ---
        const footerY = 280;
        doc.setFontSize(9);
        this.setFont(doc, 'calibri', 'bold');
        doc.text('PENTA For Hospitals and Schools Furniture Manufacturing L.L.C., Ajman, UAE', 105, footerY, { align: 'center' });
        this.setFont(doc, 'calibri', 'normal');
        doc.text('Tel : +971 6 563 2822, Email: info@penta-indust.com, www.penta-indust.com', 105, footerY + 5, { align: 'center' });
        doc.text(`Page ${i} of ${finalTotalPages}`, 190, footerY + 10, { align: 'right' });
    }
}
    
    parseHierarchicalItems(items) {
        const hierarchicalItems = [];
        let currentItem = null;
        
        if (!items || !Array.isArray(items)) {
            console.warn('parseHierarchicalItems: items is not an array or is empty');
            return hierarchicalItems;
        }
        
        console.log(`parseHierarchicalItems: Processing ${items.length} items`);
        
        items.forEach((item, index) => {
            console.log(`  Item ${index + 1}: isItemHeader=${item.isItemHeader}, isSubtotal=${item.isSubtotal}, isAdditionalItem=${item.isAdditionalItem}, description="${item.description}"`);
            
            // Check if this is an additional item part (no header, just parts)
            const isAdditionalItemPart = item.isAdditionalItem && !item.isItemHeader && !item.isSubtotal;
            
            // If we encounter a part from additional item and don't have a current item, create one
            if (isAdditionalItemPart && !currentItem) {
                currentItem = {
                    description: 'Additional Items', // Generic description, won't be displayed
                    parts: [],
                    totalQuantity: 0,
                    totalAmount: 0,
                    averageUnitPrice: 0,
                    images: item.images || [], // Get images from first part if available
                    isAdditionalItem: true, // Mark as additional item (no header display)
                    skipHeader: true // Flag to skip header in export
                };
                console.log(`  Started new additional item group (no header)`);
            }
            
            if (item.isItemHeader) {
                // Start a new item
                if (currentItem) {
                    // Calculate final values before adding
                    this.finalizeItem(currentItem);
                    hierarchicalItems.push(currentItem);
                    console.log(`  Completed item "${currentItem.description}" with ${currentItem.parts.length} parts, totalAmount=${currentItem.totalAmount}`);
                }
                
                // Parse images if they're stored as JSON string (from database)
                let images = item.images || [];
                if (typeof images === 'string') {
                    try {
                        images = JSON.parse(images);
                    } catch (e) {
                        console.error('Error parsing images JSON:', e);
                        images = [];
                    }
                }
                // Ensure images is an array
                if (!Array.isArray(images)) {
                    images = [];
                }
                
                currentItem = {
                    description: item.description || 'Untitled Item',
                    parts: [],
                    totalQuantity: 0,
                    totalAmount: 0,
                    averageUnitPrice: 0,
                    images: images, // Include parsed images array
                    isAdditionalItem: item.isAdditionalItem || false,
                    skipHeader: false // Regular items show header
                };
                
                console.log(`  Started new item "${currentItem.description}"`);
                
                // Debug logging for images
                if (currentItem.images && currentItem.images.length > 0) {
                    console.log(`  Item "${currentItem.description}" has ${currentItem.images.length} images`);
                }
            } else if (item.isSubtotal) {
                // Finalize current item with subtotal
                if (currentItem) {
                    const subtotalAmount = Number(item.unitPrice) || 0;
                    currentItem.totalAmount = subtotalAmount;
                    if (currentItem.totalQuantity > 0) {
                        currentItem.averageUnitPrice = currentItem.totalAmount / currentItem.totalQuantity;
                    } else {
                        currentItem.averageUnitPrice = currentItem.totalAmount;
                    }
                    console.log(`  Set subtotal for item "${currentItem.description}": ${currentItem.totalAmount}`);
                    
                    // If this is an additional item subtotal, finalize and add it
                    if (item.isAdditionalItem && currentItem.isAdditionalItem) {
                        this.finalizeItem(currentItem);
                        hierarchicalItems.push(currentItem);
                        console.log(`  Completed additional item group with ${currentItem.parts.length} parts`);
                        currentItem = null; // Reset for next group
                    }
                } else {
                    console.warn(`  WARNING: Found subtotal but no current item!`);
                }
            } else if (currentItem && !item.isItemHeader && !item.isSubtotal) {
                // Add part to current item
                const quantity = Number(item.quantity) || 0;
                const unitPrice = Number(item.unitPrice) || 0;
                
                // Check both description and part fields (custom parts use 'part' field)
                const partDescription = item.description || item.part || '';
                const part = {
                    description: partDescription || 'Untitled Part',
                    quantity: quantity,
                    unit: item.unit || 'NOS',
                    unitPrice: unitPrice,
                    total: quantity * unitPrice
                };
                
                currentItem.parts.push(part);
                currentItem.totalQuantity += quantity;
                currentItem.totalAmount += part.total;
                
                // If this part has images and current item doesn't, use them
                if (item.images && Array.isArray(item.images) && item.images.length > 0 && (!currentItem.images || currentItem.images.length === 0)) {
                    currentItem.images = item.images;
                }
                
                console.log(`  Added part to "${currentItem.description}": "${part.description}" (qty: ${quantity}, price: ${unitPrice})`);
            } else if (!currentItem && !item.isItemHeader && !item.isSubtotal) {
                // Orphan part or additional item part - no current item, create a standalone item
                const quantity = Number(item.quantity) || 0;
                const unitPrice = Number(item.unitPrice) || 0;
                
                // Check if this is an additional item part
                const isAdditional = item.isAdditionalItem || false;
                
                // Check both description and part fields (custom parts use 'part' field)
                const partDescription = item.description || item.part || '';
                currentItem = {
                    description: isAdditional ? 'Additional Items' : (item.description || 'Untitled Item'),
                    parts: [{
                        description: partDescription || 'Untitled Part',
                        quantity: quantity,
                        unit: item.unit || 'NOS',
                        unitPrice: unitPrice,
                        total: quantity * unitPrice
                    }],
                    totalQuantity: quantity,
                    totalAmount: quantity * unitPrice,
                    averageUnitPrice: unitPrice,
                    images: item.images || [],
                    isAdditionalItem: isAdditional,
                    skipHeader: isAdditional // Skip header for additional items
                };
                
                if (isAdditional) {
                    console.log(`  Started additional item group (no header) with part "${item.description}"`);
                } else {
                    console.warn(`  WARNING: Found orphan part "${item.description}" without an item header, creating standalone item`);
                }
            }
        });
        
        // Add the last item if exists
        if (currentItem) {
            this.finalizeItem(currentItem);
            hierarchicalItems.push(currentItem);
            console.log(`  Completed final item "${currentItem.description}" with ${currentItem.parts.length} parts, totalAmount=${currentItem.totalAmount}`);
        }
        
        console.log(`parseHierarchicalItems: Returned ${hierarchicalItems.length} hierarchical items`);
        return hierarchicalItems;
    }
    
    finalizeItem(item) {
        if (!item) {
            console.warn('finalizeItem: item is null or undefined');
            return;
        }
        
        // If no subtotal was provided, calculate from parts
        if (item.totalAmount === 0 && item.parts.length > 0) {
            item.totalAmount = item.parts.reduce((sum, part) => {
                const partTotal = part.total || (part.quantity * part.unitPrice);
                return sum + partTotal;
            }, 0);
            console.log(`  Calculated totalAmount from parts: ${item.totalAmount}`);
        }
        
        // Calculate average unit price
        if (item.totalQuantity > 0) {
            item.averageUnitPrice = item.totalAmount / item.totalQuantity;
        } else {
            item.averageUnitPrice = item.totalAmount || 0;
        }
        
        console.log(`  Finalized item "${item.description}": totalAmount=${item.totalAmount}, totalQuantity=${item.totalQuantity}, avgUnitPrice=${item.averageUnitPrice}`);
    }

    formatNumber(number, decimals = 2) {
        if (isNaN(number) || number === null || number === undefined) {
            return decimals > 0 ? '0.00' : '0';
        }
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
            useGrouping: true
        }).format(number);
    }

    async getAllQuotations() {
        try {
            const files = fs.readdirSync(this.pdfPath)
                .filter(file => file.endsWith('.pdf'))
                .map(file => {
                    const filepath = path.join(this.pdfPath, file);
                    const stats = fs.statSync(filepath);
                    return {
                        filename: file,
                        filepath,
                        quoteRef: file.replace('quotation_', '').replace('.pdf', ''),
                        createdAt: stats.birthtime,
                        size: stats.size
                    };
                })
                .sort((a, b) => b.createdAt - a.createdAt);
            
            return files;
        } catch (error) {
            console.error('Error reading quotations:', error);
            return [];
        }
    }

    async getQuotationFile(filename) {
        const filepath = path.join(this.pdfPath, filename);
        if (fs.existsSync(filepath)) {
            return filepath;
        }
        return null;
    }

    // Excel helper methods - Match PDF structure exactly as shown in image
    createExcelCoverPage(workbook, quotationData) {
        const worksheet = workbook.addWorksheet('Page 1 - Cover');
        
        // Set A4 page setup exactly like PDF
        worksheet.pageSetup = {
            paperSize: 9, // A4
            orientation: 'portrait',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            margins: {
                left: 0.75, // 20mm like PDF
                right: 0.75, // 20mm like PDF  
                top: 0.75,   // Standard top margin
                bottom: 0.75,
                header: 0.3,
                footer: 0.3
            }
        };

        // Set default font for the entire worksheet
        worksheet.properties.defaultRowHeight = 15;
        
        // Set column widths to match PDF layout
        worksheet.columns = [
            { key: 'A', width: 15 }, // Labels
            { key: 'B', width: 5 },  // Spacer
            { key: 'C', width: 30 }, // Values
            { key: 'D', width: 10 }, // Spacer
            { key: 'E', width: 15 }, // Right labels
            { key: 'F', width: 5 },  // Spacer
            { key: 'G', width: 30 }, // Right values
            { key: 'H', width: 10 }  // Spacer
        ];

        // Title - QUOTATION (top-left)
        const titleCell = worksheet.getCell('A1');
        titleCell.value = 'QUOTATION';
        titleCell.font = { 
            bold: true, 
            size: 18, 
            name: 'Calibri' 
        };
        titleCell.alignment = { 
            horizontal: 'left', 
            vertical: 'middle'
        };
        worksheet.mergeCells('A1:D2');
        
        // Add logo and header
        try {
            const logoPath = path.join(__dirname, '..', '..', 'penta logo.png');
            const logoId = workbook.addImage({
                filename: logoPath,
                extension: 'png'
            });
            
            // Position logo in column E, row 1
            worksheet.addImage(logoId, {
                tl: { col: 5, row: 0 }, // Column E (0-based index 5), top row
                ext: { width: 120, height: 60 } // Smaller size to match PDF
            });
            
            // // Add "penta" text in column F, row 1
            // const pentaCell = worksheet.getCell('F1');
            // pentaCell.value = 'penta';
            // pentaCell.font = {
            //     bold: true,
            //     size: 16,
            //     name: 'Calibri'
            // };
            
            // // Add "Innovative Solutions" in column F, row 2
            // const solutionsCell = worksheet.getCell('F2');
            // solutionsCell.value = 'Innovative Solutions';
            // solutionsCell.font = {
            //     size: 9,
            //     name: 'Calibri'
            // };
            
            // Add single line below header (row 3)
            // const lineRow = 3;
            // for (let col = 1; col <= 6; col++) {
            //     const cell = worksheet.getCell(lineRow, col);
            //     cell.border = {
            //         bottom: { style: 'thin', color: { argb: 'FF000000' } }
            //     };
            // }
        } catch (error) {
            console.error('Error adding logo:', error);
            // Fallback to text if logo fails to load
            worksheet.getCell('F1').value = 'penta';
            worksheet.getCell('F1').font = {
                bold: true,
                size: 16,
                name: 'Calibri'
            };
            
            worksheet.getCell('F2').value = 'Innovative Solutions';
            worksheet.getCell('F2').font = {
                size: 10,
                name: 'Calibri'
            };
        }
        
        // Add client information
        let row = 5;
        const clientInfo = {
            'Client:': quotationData.clientInfo?.name || 'M/S Orion Building Contracting LLC',
            'Date:': quotationData.date || moment().format('DD.MM.YYYY'),
            '': '',
            'UAE': ''
        };
        
        // Add client info with proper alignment
        Object.entries(clientInfo).forEach(([label, value], index) => {
            if (label) {
                const labelCell = worksheet.getCell(`A${row + index}`);
                labelCell.value = label;
                labelCell.font = { name: 'Calibri', size: 11 };
                labelCell.alignment = { horizontal: 'left' };
            }
            
            if (value) {
                const valueCell = worksheet.getCell(`C${row + index}`);
                valueCell.value = value;
                valueCell.font = { name: 'Calibri', size: 11 };
            }
        });
        
        // Add project information
        row += 5;
        const projectInfo = [
            { label: 'Project:', value: quotationData.projectInfo?.name || 'ASHMOUNT SCHOOL- MUDON', label2: 'Inquiry No.:', value2: quotationData.projectInfo?.inquiryNo || '' },
            { label: 'Quote Ref.:', value: quotationData.quoteRef || 'PQ25070025', label2: 'Inquiry Date:', value2: quotationData.projectInfo?.inquiryDate || quotationData.date || moment().format('DD.MM.YYYY') },
            { label: 'Customer No :', value: quotationData.customerNo || quotationData.clientInfo?.name || '', label2: 'Drawing No.:', value2: quotationData.projectInfo?.drawingNo || '' }
        ];
        
        projectInfo.forEach((info, i) => {
            const currentRow = row + i;
            
            // Left side label and value
            if (info.label) {
                const labelCell = worksheet.getCell(`A${currentRow}`);
                labelCell.value = info.label;
                labelCell.font = { name: 'Calibri', size: 11, bold: true };
                
                const valueCell = worksheet.getCell(`C${currentRow}`);
                valueCell.value = info.value;
                valueCell.font = { name: 'Calibri', size: 11 };
            }
            
            // Right side label and value
            if (info.label2) {
                const labelCell2 = worksheet.getCell(`E${currentRow}`);
                labelCell2.value = info.label2;
                labelCell2.font = { name: 'Calibri', size: 11, bold: true };
                
                const valueCell2 = worksheet.getCell(`G${currentRow}`);
                valueCell2.value = info.value2;
                valueCell2.font = { name: 'Calibri', size: 11 };
            }
        });
        
        // Add greeting
        row += 4;
        const greetingCell = worksheet.getCell(`A${row}`);
        greetingCell.value = 'Dear Sir or Madam,';
        greetingCell.font = { name: 'Calibri', size: 11 };
        
        // Add introduction paragraph
        row += 2;
        const introText = 'We appreciate your inquiry and the opportunity to provide you with a comprehensive quotation tailored to your requirements. Please find below the details of our quotation and the terms and conditions associated with it.';
        const introCell = worksheet.getCell(`A${row}`);
        introCell.value = introText;
        introCell.font = { name: 'Calibri', size: 11 };
        worksheet.mergeCells(`A${row}:G${row + 2}`);
        introCell.alignment = { wrapText: true, vertical: 'top' };
        
        // Add terms and conditions
        row += 4;
        const terms = [
            { label: 'Delivery Time:', value: quotationData.terms?.deliveryTime || '6-8 weeks for furniture and 8-12 weeks for fumecupboard and safety cabinets after receiving downpayment.' },
            { label: 'Delivery terms:', value: quotationData.terms?.deliveryTerms || 'Delivery Included' },
            { label: 'Payment terms:', value: quotationData.terms?.paymentTerms || '50% advance payment, 50% balance payment before order collection.' },
            { label: 'Installation:', value: quotationData.terms?.installation || 'Included' },
            { label: 'Warranty:', value: quotationData.terms?.warranty || '10 Years for the phenolic worktop, 1 Year for the other items' },
            { label: 'Currency:', value: quotationData.pricing?.currency || quotationData.terms?.currency || 'AED' },
            { label: 'Offer Validity:', value: quotationData.terms?.offerValidity || 'This offer valid for one month' },
            { label: 'Exclusions:', value: quotationData.terms?.exclusions || 'Civil, MEP, Ducting, Gas Works' }
        ];
        
        // Add terms and conditions with proper formatting
        terms.forEach((term, i) => {
            const currentRow = row + i;
            
            // Label
            const labelCell = worksheet.getCell(`A${currentRow}`);
            labelCell.value = term.label;
            labelCell.font = { name: 'Calibri', size: 11, bold: true };
            
            // Value
            const valueCell = worksheet.getCell(`C${currentRow}`);
            valueCell.value = term.value;
            valueCell.font = { name: 'Calibri', size: 11 };
            
            // Merge cells for longer values
            if (term.value && term.value.length > 30) {
                worksheet.mergeCells(`C${currentRow}:G${currentRow}`);
                valueCell.alignment = { wrapText: true, vertical: 'top' };
            }
        });
        
        // Add bank details
        row += terms.length + 3;
        const bankTitleCell = worksheet.getCell(`A${row}`);
        bankTitleCell.value = 'Bank Details:';
        bankTitleCell.font = { name: 'Calibri', size: 11, bold: true };
        
        const bankDetails = [
            { label: 'Bank Name:', value: 'EMIRATES ISLAMIC BANK P.J.S.C' },
            { label: 'Account Name:', value: 'PENTA FOR HOSPITALS & SCHOOLS FURNITURE MANUFACTURING L.L.C' },
            { label: 'Account No:', value: '4039 17625 001' },
            { label: 'IBAN:', value: 'AE 2503400 0000 4039 1762 5001' },
            { label: 'SWIFT/BIC:', value: 'MEBLAEAD' },
            { label: 'Branch:', value: 'Ajman, UAE' },
            { label: 'VAT No:', value: '100509636300003' }
        ];
        
        bankDetails.forEach((detail, i) => {
            const currentRow = row + i + 1;
            
            // Label
            const labelCell = worksheet.getCell(`A${currentRow}`);
            labelCell.value = detail.label;
            labelCell.font = { name: 'Calibri', size: 11, bold: true };
            
            // Value
            const valueCell = worksheet.getCell(`B${currentRow}`);
            valueCell.value = detail.value;
            valueCell.font = { name: 'Calibri', size: 11 };
            
            // Merge cells for longer values
            if (detail.value.length > 30) {
                worksheet.mergeCells(`B${currentRow}:G${currentRow}`);
            }
        });
        
        // Add assistance text
        row += bankDetails.length + 3;
        const assistanceText = 'We stand ready to assist you with any additional requirements you may have, and we would be delighted to\nfurnish you with a tailored quotation. Please do not hesitate to get in touch with us.';
        const assistanceCell = worksheet.getCell(`A${row}`);
        assistanceCell.value = assistanceText;
        assistanceCell.font = { name: 'Calibri', size: 11 };
        worksheet.mergeCells(`A${row}:G${row + 1}`);
        assistanceCell.alignment = { wrapText: true };
        
        // Add Our Best Regards section
        row += 3;
        const regardsCell = worksheet.getCell(`A${row}`);
        regardsCell.value = 'Our best regards,';
        regardsCell.font = { name: 'Calibri', size: 11 };
        
        // Add company name
        row += 2;
        const companyCell = worksheet.getCell(`A${row}`);
        companyCell.value = 'PENTA for Hospitals and Schools Furniture Manufacturing LLC';
        companyCell.font = { name: 'Calibri', size: 11, bold: true };
        
        // Add manager name
        row += 2;
        const managerCell = worksheet.getCell(`A${row}`);
        managerCell.value = 'Ahmad Alokosh';
        managerCell.font = { name: 'Calibri', size: 11 };
        
        // Add title
        row += 1;
        const managerTitleCell = worksheet.getCell(`A${row}`);
        managerTitleCell.value = 'General Manager / Partner';
        managerTitleCell.font = { name: 'Calibri', size: 11, italic: true };
        
        // Add contact info
        row += 1;
        const contactCell = worksheet.getCell(`A${row}`);
        contactCell.value = 'Mob. +971561184640';
        contactCell.font = { name: 'Calibri', size: 11 };
        
        // Add footer
        const footerRow = Math.max(row + bankDetails.length + 2, 50);
        const footerText = 'PENTA For Hospitals and Schools Furniture Manufacturing L.L.C., Ajman, UAE\n' +
                         'Tel : +971 6 563 2822, Email: info@penta-indust.com, www.penta-indust.com';
        
        // Add horizontal line above footer
        // const lineRow = footerRow - 2;
        // worksheet.mergeCells(`A${lineRow}:G${lineRow}`);
        // const lineCell = worksheet.getCell(`A${lineRow}`);
        // lineCell.border = { 
        //     top: { 
        //         style: 'thin', 
        //         color: { argb: 'FF1f4e79' } 
        //     } 
        // };
        
        // Add footer text
        worksheet.mergeCells(`A${footerRow}:G${footerRow + 1}`);
        const footerCell = worksheet.getCell(`A${footerRow}`);
        footerCell.value = footerText;
        footerCell.font = { 
            name: 'Calibri', 
            size: 10,
            bold : true
        };
        footerCell.alignment = { 
            horizontal: 'center', 
            vertical: 'middle', 
            wrapText: true 
        };
        
        // Add page numbers
        // const pageNumRow = footerRow + 3;
        // worksheet.mergeCells(`A${pageNumRow}:G${pageNumRow}`);
        // const pageNumCell = worksheet.getCell(`A${pageNumRow}`);
        // pageNumCell.value = `Page 1 of ${this.calculateTotalPages(this.parseHierarchicalItems(quotationData.items || []))}`;
        // pageNumCell.alignment = { 
        //     horizontal: 'right' 
        // };
        // pageNumCell.font = { 
        //     name: 'Calibri', 
        //     size: 10 
        // };
    }

    createExcelSummaryPage(workbook, quotationData, hierarchicalItems) {
        const worksheet = workbook.addWorksheet('Page 2 - Quotation Summary');
        
        // Set A4 page setup exactly like PDF
        worksheet.pageSetup = {
            paperSize: 9, // A4
            orientation: 'portrait',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            margins: {
                left: 0.75, // 20mm like PDF
                right: 0.75, // 20mm like PDF  
                top: 0.75,   // Standard top margin
                bottom: 0.75,
                header: 0.3,
                footer: 0.3
            }
        };

        // Show gridlines like in the image
        worksheet.views = [{
            showGridLines: true
        }];

        // Set column widths to match PDF table exactly
        worksheet.columns = [
            { width: 8 },  // A - Item number
            { width: 35 }, // B - Description
            { width: 10 }, // C - Quantity  
            { width: 15 }, // D - Unit Amount
            { width: 15 }, // E - Total Amount
            { width: 12 }  // F - Logo space
        ];

        let row = 1;
        
        // Header exactly like PDF - Quote info (left) and Logo (right)
        worksheet.getCell(`A${row}`).value = quotationData.quoteRef || 'PQ12345632';
        worksheet.getCell(`A${row}`).font = { name: 'Calibri', size: 11 };
        
        // Penta logo (right side like PDF) - actual logo image
        worksheet.mergeCells(`D${row}:F${row}`);
        
        // Add the actual Penta logo image
        try {
            const logoPath = path.join(__dirname, '..', '..', 'penta logo.png');
            if (fs.existsSync(logoPath)) {
                const logoId = workbook.addImage({
                    filename: logoPath,
                    extension: 'png',
                });
                
                worksheet.addImage(logoId, {
                    tl: { col: 4, row: 0.2 }, // D1 position
                    ext: { width: 120, height: 60 }
                });
            } else {
                // Fallback to text if logo not found
                worksheet.getCell(`D${row}`).value = 'PENTA LOGO';
                worksheet.getCell(`D${row}`).font = { bold: true, size: 10, name: 'Calibri' };
                worksheet.getCell(`D${row}`).alignment = { horizontal: 'center' };
                worksheet.getCell(`D${row}`).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE0E0E0' }
                };
            }
        } catch (error) {
            console.log('Logo not found, using text placeholder');
            worksheet.getCell(`D${row}`).value = 'PENTA LOGO';
            worksheet.getCell(`D${row}`).font = { bold: true, size: 10, name: 'Calibri' };
            worksheet.getCell(`D${row}`).alignment = { horizontal: 'center' };
            worksheet.getCell(`D${row}`).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };
        }
        row++;

        worksheet.getCell(`A${row}`).value = `PRICE: ${quotationData.pricing?.currency || 'AED'}`;
        worksheet.getCell(`A${row}`).font = { name: 'Calibri', size: 11 };
        row++;

        worksheet.getCell(`A${row}`).value = quotationData.date || moment().format('DD.MM.YYYY');
        worksheet.getCell(`A${row}`).font = { name: 'Calibri', size: 11 };
        row += 3;

        // Title exactly like PDF
        worksheet.mergeCells(`A${row}:F${row}`);
        worksheet.getCell(`A${row}`).value = 'QUOTATION SUMMARY';
        worksheet.getCell(`A${row}`).font = { bold: true, size: 14, name: 'Calibri' };
        worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
        row += 2;

        // Table headers with new styling
        const currency = quotationData.pricing?.currency || 'AED';
        const headers = ['', 'Item Description', 'Quantity', `Unit amount\n(${currency})`, `Total amount\n(${currency})`];
        
        // Set column widths based on percentages
        worksheet.getColumn(1).width = 8;  // Item column (8%)
        worksheet.getColumn(2).width = 40;  // Description column (62%)
        worksheet.getColumn(3).width = 8;   // Quantity column (8%)
        worksheet.getColumn(4).width = 12;  // Unit amount column (11%)
        worksheet.getColumn(5).width = 12;  // Total amount column (11%)
        
        headers.forEach((header, index) => {
            const cell = worksheet.getCell(row, index + 1);
            cell.value = header;
            cell.font = { bold: true, size: 13, name: 'Arial' };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFFFFF' } // White background
            };
            cell.border = {
                bottom: { style: 'medium', color: { argb: 'FF000000' } } // 2px solid black bottom border
            };
            cell.alignment = { 
                horizontal: index === 0 || index === 1 ? 'left' : (index === 2 ? 'center' : 'right'), 
                vertical: 'top', 
                wrapText: true 
            };
            cell.padding = { top: 8, bottom: 8, left: 8, right: 8 };
        });
        row++;

        // Items exactly like PDF
        if (hierarchicalItems && hierarchicalItems.length > 0) {
            hierarchicalItems.forEach((item, index) => {
                console.log(`Excel Summary - Adding item ${index + 1}: "${item.description}", qty: ${item.totalQuantity}, amount: ${item.totalAmount}`);
                const cells = [
                    `ITEM-${index + 1}`,
                    item.description || 'Untitled Item',
                    item.totalQuantity || 1,
                    this.formatNumber(item.averageUnitPrice || item.totalAmount || 0, 0),
                    this.formatNumber(item.totalAmount || 0, 0)
                ];
                
                // Apply alternating row colors (#cfcfcf for odd rows)
                const isOddRow = index % 2 === 0; // index 0, 2, 4... are odd rows (1st, 3rd, 5th...)
                const rowFillColor = isOddRow ? 'FFCFCFCF' : 'FFFFFFFF'; // #cfcfcf for odd, white for even
                
                cells.forEach((value, colIndex) => {
                    const cell = worksheet.getCell(row, colIndex + 1);
                    cell.value = value;
                    cell.font = { name: 'Arial', size: 13 };
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: rowFillColor }
                    };
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                    cell.padding = { top: 8, bottom: 8, left: 8, right: 8 };
                    
                    // Set alignment based on column
                    if (colIndex === 0) {
                        cell.font = { bold: true, name: 'Arial', size: 13 };
                        cell.alignment = { horizontal: 'left', vertical: 'top' };
                    } else if (colIndex === 1) {
                        cell.alignment = { horizontal: 'left', vertical: 'top' };
                    } else if (colIndex === 2) {
                        cell.alignment = { horizontal: 'center', vertical: 'top' };
                    } else {
                        cell.alignment = { horizontal: 'right', vertical: 'top' };
                    }
                });
                row++;
            });
        } else {
            console.warn('Excel Summary - No hierarchical items to display!');
            // Add a message if no items
            worksheet.mergeCells(`A${row}:E${row}`);
            worksheet.getCell(`A${row}`).value = 'No items found';
            worksheet.getCell(`A${row}`).font = { name: 'Calibri', size: 10, italic: true };
            worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
            row++;
        }

        // Financial summary exactly like PDF - positioned after table
        const tableEndRow = row;
        row = tableEndRow + 2;

        const pricing = quotationData.pricing || {};
        console.log('Excel Summary - Pricing data:', {
            subtotal: pricing.subtotal,
            discountPercentage: pricing.discountPercentage,
            discountedPrice: pricing.discountedPrice,
            vatPercentage: pricing.vatPercentage,
            vatAmount: pricing.vatAmount,
            totalAmount: pricing.totalAmount,
            currency: pricing.currency
        });
        
        const hasDiscount = pricing.discountPercentage > 0;
        const vatPercentage = pricing.vatPercentage || 5;
        
        const financialRows = [
            [`PRICE (${currency})`, '', '', '', this.formatNumber(pricing.subtotal || 0, 0)]
        ];
        
        if (hasDiscount) {
            financialRows.push([`DISCOUNTED PRICE (${currency})`, '', '', '', this.formatNumber(pricing.discountedPrice || 0, 0)]);
        }
        
        financialRows.push([`VAT ${vatPercentage}%`, '', '', '', this.formatNumber(pricing.vatAmount || 0, 0)]);
        
        const totalLabel = hasDiscount ? `TOTAL DISCOUNTED PRICE (${currency})` : `TOTAL PRICE (${currency})`;
        financialRows.push([totalLabel, '', '', '', this.formatNumber(pricing.totalAmount || 0, 0)]);

        financialRows.forEach((rowData, index) => {
            const isLastRow = index === financialRows.length - 1;
            rowData.forEach((value, colIndex) => {
                const cell = worksheet.getCell(row, colIndex + 1);
                cell.value = value;
                cell.font = { bold: true, name: 'Calibri', size: 10 };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
                
                // Apply styling based on row index to match PDF styling
                if (isLastRow) {
                    // Last row (TOTAL) - black background, white text
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FF000000' }
                    };
                    cell.font = { bold: true, name: 'Calibri', size: 10, color: { argb: 'FFFFFFFF' } };
                } else {
                    // Alternate rows: 0=white, 1=grey, 2=white, 3=grey (if discount exists)
                    if (index % 2 === 1) {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFDCDCDC' } // Light grey
                        };
                    } else {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFFFFFFF' } // White
                        };
                    }
                    cell.font = { bold: true, name: 'Calibri', size: 10, color: { argb: 'FF000000' } };
                }
                
                if (colIndex === 0) {
                    cell.alignment = { horizontal: 'left' };
                } else if (colIndex === 4) {
                    cell.alignment = { horizontal: 'right' };
                }
            });
            row++;
        });

        // Page footer exactly like PDF
        row = Math.max(row, 55);
        worksheet.mergeCells(`A${row}:F${row}`);
        const currentPageNumber = 2;
        const totalPages = this.calculateTotalPages(hierarchicalItems);
        worksheet.getCell(`A${row}`).value = `Page ${currentPageNumber} of ${totalPages}`;
        worksheet.getCell(`A${row}`).alignment = { horizontal: 'right' };
        worksheet.getCell(`A${row}`).font = { name: 'Calibri', size: 10 };
    }

    createExcelItemDetailPage(workbook, quotationData, item, index) {
        // Debug: Log item images
        console.log(`createExcelItemDetailPage - Item "${item.description}" has images:`, item.images ? `${item.images.length} images` : 'none');
        if (item.images && item.images.length > 0) {
            console.log(`  Image types:`, item.images.map(img => typeof img === 'string' && img.substring(0, 30)).join(', '));
        }
        
        const worksheet = workbook.addWorksheet(`Page ${index + 3} - Item ${index + 1}`);
        
        // Set A4 page setup exactly like PDF
        worksheet.pageSetup = {
            paperSize: 9, // A4
            orientation: 'portrait',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            margins: {
                left: 0.75, // 20mm like PDF
                right: 0.75, // 20mm like PDF  
                top: 0.75,   // Standard top margin
                bottom: 0.75,
                header: 0.3,
                footer: 0.3
            }
        };

        // Show gridlines like in the image
        worksheet.views = [{
            showGridLines: true
        }];

        // Set fixed column widths to prevent auto-adjustment (70%, 10%, 20% for table)
        worksheet.columns = [
            { width: 50 },  // A - PART (70%) - fixed width
            { width: 10 },  // B - UNIT (10%) - fixed width (increased to prevent wrapping)
            { width: 15 },  // C - QTY (20%) - fixed width (increased to prevent wrapping)
            { width: 12 }   // D - Logo space / Amount column for subtotal
        ];

        let row = 1;
        
        // Header exactly like PDF - Quote info (left) and Logo (right)
        worksheet.getCell(`A${row}`).value = quotationData.quoteRef || 'PQ25070025';
        worksheet.getCell(`A${row}`).font = { name: 'Calibri', size: 11 };
        
        // Penta logo (right side like PDF) - actual logo image
        worksheet.mergeCells(`D${row}:E${row}`);
        
        // Add the actual Penta logo image
        try {
            const logoPath = path.join(__dirname, '..', '..', 'penta logo.png');
            if (fs.existsSync(logoPath)) {
                const logoId = workbook.addImage({
                    filename: logoPath,
                    extension: 'png',
                });
                
                worksheet.addImage(logoId, {
                    tl: { col: 3.2, row: 0.2 }, // D1 position
                    ext: { width: 120, height: 60 }
                });
            } else {
                // Fallback to text if logo not found
                worksheet.getCell(`D${row}`).value = 'PENTA LOGO';
                worksheet.getCell(`D${row}`).font = { bold: true, size: 10, name: 'Calibri' };
                worksheet.getCell(`D${row}`).alignment = { horizontal: 'center' };
                worksheet.getCell(`D${row}`).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE0E0E0' }
                };
            }
        } catch (error) {
            console.log('Logo not found, using text placeholder');
            worksheet.getCell(`D${row}`).value = 'PENTA LOGO';
            worksheet.getCell(`D${row}`).font = { bold: true, size: 10, name: 'Calibri' };
            worksheet.getCell(`D${row}`).alignment = { horizontal: 'center' };
            worksheet.getCell(`D${row}`).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };
        }
        row++;

        worksheet.getCell(`A${row}`).value = `PRICE: ${quotationData.pricing?.currency || 'AED'}`;
        worksheet.getCell(`A${row}`).font = { name: 'Calibri', size: 11 };
        row++;

        worksheet.getCell(`A${row}`).value = quotationData.date || moment().format('DD.MM.YYYY');
        worksheet.getCell(`A${row}`).font = { name: 'Calibri', size: 11 };
        row += 2;

        // Item header with grey background - SKIP for additional items
        if (!item.skipHeader) {
            worksheet.mergeCells(`A${row}:E${row}`);
            const headerCell = worksheet.getCell(`A${row}`);
            headerCell.value = `ITEM ${item.description}`;
            headerCell.font = { bold: true, size: 13, name: 'Arial' };
            headerCell.alignment = { horizontal: 'left', vertical: 'middle' };
            headerCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFCFCFCF' } // #cfcfcf
            };
            headerCell.border = {
                top: { style: 'thin', color: { argb: 'FF000000' } },
                left: { style: 'thin', color: { argb: 'FF000000' } },
                bottom: { style: 'thin', color: { argb: 'FF000000' } },
                right: { style: 'thin', color: { argb: 'FF000000' } }
            };
            // Set row height for padding (8px top + 8px bottom)
            worksheet.getRow(row).height = 20;
            row += 2;
        }

        // Table headers with new styling (no # column, only PART, UNIT, QTY)
        const headers = ['PART', 'UNIT', 'QTY'];
        const fixedHeaderHeight = 20; // Fixed row height in points
        headers.forEach((header, colIndex) => {
            const cell = worksheet.getCell(row, colIndex + 1);
            cell.value = header;
            cell.font = { bold: true, size: 13, name: 'Arial', color: { argb: 'FF000000' } };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFFFFF' } // White background
            };
            cell.border = {
                bottom: { style: 'medium', color: { argb: 'FF000000' } } // 1.5px solid black bottom border
            };
            cell.alignment = { 
                horizontal: colIndex === 0 ? 'left' : 'center', // PART left, UNIT and QTY center
                vertical: 'middle',
                wrapText: false, // Prevent text wrapping
                shrinkToFit: false // Prevent shrinking text
            };
            cell.padding = { top: 6, bottom: 6, left: 8, right: 8 };
        });
        // Set fixed row height for header
        worksheet.getRow(row).height = fixedHeaderHeight;
        row++;

        // Parts exactly like PDF
        if (item.parts && item.parts.length > 0) {
            console.log(`Excel Item Detail - Item "${item.description}" has ${item.parts.length} parts`);
            item.parts.forEach((part, partIndex) => {
                console.log(`  Part ${partIndex + 1}: "${part.description}", qty: ${part.quantity}, unit: ${part.unit}`);
                // Check both description and part fields (custom parts use 'part' field)
                const partDescription = part.description || part.part || '';
                const cells = [
                    partDescription || 'Untitled Part',
                    part.unit || 'NOS',
                    part.quantity || 0
                ];
                
                const fixedRowHeight = 18; // Fixed row height in points for data rows
                cells.forEach((value, colIndex) => {
                    const cell = worksheet.getCell(row, colIndex + 1);
                    cell.value = value;
                    cell.font = { name: 'Arial', size: 13 };
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                    cell.padding = { top: 6, bottom: 6, left: 8, right: 8 };
                    
                    // Set alignment based on column (no # column)
                    if (colIndex === 0) {
                        // PART column - left aligned, middle vertical
                        cell.alignment = { 
                            horizontal: 'left', 
                            vertical: 'middle',
                            wrapText: true, // Allow wrapping for long descriptions
                            shrinkToFit: false
                        };
                    } else if (colIndex === 1) {
                        // UNIT column - center aligned, middle vertical, NO wrapping
                        cell.alignment = { 
                            horizontal: 'center', 
                            vertical: 'middle',
                            wrapText: false, // Prevent wrapping - keep text horizontal
                            shrinkToFit: false
                        };
                    } else if (colIndex === 2) {
                        // QTY column - center aligned, middle vertical, bold, NO wrapping
                        cell.font = { bold: true, name: 'Arial', size: 13 };
                        cell.alignment = { 
                            horizontal: 'center', 
                            vertical: 'middle',
                            wrapText: false, // Prevent wrapping - keep text horizontal
                            shrinkToFit: false
                        };
                    }
                });
                // Set fixed row height for data row
                worksheet.getRow(row).height = fixedRowHeight;
                row++;
            });
        } else {
            console.warn(`Excel Item Detail - Item "${item.description}" has no parts!`);
            // Add a message if no parts
            worksheet.mergeCells(`A${row}:D${row}`);
            worksheet.getCell(`A${row}`).value = 'No parts found for this item';
            worksheet.getCell(`A${row}`).font = { name: 'Calibri', size: 10, italic: true };
            worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
            row++;
        }

        // Subtotal with new styling - positioned after table (margin-top: 15px)
        const tableEndRow = row;
        row = tableEndRow + 2;

        // Subtotal row with #cfcfcf background, bold, 1px solid black border
        // Merge PART and UNIT columns for label, QTY column for amount
        worksheet.mergeCells(`A${row}:B${row}`);
        const subtotalLabelCell = worksheet.getCell(`A${row}`);
        subtotalLabelCell.value = 'SUBTOTAL';
        subtotalLabelCell.font = { bold: true, name: 'Arial', size: 13 };
        subtotalLabelCell.alignment = { horizontal: 'left', vertical: 'middle' };
        subtotalLabelCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFCFCFCF' } // #cfcfcf
        };
        subtotalLabelCell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
        };
        subtotalLabelCell.padding = { top: 8, bottom: 8, left: 8, right: 8 };

        // Amount cell in QTY column (right-aligned)
        const subtotalAmountCell = worksheet.getCell(`C${row}`);
        subtotalAmountCell.value = this.formatNumber(item.totalAmount);
        subtotalAmountCell.font = { bold: true, name: 'Arial', size: 13 };
        subtotalAmountCell.alignment = { horizontal: 'right', vertical: 'middle' };
        subtotalAmountCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFCFCFCF' } // #cfcfcf
        };
        subtotalAmountCell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
        };
        subtotalAmountCell.padding = { top: 8, bottom: 8, left: 8, right: 8 };
        
        // Set row height for padding
        worksheet.getRow(row).height = 20;
        worksheet.getCell(`D${row}`).alignment = { horizontal: 'right' };
        worksheet.getCell(`D${row}`).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFB4B4B4' }
        };
        worksheet.getCell(`D${row}`).border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };

        // Add images if present (after subtotal, before footer)
        console.log(`Excel Item Detail - Item "${item.description}" has ${item.images ? item.images.length : 0} images`);
        if (item.images && item.images.length > 0) {
            console.log(`Adding ${item.images.length} images to Excel for item "${item.description}"`);
            row += 2; // Add some spacing after subtotal
            this.addItemImagesToExcel(workbook, worksheet, item.images, row);
        }

        // Page footer exactly like PDF
        row = Math.max(row, 55);
        worksheet.mergeCells(`A${row}:E${row}`);
        const currentPageNumber = index + 3;
        const hierarchicalItems = this.parseHierarchicalItems(quotationData.items || []);
        const totalPages = this.calculateTotalPages(hierarchicalItems);
        worksheet.getCell(`A${row}`).value = `Page ${currentPageNumber} of ${totalPages}`;
        worksheet.getCell(`A${row}`).alignment = { horizontal: 'right' };
        worksheet.getCell(`A${row}`).font = { name: 'Calibri', size: 10 };
    }

    // Helper method to add multiple item images to Excel
    addItemImagesToExcel(workbook, worksheet, images, startRow) {
        try {
            // Validate images array
            if (!images || !Array.isArray(images) || images.length === 0) {
                console.log('No valid images to add to Excel');
                return;
            }

            // Filter out invalid images
            const validImages = images.filter(img => {
                if (!img || typeof img !== 'string') {
                    console.warn('Invalid image data found, skipping');
                    return false;
                }
                // Check if it's a valid base64 image
                if (!img.startsWith('data:image/')) {
                    console.warn('Invalid image format, skipping');
                    return false;
                }
                return true;
            });

            if (validImages.length === 0) {
                console.log('No valid images after filtering');
                return;
            }

            let currentRow = startRow;
            const imagesPerRow = 2; // 2 images per row max
            const imageWidth = 80; // Width in Excel units
            const imageHeight = 60; // Height in Excel units
            const spacing = 10; // Spacing between images

            validImages.forEach((imageData, index) => {
                try {
                    // Determine image format and extract base64 data
                    let imageFormat = 'png';
                    let base64Data = imageData;

                    if (imageData.includes('data:image/png')) {
                        imageFormat = 'png';
                        base64Data = imageData.split(',')[1];
                    } else if (imageData.includes('data:image/jpeg') || imageData.includes('data:image/jpg')) {
                        imageFormat = 'jpeg';
                        base64Data = imageData.split(',')[1];
                    } else if (imageData.includes('data:image/gif')) {
                        imageFormat = 'gif';
                        base64Data = imageData.split(',')[1];
                    } else {
                        // Try to extract base64 data anyway
                        const parts = imageData.split(',');
                        if (parts.length > 1) {
                            base64Data = parts[1];
                        }
                    }

                    // Convert base64 to buffer
                    const imageBuffer = Buffer.from(base64Data, 'base64');

                    // Add image to workbook
                    const imageId = workbook.addImage({
                        buffer: imageBuffer,
                        extension: imageFormat
                    });

                    // Calculate position
                    const colIndex = (index % imagesPerRow); // 0 or 1
                    const rowOffset = Math.floor(index / imagesPerRow); // Which row of images
                    const actualRow = currentRow + rowOffset;
                    const col = colIndex === 0 ? 0.2 : 2.5; // Column A or C

                    // Add image to worksheet
                    worksheet.addImage(imageId, {
                        tl: { col: col, row: actualRow - 0.2 },
                        ext: { width: imageWidth, height: imageHeight }
                    });

                    console.log(`Successfully added image ${index + 1} to Excel at row ${actualRow}, col ${col}`);
                } catch (error) {
                    console.error(`Error adding image ${index + 1} to Excel:`, error.message);
                    // Continue with next image instead of failing completely
                }
            });

            // Adjust row height to accommodate images
            const rowsNeeded = Math.ceil(validImages.length / imagesPerRow);
            for (let i = 0; i < rowsNeeded; i++) {
                worksheet.getRow(startRow + i).height = imageHeight * 0.75; // Adjust row height
            }
        } catch (error) {
            console.error('Error adding images to Excel:', error);
        }
    }

    async exportBOMToExcel(quotationData) {
        try {
            const workbook = new ExcelJS.Workbook();
            
            // Generate BOM data
            const bomData = this.generateBillOfMaterials(quotationData);
            
            // Check if this is a revision
            const isRevision = quotationData.isRevision || false;
            let quoteRef = quotationData.quoteRef || `PQ${moment().format('YYYYMMDD_HHmmss')}`;
            let baseRef = quoteRef;
            
            // If it's a revision, extract the base reference (without -REV#)
            if (isRevision) {
                baseRef = quoteRef.split('-REV')[0];
            }
            
            // Create folder structure using base reference
            const folderStructure = this.createPQFolderStructure(baseRef);
            
            // Determine the target directory based on whether it's a revision
            // For revisions, use the base PQ folder + 'Revision' subfolder
            // For new quotations, use the standard BOM Excel folder
            let targetDir = isRevision 
                ? path.join(folderStructure.pqFolderPath, 'Revision') 
                : folderStructure.bomExcelPath;
            
            // Create the directory if it doesn't exist
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }
            
            // Create BOM worksheet
            const worksheet = workbook.addWorksheet('Bill of Materials');
            
            // Set column widths - optimized for A4 landscape
            worksheet.columns = [
                { width: 8 },   // Column A - #
                { width: 60 },  // Column B - Material Description
                { width: 12 },  // Column C - Unit
                { width: 15 }   // Column D - Total Quantity
            ];
            
            let currentRow = 1;
            
            // Add logo in top-right corner
            try {
                const logoPath = path.join(__dirname, '..', '..', 'penta logo.png');
                console.log('BOM Excel - Looking for logo at:', logoPath);
                if (fs.existsSync(logoPath)) {
                    const imageId = workbook.addImage({
                        filename: logoPath,
                        extension: 'png',
                    });
                    worksheet.addImage(imageId, {
                        tl: { col: 3.2, row: 0.2 },
                        ext: { width: 120, height: 60 }
                    });
                    console.log('BOM Excel - Logo added successfully');
                } else {
                    console.warn('BOM Excel - Logo file not found at:', logoPath);
                }
            } catch (logoError) {
                console.error('Could not add logo to BOM Excel:', logoError.message);
            }
            
            // Header section - Quote reference, price, and date
            worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
            worksheet.getCell(`A${currentRow}`).value = quotationData.quoteRef || 'PQ25070025';
            worksheet.getCell(`A${currentRow}`).font = { name: 'Calibri', size: 10 };
            currentRow++;
            
            worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
            worksheet.getCell(`A${currentRow}`).value = `PRICE: ${quotationData.pricing?.currency || 'AED'}`;
            worksheet.getCell(`A${currentRow}`).font = { name: 'Calibri', size: 10 };
            currentRow++;
            
            worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
            worksheet.getCell(`A${currentRow}`).value = quotationData.date || moment().format('DD.MM.YYYY');
            worksheet.getCell(`A${currentRow}`).font = { name: 'Calibri', size: 10 };
            currentRow += 2;
            
            // Title - BILL OF MATERIALS
            worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
            worksheet.getCell(`A${currentRow}`).value = 'BILL OF MATERIALS';
            worksheet.getCell(`A${currentRow}`).font = { name: 'Calibri', size: 14, bold: true };
            worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' };
            worksheet.getRow(currentRow).height = 25;
            currentRow += 2;
            
            // Description paragraph
            const descText = 'The following table shows the consolidated quantity of materials required across all items in this quotation:';
            worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
            worksheet.getCell(`A${currentRow}`).value = descText;
            worksheet.getCell(`A${currentRow}`).font = { name: 'Calibri', size: 9 };
            worksheet.getCell(`A${currentRow}`).alignment = { wrapText: true, vertical: 'middle', horizontal: 'left' };
            worksheet.getRow(currentRow).height = 30;
            currentRow += 2;
            
            // Table headers
            const headers = ['#', 'Material Description', 'Unit', 'Total Quantity'];
            headers.forEach((header, colIndex) => {
                const cell = worksheet.getCell(currentRow, colIndex + 1);
                cell.value = header;
                cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF808080' } // Dark gray
                };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });
            worksheet.getRow(currentRow).height = 20;
            currentRow++;
            
            // Add data rows
            const dataStartRow = currentRow;
            if (bomData && bomData.length > 0) {
                bomData.forEach((item, index) => {
                    const row = worksheet.getRow(currentRow);
                    
                    // Set values
                    row.getCell(1).value = index + 1; // #
                    row.getCell(2).value = item.partName || ''; // Material Description
                    row.getCell(3).value = item.unit || 'NOS'; // Unit
                    row.getCell(4).value = item.totalQuantity || 0; // Total Quantity
                    
                    // Style and format each cell
                    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
                    row.getCell(1).font = { name: 'Calibri', size: 9 };
                    
                    row.getCell(2).alignment = { wrapText: true, vertical: 'middle', horizontal: 'left' };
                    row.getCell(2).font = { name: 'Calibri', size: 9 };
                    
                    row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
                    row.getCell(3).font = { name: 'Calibri', size: 9 };
                    
                    row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
                    row.getCell(4).font = { name: 'Calibri', size: 9 };
                    
                    // Add borders to all cells
                    [1, 2, 3, 4].forEach(col => {
                        row.getCell(col).border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' }
                        };
                        
                        // Alternate row colors for better readability
                        if (index % 2 === 0) {
                            row.getCell(col).fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFF5F5F5' } // Light gray for even rows
                            };
                        }
                    });
                    
                    row.height = 20; // Set row height
                    currentRow++;
                });
            } else {
                // No data message
                const row = worksheet.getRow(currentRow);
                worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
                row.getCell(1).value = 'No materials found in this quotation.';
                row.getCell(1).font = { name: 'Calibri', size: 10, italic: true };
                row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
                currentRow++;
            }
            
            // Material Summary section with gray background
            const summaryStartRow = currentRow;
            worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
            worksheet.getCell(`A${currentRow}`).value = 'MATERIAL SUMMARY:';
            worksheet.getCell(`A${currentRow}`).font = { name: 'Calibri', size: 11, bold: true };
            worksheet.getCell(`A${currentRow}`).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF0F0F0' }
            };
            worksheet.getRow(currentRow).height = 20;
            currentRow++;
            
            const totalUnique = bomData ? bomData.length : 0;
            const totalQuantity = bomData ? bomData.reduce((sum, item) => sum + (item.totalQuantity || 0), 0) : 0;
            
            worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
            worksheet.getCell(`A${currentRow}`).value = `• Total unique materials: ${totalUnique}`;
            worksheet.getCell(`A${currentRow}`).font = { name: 'Calibri', size: 10 };
            worksheet.getCell(`A${currentRow}`).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF0F0F0' }
            };
            currentRow++;
            
            worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
            worksheet.getCell(`A${currentRow}`).value = `• Total quantity of all materials: ${totalQuantity}`;
            worksheet.getCell(`A${currentRow}`).font = { name: 'Calibri', size: 10 };
            worksheet.getCell(`A${currentRow}`).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF0F0F0' }
            };
            currentRow += 2;
            
            // Note about material consolidation
            worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
            worksheet.getCell(`A${currentRow}`).value = 'Note: This Bill of Materials consolidates identical materials across all items, showing the total quantity required for the entire project.';
            worksheet.getCell(`A${currentRow}`).font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF646464' } };
            worksheet.getCell(`A${currentRow}`).alignment = { wrapText: true, vertical: 'top' };
            worksheet.getRow(currentRow).height = 30;
            currentRow += 2;
            
            // Footer - Company information
            worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
            worksheet.getCell(`A${currentRow}`).value = 'PENTA For Hospitals and Schools Furniture Manufacturing L.L.C., Ajman, UAE';
            worksheet.getCell(`A${currentRow}`).font = { name: 'Calibri', size: 9 };
            worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' };
            currentRow++;
            
            worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
            worksheet.getCell(`A${currentRow}`).value = 'Tel : +971 6 563 2822, Email: info@penta-indust.com, www.penta-indust.com';
            worksheet.getCell(`A${currentRow}`).font = { name: 'Calibri', size: 9 };
            worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' };
            currentRow++;
            
            // Page number
            worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
            worksheet.getCell(`A${currentRow}`).value = 'Page 1 of 1';
            worksheet.getCell(`A${currentRow}`).font = { name: 'Calibri', size: 9 };
            worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'right', vertical: 'middle' };
            
            // Configure page setup for A4 single page - force everything onto 1 page
            worksheet.pageSetup = {
                paperSize: 9, // A4
                orientation: 'landscape',
                fitToPage: true,
                fitToWidth: 1,
                fitToHeight: 1,
                margins: {
                    left: 0.5,
                    right: 0.5,
                    top: 0.5,
                    bottom: 0.5,
                    header: 0.3,
                    footer: 0.3
                },
                horizontalCentered: true,
                verticalCentered: false
            };
            
            // Show gridlines
            worksheet.views = [
                { showGridLines: true }
            ];
            
            // Use the variables already declared at the beginning of the method
            
            // Generate filename with full reference (including -REV# if present)
            const filename = `bom_${quoteRef}.xlsx`;
            
            // Save to the appropriate folder
            const filePath = path.join(targetDir, filename);
            await workbook.xlsx.writeFile(filePath);
            console.log(`BOM Excel file exported: ${filePath}`);
            
            // Also save to the main BOM folder for backward compatibility
            const oldFilePath = path.join(this.bomExcelPath, filename);
            await workbook.xlsx.writeFile(oldFilePath);
            
            return filePath;
        } catch (error) {
            console.error('Error exporting BOM to Excel:', error);
            throw error;
        }
    }
}

module.exports = new ExportService();
