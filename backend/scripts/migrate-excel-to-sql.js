const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class ExcelToSqlMigrator {
    constructor() {
        this.databasePath = path.join(__dirname, '..', 'database.xlsx');
        this.pricelistPath = path.join(__dirname, '..', 'pricelist.xlsx');
        this.quotationPath = path.join(__dirname, '..', 'quotation_generated.xlsx');
    }

    async migrate() {
        console.log('Starting Excel to SQL migration...');

        try {
            // Run migrations first
            await db.migrate.latest();
            console.log('Database migrations completed');

            // Migrate products from database.xlsx
            await this.migrateProducts();

            // Migrate pricelist items (if they exist)
            await this.migratePricelist();

            // Migrate quotation tracking data (if it exists)
            await this.migrateQuotationTracking();

            console.log('Migration completed successfully!');
        } catch (error) {
            console.error('Migration failed:', error);
            throw error;
        } finally {
            await db.destroy();
        }
    }

    async migrateProducts() {
        if (!fs.existsSync(this.databasePath)) {
            console.log('No database.xlsx found, skipping products migration');
            return;
        }

        try {
            console.log('Migrating products from database.xlsx...');
            
            const workbook = XLSX.readFile(this.databasePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(worksheet);

            if (data.length === 0) {
                console.log('No products found in Excel file');
                return;
            }

            // Clear existing products
            await db('products').del();

            const products = data.map((row, index) => ({
                id: row.ID || row.id || `prod_${uuidv4()}`,
                itemCode: row['Item Code'] || row['ITEM CODE'] || row.itemCode || `ITEM-${index + 1}`,
                description: row['Description'] || row['DESCRIPTION'] || row.description || row['Item Description'] || '',
                category: row['Category'] || row['CATEGORY'] || row.category || 'General',
                subcategory: row['Subcategory'] || row['SUB CATEGORY'] || row.subcategory || '',
                unit: row['Unit'] || row['UNIT'] || row.unit || 'NOS',
                unitPrice: parseFloat(row['Unit Price'] || row['UNIT PRICE'] || row.unitPrice || row['Price'] || 0),
                currency: row['Currency'] || row['CURRENCY'] || row.currency || 'AED',
                specifications: row['Specifications'] || row['SPECS'] || row.specifications || '',
                dimensions: row['Dimensions'] || row['SIZE'] || row.dimensions || '',
                material: row['Material'] || row['MATERIAL'] || row.material || '',
                brand: row['Brand'] || row['BRAND'] || row.brand || 'PENTA',
                warranty: row['Warranty'] || row['WARRANTY'] || row.warranty || '1 Year',
                availability: row['Availability'] || row['STOCK'] || row.availability || 'Available'
            }));

            await db('products').insert(products);
            console.log(`Migrated ${products.length} products`);

        } catch (error) {
            console.error('Error migrating products:', error);
        }
    }

    async migratePricelist() {
        if (!fs.existsSync(this.pricelistPath)) {
            console.log('No pricelist.xlsx found, skipping pricelist migration');
            return;
        }

        try {
            console.log('Processing pricelist.xlsx...');
            
            const workbook = XLSX.readFile(this.pricelistPath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(worksheet);

            if (data.length === 0) {
                console.log('No pricelist items found in Excel file');
                return;
            }

            // Convert pricelist items to products if they don't already exist
            const pricelistProducts = [];
            
            for (let i = 0; i < data.length; i++) {
                const row = data[i];
                const itemCode = row['Item Code'] || row['ITEM CODE'] || row.itemCode || `PRICE-${i + 1}`;
                
                // Check if product already exists
                const existingProduct = await db('products').where({ itemCode }).first();
                
                if (!existingProduct) {
                    pricelistProducts.push({
                        id: `price_${uuidv4()}`,
                        itemCode: itemCode,
                        description: row['Description'] || row['DESCRIPTION'] || row.description || '',
                        category: row['Category'] || row['CATEGORY'] || row.category || 'Pricelist Item',
                        subcategory: row['Subcategory'] || row['SUB CATEGORY'] || row.subcategory || '',
                        unit: row['Unit'] || row['UNIT'] || row.unit || 'NOS',
                        unitPrice: parseFloat(row['Unit Price'] || row['UNIT PRICE'] || row.unitPrice || row['Price'] || 0),
                        currency: row['Currency'] || row['CURRENCY'] || row.currency || 'AED',
                        specifications: row['Specifications'] || row['SPECS'] || row.specifications || '',
                        dimensions: row['Dimensions'] || row['SIZE'] || row.dimensions || '',
                        material: row['Material'] || row['MATERIAL'] || row.material || '',
                        brand: row['Brand'] || row['BRAND'] || row.brand || 'PENTA',
                        warranty: row['Warranty'] || row['WARRANTY'] || row.warranty || '1 Year',
                        availability: row['Availability'] || row['STOCK'] || row.availability || 'Available'
                    });
                }
            }

            if (pricelistProducts.length > 0) {
                await db('products').insert(pricelistProducts);
                console.log(`Migrated ${pricelistProducts.length} pricelist items as products`);
            }

        } catch (error) {
            console.error('Error migrating pricelist:', error);
        }
    }

    async migrateQuotationTracking() {
        if (!fs.existsSync(this.quotationPath)) {
            console.log('No quotation_generated.xlsx found, skipping quotation tracking migration');
            return;
        }

        try {
            console.log('Processing quotation tracking data...');
            
            const workbook = XLSX.readFile(this.quotationPath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(worksheet);

            if (data.length === 0) {
                console.log('No quotation tracking data found');
                return;
            }

            const quotations = [];
            
            for (let i = 0; i < data.length; i++) {
                const row = data[i];
                
                // Extract quotation data
                const quotationNumber = row['Quotation Number'] || row['QUOTATION NUMBER'] || row.quotationNumber;
                if (!quotationNumber) continue;

                quotations.push({
                    id: uuidv4(),
                    quotationNumber: quotationNumber,
                    clientName: row['Client Name'] || row['CLIENT NAME'] || row.clientName || 'Unknown Client',
                    clientEmail: row['Client Email'] || row['EMAIL'] || row.clientEmail || '',
                    clientPhone: row['Client Phone'] || row['PHONE'] || row.clientPhone || '',
                    clientAddress: row['Client Address'] || row['ADDRESS'] || row.clientAddress || '',
                    projectName: row['Project Name'] || row['PROJECT'] || row.projectName || '',
                    quotationDate: this.parseExcelDate(row['Quotation Date'] || row['DATE'] || row.quotationDate),
                    validUntil: this.parseExcelDate(row['Valid Until'] || row['VALID UNTIL'] || row.validUntil),
                    subtotal: parseFloat(row['Subtotal'] || row['SUB TOTAL'] || row.subtotal || 0),
                    vatRate: parseFloat(row['VAT Rate'] || row['VAT RATE'] || row.vatRate || 5),
                    vatAmount: parseFloat(row['VAT Amount'] || row['VAT AMOUNT'] || row.vatAmount || 0),
                    totalAmount: parseFloat(row['Total Amount'] || row['TOTAL AMOUNT'] || row.totalAmount || 0),
                    status: row['Status'] || row['STATUS'] || row.status || 'Draft',
                    terms: row['Terms'] || row['TERMS'] || row.terms || '',
                    notes: row['Notes'] || row['NOTES'] || row.notes || ''
                });
            }

            if (quotations.length > 0) {
                // Clear existing quotations
                await db('quotations').del();
                await db('quotations').insert(quotations);
                console.log(`Migrated ${quotations.length} quotation records`);
            }

        } catch (error) {
            console.error('Error migrating quotation tracking:', error);
        }
    }

    parseExcelDate(dateValue) {
        if (!dateValue) return null;
        
        // If it's already a valid date string, return it
        if (typeof dateValue === 'string' && dateValue.match(/^\d{4}-\d{2}-\d{2}/)) {
            return dateValue;
        }
        
        // If it's an Excel serial number
        if (typeof dateValue === 'number') {
            const date = new Date((dateValue - 25569) * 86400 * 1000);
            return date.toISOString().split('T')[0];
        }
        
        // Try to parse as date
        try {
            const date = new Date(dateValue);
            if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0];
            }
        } catch (e) {
            // Ignore parsing errors
        }
        
        return null;
    }
}

// Run migration if called directly
if (require.main === module) {
    const migrator = new ExcelToSqlMigrator();
    migrator.migrate()
        .then(() => {
            console.log('Migration script completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration script failed:', error);
            process.exit(1);
        });
}

module.exports = ExcelToSqlMigrator;