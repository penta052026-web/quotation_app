import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { Product } from '../models/models';

@Injectable({
  providedIn: 'root'
})
export class PricelistService {
  private apiUrl = 'http://localhost:3000/api';
  private pricelistSubject = new BehaviorSubject<Product[]>([]);
  public pricelist$ = this.pricelistSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadPricelist();
  }

  private loadPricelist(): void {
    this.getAllPricelistItems().subscribe({
      next: (items) => {
        this.pricelistSubject.next(items);
      },
      error: (error) => {
        console.error('Error loading pricelist:', error);
      }
    });
  }

  getAllPricelistItems(): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.apiUrl}/pricelist`);
  }

  getPricelistItemById(id: string): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/pricelist/${id}`);
  }

  searchPricelistItems(query: string): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.apiUrl}/pricelist/search`, {
      params: { query }
    });
  }

  getPricelistCategories(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/pricelist/categories`);
  }

  reloadPricelist(): Observable<{message: string}> {
    return this.http.post<{message: string}>(`${this.apiUrl}/pricelist/reload`, {});
  }

  // Get current pricelist items synchronously
  getCurrentPricelistItems(): Product[] {
    return this.pricelistSubject.getValue();
  }
}
