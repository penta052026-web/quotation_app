# PDF and Excel Generation

**Note: HTML/CSS templates have been removed as they are not used by the current system.**

The quotation application generates PDF and Excel files programmatically using the following libraries:

- **PDF Generation**: jsPDF library (in `backend/services/exportService.js`)
- **Excel Generation**: ExcelJS library (in `backend/services/exportService.js`)

## Current Implementation

### PDF Generation
- Uses jsPDF to create PDFs programmatically
- Supports complex layouts with tables, images, and text
- Generates multi-page documents with proper page numbering
- Includes company logo and professional formatting

### Excel Generation
- Uses ExcelJS to create multi-sheet Excel workbooks
- Creates separate worksheets for cover page, summary, and item details
- Supports images, tables, and formatting
- Generates both quotation and BOM Excel files

## File Structure

```
backend/
├── services/
│   └── exportService.js     # Main export service using jsPDF and ExcelJS
├── pdf/                     # Generated PDF files
├── excel/                   # Generated Excel files
└── templates/               # This directory (now contains only documentation)
    └── README.md           # This file
```

## Key Features

### PDF Features
- A4 page format with professional layout
- Company logo integration
- Multi-page documents with proper headers/footers
- Table-based layouts for items and pricing
- Support for item images
- Automatic page numbering
- Print-optimized formatting

### Excel Features
- Multi-sheet workbooks
- Cover page with client information
- Summary sheet with pricing tables
- Individual item detail sheets
- Image support for items
- Professional formatting with borders and colors

## Data Structure

The export service expects quotation data in the following format:

```javascript
{
  quoteRef: "PQ12345678",
  date: "DD.MM.YYYY",
  clientInfo: {
    name: "Client Name",
    email: "client@example.com",
    phone: "+971xxxxxxxxx",
    address: "Client Address"
  },
  projectInfo: {
    name: "Project Name",
    location: "Project Location"
  },
  items: [
    {
      description: "Item Description",
      totalQuantity: 10,
      unitPrice: 100,
      totalAmount: 1000,
      parts: [
        {
          description: "Part Description",
          quantity: 5,
          unit: "NOS",
          unitPrice: 20
        }
      ],
      images: ["base64:image/data", ...]
    }
  ],
  pricing: {
    currency: "AED",
    subtotal: 1000,
    discountPercentage: 0,
    vatPercentage: 5,
    vatAmount: 50,
    totalAmount: 1050
  }
}
```

## Usage

PDF and Excel generation is handled automatically when creating quotations through the API endpoints:

- `POST /api/quotations/generate-with-pdfs` - Generates quotation with PDFs and Excel files
- `POST /api/quotations/export/pdf` - Exports existing quotation to PDF
- `POST /api/quotations/export/excel` - Exports existing quotation to Excel
- `POST /api/quotations/export/bom-pdf` - Exports BOM to PDF
- `POST /api/quotations/export/bom-excel` - Exports BOM to Excel

## Notes

- The system no longer uses HTML/CSS templates for generation
- All styling and layout is handled programmatically in JavaScript
- This approach provides better control over PDF and Excel formatting
- Generated files are saved in organized folder structures based on quote reference

