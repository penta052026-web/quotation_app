import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PricelistService } from '../../services/pricelist';
import { Product } from '../../models/models';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

@Component({
  selector: 'app-multi-product-selector',
  imports: [CommonModule, FormsModule],
  templateUrl: './multi-product-selector.html',
  styleUrl: './multi-product-selector.scss'
})
export class MultiProductSelector implements OnInit, OnDestroy {
  @Input() selectedProducts: Product[] = [];
  @Output() productsSelected = new EventEmitter<Product[]>();
  @Output() selectionChanged = new EventEmitter<{
    selectedProducts: Product[];
    combinedDescription: string;
    totalPrice: number;
  }>();
  
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

  constructor(private pricelistService: PricelistService) {}

  ngOnInit() {
    this.loadProducts();
    this.setupSearch();
    this.loadRecentProducts();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadProducts() {
    this.isLoading = true;
    this.pricelistService.getAllPricelistItems()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (products) => {
          this.products = products;
          this.filteredProducts = products.slice(0, 50);
          this.isLoading = false;
          this.loadRecentProducts();
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
      .slice(0, 50);
  }

  selectProduct(product: Product) {
    const isAlreadySelected = this.selectedProducts.some(p => p.id === product.id);
    
    if (isAlreadySelected) {
      // Remove from selection
      this.selectedProducts = this.selectedProducts.filter(p => p.id !== product.id);
    } else {
      // Add to selection
      this.selectedProducts = [...this.selectedProducts, product];
    }
    
    this.addToRecentProducts(product);
    this.emitSelectionChange();
  }

  removeProduct(productId: string) {
    this.selectedProducts = this.selectedProducts.filter(p => p.id !== productId);
    this.emitSelectionChange();
  }

  clearAllSelections() {
    this.selectedProducts = [];
    this.emitSelectionChange();
  }

  private emitSelectionChange() {
    const combinedDescription = this.selectedProducts.map(p => p.description).join('\n\n');
    const totalPrice = this.selectedProducts.reduce((sum, p) => sum + p.unitPrice, 0);
    
    this.productsSelected.emit(this.selectedProducts);
    this.selectionChanged.emit({
      selectedProducts: this.selectedProducts,
      combinedDescription: combinedDescription,
      totalPrice: totalPrice
    });
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
    setTimeout(() => {
      this.isDropdownOpen = false;
    }, 150);
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
    const recentProductsJson = localStorage.getItem('recentPricelistProducts');
    if (recentProductsJson) {
      try {
        const recentProductIds = JSON.parse(recentProductsJson) as string[];
        this.recentProducts = recentProductIds
          .map(id => this.products.find(p => p.id === id))
          .filter(p => p !== undefined) as Product[];
      } catch (error) {
        console.error('Error loading recent products:', error);
        localStorage.removeItem('recentPricelistProducts');
      }
    }
  }

  private addToRecentProducts(product: Product) {
    this.recentProducts = this.recentProducts.filter(p => p.id !== product.id);
    this.recentProducts.unshift(product);
    this.recentProducts = this.recentProducts.slice(0, 5);
    
    const recentProductIds = this.recentProducts.map(p => p.id);
    localStorage.setItem('recentPricelistProducts', JSON.stringify(recentProductIds));
  }

  isRecentProduct(product: Product): boolean {
    return this.recentProducts.some(p => p.id === product.id) && this.showingRecents;
  }

  isProductSelected(product: Product): boolean {
    return this.selectedProducts.some(p => p.id === product.id);
  }

  getSelectedProductsCount(): number {
    return this.selectedProducts.length;
  }

  getSelectedProductsTotalPrice(): number {
    return this.selectedProducts.reduce((sum, p) => sum + p.unitPrice, 0);
  }
}
