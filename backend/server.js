const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const moment = require('moment');

const sqlService = require('./services/sqlService');
const excelService = require('./services/excelService'); // Keep for compatibility
const quotationService = require('./services/quotationService');
const exportService = require('./services/exportService');
const pricelistService = require('./services/pricelistService');
const quotationTracker = require('./services/quotationTracker');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// app.use(cors());
// 🔴 THIS IS REQUIRED
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 🔴 THIS LINE IS CRITICAL
app.options('*', cors());

// Middleware to parse JSON
app.use(express.json()); 



app.use(bodyParser.json({ limit: '50mb' })); // Increase payload limit for images
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files
app.use('/exports', express.static(path.join(__dirname, 'exports')));
app.use('/pdf', express.static(path.join(__dirname, 'pdf')));
app.use('/pdf/bom', express.static(path.join(__dirname, 'pdf', 'bom')));
app.use('/excel', express.static(path.join(__dirname, 'excel')));
app.use('/excel/quotations', express.static(path.join(__dirname, 'excel', 'quotations')));
app.use('/excel/bom', express.static(path.join(__dirname, 'excel', 'bom')));
// Serve new Quotation folder structure
app.use('/quotation-files', express.static(path.join(__dirname, '..', 'Quotation')));

// Create exports directory if it doesn't exist
const exportsDir = path.join(__dirname, 'exports');
if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir);
}

// Create excel directories if they don't exist
const excelDir = path.join(__dirname, 'excel');
const excelQuotationsDir = path.join(__dirname, 'excel', 'quotations');
const excelBomDir = path.join(__dirname, 'excel', 'bom');

if (!fs.existsSync(excelDir)) {
    fs.mkdirSync(excelDir);
}
if (!fs.existsSync(excelQuotationsDir)) {
    fs.mkdirSync(excelQuotationsDir, { recursive: true });
}
if (!fs.existsSync(excelBomDir)) {
    fs.mkdirSync(excelBomDir, { recursive: true });
}

// Routes

app.post('/api/test', (req, res) => {
  console.log(req.body); // should show JSON payload
  res.json({ message: 'POST works', received: req.body });
});

// Health check
app.get('/', (req, res) => {
    res.json({ message: 'Quotation App Backend is running!' });
});

// Get all products from SQL database
app.get('/api/products', async (req, res) => {
    try {
        const products = await sqlService.getAllProducts();
        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// Search products
app.get('/api/products/search', async (req, res) => {
    try {
        const { query } = req.query;
        const products = await sqlService.searchProducts(query);
        res.json(products);
    } catch (error) {
        console.error('Error searching products:', error);
        res.status(500).json({ error: 'Failed to search products' });
    }
});

// Get product by ID
app.get('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const product = await sqlService.getProductById(id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json(product);
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});

// Check if quotation number exists
app.get('/api/quotations/check/:quotationNumber', async (req, res) => {
    try {
        const { quotationNumber } = req.params;
        const exists = await sqlService.checkQuotationNumberExists(quotationNumber);
        res.json({ exists });
    } catch (error) {
        console.error('Error checking quotation number:', error);
        res.status(500).json({ error: 'Failed to check quotation number' });
    }
});

// Generate quotation
app.post('/api/quotations/generate', async (req, res) => {
    try {
        const quotationData = req.body;
        const quotation = await quotationService.generateQuotation(quotationData);
        res.json(quotation);
    } catch (error) {
        console.error('Error generating quotation:', error);
        if (error.message.includes('already exists')) {
            res.status(409).json({ error: error.message }); // 409 Conflict for duplicates
        } else {
            res.status(500).json({ error: 'Failed to generate quotation' });
        }
    }
});

// Generate quotation with automatic PDF generation
app.post('/api/quotations/generate-with-pdfs', async (req, res) => {
    try {
        const quotationData = req.body;
        
        // Debug: Check for images in the request
        const itemsWithImages = quotationData.items?.filter(item => item.images && item.images.length > 0) || [];
        console.log(`Received quotation request with ${itemsWithImages.length} items containing images`);
        itemsWithImages.forEach((item, index) => {
            console.log(`Item ${index + 1}: "${item.description}" has ${item.images.length} images`);
        });
        
        // First generate the quotation
        const quotation = await quotationService.generateQuotation(quotationData);
        
        // Then automatically generate both PDFs and Excel files
        const quotationFilePath = await exportService.exportToPDF(quotation);
        const bomFilePath = await exportService.exportBOMToPDF(quotation, {
            stripPQ: true,
            quoteRef: quotation.quoteRef
        });
        const quotationExcelFilePath = await exportService.exportToExcel(quotation);
        const bomExcelFilePath = await exportService.exportBOMToExcel(quotation);
        
        const quoteRef = quotation.quoteRef || quotation.quotationNumber || `PQ${moment().format('YYYYMMDD_HHmmss')}`;
        // Use base reference (without -REV#) for folder structure in URLs
        const baseRef = quoteRef.split('-REV')[0];
        const quotationFilename = path.basename(quotationFilePath);
        const bomFilename = path.basename(bomFilePath);
        const quotationExcelFilename = path.basename(quotationExcelFilePath);
        const bomExcelFilename = path.basename(bomExcelFilePath);
        
        res.json({
            quotation,
            pdfs: {
                quotationPdf: {
                    filePath: quotationFilePath,
                    downloadUrl: `/quotation-files/${baseRef}/Quotation/PDF/${quotationFilename}`,
                    fallbackDownloadUrl: `/pdf/${quotationFilename}`
                },
                bomPdf: {
                    filePath: bomFilePath,
                    downloadUrl: `/quotation-files/${baseRef}/BOM/PDF/${bomFilename}`,
                    fallbackDownloadUrl: `/pdf/bom/${bomFilename}`
                }
            },
            excels: {
                quotationExcel: {
                    filePath: quotationExcelFilePath,
                    downloadUrl: `/quotation-files/${baseRef}/Quotation/Excel/${quotationExcelFilename}`,
                    fallbackDownloadUrl: `/excel/quotations/${quotationExcelFilename}`
                },
                bomExcel: {
                    filePath: bomExcelFilePath,
                    downloadUrl: `/quotation-files/${baseRef}/BOM/Excel/${bomExcelFilename}`,
                    fallbackDownloadUrl: `/excel/bom/${bomExcelFilename}`
                }
            }
        });
    } catch (error) {
        console.error('Error generating quotation with PDFs:', error);
        if (error.message.includes('already exists')) {
            res.status(409).json({ error: error.message }); // 409 Conflict for duplicates
        } else {
            res.status(500).json({ error: 'Failed to generate quotation with PDFs' });
        }
    }
});

// Export quotation to Excel
app.post('/api/quotations/export/excel', async (req, res) => {
    try {
        const quotationData = req.body;
        const filePath = await exportService.exportToExcel(quotationData);
        const quoteRef = quotationData.quoteRef || `PQ${moment().format('YYYYMMDD_HHmmss')}`;
        const filename = path.basename(filePath);
        
        // Construct URL for new folder structure: /quotation-files/PQ[ref]/Quotation/Excel/filename.xlsx
        const newDownloadUrl = `/quotation-files/${quoteRef}/Quotation/Excel/${filename}`;
        
        res.json({ 
            filePath, 
            downloadUrl: newDownloadUrl,
            // Keep old URL for backward compatibility
            fallbackDownloadUrl: `/excel/quotations/${filename}`
        });
    } catch (error) {
        console.error('Error exporting to Excel:', error);
        res.status(500).json({ error: 'Failed to export to Excel' });
    }
});

// Export quotation to PDF
app.post('/api/quotations/export/pdf', async (req, res) => {
    try {
        const quotationData = req.body;
        const filePath = await exportService.exportToPDF(quotationData);
        const quoteRef = quotationData.quoteRef || `PQ${moment().format('YYYYMMDD_HHmmss')}`;
        const filename = path.basename(filePath);
        
        // Construct URL for new folder structure: /quotation-files/PQ[ref]/Quotation/PDF/filename.pdf
        const newDownloadUrl = `/quotation-files/${quoteRef}/Quotation/PDF/${filename}`;
        
        res.json({ 
            filePath, 
            downloadUrl: newDownloadUrl,
            // Keep old URL for backward compatibility
            fallbackDownloadUrl: `/pdf/${filename}`
        });
    } catch (error) {
        console.error('Error exporting to PDF:', error);
        res.status(500).json({ error: 'Failed to export to PDF' });
    }
});

// Export BOM to PDF
app.post('/api/quotations/export/bom-pdf', async (req, res) => {
    try {
        const quotationData = req.body;
        const filePath = await exportService.exportBOMToPDF(quotationData, {
            stripPQ: true,
            quoteRef: quotationData.quoteRef
        });
        const quoteRef = quotationData.quoteRef || `PQ${moment().format('YYYYMMDD_HHmmss')}`;
        const filename = path.basename(filePath);
        
        // Construct URL for new folder structure: /quotation-files/PQ[ref]/BOM/PDF/filename.pdf
        const newDownloadUrl = `/quotation-files/${quoteRef}/BOM/PDF/${filename}`;
        
        res.json({ 
            filePath, 
            downloadUrl: newDownloadUrl,
            // Keep old URL for backward compatibility
            fallbackDownloadUrl: `/pdf/bom/${filename}`
        });
    } catch (error) {
        console.error('Error exporting BOM to PDF:', error);
        res.status(500).json({ error: 'Failed to export BOM to PDF' });
    }
});

// Export BOM to Excel
app.post('/api/quotations/export/bom-excel', async (req, res) => {
    try {
        const quotationData = req.body;
        const filePath = await exportService.exportBOMToExcel(quotationData);
        const quoteRef = quotationData.quoteRef || `PQ${moment().format('YYYYMMDD_HHmmss')}`;
        const filename = path.basename(filePath);
        
        // Construct URL for new folder structure: /quotation-files/PQ[ref]/BOM/Excel/filename.xlsx
        const newDownloadUrl = `/quotation-files/${quoteRef}/BOM/Excel/${filename}`;
        
        res.json({ 
            filePath, 
            downloadUrl: newDownloadUrl,
            // Keep old URL for backward compatibility
            fallbackDownloadUrl: `/excel/bom/${filename}`
        });
    } catch (error) {
        console.error('Error exporting BOM to Excel:', error);
        res.status(500).json({ error: 'Failed to export BOM to Excel' });
    }
});

// Generate BOM PDF from existing quotation by quote reference
app.post('/api/quotations/generate-bom/:quoteRef', async (req, res) => {
    try {
        const { quoteRef } = req.params;
        
        // First, check if BOM already exists
        const bomFilename = `bom_${quoteRef.replace('PQ', '')}.pdf`;
        const bomPath = path.join(__dirname, 'pdf', 'bom', bomFilename);
        
        if (fs.existsSync(bomPath)) {
            // BOM already exists, just return the download URL
            return res.json({ 
                filePath: bomPath, 
                downloadUrl: `/pdf/bom/${bomFilename}` 
            });
        }
        
        // BOM doesn't exist, create a simple one from database items
        console.log(`Fetching quotation data for quoteRef: ${quoteRef}`);
        const dbQuotationData = await sqlService.getQuotationByRef(quoteRef);
        
        if (!dbQuotationData) {
            console.log(`Quotation not found in database for quoteRef: ${quoteRef}`);
            // Create a very basic BOM as fallback
            const basicBomData = createBasicBOMFallback(quoteRef);
            
            const filePath = await exportService.exportBOMToPDF(basicBomData, {
                stripPQ: true,
                quoteRef: quoteRef
            });
            
            return res.json({ filePath, downloadUrl: `/pdf/bom/${path.basename(filePath)}` });
        }
        
        console.log('Database quotation data:', JSON.stringify(dbQuotationData, null, 2));
        
        // Create a simplified BOM from database items
        const simpleBomData = createSimpleBOMData(dbQuotationData);
        console.log('Simple BOM data created:', JSON.stringify(simpleBomData, null, 2));
        
        // Generate BOM PDF with simple structure
        const filePath = await exportService.exportBOMToPDF(simpleBomData, {
            stripPQ: true,
            quoteRef: quoteRef
        });
        
        res.json({ filePath, downloadUrl: `/pdf/bom/${path.basename(filePath)}` });
    } catch (error) {
        console.error('Error generating BOM PDF from quote reference:', error);
        console.error('Error details:', error.stack);
        res.status(500).json({ error: 'Failed to generate BOM PDF' });
    }
});

// Helper function to create simple BOM data structure
function createSimpleBOMData(dbQuotationData) {
    return {
        quoteRef: dbQuotationData.quotationNumber,
        date: moment(dbQuotationData.quotationDate || dbQuotationData.created_at).format('DD.MM.YYYY'),
        pricing: {
            currency: 'AED',
            subtotal: dbQuotationData.subtotal,
            vatAmount: dbQuotationData.vatAmount,
            totalAmount: dbQuotationData.totalAmount
        },
        // Create simple items structure that BOM can process
        items: createSimpleItemsStructure(dbQuotationData.items || [])
    };
}

function createSimpleItemsStructure(dbItems) {
    const items = [];
    
    if (!dbItems || dbItems.length === 0) {
        return items;
    }
    
    // Create a simple structure that the BOM generator can handle
    dbItems.forEach((item, index) => {
        // Add item header
        items.push({
            description: `ITEM ${index + 1}`,
            quantity: 1,
            unit: 'ITEM',
            unitPrice: 0,
            isItemHeader: true,
            itemIndex: index
        });
        
        // Add the part/product
        items.push({
            description: item.productDescription || item.customDescription || 'Unknown Item',
            quantity: item.quantity || 1,
            unit: item.unit || 'NOS',
            unitPrice: item.unitPrice || 0,
            itemIndex: index,
            partIndex: 1
        });
        
        // Add subtotal
        items.push({
            description: 'SUBTOTAL',
            quantity: 1,
            unit: '',
            unitPrice: item.totalPrice || ((item.quantity || 1) * (item.unitPrice || 0)),
            isSubtotal: true,
            itemIndex: index
        });
    });
    
    return items;
}

function createBasicBOMFallback(quoteRef) {
    return {
        quoteRef: quoteRef,
        date: moment().format('DD.MM.YYYY'),
        pricing: {
            currency: 'AED',
            subtotal: 0,
            vatAmount: 0,
            totalAmount: 0
        },
        items: [{
            description: 'No detailed BOM data available',
            quantity: 1,
            unit: 'NOTE',
            unitPrice: 0,
            isItemHeader: false
        }]
    };
}

// Export both quotation and BOM to PDF
app.post('/api/quotations/export/dual-pdf', async (req, res) => {
    try {
        const quotationData = req.body;
        
        // Generate quotation PDF
        const quotationFilePath = await exportService.exportToPDF(quotationData);
        
        // Generate BOM PDF
        const bomFilePath = await exportService.exportBOMToPDF(quotationData, {
            stripPQ: true,
            quoteRef: quotationData.quoteRef
        });
        
        const quoteRef = quotationData.quoteRef || `PQ${moment().format('YYYYMMDD_HHmmss')}`;
        const quotationFilename = path.basename(quotationFilePath);
        const bomFilename = path.basename(bomFilePath);
        
        res.json({ 
            quotationPdf: {
                filePath: quotationFilePath,
                downloadUrl: `/quotation-files/${quoteRef}/Quotation/PDF/${quotationFilename}`,
                fallbackDownloadUrl: `/pdf/${quotationFilename}`
            },
            bomPdf: {
                filePath: bomFilePath,
                downloadUrl: `/quotation-files/${quoteRef}/BOM/PDF/${bomFilename}`,
                fallbackDownloadUrl: `/pdf/bom/${bomFilename}`
            }
        });
    } catch (error) {
        console.error('Error exporting dual PDFs:', error);
        res.status(500).json({ error: 'Failed to export both PDFs' });
    }
});

// Get all quotations
app.get('/api/quotations', async (req, res) => {
    try {
        const quotations = await sqlService.getAllQuotations();
        res.json(quotations);
    } catch (error) {
        console.error('Error fetching quotations:', error);
        res.status(500).json({ error: 'Failed to fetch quotations' });
    }
});

// Get quotation by ID
app.get('/api/quotations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const quotation = await sqlService.getQuotationById(id);
        
        if (!quotation) {
            return res.status(404).json({ error: 'Quotation not found' });
        }
        
        res.json(quotation);
    } catch (error) {
        console.error('Error fetching quotation:', error);
        res.status(500).json({ error: 'Failed to fetch quotation' });
    }
});

// Get quotation by quotation number
app.get('/api/quotations/number/:quotationNumber', async (req, res) => {
    try {
        const { quotationNumber } = req.params;
        const quotation = await sqlService.getQuotationByNumber(quotationNumber);
        
        if (!quotation) {
            return res.status(404).json({ error: 'Quotation not found' });
        }
        
        res.json(quotation);
    } catch (error) {
        console.error('Error fetching quotation:', error);
        res.status(500).json({ error: 'Failed to fetch quotation' });
    }
});

// Update quotation (for revisions)
// app.put('/api/quotations/:id', async (req, res) => {
//     try {
//         const { id } = req.params;
//         const quotationData = req.body;
        
//         // Mark this as a revision
//         quotationData.isRevision = true;
        
//         // Update the quotation in the database
//         const updatedQuotation = await sqlService.updateQuotation(id, quotationData);
        
//         if (!updatedQuotation) {
//             return res.status(404).json({ error: 'Quotation not found' });
//         }
        
//         // Generate both quotation and BOM PDFs for the revision
//         try {
//             // Generate quotation PDF
//             const quotationFilePath = await exportService.exportToPDF(quotationData);
            
//             // Generate BOM PDF
//             const bomFilePath = await exportService.exportBOMToPDF(quotationData, {
//                 stripPQ: true,
//                 quoteRef: quotationData.quoteRef
//             });
            
//             console.log(`Generated revision PDFs:\n- Quotation: ${quotationFilePath}\n- BOM: ${bomFilePath}`);
            
//             // Return both file paths in the response
//             res.json({
//                 ...updatedQuotation,
//                 files: {
//                     quotationPdf: quotationFilePath,
//                     bomPdf: bomFilePath
//                 }
//             });
//         } catch (pdfError) {
//             console.error('Error generating PDFs for revision:', pdfError);
//             // Still return the updated quotation even if PDF generation fails
//             res.json(updatedQuotation);
//         }
//     } catch (error) {
//         console.error('Error updating quotation:', error);
//         res.status(500).json({ error: 'Failed to update quotation: ' + error.message });
//     }
// });


// Update quotation (for revisions)
app.put('/api/quotations/:id', async (req, res) => {
// Generate both quotation and BOM PDFs for the revision
        try {
            // Generate quotation PDF
            const quotationFilePath = await exportService.exportToPDF(quotationData);
            
            // Generate BOM PDF
            const bomFilePath = await exportService.exportBOMToPDF(quotationData, {
                stripPQ: true,
                quoteRef: quotationData.quoteRef
            });
            
            console.log(`Generated revision PDFs:\n- Quotation: ${quotationFilePath}\n- BOM: ${bomFilePath}`);
            
            // Return both file paths in the response
            res.json({
                ...updatedQuotation,
                files: {
                    quotationPdf: quotationFilePath,
                    bomPdf: bomFilePath
                }
            });
        } catch (pdfError) {
            console.error('Error generating PDFs for revision:', pdfError);
            // Still return the updated quotation even if PDF generation fails
            res.json(updatedQuotation);
        }

});


// Get quotation tracking records
app.get('/api/quotations/tracking', async (req, res) => {
    try {
        const records = await quotationTracker.getQuotationRecords();
        res.json({
            success: true,
            data: records,
            count: records.length
        });
    } catch (error) {
        console.error('Error fetching quotation tracking records:', error);
        res.status(500).json({ error: 'Failed to fetch quotation tracking records' });
    }
});

// Update quotation status
app.put('/api/quotations/:quotationNumber/status', async (req, res) => {
    try {
        const { quotationNumber } = req.params;
        const { status } = req.body;
        
        if (!status) {
            return res.status(400).json({ error: 'Status is required' });
        }
        
        const updated = await sqlService.updateQuotationStatus(quotationNumber, status);
        
        if (updated) {
            res.json({ 
                success: true, 
                message: `Quotation ${quotationNumber} status updated to ${status}` 
            });
        } else {
            res.status(404).json({ 
                success: false, 
                error: 'Quotation not found' 
            });
        }
    } catch (error) {
        console.error('Error updating quotation status:', error);
        res.status(500).json({ error: 'Failed to update quotation status' });
    }
});

// Download quotation tracking Excel file
app.get('/api/quotations/tracking/download', async (req, res) => {
    try {
        const filePath = quotationTracker.getFilePath();
        const filename = 'quotation_generated.xlsx';
        
        if (!require('fs').existsSync(filePath)) {
            return res.status(404).json({ error: 'Quotation tracking file not found' });
        }
        
        res.download(filePath, filename);
    } catch (error) {
        console.error('Error downloading quotation tracking file:', error);
        res.status(500).json({ error: 'Failed to download quotation tracking file' });
    }
});

// Download specific quotation PDF
app.get('/api/quotations/download/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = await exportService.getQuotationFile(filename);
        
        if (!filePath) {
            return res.status(404).json({ error: 'Quotation not found' });
        }
        
        res.download(filePath, filename);
    } catch (error) {
        console.error('Error downloading quotation:', error);
        res.status(500).json({ error: 'Failed to download quotation' });
    }
});

// Update product in SQL database
app.put('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const productData = req.body;
        const updatedProduct = await sqlService.updateProduct(id, productData);
        res.json(updatedProduct);
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// Add new product to SQL database
app.post('/api/products', async (req, res) => {
    try {
        const productData = req.body;
        const newProduct = await sqlService.addProduct(productData);
        res.json(newProduct);
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).json({ error: 'Failed to add product' });
    }
});

// Pricelist API endpoints

// Get all pricelist items
app.get('/api/pricelist', async (req, res) => {
    try {
        const items = await pricelistService.getAllPricelistItems();
        res.json(items);
    } catch (error) {
        console.error('Error fetching pricelist items:', error);
        res.status(500).json({ error: 'Failed to fetch pricelist items' });
    }
});

// Search pricelist items
app.get('/api/pricelist/search', async (req, res) => {
    try {
        const { query } = req.query;
        const items = await pricelistService.searchPricelistItems(query);
        res.json(items);
    } catch (error) {
        console.error('Error searching pricelist items:', error);
        res.status(500).json({ error: 'Failed to search pricelist items' });
    }
});

// Get pricelist item by ID
app.get('/api/pricelist/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const item = await pricelistService.getPricelistItemById(id);
        if (!item) {
            return res.status(404).json({ error: 'Pricelist item not found' });
        }
        res.json(item);
    } catch (error) {
        console.error('Error fetching pricelist item:', error);
        res.status(500).json({ error: 'Failed to fetch pricelist item' });
    }
});

// Get pricelist categories
app.get('/api/pricelist/categories', async (req, res) => {
    try {
        const categories = await pricelistService.getPricelistCategories();
        res.json(categories);
    } catch (error) {
        console.error('Error fetching pricelist categories:', error);
        res.status(500).json({ error: 'Failed to fetch pricelist categories' });
    }
});

// Reload pricelist from Excel file
app.post('/api/pricelist/reload', async (req, res) => {
    try {
        const itemCount = await pricelistService.reloadPricelist();
        res.json({ message: `Pricelist reloaded successfully. ${itemCount} items loaded.` });
    } catch (error) {
        console.error('Error reloading pricelist:', error);
        res.status(500).json({ error: 'Failed to reload pricelist' });
    }
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Quotation App Backend running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}`);
    console.log(`API Documentation: http://localhost:${PORT}/api`);
});

module.exports = app;
