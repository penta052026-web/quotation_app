const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const quotationTracker = require('./quotationTracker');
const sqlService = require('./sqlService');

class QuotationService {
    generateQuoteRef() {
        const date = moment().format('YYMM');
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `PQ${date}${random}`;
    }

    // Check if a quotation number already exists
    async checkQuotationNumberExists(quotationNumber) {
        const fs = require('fs');
        const path = require('path');
        
        try {
            // First check in the quotation tracker Excel file (most reliable)
            const existsInTracker = await quotationTracker.checkQuotationExists(quotationNumber);
            if (existsInTracker) {
                console.log(`Quotation ${quotationNumber} found in tracker`);
                return true;
            }
            
            // Also check in PDF folder as backup
            const pdfDir = path.join(__dirname, '..', 'pdf');
            if (fs.existsSync(pdfDir)) {
                const files = fs.readdirSync(pdfDir);
                const pdfExists = files.some(file => 
                    file.includes(`quotation_${quotationNumber}.pdf`)
                );
                if (pdfExists) {
                    console.log(`Quotation ${quotationNumber} found in PDF folder`);
                    return true;
                }
            }
            
            // Also check in exports folder as backup
            const exportsDir = path.join(__dirname, '..', 'exports');
            if (fs.existsSync(exportsDir)) {
                const files = fs.readdirSync(exportsDir);
                const exportExists = files.some(file => 
                    file.includes(`quotation_${quotationNumber}.`)
                );
                if (exportExists) {
                    console.log(`Quotation ${quotationNumber} found in exports folder`);
                    return true;
                }
            }
            
            console.log(`Quotation ${quotationNumber} is available`);
            return false;
        } catch (error) {
            console.error('Error checking quotation number existence:', error);
            return false;
        }
    }

    async generateQuotation(quotationData) {
        try {
            // Check if this is a revision
            const isRevision = quotationData.isRevision || false;
            
            // Generate a unique reference number if not provided
            if (!quotationData.quoteRef) {
                quotationData.quoteRef = this.generateQuoteRef();
            } else if (isRevision) {
                // For revisions, ensure we have the base quote ref (without -REV suffix)
                const baseQuoteRef = quotationData.quoteRef.split('-')[0];
                quotationData.baseQuoteRef = baseQuoteRef;
                
                // Update the quoteRef to include the revision number
                const revisionMatch = quotationData.quoteRef.match(/-REV(\d+)$/i);
                const revisionNumber = revisionMatch ? parseInt(revisionMatch[1], 10) + 1 : 1;
                quotationData.quoteRef = `${baseQuoteRef}-REV${revisionNumber}`;
            }
            
            const {
                quotationNumber, // Manual quotation number from frontend
                clientInfo,
                projectInfo,
                items,
                terms,
                discountPercentage = 0,
                vatPercentage = 5,
                currency = 'AED'
            } = quotationData;
            
            // Set the isRevision flag for export service
            quotationData.isRevision = isRevision;
            
            // Validate quotation number
            if (!quotationNumber) {
                throw new Error('Quotation number is required');
            }
            
            // For new quotations (not revisions), check if the number already exists
            if (!isRevision) {
                const exists = await this.checkQuotationNumberExists(quotationNumber);
                if (exists) {
                    throw new Error(`Quotation number ${quotationNumber} already exists`);
                }
            }

            // Log the incoming items in hierarchical structure
            console.log('\n=== QUOTATION ITEMS HIERARCHY ===');
            
            // Group items by parent
            const itemsByParent = {};
            items.forEach(item => {
                const parentId = item.parentItemId || 'root';
                if (!itemsByParent[parentId]) {
                    itemsByParent[parentId] = [];
                }
                itemsByParent[parentId].push(item);
            });
            
            // Find root items (items with no parent or isItemHeader)
            const rootItems = items.filter(item => !item.parentItemId || item.isItemHeader);
            
            // Log each root item with its parts
            rootItems.forEach((item, index) => {
                const itemNumber = index + 1;
                const parts = itemsByParent[item.id] || [];
                
                // Log the main item
                console.log(`Item ${itemNumber}: ${item.description || 'No Description'}`);
                console.log(`  Unit: ${item.unit || 'Pcs'}, Qty: ${item.quantity || 1}, Price: ${item.unitPrice || 0}`);
                
                // Log its parts if any
                if (parts.length > 0) {
                    console.log('  Parts:');
                    parts.forEach((part, partIndex) => {
                        console.log(`    Part ${partIndex + 1}: ${part.description || 'No Description'}`);
                        console.log(`      Unit: ${part.unit || 'Pcs'}, Qty: ${part.quantity || 1}, Price: ${part.unitPrice || 0}`);
                    });
                } else if (!item.isItemHeader) {
                    // If it's not a header and has no parts, log as a standalone part
                    console.log('  (No parts - standalone item)');
                }
                
                console.log(''); // Empty line between items
            });
            
            console.log('=== END OF ITEM HIERARCHY ===\n');

            // Calculate subtotal (exclude item headers and subtotal rows)
            let subtotal = 0;
            console.log('\n=== CALCULATING TOTALS ===');
            
            const processedItems = items.map((item, index) => {
                const lineTotal = (item.unitPrice || 0) * (item.quantity || 0);
                
                // Only add to subtotal if it's not an item header or subtotal row
                if (!item.isItemHeader && !item.isSubtotal) {
                    subtotal += lineTotal;
                    console.log(`[INCLUDED] ${item.description}: ${item.quantity} x ${item.unitPrice} = ${lineTotal}`);
                } else {
                    console.log(`[EXCLUDED] ${item.isItemHeader ? 'HEADER' : 'SUBTOTAL'}: ${item.description}`);
                }

                return {
                    itemNo: index + 1,
                    ...item,
                    lineTotal,
                    formattedPrice: this.formatCurrency(item.unitPrice || 0),
                    formattedTotal: this.formatCurrency(lineTotal)
                };
            });
            
            console.log('\n=== CALCULATION SUMMARY ===');
            console.log(`Subtotal (before discount): ${subtotal.toFixed(2)}`);

            // Calculate discount
            const discountAmount = subtotal * (discountPercentage / 100);
            const discountedPrice = subtotal - discountAmount;
            console.log(`- Discount (${discountPercentage}%): -${discountAmount.toFixed(2)}`);
            console.log(`= After discount: ${discountedPrice.toFixed(2)}`);

            // Calculate VAT
            const vatAmount = discountedPrice * (vatPercentage / 100);
            const totalAmount = discountedPrice + vatAmount;
            console.log(`+ VAT (${vatPercentage}%): +${vatAmount.toFixed(2)}`);
            console.log('--------------------------');
            console.log(`TOTAL: ${totalAmount.toFixed(2)} ${currency}`);
            console.log('==========================\n');

            // Generate quotation object
            const quotation = {
                id: uuidv4(),
                quoteRef: quotationNumber, // Use manual quotation number
                date: moment().format('DD.MM.YYYY'),
                clientInfo: {
                    name: clientInfo?.name || '',
                    address: clientInfo?.address || '',
                    contactPerson: clientInfo?.contactPerson || '',
                    email: clientInfo?.email || '',
                    phone: clientInfo?.phone || ''
                },
                projectInfo: {
                    name: projectInfo?.name || '',
                    location: projectInfo?.location || '',
                    inquiryNo: projectInfo?.inquiryNo || '',
                    inquiryDate: projectInfo?.inquiryDate || moment().format('DD.MM.YYYY'),
                    drawingNo: projectInfo?.drawingNo || ''
                },
                items: processedItems,
                pricing: {
                    subtotal,
                    discountPercentage,
                    discountAmount,
                    discountedPrice,
                    vatPercentage,
                    vatAmount,
                    totalAmount,
                    currency: currency
                },
                terms: {
                    deliveryTime: terms?.deliveryTime || '6-8 weeks for furniture and 8-12 weeks for fumecupboard and safety cabinets after receiving downpayment',
                    deliveryTerms: terms?.deliveryTerms || 'Delivery Included',
                    paymentTerms: terms?.paymentTerms || '50% advance payment, 50% balance payment before order collection',
                    installation: terms?.installation || 'Included',
                    warranty: terms?.warranty || '10 Years for the phenolic worktop, 1 Year for the other items',
                    currency: terms?.currency || currency,
                    offerValidity: terms?.offerValidity || 'This offer valid for one month',
                    exclusions: terms?.exclusions || 'Civil, MEP, Ducting, Gas Works'
                },
                companyInfo: {
                    name: 'PENTA for Hospitals and Schools Furniture Manufacturing LLC',
                    address: 'PENTA For Hospitals and Schools Furniture Manufacturing L.L.C., Ajman, UAE',
                    phone: '+971 6 563 2822',
                    email: 'info@penta-indust.com',
                    website: 'www.penta-indust.com',
                    manager: {
                        name: 'Ahmad Alokosh',
                        title: 'General Manager / Partner',
                        mobile: '+971561184640'
                    },
                    bankDetails: {
                        name: 'PENTA FOR SCHOOLS&HOSP FURN MANF CO',
                        accountNo: '4001 575368 500',
                        ibanAED: 'AE62 0090 0040 0157 5368 500',
                        ibanUSD: 'AE07 0090 0040 0157 5368 520',
                        ibanEUR: 'AE90 0090 0040 0157 5368 578',
                        bank: 'ARAB BANK'
                    }
                },
                notes: {
                    colorNote: 'THE QUOTE IS FOR STANDARD COLOR FRAME WHITE AND CARCASS WHITE COLOR',
                    additionalNotes: terms?.additionalNotes || ''
                },
                summary: {
                    totalItems: processedItems.length,
                    totalQuantity: processedItems.reduce((sum, item) => sum + (item.quantity || 0), 0),
                    formattedSubtotal: this.formatCurrency(subtotal),
                    formattedDiscountAmount: this.formatCurrency(discountAmount),
                    formattedDiscountedPrice: this.formatCurrency(discountedPrice),
                    formattedVatAmount: this.formatCurrency(vatAmount),
                    formattedTotalAmount: this.formatCurrency(totalAmount)
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Add record to quotation tracker Excel file
            try {
                await quotationTracker.addQuotationRecord(quotation);
                console.log(`Quotation ${quotation.quoteRef} added to tracking Excel`);
            } catch (trackerError) {
                console.error('Error adding to quotation tracker:', trackerError);
                // Don't fail the quotation generation if tracker fails
            }

            // Save quotation to SQL database
            try {
                // Build hierarchical items for SQL from processed flat items
                const hierarchicalItems = [];
                const headers = quotation.items.filter(item => item.isItemHeader);

                headers.forEach(header => {
                    const itemIndex = header.itemIndex;
                    const parts = quotation.items
                        .filter(item =>
                            item.itemIndex === itemIndex &&
                            !item.isItemHeader &&
                            !item.isSubtotal
                        )
                        .map(part => ({
                            description: part.description || '',
                            quantity: part.quantity || 1,
                            unit: part.unit || 'Pcs',
                            unitPrice: part.unitPrice || 0,
                            productId: part.productId || null,
                            customDescription: part.description || '',
                            notes: part.notes || ''
                        }));

                    hierarchicalItems.push({
                        itemHeader: header.description || header.itemHeader || '',
                        description: header.description || header.itemHeader || '',
                        quantity: 1,
                        unit: 'ITEM',
                        unitPrice: 0,
                        productId: null,
                        customDescription: header.description || header.itemHeader || '',
                        notes: header.notes || '',
                        parts
                    });
                });

                const dbQuotationData = {
                    quotationNumber: quotation.quoteRef,
                    clientName: quotation.clientInfo.name,
                    clientEmail: quotation.clientInfo.email,
                    clientPhone: quotation.clientInfo.phone,
                    clientAddress: quotation.clientInfo.address,
                    projectName: quotation.projectInfo.name,
                    quotationDate: moment().format('YYYY-MM-DD'),
                    validUntil: moment().add(30, 'days').format('YYYY-MM-DD'), // Default 30 days validity
                    subtotal: quotation.pricing.subtotal,
                    discountPercentage: quotation.pricing.discountPercentage,
                    discountAmount: quotation.pricing.discountAmount,
                    vatRate: quotation.pricing.vatPercentage,
                    vatAmount: quotation.pricing.vatAmount,
                    totalAmount: quotation.pricing.totalAmount,
                    status: 'Generated',
                    terms: JSON.stringify(quotation.terms), // Store terms as JSON
                    notes: quotation.notes?.additionalNotes || '',
                    items: hierarchicalItems,
                    isRevision: isRevision,
                    baseQuoteRef: quotation.baseQuoteRef || null
                };

                if (isRevision) {
                    // For revisions, update the existing quotation status to 'Revised'
                    await sqlService.updateQuotationStatus(quotation.baseQuoteRef || quotation.quoteRef, 'Revised');
                    // Create new record for the revision
                    await sqlService.createQuotation(dbQuotationData);
                    console.log(`Quotation revision ${quotation.quoteRef} saved to SQL database`);
                } else {
                    await sqlService.createQuotation(dbQuotationData);
                    console.log(`Quotation ${quotation.quoteRef} saved to SQL database`);
                }
            } catch (dbError) {
                console.error('Error saving to SQL database:', dbError);
                // Don't fail the quotation generation if database save fails
                // This ensures backward compatibility
            }

            return quotation;
        } catch (error) {
            console.error('Error generating quotation:', error);
            throw error;
        }
    }

    formatCurrency(amount, currency = 'AED') {
        return new Intl.NumberFormat('en-AE', {
            style: 'decimal',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }

    async validateQuotationData(quotationData) {
        const errors = [];

        // Validate client info
        if (!quotationData.clientInfo?.name) {
            errors.push('Client name is required');
        }

        // Validate items
        if (!quotationData.items || quotationData.items.length === 0) {
            errors.push('At least one item is required');
        } else {
            quotationData.items.forEach((item, index) => {
                if (!item.description) {
                    errors.push(`Item ${index + 1}: Description is required`);
                }
                if (!item.unitPrice || item.unitPrice <= 0) {
                    errors.push(`Item ${index + 1}: Valid unit price is required`);
                }
                if (!item.quantity || item.quantity <= 0) {
                    errors.push(`Item ${index + 1}: Valid quantity is required`);
                }
            });
        }

        return errors;
    }

    async calculateQuotationTotals(items, discountPercentage = 0, vatPercentage = 5) {
        let subtotal = 0;

        items.forEach(item => {
            subtotal += (item.unitPrice || 0) * (item.quantity || 0);
        });

        const discountAmount = subtotal * (discountPercentage / 100);
        const discountedPrice = subtotal - discountAmount;
        const vatAmount = discountedPrice * (vatPercentage / 100);
        const totalAmount = discountedPrice + vatAmount;

        return {
            subtotal,
            discountAmount,
            discountedPrice,
            vatAmount,
            totalAmount,
            formattedSubtotal: this.formatCurrency(subtotal),
            formattedDiscountAmount: this.formatCurrency(discountAmount),
            formattedDiscountedPrice: this.formatCurrency(discountedPrice),
            formattedVatAmount: this.formatCurrency(vatAmount),
            formattedTotalAmount: this.formatCurrency(totalAmount)
        };
    }

    generateQuotationSummary(quotation) {
        return {
            quoteRef: quotation.quoteRef,
            clientName: quotation.clientInfo.name,
            projectName: quotation.projectInfo.name,
            date: quotation.date,
            totalItems: quotation.summary.totalItems,
            totalQuantity: quotation.summary.totalQuantity,
            totalAmount: quotation.pricing.totalAmount,
            formattedTotalAmount: quotation.summary.formattedTotalAmount,
            currency: quotation.pricing.currency
        };
    }
}

module.exports = new QuotationService();
