const fs = require('fs');
const path = require('path');
const HtmlToPdfService = require('./services/htmlToPdfService');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

// Test data that matches the template structure
const testData = {
    quoteRef: 'PQ2024010301',
    date: '03/01/2024',
    items: [
        {
            description: 'Ergonomic Office Chair',
            quantity: 5,
            unitPrice: 1200,
            totalPrice: 6000
        },
        {
            description: 'Standing Desk',
            quantity: 3,
            unitPrice: 2500,
            totalPrice: 7500
        },
        {
            description: 'Monitor Arm',
            quantity: 5,
            unitPrice: 350,
            totalPrice: 1750
        }
    ],
    pricing: {
        subtotal: 15250,
        vatRate: 5,
        vatAmount: 762.50,
        totalAmount: 16012.50,
        currency: 'AED'
    }
};

async function testPdfGeneration() {
    try {
        console.log('🚀 Starting PDF generation test...');
        
        // Initialize the PDF service
        const pdfService = new HtmlToPdfService();
        
        // Log template path for debugging
        const templatePath = path.resolve(__dirname, 'templates', 'pdf', 'quotation.html');
        console.log(`📄 Using template: ${templatePath}`);
        
        // Verify template exists
        try {
            const templateContent = await readFile(templatePath, 'utf8');
            console.log('✅ Template file found and read successfully');
            
            // Log a sample of the template content
            console.log('📋 Template preview (first 200 chars):');
            console.log(templateContent.substring(0, 200) + '...');
            
        } catch (err) {
            console.error('❌ Error reading template file:', err);
            return;
        }
        
        // Generate PDF
        console.log('🔄 Generating PDF...');
        const startTime = Date.now();
        const pdfBuffer = await pdfService.generatePDFFromTemplate(testData, 'quotation');
        const endTime = Date.now();
        
        console.log(`⏱️  PDF generation took ${(endTime - startTime) / 1000} seconds`);
        
        // Save the PDF for review
        const outputPath = path.join(__dirname, 'test-output.pdf');
        await writeFile(outputPath, pdfBuffer);
        
        console.log(`\n✅ PDF generated successfully at: ${outputPath}`);
        console.log(`📄 File size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
        console.log('\nPlease check the generated PDF to verify the layout and styling.');
        
        // Generate HTML for debugging
        const debugHtmlPath = path.join(__dirname, 'debug-output.html');
        const template = await readFile(templatePath, 'utf8');
        const compiledTemplate = require('handlebars').compile(template);
        const htmlOutput = compiledTemplate({
            ...testData,
            logoPath: path.resolve(__dirname, '..', 'penta logo.png')
        });
        await writeFile(debugHtmlPath, htmlOutput);
        console.log(`\n🔍 Debug HTML generated at: ${debugHtmlPath}`);
        
    } catch (error) {
        console.error('\n❌ Error generating PDF:');
        console.error(error);
        
        if (error.stack) {
            console.error('\nStack trace:');
            console.error(error.stack);
        }
    }
}

// Run the test
testPdfGeneration();
