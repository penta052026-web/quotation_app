# ProductSelector Component

A sophisticated, searchable dropdown component for selecting products from the pricelist database. This component provides an intuitive interface for users to search, browse, and select products to auto-fill quotation items.

## Features

### 🔍 **Advanced Search**
- Real-time search with 300ms debouncing for optimal performance
- Multi-field search across:
  - Product description
  - Item code
  - Category and subcategory
  - Brand name
- Case-insensitive searching
- Results limited to 50 items for performance

### 💨 **Performance Optimized**
- Debounced search input to prevent excessive API calls
- Virtual scrolling-ready with trackBy function
- Lazy loading with initial 50 product limit
- Efficient change detection with OnPush strategy potential

### 🎨 **Elegant UI/UX**
- Glass morphism design matching the app's aesthetic
- Smooth animations and transitions
- Responsive design for all screen sizes
- Professional loading and empty states
- Clear visual hierarchy with color-coded tags

### 🔄 **Smart Integration**
- Seamless integration with reactive forms
- Event-driven architecture with product selection emission
- Automatic form field population
- Clear selection functionality

## Usage

### Basic Implementation

```typescript
import { ProductSelector } from './components/product-selector/product-selector';

@Component({
  imports: [ProductSelector],
  // ...
})
export class MyComponent {
  onProductSelected(product: Product) {
    // Handle product selection
    console.log('Selected product:', product);
  }
}
```

```html
<app-product-selector 
  (productSelected)="onProductSelected($event)">
</app-product-selector>
```

### Advanced Usage with Form Integration

```html
<div class="form-field">
  <label>Search Products from Pricelist</label>
  <app-product-selector 
    [selectedProduct]="currentProduct"
    (productSelected)="onProductSelect(itemIndex, $event)">
  </app-product-selector>
  <p class="field-help">Search and select from our product pricelist</p>
</div>
```

## API Reference

### Inputs
| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `selectedProduct` | `Product \| null` | `null` | Currently selected product |

### Outputs
| Event | Type | Description |
|-------|------|-------------|
| `productSelected` | `EventEmitter<Product>` | Emitted when a product is selected |

### Methods
| Method | Parameters | Description |
|--------|------------|-------------|
| `clearSelection()` | None | Clear the current selection |
| `toggleDropdown()` | None | Toggle dropdown visibility |

## Product Data Structure

The component expects products with the following interface:

```typescript
interface Product {
  id: string;
  itemCode: string;
  description: string;
  category: string;
  subcategory: string;
  unit: string;
  unitPrice: number;
  currency: string;
  brand: string;
  // ... additional fields
}
```

## Styling

The component uses SCSS with CSS custom properties for easy theming:

```scss
.product-selector {
  --primary-color: #667eea;
  --glass-bg: rgba(255, 255, 255, 0.1);
  --backdrop-blur: blur(10px);
  // ... other custom properties
}
```

### Theme Customization

Override the following CSS variables to customize the appearance:

- `--primary-color`: Main accent color
- `--glass-bg`: Glass morphism background
- `--border-radius`: Component border radius
- `--shadow`: Box shadow values

## Integration with Quotation Form

The ProductSelector is integrated into the quotation form to provide:

1. **Auto-fill functionality**: Selected products automatically populate:
   - Description field
   - Unit field  
   - Unit price field

2. **Seamless user experience**: 
   - Positioned after description textarea
   - Helpful instruction text
   - Non-intrusive design

3. **Form validation compatibility**:
   - Works with reactive forms
   - Maintains form validation state
   - Preserves user modifications

## Performance Considerations

### Optimization Features
- **Debounced Search**: 300ms delay prevents excessive API calls
- **Result Limiting**: Maximum 50 results displayed
- **TrackBy Function**: Optimizes Angular's change detection
- **Lazy Loading**: Products loaded on component initialization

### Memory Management
- **Subscription Cleanup**: Proper cleanup with `takeUntil(destroy$)`
- **Event Listeners**: Cleaned up in `ngOnDestroy`
- **Dropdown Management**: Automatic cleanup of DOM event listeners

## Accessibility

The component includes:
- Proper ARIA labels and roles
- Keyboard navigation support
- Screen reader compatible text
- Focus management
- Semantic HTML structure

## Browser Support

Supports all modern browsers with:
- ES6+ features
- CSS Grid and Flexbox
- CSS Custom Properties
- Backdrop-filter (with fallbacks)

## Development

### Local Development
```bash
ng serve
```

### Building
```bash
ng build
```

### Testing
```bash
ng test
```

## Examples

### Search Examples
- Search by description: "office chair"
- Search by item code: "OFC-001"  
- Search by category: "furniture"
- Search by brand: "Herman Miller"

The component will intelligently match across all these fields and provide relevant results with highlighting and categorization.
