import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../services/product';
import { Product } from '../../models/models';
import { Subject, debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs';

@Component({
  selector: 'app-product-selector',
  imports: [CommonModule, FormsModule],
  templateUrl: './product-selector.html',
  styleUrl: './product-selector.scss'
})
export class ProductSelector implements OnInit, OnDestroy {
  @Input() selectedProduct: Product | null = null;
  @Output() productSelected = new EventEmitter<Product>();
  
  searchTerm = '';
  products: Product[] = [];
  filteredProducts: Product[] = [];
  recentProducts: Product[] = [];
  isDropdownOpen = false;
  isLoading = false;
  highlightedIndex = -1;
  showingRecents = false;
  
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(private productService: ProductService) {}

  ngOnInit() {
    this.loadProducts();
    this.setupSearch();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadProducts() {
    this.isLoading = true;
    this.productService.getAllProducts()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (products) => {
          this.products = products;
          this.filteredProducts = products.slice(0, 50); // Show first 50 initially
          this.isLoading = false;
          this.loadRecentProducts(); // Load recent products after all products are loaded
        },
        error: (error) => {
          console.error('Error loading products:', error);
          this.isLoading = false;
        }
      });
  }

  private setupSearch() {
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(searchTerm => {
        this.filterProducts(searchTerm);
      });
  }

  onSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const term = target.value;
    this.onSearchChange(term);
  }

  onSearchChange(term: string) {
    this.searchTerm = term;
    this.searchSubject.next(term);
    if (!this.isDropdownOpen) {
      this.isDropdownOpen = true;
    }
  }

  private filterProducts(searchTerm: string) {
    if (!searchTerm.trim()) {
      if (this.recentProducts.length > 0) {
        this.filteredProducts = [...this.recentProducts, ...this.products.slice(0, 50 - this.recentProducts.length)];
        this.showingRecents = true;
      } else {
        this.filteredProducts = this.products.slice(0, 50);
        this.showingRecents = false;
      }
      return;
    }

    this.showingRecents = false;
    const term = searchTerm.toLowerCase();
    this.filteredProducts = this.products
      .filter(product => 
        product.description.toLowerCase().includes(term) ||
        product.itemCode.toLowerCase().includes(term) ||
        product.category.toLowerCase().includes(term) ||
        product.subcategory.toLowerCase().includes(term) ||
        product.brand.toLowerCase().includes(term)
      )
      .slice(0, 50); // Limit results for performance
  }

  selectProduct(product: Product) {
    this.selectedProduct = product;
    this.searchTerm = product.description;
    this.isDropdownOpen = false;
    this.highlightedIndex = -1;
    this.addToRecentProducts(product);
    this.productSelected.emit(product);
  }

  toggleDropdown() {
    this.isDropdownOpen = !this.isDropdownOpen;
    if (this.isDropdownOpen && this.filteredProducts.length === 0) {
      this.filteredProducts = this.products.slice(0, 50);
    }
  }

  onInputFocus() {
    this.isDropdownOpen = true;
    if (this.filteredProducts.length === 0) {
      this.filteredProducts = this.products.slice(0, 50);
    }
  }

  onInputBlur() {
    // Delay closing to allow for product selection
    setTimeout(() => {
      this.isDropdownOpen = false;
    }, 150);
  }

  clearSelection() {
    this.selectedProduct = null;
    this.searchTerm = '';
    this.filteredProducts = this.products.slice(0, 50);
    this.productSelected.emit(null as any);
  }

  trackByItemCode(index: number, item: Product): string {
    return item.itemCode;
  }

  onKeyDown(event: KeyboardEvent) {
    if (!this.isDropdownOpen) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        this.isDropdownOpen = true;
        this.highlightedIndex = 0;
        return;
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.highlightedIndex = Math.min(
          this.highlightedIndex + 1,
          this.filteredProducts.length - 1
        );
        this.scrollToHighlighted();
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.highlightedIndex = Math.max(this.highlightedIndex - 1, 0);
        this.scrollToHighlighted();
        break;

      case 'Enter':
        event.preventDefault();
        if (this.highlightedIndex >= 0 && this.highlightedIndex < this.filteredProducts.length) {
          this.selectProduct(this.filteredProducts[this.highlightedIndex]);
        }
        break;

      case 'Escape':
        event.preventDefault();
        this.isDropdownOpen = false;
        this.highlightedIndex = -1;
        break;
    }
  }

  private scrollToHighlighted() {
    setTimeout(() => {
      const highlightedElement = document.querySelector('.product-item.highlighted');
      if (highlightedElement) {
        highlightedElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        });
      }
    });
  }

  isHighlighted(index: number): boolean {
    return this.highlightedIndex === index;
  }

  onMouseEnter(index: number) {
    this.highlightedIndex = index;
  }

  private loadRecentProducts() {
    const recentProductsJson = localStorage.getItem('recentProducts');
    if (recentProductsJson) {
      try {
        const recentProductIds = JSON.parse(recentProductsJson) as string[];
        this.recentProducts = recentProductIds
          .map(id => this.products.find(p => p.id === id))
          .filter(p => p !== undefined) as Product[];
      } catch (error) {
        console.error('Error loading recent products:', error);
        localStorage.removeItem('recentProducts');
      }
    }
  }

  private addToRecentProducts(product: Product) {
    // Remove if already exists
    this.recentProducts = this.recentProducts.filter(p => p.id !== product.id);
    
    // Add to beginning
    this.recentProducts.unshift(product);
    
    // Keep only last 5 recent products
    this.recentProducts = this.recentProducts.slice(0, 5);
    
    // Save to localStorage
    const recentProductIds = this.recentProducts.map(p => p.id);
    localStorage.setItem('recentProducts', JSON.stringify(recentProductIds));
  }

  isRecentProduct(product: Product): boolean {
    return this.recentProducts.some(p => p.id === product.id) && this.showingRecents;
  }
}
