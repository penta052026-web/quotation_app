import { Component, EventEmitter, Input, Output, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs/operators';
import { PricelistService } from '../../services/pricelist';
import { Product } from '../../models/models';

export interface PricelistItem extends Product {
  // Extending Product to ensure compatibility
}

@Component({
  selector: 'app-pricelist-item-selector',
  templateUrl: './pricelist-item-selector.component.html',
  styleUrls: ['./pricelist-item-selector.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class PricelistItemSelectorComponent implements OnInit, OnDestroy {
  @Input() placeholder: string = 'Search pricelist items...';
  @Input() disabled: boolean = false;
  @Output() itemSelected = new EventEmitter<Product>();

  @ViewChild('searchInput', { static: false }) searchInput!: ElementRef<HTMLInputElement>;

  searchQuery: string = '';
  filteredItems: Product[] = [];
  recentItems: Product[] = [];
  isLoading: boolean = false;
  isDropdownOpen: boolean = false;
  highlightedIndex: number = -1;

  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(private pricelistService: PricelistService) {}

  ngOnInit() {
    this.loadRecentItems();
    this.setupSearch();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSearch() {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        if (!query.trim()) {
          return Promise.resolve([]);
        }
        this.isLoading = true;
        return this.pricelistService.searchPricelistItems(query);
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (items) => {
        this.filteredItems = items;
        this.isLoading = false;
        this.highlightedIndex = -1;
      },
      error: (error) => {
        console.error('Error searching pricelist items:', error);
        this.filteredItems = [];
        this.isLoading = false;
      }
    });
  }

  private loadRecentItems() {
    const savedItems = localStorage.getItem('recentPricelistItems');
    if (savedItems) {
      this.recentItems = JSON.parse(savedItems);
    }
  }

  private saveRecentItem(item: Product) {
    // Remove if already exists
    this.recentItems = this.recentItems.filter(recent => recent.id !== item.id);
    
    // Add to beginning
    this.recentItems.unshift(item);
    
    // Keep only last 10 items to show scrolling functionality
    this.recentItems = this.recentItems.slice(0, 10);
    
    // Save to localStorage
    localStorage.setItem('recentPricelistItems', JSON.stringify(this.recentItems));
  }

  onInputFocus() {
    this.isDropdownOpen = true;
    if (!this.searchQuery.trim()) {
      this.filteredItems = [];
    }
  }

  onInputBlur() {
    // Delay hiding dropdown to allow for item clicks
    setTimeout(() => {
      this.isDropdownOpen = false;
      this.highlightedIndex = -1;
    }, 200);
  }

  onSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.searchQuery = target.value;
    this.searchSubject.next(this.searchQuery);
    this.isDropdownOpen = true;
  }

  onKeyDown(event: KeyboardEvent) {
    if (!this.isDropdownOpen) {
      if (event.key === 'ArrowDown' || event.key === 'Enter') {
        this.isDropdownOpen = true;
        event.preventDefault();
      }
      return;
    }

    const items = this.getDisplayItems();
    
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.highlightedIndex = Math.min(this.highlightedIndex + 1, items.length - 1);
        this.scrollToHighlighted();
        break;
        
      case 'ArrowUp':
        event.preventDefault();
        this.highlightedIndex = Math.max(this.highlightedIndex - 1, -1);
        this.scrollToHighlighted();
        break;
        
      case 'Enter':
        event.preventDefault();
        if (this.highlightedIndex >= 0 && items[this.highlightedIndex]) {
          this.selectItem(items[this.highlightedIndex]);
        }
        break;
        
      case 'Escape':
        event.preventDefault();
        this.isDropdownOpen = false;
        this.highlightedIndex = -1;
        this.searchInput?.nativeElement.blur();
        break;
    }
  }

  private scrollToHighlighted() {
    setTimeout(() => {
      const dropdown = document.querySelector('.pricelist-dropdown');
      const highlighted = dropdown?.querySelector('.dropdown-item.highlighted');
      if (highlighted && dropdown) {
        highlighted.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
  }

  getDisplayItems(): Product[] {
    if (this.searchQuery.trim()) {
      return this.filteredItems;
    }
    return this.recentItems;
  }

  selectItem(item: Product) {
    this.saveRecentItem(item);
    this.searchQuery = '';
    this.isDropdownOpen = false;
    this.highlightedIndex = -1;
    this.filteredItems = [];
    
    // Clear the input
    if (this.searchInput) {
      this.searchInput.nativeElement.value = '';
    }
    
    this.itemSelected.emit(item);
  }

  clearSearch() {
    this.searchQuery = '';
    this.filteredItems = [];
    this.isDropdownOpen = false;
    this.highlightedIndex = -1;
    
    if (this.searchInput) {
      this.searchInput.nativeElement.value = '';
      this.searchInput.nativeElement.focus();
    }
  }

  formatPrice(price: number, currency: string = 'AED'): string {
    return `${currency} ${price.toFixed(2)}`;
  }

  getItemDisplayText(item: Product): string {
    return `${item.description}`;
  }

  getItemSubText(item: Product): string {
    return `${item.itemCode} • ${this.formatPrice(item.unitPrice)} per ${item.unit}`;
  }
}
