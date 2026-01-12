# HTML Template Integration Guide

## Problem
The current PDF generation uses jsPDF programmatically (`generatePage1`, `generateQuotationSummary`, etc.), but we've created HTML/CSS templates that aren't being used.

## Solution Options

### Option 1: Use Puppeteer (Recommended)
Install dependencies and use HTML templates:
```bash
npm install puppeteer handlebars --save
```

Then modify `exportService.js` to use HTML templates via Puppeteer.

### Option 2: Update jsPDF Styling
Update the existing jsPDF methods (`generateQuotationSummary`, etc.) to match the CSS styling from `quotation.css`.

## Current Status
- ✅ HTML/CSS templates created at `backend/templates/pdf/quotation.html` and `quotation.css`
- ❌ Templates are NOT being used - system still uses jsPDF programmatically
- ❌ Need to integrate Puppeteer or update jsPDF styling methods

## Next Steps
1. Install Puppeteer and Handlebars
2. Add method to render HTML templates to PDF
3. Update `exportToPDF` to use HTML templates instead of jsPDF methods

