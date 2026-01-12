const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

async function updateDatabase() {
    try {
        console.log('Starting database updates...');

        // Example 1: Update a specific product
        await db('products')
            .where({ itemCode: 'PHYS-TT-001' })
            .update({
                unitPrice: 7000.00,
                specifications: 'Updated HPL worktop 13mm thick, powder-coated frame',
                updated_at: new Date()
            });

        console.log('✅ Updated PHYS-TT-001');

        // Example 2: Add a new product
        const newProduct = {
            id: uuidv4(),
            itemCode: 'LAB-BENCH-001',
            description: 'Laboratory Bench with Storage',
            category: 'Laboratory Equipment',
            subcategory: 'Benches',
            unit: 'NOS',
            unitPrice: 3500.00,
            currency: 'AED',
            specifications: 'Chemical resistant top, built-in storage',
            dimensions: '1500 x 750 x 900 mm',
            material: 'HPL/Steel',
            brand: 'PENTA',
            warranty: '2 Years',
            availability: 'Available'
        };

        await db('products').insert(newProduct);
        console.log('✅ Added new product:', newProduct.itemCode);

        // Example 3: Update category for pricelist items
        const updatedCount = await db('products')
            .where({ category: 'Pricelist Item' })
            .update({
                category: 'General Items',
                updated_at: new Date()
            });

        console.log(`✅ Updated ${updatedCount} pricelist items`);

        // Example 4: Delete products with 0 price
        const deletedCount = await db('products')
            .where({ unitPrice: 0.0 })
            .delete();

        console.log(`✅ Deleted ${deletedCount} products with 0 price`);

        console.log('Database updates completed successfully!');

    } catch (error) {
        console.error('Error updating database:', error);
    } finally {
        await db.destroy();
    }
}

// Run the updates
updateDatabase();