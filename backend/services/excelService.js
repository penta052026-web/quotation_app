const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

class ExcelService {
    constructor() {
        this.dbPath = path.join(__dirname, '..', 'database.xlsx');
        this.products = [];
        this.loadProducts();
    }

    async loadProducts() {
        try {
            if (!fs.existsSync(this.dbPath)) {
                console.log('Database file not found, creating sample data...');
                await this.createSampleDatabase();
                return;
            }

            const workbook = XLSX.readFile(this.dbPath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            // Convert to JSON
            const data = XLSX.utils.sheet_to_json(worksheet);
            
            // Transform data to match our product structure
            this.products = data.map((row, index) => ({
                id: row.ID || `prod_${index + 1}`,
                itemCode: row['Item Code'] || row['ITEM CODE'] || `ITEM-${index + 1}`,
                description: row['Description'] || row['DESCRIPTION'] || row['Item Description'] || '',
                category: row['Category'] || row['CATEGORY'] || 'General',
                subcategory: row['Subcategory'] || row['SUB CATEGORY'] || '',
                unit: row['Unit'] || row['UNIT'] || 'NOS',
                unitPrice: parseFloat(row['Unit Price'] || row['UNIT PRICE'] || row['Price'] || 0),
                currency: row['Currency'] || row['CURRENCY'] || 'AED',
                specifications: row['Specifications'] || row['SPECS'] || '',
                dimensions: row['Dimensions'] || row['SIZE'] || '',
                material: row['Material'] || row['MATERIAL'] || '',
                brand: row['Brand'] || row['BRAND'] || 'PENTA',
                warranty: row['Warranty'] || row['WARRANTY'] || '1 Year',
                availability: row['Availability'] || row['STOCK'] || 'Available'
            }));

            console.log(`Loaded ${this.products.length} products from database`);
        } catch (error) {
            console.error('Error loading products from Excel:', error);
            await this.createSampleDatabase();
        }
    }

    async createSampleDatabase() {
        // Create sample data based on the PDF reference
        const sampleProducts = [
            {
                id: 'prod_1',
                itemCode: 'PHYS-TT-001',
                description: 'PHYSICS TEACHER TABLE : W 2180 X D 750 X H 900 MM',
                category: 'Physics Lab',
                subcategory: 'Teacher Furniture',
                unit: 'NOS',
                unitPrice: 6766,
                currency: 'AED',
                specifications: 'HPL worktop 13mm thick, powder-coated frame',
                dimensions: '2180 x 750 x 900 mm',
                material: 'HPL/Steel',
                brand: 'PENTA',
                warranty: '1 Year',
                availability: 'Available'
            },
            {
                id: 'prod_2',
                itemCode: 'PHYS-IB-001',
                description: 'PHYSICS ISLAND BENCH : W 3080 X D 750 X H 900 MM',
                category: 'Physics Lab',
                subcategory: 'Student Furniture',
                unit: 'NOS',
                unitPrice: 7519,
                currency: 'AED',
                specifications: 'HPL worktop 13mm thick, suspended cabinets',
                dimensions: '3080 x 750 x 900 mm',
                material: 'HPL/Steel/MDF',
                brand: 'PENTA',
                warranty: '1 Year',
                availability: 'Available'
            },
            {
                id: 'prod_3',
                itemCode: 'STOR-CAB-001',
                description: 'TALL STORAGE CABINET WITH PANEL DOOR 1000X420X2100MM',
                category: 'Storage',
                subcategory: 'Cabinets',
                unit: 'NOS',
                unitPrice: 1515,
                currency: 'AED',
                specifications: 'Melamine MDF construction with panel doors',
                dimensions: '1000 x 420 x 2100 mm',
                material: 'Melamine MDF',
                brand: 'PENTA',
                warranty: '1 Year',
                availability: 'Available'
            },
            {
                id: 'prod_4',
                itemCode: 'CHEM-TT-001',
                description: 'CHEMISTRY LAB TEACHER TABLE : W 2180 X D 750 X H 900 MM',
                category: 'Chemistry Lab',
                subcategory: 'Teacher Furniture',
                unit: 'NOS',
                unitPrice: 8806,
                currency: 'AED',
                specifications: 'Phenolic chemical resistance worktop 16mm thick',
                dimensions: '2180 x 750 x 900 mm',
                material: 'Phenolic/Steel',
                brand: 'PENTA',
                warranty: '10 Years for worktop, 1 Year for other items',
                availability: 'Available'
            },
            {
                id: 'prod_5',
                itemCode: 'FUME-CUP-001',
                description: 'FUME CUPBOARD 1200 MM',
                category: 'Chemistry Lab',
                subcategory: 'Safety Equipment',
                unit: 'NOS',
                unitPrice: 25000,
                currency: 'AED',
                specifications: 'Complete fume cupboard with ventilation system',
                dimensions: '1200 x 750 x 2100 mm',
                material: 'Chemical resistant materials',
                brand: 'PENTA',
                warranty: '1 Year',
                availability: 'Available'
            },
            {
                id: 'prod_6',
                itemCode: 'CHAIR-TCH-001',
                description: 'TEACHER CHAIR',
                category: 'Seating',
                subcategory: 'Chairs',
                unit: 'NOS',
                unitPrice: 400,
                currency: 'AED',
                specifications: 'Ergonomic teacher chair with adjustable height',
                dimensions: 'Standard office chair dimensions',
                material: 'Fabric/Steel',
                brand: 'PENTA',
                warranty: '1 Year',
                availability: 'Available'
            },
            {
                id: 'prod_7',
                itemCode: 'STOOL-STU-001',
                description: 'STUDENT STOOL',
                category: 'Seating',
                subcategory: 'Stools',
                unit: 'NOS',
                unitPrice: 250,
                currency: 'AED',
                specifications: 'Laboratory stool with footrest',
                dimensions: 'Standard laboratory stool',
                material: 'Plastic/Steel',
                brand: 'PENTA',
                warranty: '1 Year',
                availability: 'Available'
            }
        ];

        this.products = sampleProducts;
        await this.saveProducts();
    }

    async saveProducts() {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Products');

            // Add headers
            worksheet.columns = [
                { header: 'ID', key: 'id', width: 15 },
                { header: 'Item Code', key: 'itemCode', width: 15 },
                { header: 'Description', key: 'description', width: 50 },
                { header: 'Category', key: 'category', width: 20 },
                { header: 'Subcategory', key: 'subcategory', width: 20 },
                { header: 'Unit', key: 'unit', width: 10 },
                { header: 'Unit Price', key: 'unitPrice', width: 15 },
                { header: 'Currency', key: 'currency', width: 10 },
                { header: 'Specifications', key: 'specifications', width: 40 },
                { header: 'Dimensions', key: 'dimensions', width: 25 },
                { header: 'Material', key: 'material', width: 20 },
                { header: 'Brand', key: 'brand', width: 15 },
                { header: 'Warranty', key: 'warranty', width: 20 },
                { header: 'Availability', key: 'availability', width: 15 }
            ];

            // Add data
            this.products.forEach(product => {
                worksheet.addRow(product);
            });

            // Style the header row
            worksheet.getRow(1).font = { bold: true };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };

            await workbook.xlsx.writeFile(this.dbPath);
            console.log('Products saved to database');
        } catch (error) {
            console.error('Error saving products:', error);
            throw error;
        }
    }

    async getAllProducts() {
        return this.products;
    }

    async getProductById(id) {
        return this.products.find(product => product.id === id);
    }

    async searchProducts(query) {
        if (!query) return this.products;
        
        const searchQuery = query.toLowerCase();
        return this.products.filter(product => 
            product.description.toLowerCase().includes(searchQuery) ||
            product.itemCode.toLowerCase().includes(searchQuery) ||
            product.category.toLowerCase().includes(searchQuery) ||
            product.material.toLowerCase().includes(searchQuery)
        );
    }

    async addProduct(productData) {
        const newProduct = {
            id: uuidv4(),
            ...productData,
            unitPrice: parseFloat(productData.unitPrice) || 0
        };
        
        this.products.push(newProduct);
        await this.saveProducts();
        return newProduct;
    }

    async updateProduct(id, productData) {
        const index = this.products.findIndex(product => product.id === id);
        if (index === -1) {
            throw new Error('Product not found');
        }

        this.products[index] = {
            ...this.products[index],
            ...productData,
            unitPrice: parseFloat(productData.unitPrice) || this.products[index].unitPrice
        };

        await this.saveProducts();
        return this.products[index];
    }

    async getProductsByCategory(category) {
        return this.products.filter(product => 
            product.category.toLowerCase() === category.toLowerCase()
        );
    }

    async getCategories() {
        const categories = [...new Set(this.products.map(product => product.category))];
        return categories.sort();
    }
}

module.exports = new ExcelService();
