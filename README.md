# Quotation Generator Application

A professional quotation generation application built with Angular frontend, Node.js backend, and Excel database integration.

## Features

- **Professional Quotation Generation**: Create detailed quotations matching the PDF reference format
- **Excel Database Integration**: Uses Excel file as product database with CRUD operations
- **Dynamic Pricing**: Automatic calculation of subtotals, discounts, VAT, and totals
- **Multiple Export Formats**: Export quotations to Excel and PDF formats
- **Editable Output**: Generated quotations are fully editable
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## Project Structure

```
quotation-app/
├── backend/                 # Node.js Express server
│   ├── services/           # Business logic services
│   ├── exports/            # Generated export files
│   └── database.xlsx       # Excel database file
├── frontend/quotation-frontend/  # Angular application
│   ├── src/app/
│   │   ├── components/     # UI components
│   │   ├── services/       # Angular services
│   │   └── models/         # TypeScript interfaces
└── README.md
```

## Technology Stack

### Backend
- **Node.js** with Express.js
- **Excel processing**: xlsx, ExcelJS
- **PDF generation**: jsPDF with jsPDF-autotable
- **File handling**: multer
- **CORS support**

### Frontend
- **Angular 20+** with standalone components
- **Reactive Forms** for form management
- **HTTP Client** for API communication
- **SCSS** for styling
- **Responsive design**

## Setup Instructions

### Prerequisites
- Node.js (v18 or higher)
- npm (v8 or higher)

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the backend server:
   ```bash
   npm start
   ```
   
   The backend will run on `http://localhost:3000`

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend/quotation-frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Angular development server:
   ```bash
   ng serve
   ```
   
   The frontend will run on `http://localhost:4200`

## Usage Guide

### Creating a Quotation

1. **Client Information**
   - Enter client name (required)
   - Add contact person, email, phone, and address

2. **Project Information**
   - Enter project name (required)
   - Add location, inquiry number, date, and drawing number

3. **Items Section**
   - Add items with description, quantity, unit, and unit price
   - Use "Add Item" button to add more items
   - Remove items with the "Remove" button (minimum 1 item required)

4. **Terms and Conditions**
   - Pre-filled with standard terms (editable)
   - Modify delivery time, payment terms, warranty, etc.

5. **Pricing**
   - Set discount percentage (0-100%)
   - Set VAT percentage (default: 5%)
   - View estimated total in real-time

6. **Generate Quotation**
   - Click "Generate Quotation" to create the quotation
   - Export to Excel or PDF format

### Export Formats

**Excel Export**
- Professional formatting matching the PDF reference
- Fully editable spreadsheet
- Includes all quotation details, items, and calculations

**PDF Export**
- Print-ready format
- Professional layout
- Includes company branding and terms

## API Endpoints

### Products
- `GET /api/products` - Get all products
- `GET /api/products/search?query=term` - Search products
- `GET /api/products/:id` - Get product by ID
- `POST /api/products` - Add new product
- `PUT /api/products/:id` - Update product

### Quotations
- `POST /api/quotations/generate` - Generate quotation
- `POST /api/quotations/export/excel` - Export to Excel
- `POST /api/quotations/export/pdf` - Export to PDF

## Database Structure

The Excel database (`database.xlsx`) contains product information with the following columns:
- ID, Item Code, Description, Category, Subcategory
- Unit, Unit Price, Currency, Specifications
- Dimensions, Material, Brand, Warranty, Availability

## Customization

### Company Information
Edit the company details in `/backend/services/quotationService.js`:
- Company name and address
- Contact information
- Bank details
- Manager information

### Default Terms
Modify default terms and conditions in the quotation service or frontend form.

### Styling
Customize the appearance by editing SCSS files in the Angular components.

## Features Implemented

✅ Professional quotation generation matching PDF reference
✅ Excel database integration with product catalog
✅ Dynamic pricing calculations (subtotal, discount, VAT)
✅ Export to Excel and PDF formats
✅ Responsive web interface
✅ Form validation and error handling
✅ Real-time total calculations
✅ Editable terms and conditions

## Browser Compatibility

- Chrome (recommended)
- Firefox
- Safari
- Edge

## Support

For issues or questions, please check:
1. Console logs for error messages
2. Network tab for API call status
3. Ensure both backend and frontend are running

## License

This project is for demonstration purposes. Modify as needed for your use case.
