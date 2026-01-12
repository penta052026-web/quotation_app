const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const Handlebars = require('handlebars');

class HtmlToPdfService {
    constructor() {
        this.templatesPath = path.join(__dirname, '..', 'templates', 'pdf');
        this.logoPath = path.join(__dirname, '..', '..', 'penta logo.png');
    }

    // Register Handlebars helpers
    registerHelpers() {
        Handlebars.registerHelper('formatCurrency', (amount) => {
            if (typeof amount !== 'number') return amount || '0';
            return amount.toLocaleString('en-US', { 
                minimumFractionDigits: 0, 
                maximumFractionDigits: 2 
            });
        });

        Handlebars.registerHelper('getCurrency', (currency) => {
            return currency || 'AED';
        });

        Handlebars.registerHelper('increment', (index) => {
            return index + 1;
        });

        Handlebars.registerHelper('calculatePageNumber', (index) => {
            // Page 1: Cover, Page 2: Summary, Page 3+: Item details
            return index + 3;
        });
    }

    async generatePDFFromTemplate(quotationData, templateType = 'quotation') {
        try {
            this.registerHelpers();

            // Get absolute path to the template
            const htmlTemplatePath = path.resolve(__dirname, '..', 'templates', 'pdf', `${templateType}.html`);
            
            // Read the HTML template
            let html = fs.readFileSync(htmlTemplatePath, 'utf8');

            // Prepare data for template
            const templateData = {
                ...quotationData,
                logoPath: this.logoPath,
                currency: quotationData.pricing?.currency || 'AED',
                date: quotationData.date || quotationData.quotationDate || new Date().toLocaleDateString('en-GB'),
                totalPages: this.calculateTotalPages(quotationData),
                pricing: {
                    subtotal: quotationData.pricing?.subtotal || quotationData.subtotal || 0,
                    discountPercentage: quotationData.pricing?.discountPercentage || 0,
                    discountAmount: quotationData.pricing?.discountAmount || 0,
                    discountedPrice: (quotationData.pricing?.subtotal || 0) - (quotationData.pricing?.discountAmount || 0),
                    vatRate: quotationData.pricing?.vatRate || quotationData.vatRate || 5,
                    vatAmount: quotationData.pricing?.vatAmount || quotationData.vatAmount || 0,
                    totalAmount: quotationData.pricing?.totalAmount || quotationData.totalAmount || 0,
                    currency: quotationData.pricing?.currency || 'AED'
                }
            };

            // Compile and render the template with data
            const template = Handlebars.compile(html);
            html = template(templateData);

            // Launch Puppeteer with additional arguments for better compatibility
            const browser = await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu'
                ]
            });

            const page = await browser.newPage();
            
            // Set viewport to A4 size at 96 DPI
            await page.setViewport({
                width: 1123,  // A4 width in pixels at 96 DPI
                height: 1587, // A4 height in pixels at 96 DPI
                deviceScaleFactor: 1,
            });

            // Set content with networkidle0 to ensure all resources are loaded
            await page.setContent(html, {
                waitUntil: 'networkidle0',
                timeout: 30000 // 30 seconds timeout
            });

            // Wait for any final rendering
            await page.evaluateHandle('document.fonts.ready');

            // Generate PDF with print media type to ensure CSS print styles are applied
            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '0mm',
                    right: '0mm',
                    bottom: '0mm',
                    left: '0mm'
                }
            });

            await browser.close();

            return pdfBuffer;
        } catch (error) {
            console.error('Error generating PDF from HTML template:', error);
            throw error;
        }
    }

    calculateTotalPages(quotationData) {
        const hierarchicalItems = this.parseHierarchicalItems(quotationData.items || []);
        // Page 1: Cover, Page 2: Summary, Page 3+: Item details (1 per item)
        return 2 + hierarchicalItems.length;
    }

    parseHierarchicalItems(items) {
        // Simple parsing - you may need to adjust based on your data structure
        return items.map((item, index) => ({
            ...item,
            totalQuantity: item.quantity || item.totalQuantity || 1,
            unitPrice: item.unitPrice || item.averageUnitPrice || 0,
            totalAmount: item.totalPrice || item.totalAmount || 0
        }));
    }
}

module.exports = HtmlToPdfService;

