const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

class PricelistService {
    constructor() {
        this.pricelistPath = path.join(__dirname, '..', 'pricelist.xlsx');
        this.pricelistItems = [];
        this.loadPricelist();
    }

    async loadPricelist() {
        try {
            if (!fs.existsSync(this.pricelistPath)) {
                console.log('Pricelist file not found, creating sample data...');
                await this.createSamplePricelist();
                return;
            }

            const workbook = XLSX.readFile(this.pricelistPath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            // Get both column A (description) and column B (price) data
            const range = XLSX.utils.decode_range(worksheet['!ref']);
            const pricelistData = [];
            
            // Read columns A and B from row 1 to the last row
            for (let row = range.s.r; row <= range.e.r; row++) {
                const descriptionCell = worksheet[XLSX.utils.encode_cell({ r: row, c: 0 })];
                const priceCell = worksheet[XLSX.utils.encode_cell({ r: row, c: 1 })];
                
                if (descriptionCell && descriptionCell.v) {
                    const description = descriptionCell.v.toString().trim();
                    if (description && description !== '' && description !== 'Description' && description !== 'Item') {
                        let price = 0;
                        if (priceCell && priceCell.v) {
                            price = parseFloat(priceCell.v) || 0;
                        }
                        pricelistData.push({ description, price });
                    }
                }
            }

            // Transform data to match our product structure
            this.pricelistItems = pricelistData.map((item, index) => ({
                id: `pricelist_${index + 1}`,
                itemCode: `PL-${String(index + 1).padStart(3, '0')}`,
                description: item.description,
                category: this.extractCategory(item.description),
                subcategory: this.extractSubcategory(item.description),
                unit: this.extractUnit(item.description),
                unitPrice: item.price || this.extractPrice(item.description),
                currency: 'AED',
                specifications: item.description,
                dimensions: this.extractDimensions(item.description),
                material: this.extractMaterial(item.description),
                brand: 'PENTA',
                warranty: '1 Year',
                availability: 'Available',
                source: 'pricelist'
            }));

            console.log(`Loaded ${this.pricelistItems.length} items from pricelist columns A (description) and B (price)`);
        } catch (error) {
            console.error('Error loading pricelist from Excel:', error);
            await this.createSamplePricelist();
        }
    }

    // Helper method to extract category from description
    extractCategory(description) {
        const desc = description.toLowerCase();
        
        if (desc.includes('physics') || desc.includes('phys')) return 'Physics Lab';
        if (desc.includes('chemistry') || desc.includes('chem')) return 'Chemistry Lab';
        if (desc.includes('biology') || desc.includes('bio')) return 'Biology Lab';
        if (desc.includes('fume') || desc.includes('cupboard')) return 'Safety Equipment';
        if (desc.includes('table') || desc.includes('bench')) return 'Furniture';
        if (desc.includes('chair') || desc.includes('stool')) return 'Seating';
        if (desc.includes('cabinet') || desc.includes('storage')) return 'Storage';
        if (desc.includes('sink') || desc.includes('tap')) return 'Plumbing';
        if (desc.includes('electrical') || desc.includes('power')) return 'Electrical';
        
        return 'General';
    }

    // Helper method to extract subcategory
    extractSubcategory(description) {
        const desc = description.toLowerCase();
        
        if (desc.includes('teacher')) return 'Teacher Furniture';
        if (desc.includes('student')) return 'Student Furniture';
        if (desc.includes('island')) return 'Island Benches';
        if (desc.includes('wall')) return 'Wall Benches';
        if (desc.includes('tall') && desc.includes('cabinet')) return 'Tall Storage';
        if (desc.includes('base') && desc.includes('cabinet')) return 'Base Cabinets';
        if (desc.includes('overhead') || desc.includes('wall cabinet')) return 'Wall Cabinets';
        
        return '';
    }

    // Helper method to extract unit from description
    extractUnit(description) {
        const desc = description.toLowerCase();
        
        if (desc.includes('linear') || desc.includes('lm') || desc.includes('l.m')) return 'LM';
        if (desc.includes('sqm') || desc.includes('sq.m') || desc.includes('square')) return 'SQM';
        if (desc.includes('pair') || desc.includes('pairs')) return 'PAIR';
        if (desc.includes('set') || desc.includes('sets')) return 'SET';
        if (desc.includes('meter') || desc.includes('metres') || desc.includes('mtr')) return 'MTR';
        
        return 'NOS';
    }

    // Helper method to extract price from description (if present)
    extractPrice(description) {
        // Look for price patterns like AED 1000, $500, etc.
        const priceMatch = description.match(/(?:AED|USD|\$|₹)\s*(\d+(?:,\d+)*(?:\.\d{2})?)/i);
        if (priceMatch) {
            return parseFloat(priceMatch[1].replace(/,/g, ''));
        }
        
        // Look for just numbers that might be prices
        const numberMatch = description.match(/\b(\d{3,}(?:,\d+)*(?:\.\d{2})?)\b/);
        if (numberMatch) {
            return parseFloat(numberMatch[1].replace(/,/g, ''));
        }
        
        return 0; // Default price
    }

    // Helper method to extract dimensions from description
    extractDimensions(description) {
        // Look for dimension patterns like 1200x600x900, W1200xD600xH900, etc.
        const dimensionPatterns = [
            /(\d+)\s*[xX×]\s*(\d+)\s*[xX×]\s*(\d+)\s*(?:mm|MM)?/,
            /W\s*(\d+)\s*[xX×]\s*D\s*(\d+)\s*[xX×]\s*H\s*(\d+)\s*(?:mm|MM)?/i,
            /(\d+)\s*mm\s*[xX×]\s*(\d+)\s*mm\s*[xX×]\s*(\d+)\s*mm/i
        ];
        
        for (const pattern of dimensionPatterns) {
            const match = description.match(pattern);
            if (match) {
                return `${match[1]} x ${match[2]} x ${match[3]} mm`;
            }
        }
        
        return '';
    }

    // Helper method to extract material from description
    extractMaterial(description) {
        const desc = description.toLowerCase();
        
        if (desc.includes('phenolic')) return 'Phenolic';
        if (desc.includes('hpl')) return 'HPL';
        if (desc.includes('stainless') || desc.includes('ss')) return 'Stainless Steel';
        if (desc.includes('steel') || desc.includes('metal')) return 'Steel';
        if (desc.includes('wood') || desc.includes('timber')) return 'Wood';
        if (desc.includes('melamine') || desc.includes('mdf')) return 'Melamine MDF';
        if (desc.includes('plastic') || desc.includes('polymer')) return 'Plastic';
        if (desc.includes('glass')) return 'Glass';
        if (desc.includes('ceramic')) return 'Ceramic';
        
        return 'Standard Materials';
    }

    async createSamplePricelist() {
        // This would create a sample pricelist.xlsx file if it doesn't exist
        // For now, we'll create some sample data in memory
        this.pricelistItems = [
            {
                id: 'pricelist_1',
                itemCode: 'PL-001',
                description: 'PHYSICS TEACHER TABLE W 2180 X D 750 X H 900 MM',
                category: 'Physics Lab',
                subcategory: 'Teacher Furniture',
                unit: 'NOS',
                unitPrice: 6766,
                currency: 'AED',
                specifications: 'Physics teacher table with HPL worktop',
                dimensions: '2180 x 750 x 900 mm',
                material: 'HPL',
                brand: 'PENTA',
                warranty: '1 Year',
                availability: 'Available',
                source: 'pricelist'
            },
            {
                id: 'pricelist_2',
                itemCode: 'PL-002',
                description: 'STUDENT LABORATORY BENCH ISLAND TYPE 3080X750X900MM',
                category: 'Physics Lab',
                subcategory: 'Student Furniture',
                unit: 'NOS',
                unitPrice: 7519,
                currency: 'AED',
                specifications: 'Island bench for student laboratory',
                dimensions: '3080 x 750 x 900 mm',
                material: 'HPL',
                brand: 'PENTA',
                warranty: '1 Year',
                availability: 'Available',
                source: 'pricelist'
            }
        ];
        
        console.log('Created sample pricelist data');
    }

    async getAllPricelistItems() {
        return this.pricelistItems;
    }

    async getPricelistItemById(id) {
        return this.pricelistItems.find(item => item.id === id);
    }

    async searchPricelistItems(query) {
        if (!query) return this.pricelistItems;
        
        const searchQuery = query.toLowerCase();
        return this.pricelistItems.filter(item => 
            item.description.toLowerCase().includes(searchQuery) ||
            item.itemCode.toLowerCase().includes(searchQuery) ||
            item.category.toLowerCase().includes(searchQuery) ||
            item.material.toLowerCase().includes(searchQuery) ||
            item.subcategory.toLowerCase().includes(searchQuery)
        );
    }

    async getPricelistItemsByCategory(category) {
        return this.pricelistItems.filter(item => 
            item.category.toLowerCase() === category.toLowerCase()
        );
    }

    async getPricelistCategories() {
        const categories = [...new Set(this.pricelistItems.map(item => item.category))];
        return categories.sort();
    }

    // Method to reload pricelist from file (useful for updates)
    async reloadPricelist() {
        await this.loadPricelist();
        return this.pricelistItems.length;
    }
}

module.exports = new PricelistService();
