const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class SqlService {
    constructor() {
        this.initializeDatabase();
    }

    async initializeDatabase() {
        try {
            // Run migrations
            await db.migrate.latest();
            console.log('Database migrations completed successfully');
            
            // Check if we have any products, if not, seed with sample data
            const productCount = await db('products').count('* as count').first();
            if (productCount.count === 0) {
                await this.seedSampleProducts();
            }
        } catch (error) {
            console.error('Error initializing database:', error);
        }
    }

    async seedSampleProducts() {
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

        try {
            await db('products').insert(sampleProducts);
            console.log(`Seeded ${sampleProducts.length} sample products`);
        } catch (error) {
            console.error('Error seeding sample products:', error);
        }
    }

    // Product Methods
    async getAllProducts() {
        return await db('products').select('*').orderBy('category', 'itemCode');
    }

    async getProductById(id) {
        return await db('products').where({ id }).first();
    }

    async searchProducts(query) {
        if (!query) return await this.getAllProducts();
        
        const searchQuery = `%${query.toLowerCase()}%`;
        return await db('products')
            .where(function() {
                this.whereRaw('LOWER(description) LIKE ?', [searchQuery])
                    .orWhereRaw('LOWER(itemCode) LIKE ?', [searchQuery])
                    .orWhereRaw('LOWER(category) LIKE ?', [searchQuery])
                    .orWhereRaw('LOWER(material) LIKE ?', [searchQuery]);
            })
            .orderBy('category', 'itemCode');
    }

    async addProduct(productData) {
        const newProduct = {
            id: uuidv4(),
            ...productData,
            unitPrice: parseFloat(productData.unitPrice) || 0
        };
        
        await db('products').insert(newProduct);
        return newProduct;
    }

    async updateProduct(id, productData) {
        const updateData = {
            ...productData,
            unitPrice: parseFloat(productData.unitPrice) || 0,
            updated_at: new Date()
        };

        const updated = await db('products')
            .where({ id })
            .update(updateData);

        if (updated === 0) {
            throw new Error('Product not found');
        }

        return await this.getProductById(id);
    }

    async deleteProduct(id) {
        const deleted = await db('products').where({ id }).delete();
        return deleted > 0;
    }

    async getProductsByCategory(category) {
        return await db('products')
            .where('category', 'ilike', category)
            .orderBy('itemCode');
    }

    async getCategories() {
        const result = await db('products')
            .distinct('category')
            .orderBy('category');
        
        return result.map(row => row.category);
    }

    // Quotation Methods
    async createQuotation(quotationData) {
        const trx = await db.transaction();
        
        try {
            const quotationId = uuidv4();
            const quotation = {
                id: quotationId,
                quotationNumber: quotationData.quotationNumber,
                clientName: quotationData.clientName,
                clientEmail: quotationData.clientEmail,
                clientPhone: quotationData.clientPhone,
                clientAddress: quotationData.clientAddress,
                projectName: quotationData.projectName,
                quotationDate: quotationData.quotationDate,
                validUntil: quotationData.validUntil,
                subtotal: quotationData.subtotal,
                discountPercentage: quotationData.discountPercentage || 0,
                discountAmount: quotationData.discountAmount || 0,
                vatRate: quotationData.vatRate || 5.00,
                vatAmount: quotationData.vatAmount,
                totalAmount: quotationData.totalAmount,
                status: quotationData.status || 'Draft',
                terms: typeof quotationData.terms === 'object' 
                    ? JSON.stringify(quotationData.terms) 
                    : (quotationData.terms || ''),
                notes: quotationData.notes
            };

            await trx('quotations').insert(quotation);

            // Process items and their parts
            if (quotationData.items && quotationData.items.length > 0) {
                const allItems = [];
                
                // Process each top-level item
                for (const item of quotationData.items) {
                    const itemId = uuidv4();
                    
                    // Store images as JSON string if they exist
                    let imagesJson = null;
                    if (item.images && Array.isArray(item.images) && item.images.length > 0) {
                        imagesJson = JSON.stringify(item.images);
                    }
                    
                    // Add the main item
                    allItems.push({
                        id: itemId,
                        quotationId: quotationId,
                        productId: item.productId || null,
                        quantity: item.quantity || 1,
                        unitPrice: item.unitPrice || 0,
                        totalPrice: (item.quantity || 1) * (item.unitPrice || 0),
                        customDescription: item.itemHeader || item.customDescription || '',
                        notes: item.notes || '',
                        parentItemId: null, // Top-level item has no parent
                        images: imagesJson
                    });
                    
                    // Process parts if they exist
                    if (item.parts && item.parts.length > 0) {
                        for (const part of item.parts) {
                            allItems.push({
                                id: uuidv4(),
                                quotationId: quotationId,
                                parentItemId: itemId,
                                productId: part.productId || null,
                                quantity: part.quantity || 1,
                                unitPrice: part.unitPrice || 0,
                                totalPrice: (part.quantity || 1) * (part.unitPrice || 0),
                                customDescription: part.description || part.customDescription || '',
                                notes: part.notes || ''
                            });
                        }
                    }
                }
                
                // Insert all items and parts in a single transaction
                if (allItems.length > 0) {
                    await trx('quotation_items').insert(allItems);
                }
            }

            await trx.commit();
            return await this.getQuotationById(quotationId);
        } catch (error) {
            await trx.rollback();
            throw error;
        }
    }

    async getQuotationById(id) {
        try {
            const quotation = await db('quotations').where({ id }).first();
            if (!quotation) return null;

            // Get all items for this quotation
            const items = await db('quotation_items')
                .leftJoin('products', 'quotation_items.productId', 'products.id')
                .where('quotation_items.quotationId', id)
                .select(
                    'quotation_items.*',
                    'products.itemCode',
                    'products.description as productDescription',
                    'products.unit',
                    'products.specifications',
                    'products.dimensions',
                    'products.material',
                    'products.brand',
                    'products.warranty',
                    'products.availability'
                );

            // Group items by parent
            const itemsByParent = new Map();
            items.forEach(item => {
                const parentId = item.parentItemId || 'root';
                if (!itemsByParent.has(parentId)) {
                    itemsByParent.set(parentId, []);
                }
                itemsByParent.get(parentId).push(item);
            });

            // Build the hierarchical structure
            const buildItems = (parentId) => {
                const children = itemsByParent.get(parentId) || [];
                return children.map(item => {
                    // Parse images from JSON string if they exist
                    let images = [];
                    if (item.images) {
                        try {
                            images = typeof item.images === 'string' ? JSON.parse(item.images) : item.images;
                            if (!Array.isArray(images)) {
                                images = [];
                            }
                        } catch (e) {
                            console.error('Error parsing images JSON:', e);
                            images = [];
                        }
                    }
                    
                    return {
                        id: item.id,
                        productId: item.productId,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        totalPrice: item.totalPrice,
                        customDescription: item.customDescription,
                        notes: item.notes,
                        itemHeader: item.customDescription || item.productDescription || '',
                        description: item.customDescription || item.productDescription || '',
                        unit: item.unit || 'Pcs',
                        images: images, // Include images array
                        parts: buildItems(item.id) // Recursively get child parts
                    };
                });
            };

            // Parse terms if it's a JSON string
            let terms = {};
            if (quotation.terms) {
                try {
                    terms = typeof quotation.terms === 'string' 
                        ? JSON.parse(quotation.terms) 
                        : quotation.terms;
                } catch (e) {
                    console.error('Error parsing terms:', e);
                }
            }

            return {
                ...quotation,
                terms,
                items: buildItems('root')
            };
        } catch (error) {
            console.error('Error in getQuotationById:', error);
            throw error;
        }
    }

    async getQuotationByNumber(quotationNumber) {
        try {
            const quotation = await db('quotations')
                .where('quotationNumber', quotationNumber)
                .first();
            
            if (!quotation) return null;
            
            // Use getQuotationById to get the full quotation with items
            return this.getQuotationById(quotation.id);
        } catch (error) {
            console.error('Error in getQuotationByNumber:', error);
            throw error;
        }
    }

    async getAllQuotations() {
        try {
            const quotations = await db('quotations')
                .select('*')
                .orderBy('created_at', 'desc');

            // For each quotation, get the items count and total amount
            const quotationsWithDetails = await Promise.all(
                quotations.map(async (quotation) => {
                    const items = await db('quotation_items')
                        .where('quotationId', quotation.id)
                        .whereNull('parentItemId')
                        .count('* as count')
                        .first();

                    return {
                        ...quotation,
                        itemsCount: items ? parseInt(items.count) : 0,
                        // Parse terms if it's a JSON string
                        terms: quotation.terms && typeof quotation.terms === 'string' 
                            ? JSON.parse(quotation.terms) 
                            : (quotation.terms || {})
                    };
                })
            );

            return quotationsWithDetails;
        } catch (error) {
            console.error('Error in getAllQuotations:', error);
            throw error;
        }
    }

    async checkQuotationNumberExists(quotationNumber) {
        try {
            const count = await db('quotations')
                .where('quotationNumber', quotationNumber)
                .count('* as count')
                .first();
                
            return count && parseInt(count.count) > 0;
        } catch (error) {
            console.error('Error checking quotation number:', error);
            throw error;
        }
    }

    // Update an existing quotation and its items
    async updateQuotation(id, quotationData) {
        const trx = await db.transaction();

        try {
            // Build quotation update payload
            const quotationUpdate = {
                quotationNumber: quotationData.quotationNumber,
                clientName: quotationData.clientName,
                clientEmail: quotationData.clientEmail,
                clientPhone: quotationData.clientPhone,
                clientAddress: quotationData.clientAddress,
                projectName: quotationData.projectName,
                quotationDate: quotationData.quotationDate,
                validUntil: quotationData.validUntil,
                subtotal: quotationData.subtotal,
                discountPercentage: quotationData.discountPercentage || 0,
                discountAmount: quotationData.discountAmount || 0,
                vatRate: quotationData.vatRate || 5.00,
                vatAmount: quotationData.vatAmount,
                totalAmount: quotationData.totalAmount,
                status: quotationData.status || 'Updated',
                terms: typeof quotationData.terms === 'object'
                    ? JSON.stringify(quotationData.terms)
                    : (quotationData.terms || ''),
                notes: quotationData.notes,
                updated_at: new Date()
            };

            // Update main quotation record
            const updated = await trx('quotations')
                .where({ id })
                .update(quotationUpdate);

            if (updated === 0) {
                await trx.rollback();
                return null;
            }

            // Replace all quotation items with new ones
            await trx('quotation_items').where({ quotationId: id }).del();

            if (quotationData.items && quotationData.items.length > 0) {
                const allItems = [];

                for (const item of quotationData.items) {
                    const itemId = uuidv4();

                    // Store images as JSON string if they exist
                    let imagesJson = null;
                    if (item.images && Array.isArray(item.images) && item.images.length > 0) {
                        imagesJson = JSON.stringify(item.images);
                    }

                    allItems.push({
                        id: itemId,
                        quotationId: id,
                        productId: item.productId || null,
                        quantity: item.quantity || 1,
                        unitPrice: item.unitPrice || 0,
                        totalPrice: (item.quantity || 1) * (item.unitPrice || 0),
                        customDescription: item.itemHeader || item.customDescription || item.description || '',
                        notes: item.notes || '',
                        parentItemId: null,
                        images: imagesJson
                    });

                    if (item.parts && item.parts.length > 0) {
                        for (const part of item.parts) {
                            allItems.push({
                                id: uuidv4(),
                                quotationId: id,
                                parentItemId: itemId,
                                productId: part.productId || null,
                                quantity: part.quantity || 1,
                                unitPrice: part.unitPrice || 0,
                                totalPrice: (part.quantity || 1) * (part.unitPrice || 0),
                                customDescription: part.description || part.customDescription || '',
                                notes: part.notes || ''
                            });
                        }
                    }
                }

                if (allItems.length > 0) {
                    await trx('quotation_items').insert(allItems);
                }
            }

            await trx.commit();
            return await this.getQuotationById(id);
        } catch (error) {
            await trx.rollback();
            console.error('Error updating quotation:', error);
            throw error;
        }
    }

    // Update quotation status in SQL database
    async updateQuotationStatus(quotationNumber, status) {
        try {
            const updated = await db('quotations')
                .where('quotationNumber', quotationNumber)
                .update({
                    status,
                    updated_at: new Date()
                });

            return updated > 0;
        } catch (error) {
            console.error('Error updating quotation status in SQL:', error);
            throw error;
        }
    }
}

module.exports = new SqlService();
