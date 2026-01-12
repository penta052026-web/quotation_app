# Excel to SQL Database Migration

This document describes the conversion of your Excel-based database to a SQL database using SQLite and Knex.js.

## What Was Done

### 1. Database Schema Design
- **Products Table**: Stores all product information (items, descriptions, prices, etc.)
- **Quotations Table**: Stores quotation headers (client info, dates, totals, etc.)
- **Quotation Items Table**: Stores individual line items for each quotation

### 2. Technology Stack
- **SQLite**: Lightweight, file-based SQL database
- **Knex.js**: SQL query builder and migration tool
- **Migration Scripts**: Automated database schema creation

### 3. Migration Results
✅ **455 products** successfully migrated from Excel files:
- 7 products from `database.xlsx`
- 448 products from `pricelist.xlsx`

## Files Created

### Core Files
- `knexfile.js` - Database configuration
- `config/database.js` - Database connection setup
- `services/sqlService.js` - New SQL-based data service

### Migration Files
- `migrations/001_create_products.js` - Products table schema
- `migrations/002_create_quotations.js` - Quotations table schema
- `migrations/003_create_quotation_items.js` - Quotation items table schema

### Utilities
- `scripts/migrate-excel-to-sql.js` - Excel data import script

## Database Tables

### Products Table
```sql
- id (Primary Key)
- itemCode (Unique)
- description
- category
- subcategory
- unit
- unitPrice
- currency
- specifications
- dimensions
- material
- brand
- warranty
- availability
- created_at, updated_at
```

### Quotations Table
```sql
- id (Primary Key)
- quotationNumber (Unique)
- clientName
- clientEmail
- clientPhone
- clientAddress
- projectName
- quotationDate
- validUntil
- subtotal
- vatRate
- vatAmount
- totalAmount
- status
- terms
- notes
- created_at, updated_at
```

### Quotation Items Table
```sql
- id (Primary Key)
- quotationId (Foreign Key)
- productId (Foreign Key)
- quantity
- unitPrice
- totalPrice
- customDescription
- notes
- created_at, updated_at
```

## Available NPM Scripts

```bash
# Run database migrations
npm run migrate

# Rollback migrations
npm run migrate:rollback

# Import data from Excel files
npm run migrate:excel

# Reset database (rollback all and re-run migrations)
npm run db:reset

# Start the server
npm start

# Development mode with auto-restart
npm dev
```

## Benefits of SQL Database

### Performance
- ✅ Faster queries with proper indexing
- ✅ Concurrent access support
- ✅ Better memory management

### Data Integrity
- ✅ Foreign key constraints
- ✅ Data validation
- ✅ Transaction support

### Scalability
- ✅ Easy to add new fields
- ✅ Complex queries with JOINs
- ✅ Can migrate to PostgreSQL/MySQL later

### Developer Experience
- ✅ Standard SQL queries
- ✅ Migration system for schema changes
- ✅ Better debugging capabilities

## API Endpoints (Updated)

All existing API endpoints continue to work, but now use SQL instead of Excel:

```
GET /api/products              - Get all products
GET /api/products/search       - Search products
GET /api/products/:id          - Get product by ID
POST /api/products             - Add new product
PUT /api/products/:id          - Update product

GET /api/quotations/check/:quotationNumber - Check quotation exists
PUT /api/quotations/:quotationNumber/status - Update quotation status
```

## Database File Location

The SQLite database is stored as:
```
backend/database.sqlite3
```

## Backup Strategy

### Automatic Backup
The original Excel files are preserved:
- `database.xlsx`
- `pricelist.xlsx`  
- `quotation_generated.xlsx`

### Manual Backup
```bash
# Backup the SQLite database
cp database.sqlite3 database.sqlite3.backup.$(date +%Y%m%d)
```

## Migration Verification

The migration was successful:
- ✅ Dependencies installed
- ✅ Database schema created
- ✅ 455 products imported
- ✅ Server starts successfully
- ✅ All API endpoints functional

## Rollback Plan (If Needed)

If you need to revert to Excel:
1. Keep the original Excel files
2. Revert `server.js` to use `excelService` instead of `sqlService`
3. The original `excelService.js` is still available

## Next Steps

1. **Test thoroughly** with your frontend application
2. **Monitor performance** - should be faster than Excel
3. **Consider PostgreSQL** for production if you need more advanced features
4. **Implement proper backups** for production use

## Troubleshooting

### Database Issues
```bash
# Reset the database
npm run db:reset

# Check database content
node -e "const db = require('./config/database'); db('products').count('*').then(console.log).then(() => db.destroy());"
```

### Migration Issues
```bash
# Re-run Excel import
npm run migrate:excel
```

## Support

The new SQL system is fully compatible with your existing application. All functionality that worked with Excel files now works with the SQL database, with improved performance and reliability.