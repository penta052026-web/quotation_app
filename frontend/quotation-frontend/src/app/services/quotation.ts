import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { switchMap, map, tap } from 'rxjs/operators';
import { Quotation, QuotationRequest, ExportResponse } from '../models/models';

@Injectable({
  providedIn: 'root'
})
export class QuotationService {
  private apiUrl = 'http://localhost:3000/api';
  private currentQuotationSubject = new BehaviorSubject<Quotation | null>(null);
  public currentQuotation$ = this.currentQuotationSubject.asObservable();

  constructor(private http: HttpClient) {}

  generateQuotation(quotationRequest: QuotationRequest): Observable<Quotation> {
    return this.http.post<Quotation>(`${this.apiUrl}/quotations/generate`, quotationRequest);
  }

  setCurrentQuotation(quotation: Quotation): void {
    this.currentQuotationSubject.next(quotation);
  }

  getCurrentQuotation(): Quotation | null {
    return this.currentQuotationSubject.getValue();
  }

  clearCurrentQuotation(): void {
    this.currentQuotationSubject.next(null);
  }

  exportToExcel(quotation: Quotation): Observable<ExportResponse> {
    return this.http.post<ExportResponse>(`${this.apiUrl}/quotations/export/excel`, quotation);
  }

  exportToPDF(quotation: Quotation): Observable<ExportResponse> {
    return this.http.post<ExportResponse>(`${this.apiUrl}/quotations/export/pdf`, quotation);
  }

  exportBOMToPDF(quotation: Quotation): Observable<ExportResponse> {
    return this.http.post<ExportResponse>(`${this.apiUrl}/quotations/export/bom-pdf`, quotation);
  }

  exportBOMToExcel(quotation: Quotation): Observable<ExportResponse> {
    return this.http.post<ExportResponse>(`${this.apiUrl}/quotations/export/bom-excel`, quotation);
  }

  calculateTotals(items: any[], discountPercentage: number = 0, vatPercentage: number = 5): any {
    let subtotal = 0;
    items.forEach(item => {
      subtotal += (item.unitPrice || 0) * (item.quantity || 0);
    });

    const discountAmount = subtotal * (discountPercentage / 100);
    const discountedPrice = subtotal - discountAmount;
    const vatAmount = discountedPrice * (vatPercentage / 100);
    const totalAmount = discountedPrice + vatAmount;

    return {
      subtotal,
      discountAmount,
      discountedPrice,
      vatAmount,
      totalAmount,
      formattedSubtotal: this.formatCurrency(subtotal),
      formattedDiscountAmount: this.formatCurrency(discountAmount),
      formattedDiscountedPrice: this.formatCurrency(discountedPrice),
      formattedVatAmount: this.formatCurrency(vatAmount),
      formattedTotalAmount: this.formatCurrency(totalAmount)
    };
  }

  formatCurrency(amount: number, currency: string = 'AED'): string {
    return new Intl.NumberFormat('en-AE', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  getAllQuotations(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/quotations`);
  }

  getQuotationById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/quotations/${id}`);
  }

  getQuotationByNumber(quotationNumber: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/quotations/number/${quotationNumber}`);
  }

  // Update existing quotation by database ID
  updateQuotation(id: string, quotationData: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/quotations/${id}`, quotationData);
  }

  downloadQuotation(filename: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/quotations/download/${filename}`, {
      responseType: 'blob'
    });
  }

  generateAndDownloadPDF(quotationRequest: QuotationRequest): Observable<{quotation: Quotation, downloadUrl: string}> {
    return this.generateQuotation(quotationRequest).pipe(
      switchMap(quotation => 
        this.exportToPDF(quotation).pipe(
          map(exportResponse => ({
            quotation,
            downloadUrl: `http://localhost:3000${exportResponse.downloadUrl}`
          }))
        )
      )
    );
  }

  generateQuotationWithPDFs(quotationRequest: QuotationRequest): Observable<{quotation: Quotation, pdfs: {quotationPdf: ExportResponse, bomPdf: ExportResponse}, excels: {quotationExcel: ExportResponse, bomExcel: ExportResponse}}> {
    return this.http.post<{quotation: Quotation, pdfs: {quotationPdf: ExportResponse, bomPdf: ExportResponse}, excels: {quotationExcel: ExportResponse, bomExcel: ExportResponse}}>(
      `${this.apiUrl}/quotations/generate-with-pdfs`, 
      quotationRequest
    );
  }

  exportDualPDF(quotation: Quotation): Observable<{quotationPdf: ExportResponse, bomPdf: ExportResponse}> {
    return this.http.post<{quotationPdf: ExportResponse, bomPdf: ExportResponse}>(
      `${this.apiUrl}/quotations/export/dual-pdf`, 
      quotation
    );
  }

  generateAndDownloadBothPDFs(quotationRequest: QuotationRequest): Observable<{quotation: Quotation, quotationUrl: string, bomUrl: string}> {
    return this.generateQuotationWithPDFs(quotationRequest).pipe(
      tap((response: any) => {
        // Helper function to download a file using HttpClient
        const downloadFile = (url: string, filename: string, delay: number = 0): void => {
          if (!url) return;
          
          setTimeout(() => {
            const fullUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`;
            
            // Use HttpClient to download as blob
            this.http.get(fullUrl, {
              responseType: 'blob',
              headers: new HttpHeaders({
                'Accept': 'application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
              })
            }).subscribe({
              next: (blob: Blob) => {
                try {
                  // Create a blob URL and trigger download
                  const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
                  a.href = blobUrl;
            a.download = filename;
                  a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
                  
                  // Clean up after a short delay
                  setTimeout(() => {
            document.body.removeChild(a);
                    window.URL.revokeObjectURL(blobUrl);
                  }, 100);
                } catch (error) {
                  console.error(`Error triggering download for ${filename}:`, error);
                  // Fallback: try opening in new tab
                  window.open(fullUrl, '_blank');
                }
              },
              error: (error) => {
                console.error(`Error downloading ${filename}:`, error);
                // Fallback: try opening in new tab
                window.open(fullUrl, '_blank');
              }
            });
          }, delay);
        };

        // Automatically download Quotation PDF
        if (response.pdfs?.quotationPdf?.downloadUrl) {
          const filename = response.pdfs.quotationPdf.downloadUrl.split('/').pop() || 'quotation.pdf';
          downloadFile(response.pdfs.quotationPdf.downloadUrl, filename, 100);
        }

        // Automatically download BOM PDF
        if (response.pdfs?.bomPdf?.downloadUrl) {
          const filename = response.pdfs.bomPdf.downloadUrl.split('/').pop() || 'bom.pdf';
          downloadFile(response.pdfs.bomPdf.downloadUrl, filename, 300);
        }

        // Automatically download Quotation Excel
        if (response.excels?.quotationExcel?.downloadUrl) {
          const filename = response.excels.quotationExcel.downloadUrl.split('/').pop() || 'quotation.xlsx';
          downloadFile(response.excels.quotationExcel.downloadUrl, filename, 500);
        }

        // Automatically download BOM Excel
        if (response.excels?.bomExcel?.downloadUrl) {
          const filename = response.excels.bomExcel.downloadUrl.split('/').pop() || 'bom.xlsx';
          downloadFile(response.excels.bomExcel.downloadUrl, filename, 700);
        }
      }),
      map((response: any) => ({
        quotation: response.quotation,
        quotationUrl: response.pdfs?.quotationPdf?.downloadUrl ? `http://localhost:3000${response.pdfs.quotationPdf.downloadUrl}` : '',
        bomUrl: response.pdfs?.bomPdf?.downloadUrl ? `http://localhost:3000${response.pdfs.bomPdf.downloadUrl}` : ''
      }))
    );
  }

  generateBOMByQuoteRef(quoteRef: string): Observable<ExportResponse> {
    return this.http.post<ExportResponse>(`${this.apiUrl}/quotations/generate-bom/${quoteRef}`, {});
  }

  /**
   * Create a revision of an existing quotation
   * @param revisionData - The revision data with isRevision flag
   * @returns Observable of the created revision quotation
   */
  public createRevision(revisionData: any): Observable<any> {
    // Revisions are now handled through generateQuotationWithPDFs with isRevision flag
    return this.generateQuotationWithPDFs(revisionData).pipe(
      map(response => response.quotation)
    );
  }

  /**
   * Get quotation by reference number
   * @param quoteRef - The quotation reference number
   * @returns Observable of the quotation
   */
  public getQuotationByRef(quoteRef: string): Observable<any> {
    // Use getQuotationByNumber instead
    return this.getQuotationByNumber(quoteRef);
  }

  /**
   * Get revision count for a quotation reference
   * @param quoteRef - The quotation reference number
   * @returns Observable of the revision count
   */
  public getRevisionCount(quoteRef: string): Observable<number> {
    // This method is not implemented in the backend yet
    // Return 0 as default for now
    return of(0);
  }
}
