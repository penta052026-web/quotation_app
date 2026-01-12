const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const moment = require('moment');

class QuotationTracker {
    constructor() {
        this.filePath = path.join(__dirname, '..', 'quotation_generated.xlsx');
        this.sheetName = 'Generated Quotations';
        this.ensureFileExists();
    }

    async ensureFileExists() {
        try {
            if (!fs.existsSync(this.filePath)) {
                await this.createInitialFile();
            }
        } catch (error) {
            console.error('Error ensuring quotation tracker file exists:', error);
            throw error;
        }
    }

    async createInitialFile() {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet(this.sheetName);

            // Define headers
            const headers = [
                'Quotation Number',
                'Client ID', 
                'Client Name',
                'Total Price',
                'Currency',
                'Generated Date',
                'Generated Time',
                'Project Name',
                'Status'
            ];

            // Add headers with styling
            const headerRow = worksheet.addRow(headers);
            headerRow.font = { bold: true, size: 12 };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE6F3FF' }
            };

            // Set column widths
            worksheet.getColumn(1).width = 20; // Quotation Number
            worksheet.getColumn(2).width = 15; // Client ID
            worksheet.getColumn(3).width = 30; // Client Name
            worksheet.getColumn(4).width = 15; // Total Price
            worksheet.getColumn(5).width = 10; // Currency
            worksheet.getColumn(6).width = 15; // Generated Date
            worksheet.getColumn(7).width = 15; // Generated Time
            worksheet.getColumn(8).width = 30; // Project Name
            worksheet.getColumn(9).width = 12; // Status

            // Add borders to headers
            headerRow.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });

            // Freeze the header row
            worksheet.views = [
                { state: 'frozen', ySplit: 1 }
            ];

            await workbook.xlsx.writeFile(this.filePath);
            console.log('Quotation tracker file created:', this.filePath);
        } catch (error) {
            console.error('Error creating initial quotation tracker file:', error);
            throw error;
        }
    }

    async addQuotationRecord(quotationData) {
        try {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(this.filePath);
            
            let worksheet = workbook.getWorksheet(this.sheetName);
            if (!worksheet) {
                worksheet = workbook.addWorksheet(this.sheetName);
                // Re-add headers if worksheet was missing
                const headers = [
                    'Quotation Number', 'Client ID', 'Client Name', 'Total Price', 
                    'Currency', 'Generated Date', 'Generated Time', 'Project Name', 'Status'
                ];
                const headerRow = worksheet.addRow(headers);
                headerRow.font = { bold: true };
            }

            // Generate a unique client ID if not provided
            const clientId = this.generateClientId(quotationData.clientInfo?.name || 'Unknown');

            // Determine the final price to store (discounted price if discount applied, otherwise total)
            const finalPrice = quotationData.pricing?.discountedPrice && quotationData.pricing?.discountedPrice > 0 
                ? quotationData.pricing.discountedPrice 
                : quotationData.pricing?.totalAmount || 0;

            const newRow = [
                quotationData.quoteRef || '',
                clientId,
                quotationData.clientInfo?.name || '',
                finalPrice,
                quotationData.pricing?.currency || 'AED',
                moment().format('DD/MM/YYYY'),
                moment().format('HH:mm:ss'),
                quotationData.projectInfo?.name || '',
                'Generated'
            ];

            const addedRow = worksheet.addRow(newRow);
            
            // Add styling to the new row
            addedRow.eachCell((cell, colNumber) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
                
                // Format price column
                if (colNumber === 4) { // Total Price column
                    cell.numFmt = '#,##0.00';
                }
                
                // Center align certain columns
                if ([2, 5, 6, 7, 9].includes(colNumber)) { // Client ID, Currency, Date, Time, Status
                    cell.alignment = { horizontal: 'center' };
                }
            });

            await workbook.xlsx.writeFile(this.filePath);
            
            console.log(`Quotation record added: ${quotationData.quoteRef} for ${quotationData.clientInfo?.name}`);
            
            return {
                success: true,
                clientId: clientId,
                message: 'Quotation record added successfully'
            };
        } catch (error) {
            console.error('Error adding quotation record:', error);
            throw error;
        }
    }

    generateClientId(clientName) {
        if (!clientName || clientName === 'Unknown') {
            return `CLI${moment().format('YYYYMMDD')}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
        }
        
        // Generate client ID from name initials + date + random number
        const initials = clientName.split(' ')
            .map(word => word.charAt(0))
            .join('')
            .toUpperCase()
            .substring(0, 3);
            
        const dateStr = moment().format('MMDD');
        const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
        
        return `${initials}${dateStr}${random}`;
    }

    async getQuotationRecords() {
        try {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(this.filePath);
            
            const worksheet = workbook.getWorksheet(this.sheetName);
            if (!worksheet) {
                return [];
            }

            const records = [];
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; // Skip header row
                
                const values = row.values;
                if (values && values.length > 1) {
                    records.push({
                        quotationNumber: values[1],
                        clientId: values[2],
                        clientName: values[3],
                        totalPrice: values[4],
                        currency: values[5],
                        generatedDate: values[6],
                        generatedTime: values[7],
                        projectName: values[8],
                        status: values[9]
                    });
                }
            });

            return records;
        } catch (error) {
            console.error('Error reading quotation records:', error);
            return [];
        }
    }

    async checkQuotationExists(quotationNumber) {
        try {
            const records = await this.getQuotationRecords();
            return records.some(record => record.quotationNumber === quotationNumber);
        } catch (error) {
            console.error('Error checking quotation existence:', error);
            return false;
        }
    }

    async updateQuotationStatus(quotationNumber, status) {
        try {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(this.filePath);
            
            const worksheet = workbook.getWorksheet(this.sheetName);
            if (!worksheet) {
                throw new Error('Quotation tracking worksheet not found');
            }

            let updated = false;
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; // Skip header row
                
                const quotationCell = row.getCell(1);
                if (quotationCell.value === quotationNumber) {
                    const statusCell = row.getCell(9);
                    statusCell.value = status;
                    updated = true;
                }
            });

            if (updated) {
                await workbook.xlsx.writeFile(this.filePath);
                console.log(`Updated quotation ${quotationNumber} status to: ${status}`);
                return true;
            }

            return false;
        } catch (error) {
            console.error('Error updating quotation status:', error);
            return false;
        }
    }

    getFilePath() {
        return this.filePath;
    }
}

module.exports = new QuotationTracker();
