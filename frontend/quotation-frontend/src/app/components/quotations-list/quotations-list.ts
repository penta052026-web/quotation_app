import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { QuotationService } from '../../services/quotation';
import { API_CONFIG } from '../../api.config';


@Component({
  selector: 'app-quotations-list',
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './quotations-list.html',
  styleUrl: './quotations-list.scss'
})
export class QuotationsList implements OnInit {
  quotations: any[] = [];
  filteredQuotations: any[] = [];
  loading = true;
  searchTerm: string = '';

  constructor(
    private quotationService: QuotationService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadQuotations();
  }

  loadQuotations() {
    this.loading = true;
    this.quotationService.getAllQuotations().subscribe({
      next: (quotations) => {
        console.log('Raw quotations data:', quotations);
        
        // Map the data to ensure consistent property names
        this.quotations = Array.isArray(quotations) ? quotations.map(quote => ({
          ...quote,
          // Map different possible property names to expected ones
          quoteRef: quote.quotationNumber || quote.quoteRef || 'N/A',
          createdAt: quote.quotationDate || quote.createdAt || new Date().toISOString(),
          size: quote.size || 0,
          filename: quote.filename || `quotation_${quote.quotationNumber || 'unknown'}.pdf`
        })) : [];
        
        this.filteredQuotations = [...this.quotations];
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading quotations:', error);
        this.loading = false;
      }
    });
  }
  
  // Format date for display
  // Format date for display with time
  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      console.error('Error formatting date:', e);
      return 'Invalid Date';
    }
  }
  
  // Format file size in a human-readable format
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  onSearch() {
    if (!this.searchTerm.trim()) {
      this.filteredQuotations = this.quotations;
      return;
    }

    const term = this.searchTerm.toLowerCase();
    this.filteredQuotations = this.quotations.filter(quotation =>
      quotation.quoteRef.toLowerCase().includes(term) ||
      quotation.filename.toLowerCase().includes(term)
    );
  }

  downloadQuotationPDF(quoteRef: string) {
    if (!quoteRef || quoteRef === 'N/A') {
      alert('Invalid quotation reference');
      return;
    }
    
    // Construct the filename from quote ref
    const filename = `quotation_${quoteRef}.pdf`;
    
    // Try new folder structure first
    const newUrl = `${API_CONFIG.BASE_URL}/quotation-files/${quoteRef}/Quotation/PDF/${filename}`;
    const fallbackUrl = `${API_CONFIG.BASE_URL}/pdf/${filename}`;
    
    // Create download link
    const link = document.createElement('a');
    link.href = newUrl;
    link.download = filename;
    link.target = '_blank';
    link.style.display = 'none';
    document.body.appendChild(link);
    
    link.onerror = () => {
      // Fallback to old location
      link.href = fallbackUrl;
      link.click();
    };
    
    link.click();
    document.body.removeChild(link);
  }

  downloadBOMPDF(quoteRef: string) {
    // Generate and download BOM PDF for this quotation
    this.quotationService.generateBOMByQuoteRef(quoteRef).subscribe({
      next: (response) => {
        window.open(`${API_CONFIG.BASE_URL}${response.downloadUrl}`, '_blank');
      },
      error: (error) => {
        console.error('Error downloading BOM PDF:', error);
        alert('Error generating BOM PDF. Please try again.');
      }
    });
  }

  viewQuotation(quoteRef: string) {
    if (!quoteRef || quoteRef === 'N/A') {
      alert('Invalid quotation reference');
      return;
    }
    
    // Construct the filename from quote ref
    const filename = `quotation_${quoteRef}.pdf`;
    
    // Try new folder structure first
    const newUrl = `${API_CONFIG.BASE_URL}/quotation-files/${quoteRef}/Quotation/PDF/${filename}`;
    const fallbackUrl = `${API_CONFIG.BASE_URL}/pdf/${filename}`;
    
    // Try to open the PDF in a new tab
    // First try the new URL, if it fails, try the fallback
    fetch(newUrl, { method: 'HEAD' })
      .then(response => {
        if (response.ok) {
          window.open(newUrl, '_blank');
          return; 
        } else {
          // Try fallback URL
          return fetch(fallbackUrl, { method: 'HEAD' });
        }
      })
      .then(fallbackResponse => {
        if (fallbackResponse && fallbackResponse.ok) {
          window.open(fallbackUrl, '_blank');
        } else if (fallbackResponse) {
          // If both URLs fail, show error
          alert('PDF file not found. Please generate the quotation PDFs again.');
        }
      })
      .catch(error => {
        console.error('Error checking PDF file:', error);
        alert('Error accessing PDF file. Please try again or regenerate the quotation.');
      });
  }

  getTotalSize(): string {
    const totalBytes = this.quotations.reduce((total, quotation) => total + (quotation.size || 0), 0);
    return this.formatFileSize(totalBytes);
  }

  editQuotation(quotationId: string): void {
    if (!quotationId) {
      console.error('No quotation ID provided for editing');
      return;
    }
    
    // Navigate to the edit form with the quotation ID
    this.router.navigate(['/edit', quotationId]);
  }
}
