import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { ProductService } from '../../services/product';
import { QuotationService } from '../../services/quotation';
import { Product, QuotationRequest } from '../../models/models';

import { Observable, debounceTime, distinctUntilChanged } from 'rxjs';
import { PricelistItemSelectorComponent } from '../pricelist-item-selector/pricelist-item-selector.component';


import { API_CONFIG } from '../../api.config';

interface PartType {
  id?: string;
  part?: string; // Form control name for part description
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  productId: string | null;
  isCustomPart?: boolean;
}

interface ItemType {
  itemHeader: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  parts: PartType[];
}

interface ItemType {
  itemHeader: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  parts: PartType[];
  images: any[]; // Use the correct type if known, otherwise use 'any[]'
}

@Component({
  selector: 'app-quotation-form',
  imports: [CommonModule, ReactiveFormsModule, RouterModule, PricelistItemSelectorComponent],
  templateUrl: './quotation-form.html',
  styleUrl: './quotation-form.scss'
})
export class QuotationForm implements OnInit {
  quotationForm: FormGroup;
  products$: Observable<Product[]>;
  isGenerating = false;
  quotationNumberError: string = '';
  isCheckingQuotationNumber = false;
  originalQuotationNumber = '';
  isEditMode = false;
  quotationId: string | null = null;
  isLoading = false;
  
  constructor(
    private fb: FormBuilder,
    private productService: ProductService,
    public quotationService: QuotationService,
    private sanitizer: DomSanitizer,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.products$ = this.productService.products$;
    this.quotationForm = this.createForm();
  }

  ngOnInit() {
    // Check if we're in edit mode
    this.quotationId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.quotationId;
    
    if (this.isEditMode && this.quotationId) {
      this.loadQuotationForEdit(this.quotationId);
    }
    // Note: PQ number is now manually entered by user, not auto-generated
    
    // Set up real-time validation for quotation number
    const quotationNumberControl = this.quotationForm.get('quotationInfo.quotationNumber');
    if (quotationNumberControl) {
      quotationNumberControl.valueChanges.pipe(
        debounceTime(500),
        distinctUntilChanged()
      ).subscribe(() => {
        // Placeholder for future live validation if needed
      });
    }
  }

  private createForm(): FormGroup {
    return this.fb.group({
      quotationInfo: this.fb.group({
        // Quotation number must follow PQYYMMNNNN pattern, optionally with -REVn suffix
        quotationNumber: ['', [
          Validators.required,
          Validators.pattern(/^PQ\d{8}(-REV\d+)?$/)
        ]]
      }),
      clientInfo: this.fb.group({
        name: ['', Validators.required],
        address: [''],
        contactPerson: [''],
        email: ['', Validators.email],
        phone: ['']
      }),
      projectInfo: this.fb.group({
        name: ['', Validators.required],
        location: [''],
        inquiryNo: [''],
        inquiryDate: [new Date().toISOString().split('T')[0]],
        drawingNo: ['']
      }),
      items: this.fb.array([this.createItemForm()]),
      additionalItems: this.fb.array([]),
      terms: this.fb.group({
        deliveryTime: ['6-8 weeks for furniture and 8-12 weeks for fumecupboard and safety cabinets after receiving downpayment'],
        paymentTerms: ['50% advance payment, 50% balance payment before order collection'],
        warranty: ['10 Years for the phenolic worktop, 1 Year for the other items'],
        currency: ['AED']
      }),
      bankDetails: this.fb.group({
        name: ['PENTA FOR SCHOOLS&HOSP FURN MANF CO'],
        accountNo: ['4001 575368 500'],
        ibanAED: ['AE62 0090 0040 0157 5368 500'],
        ibanUSD: ['AE07 0090 0040 0157 5368 520'],
        ibanEUR: ['AE90 0090 0040 0157 5368 578'],
        bank: ['ARAB BANK']
      }),
      vatApplicable: [true],
      discountPercentage: [0, [Validators.min(0), Validators.max(100)]],
      vatPercentage: [5, [Validators.min(0), Validators.max(100)]]
    });
  }

  // Generate a new base PQ number in the format PQYYMMNNNN
  private generatePQNumber(): string {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2); // YY
    const month = String(now.getMonth() + 1).padStart(2, '0'); // MM
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0'); // NNNN
    return `PQ${year}${month}${random}`;
  }

  // Given an existing quotation number (with or without -REVn), compute the next revision number
  private getNextRevisionNumber(currentNumber: string): string {
    if (!currentNumber) {
      return this.generatePQNumber();
    }
    const match = currentNumber.match(/^(PQ\d{8})(?:-REV(\d+))?$/i);
    if (!match) {
      // If format is unexpected, fall back to generating a fresh PQ number
      return this.generatePQNumber();
    }
    const baseRef = match[1];
    const currentRev = match[2] ? parseInt(match[2], 10) : 0;
    const nextRev = currentRev + 1;
    return `${baseRef}-REV${nextRev}`;
  }

  private createItemForm(): FormGroup {
    return this.fb.group({
      itemHeader: ['', Validators.required], // Main item header
      description: [''], // Item description
      parts: this.fb.array([]), // Sub-parts from pricelist
      images: this.fb.array([]) // Array of images for the item
    });
  }

  private createPartForm(data: any = {}): FormGroup {
    // If data is a Product (from pricelist), use its properties; otherwise treat as stored/raw part data
    // Product objects have an `itemCode` field, whereas stored parts do not.
    const isProduct = data && typeof data === 'object' && 'description' in data && 'unitPrice' in data && 'itemCode' in data;
    
    const partData = isProduct 
      ? {
          part: data.description || '',
          description: data.description || '',
          unit: data.unit || 'Pcs',
          quantity: 1,
          unitPrice: data.unitPrice || 0,
          productId: data.id || null,
          isCustomPart: false
        }
      : (() => {
          // Determine if this is a custom part first
          const isCustom = typeof data.isCustomPart === 'boolean' ? data.isCustomPart : !data.productId;
          
          // For custom parts, preserve empty strings - never default to 'Part'
          // For non-custom parts, use provided values or default to 'Part' only if completely missing
          let partValue = '';
          if (data.hasOwnProperty('part')) {
            partValue = data.part; // Use provided value (even if empty string)
          } else if (data.hasOwnProperty('description')) {
            partValue = data.description; // Fallback to description
          } else if (!isCustom) {
            partValue = 'Part'; // Only default to 'Part' for non-custom parts with no data
          }
          
          return {
            part: partValue,
            description: data.hasOwnProperty('description') ? data.description : (data.part || ''),
            unit: data.unit || 'Pcs',
            quantity: data.quantity || 1,
            unitPrice: data.unitPrice || 0,
            productId: data.productId || null,
            isCustomPart: isCustom
          };
        })();

    return this.fb.group({
      part: [partData.part, Validators.required],
      description: [partData.description],
      unit: [partData.unit, Validators.required],
      quantity: [partData.quantity, [Validators.required, Validators.min(1)]],
      unitPrice: [partData.unitPrice, [Validators.required, Validators.min(0.01)]],
      productId: [partData.productId],
      isCustomPart: [partData.isCustomPart]
    });
  }

  private createCustomPartForm(): FormGroup {
    // Create a custom part with empty description fields so user can enter their own
    return this.fb.group({
      part: ['', Validators.required],
      description: [''],
      unit: ['Pcs', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      unitPrice: [0.01, [Validators.required, Validators.min(0.01)]],
      productId: [null],
      isCustomPart: [true]
    });
  }

  private createAdditionalItemForm(): FormGroup {
    return this.fb.group({
      description: ['', Validators.required], // Item description
      parts: this.fb.array([this.createAdditionalPartForm()]), // Sub-parts with pricing
      images: this.fb.array([]) // Array of images for the item
    });
  }

  private createAdditionalPartForm(): FormGroup {
    return this.fb.group({
      description: ['', Validators.required],
      unit: ['NOS', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      unitPrice: [0.01, [Validators.required, Validators.min(0.01)]]
    });
  }

  get itemsArray(): FormArray {
    const items = this.quotationForm.get('items');
    if (!items) {
      console.warn('Items form array not found, initializing...');
      this.quotationForm.setControl('items', this.fb.array([this.createItemForm()]));
      return this.quotationForm.get('items') as FormArray;
    }
    return items as FormArray;
  }

  getPartsArray(itemIndex: number): FormArray {
    const itemsArray = this.itemsArray;
    if (itemsArray.length <= itemIndex) {
      console.warn(`Item at index ${itemIndex} not found, adding new item`);
      itemsArray.push(this.createItemForm());
    }
    const item = itemsArray.at(itemIndex) as FormGroup;
    let parts = item.get('parts') as FormArray;
    if (!parts) {
      console.warn('Parts array not found, initializing...');
      parts = this.fb.array([]);
      item.setControl('parts', parts);
    }
    return parts;
  }

  get additionalItemsArray(): FormArray {
    const additionalItems = this.quotationForm.get('additionalItems');
    if (!additionalItems) {
      console.warn('Additional items form array not found, initializing...');
      this.quotationForm.setControl('additionalItems', this.fb.array([]));
      return this.quotationForm.get('additionalItems') as FormArray;
    }
    return additionalItems as FormArray;
  }

  getAdditionalPartsArray(itemIndex: number): FormArray {
    const additionalItemsArray = this.additionalItemsArray;
    if (additionalItemsArray.length <= itemIndex) {
      console.warn(`Additional item at index ${itemIndex} not found, adding new item`);
      additionalItemsArray.push(this.createAdditionalItemForm());
    }
    const item = additionalItemsArray.at(itemIndex) as FormGroup;
    let parts = item.get('parts') as FormArray;
    if (!parts) {
      console.warn('Additional item parts array not found, initializing...');
      parts = this.fb.array([this.createAdditionalPartForm()]);
      item.setControl('parts', parts);
    }
    return parts;
  }

  addItem(): void {
    this.itemsArray.push(this.createItemForm());
  }

  removeItem(index: number): void {
    if (this.itemsArray.length > 1) {
      this.itemsArray.removeAt(index);
    }
  }

  addPartToItem(itemIndex: number, product?: Product): void {
    const partsArray = this.getPartsArray(itemIndex);
    partsArray.push(this.createPartForm(product));
  }

  addCustomPartToItem(itemIndex: number): void {
    const partsArray = this.getPartsArray(itemIndex);
    partsArray.push(this.createCustomPartForm());
  }

  removePartFromItem(itemIndex: number, partIndex: number): void {
    const partsArray = this.getPartsArray(itemIndex);
    if (partsArray.length > 0) {
      partsArray.removeAt(partIndex);
    }
  }

  addAdditionalItem(): void {
    this.additionalItemsArray.push(this.createAdditionalItemForm());
  }

  removeAdditionalItem(index: number): void {
    this.additionalItemsArray.removeAt(index);
  }

  addPartToAdditionalItem(itemIndex: number): void {
    const partsArray = this.getAdditionalPartsArray(itemIndex);
    partsArray.push(this.createAdditionalPartForm());
  }

  removePartFromAdditionalItem(itemIndex: number, partIndex: number): void {
    const partsArray = this.getAdditionalPartsArray(itemIndex);
    if (partsArray.length > 1) {
      partsArray.removeAt(partIndex);
    }
  }

  calculateAdditionalItemSubtotal(itemIndex: number): number {
    const partsArray = this.getAdditionalPartsArray(itemIndex);
    let subtotal = 0;
    partsArray.controls.forEach(part => {
      const quantity = part.get('quantity')?.value || 0;
      const unitPrice = part.get('unitPrice')?.value || 0;
      subtotal += quantity * unitPrice;
    });
    return subtotal;
  }

  private createImageForm(imageData: string, fileName: string, fileSize: number): FormGroup {
    return this.fb.group({
      data: [imageData],
      fileName: [fileName],
      fileSize: [fileSize]
    });
  }

  getImagesArray(itemIndex: number, isAdditional: boolean = false): FormArray {
    const itemsArray = isAdditional ? this.additionalItemsArray : this.itemsArray;
    return itemsArray.at(itemIndex).get('images') as FormArray;
  }

  onImageSelected(event: any, itemIndex: number, isAdditional: boolean = false): void {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      // Validate file size (max 10MB for initial upload, will be compressed)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        alert('Image size must be less than 10MB. Please choose a smaller image.');
        event.target.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const imagesArray = this.getImagesArray(itemIndex, isAdditional);
          
          // Validate Base64 data
          const imageData = e.target.result;
          if (!imageData || typeof imageData !== 'string') {
            throw new Error('Invalid image data');
          }

          // Show compression message for large images
          if (file.size > 500 * 1024) { // 500KB
            console.log('Compressing large image...');
          }

          // Compress image if it's too large
          this.compressImage(imageData, file.name, file.size).then((compressedData) => {
            const imageForm = this.createImageForm(compressedData.data, compressedData.name, compressedData.size);
            imagesArray.push(imageForm);
            
            // Show compression result if significant
            if (file.size > compressedData.size * 2) {
              console.log(`Image compressed: ${(file.size / 1024).toFixed(1)}KB → ${(compressedData.size / 1024).toFixed(1)}KB`);
            }
          }).catch((error) => {
            console.error('Error compressing image:', error);
            alert('Error processing image. Please try a smaller image.');
          });
        } catch (error) {
          console.error('Error processing image:', error);
          alert('Error processing image. Please try a different image.');
        }
      };
      reader.onerror = () => {
        alert('Error reading image file. Please try again.');
      };
      reader.readAsDataURL(file);
    } else {
      alert('Please select a valid image file.');
    }
    // Reset the input
    event.target.value = '';
  }

  removeImage(itemIndex: number, imageIndex: number, isAdditional: boolean = false): void {
    const imagesArray = this.getImagesArray(itemIndex, isAdditional);
    imagesArray.removeAt(imageIndex);
  }

  hasImages(itemIndex: number, isAdditional: boolean = false): boolean {
    const imagesArray = this.getImagesArray(itemIndex, isAdditional);
    return imagesArray.length > 0;
  }

  getImageCount(itemIndex: number, isAdditional: boolean = false): number {
    const imagesArray = this.getImagesArray(itemIndex, isAdditional);
    return imagesArray.length;
  }

  private compressImage(imageData: string, fileName: string, fileSize: number): Promise<{data: string, name: string, size: number}> {
    return new Promise((resolve, reject) => {
      try {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Cannot create canvas context'));
            return;
          }

          // Much more aggressive compression - max 800px for PDF use
          const maxSize = 800;
          let { width, height } = img;
          
          if (width > height) {
            if (width > maxSize) {
              height = (height * maxSize) / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = (width * maxSize) / height;
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;

          // Draw and compress with aggressive settings
          ctx.drawImage(img, 0, 0, width, height);
          
          // Start with low quality and increase if needed
          let quality = 0.3; // Very aggressive compression
          let compressedData = canvas.toDataURL('image/jpeg', quality);
          let compressedSize = Math.round((compressedData.length * 3) / 4);
          
          // If still too large, reduce quality further
          while (compressedSize > 200 * 1024 && quality > 0.1) { // Target 200KB max
            quality -= 0.05;
            compressedData = canvas.toDataURL('image/jpeg', quality);
            compressedSize = Math.round((compressedData.length * 3) / 4);
          }
          
          console.log(`Compressed image from ${fileSize} bytes to ${compressedSize} bytes (quality: ${quality})`);
          
          resolve({
            data: compressedData,
            name: fileName.replace(/\.[^/.]+$/, '.jpg'), // Change extension to jpg
            size: compressedSize
          });
        };
        
        img.onerror = () => {
          reject(new Error('Failed to load image for compression'));
        };
        
        img.src = imageData;
      } catch (error) {
        reject(error);
      }
    });
  }

  onProductSelect(index: number, product: Product): void {
    const itemForm = this.itemsArray.at(index) as FormGroup;
    itemForm.patchValue({
      description: product.description,
      unit: product.unit,
      unitPrice: product.unitPrice
    });
  }

  onPricelistItemSelected(itemIndex: number, product: Product): void {
    // Add the selected product as a part to the specified item
    this.addPartToItem(itemIndex, product);
  }

  calculateItemSubtotal(itemIndex: number): number {
    const partsArray = this.getPartsArray(itemIndex);
    let subtotal = 0;
    partsArray.controls.forEach(partControl => {
      const part = partControl.value;
      subtotal += (part.unitPrice || 0) * (part.quantity || 0);
    });
    return subtotal;
  }

  calculateSubtotal(): number {
    let subtotal = 0;
    
    // Calculate subtotal from regular items
    for (let i = 0; i < this.itemsArray.length; i++) {
      subtotal += this.calculateItemSubtotal(i);
    }
    
    // Calculate subtotal from additional items
    for (let i = 0; i < this.additionalItemsArray.length; i++) {
      subtotal += this.calculateAdditionalItemSubtotal(i);
    }
    
    return subtotal;
  }

  calculateDiscountAmount(): number {
    const subtotal = this.calculateSubtotal();
    const discountPercentage = this.quotationForm.get('discountPercentage')?.value || 0;
    return subtotal * (discountPercentage / 100);
  }

  calculateSubtotalAfterDiscount(): number {
    const subtotal = this.calculateSubtotal();
    const discountAmount = this.calculateDiscountAmount();
    return subtotal - discountAmount;
  }

  calculateVATAmount(): number {
    const subtotalAfterDiscount = this.calculateSubtotalAfterDiscount();
    const vatApplicable = this.quotationForm.get('vatApplicable')?.value;
    return vatApplicable ? subtotalAfterDiscount * 0.05 : 0;
  }

  calculateTotal(): number {
    const subtotalAfterDiscount = this.calculateSubtotalAfterDiscount();
    const vatAmount = this.calculateVATAmount();
    return subtotalAfterDiscount + vatAmount;
  }

  hasCurrentQuotation(): boolean {
    return this.quotationService.getCurrentQuotation() !== null;
  }

  hasZeroPricedItems(): boolean {
    // Check regular items
    for (let i = 0; i < this.itemsArray.length; i++) {
      const partsArray = this.getPartsArray(i);
      const hasZeroPricedPart = partsArray.controls.some(partControl => {
        const part = partControl.value;
        return !part.unitPrice || part.unitPrice < 0.01;
      });
      if (hasZeroPricedPart) {
        return true;
      }
    }
    
    // Check additional items
    for (let i = 0; i < this.additionalItemsArray.length; i++) {
      const partsArray = this.getAdditionalPartsArray(i);
      const hasZeroPricedPart = partsArray.controls.some(partControl => {
        const part = partControl.value;
        return !part.unitPrice || part.unitPrice < 0.01;
      });
      if (hasZeroPricedPart) {
        return true;
      }
    }
    
    return false;
  }

  hasInvalidQuantities(): boolean {
    // Check regular items
    for (let i = 0; i < this.itemsArray.length; i++) {
      const partsArray = this.getPartsArray(i);
      const hasInvalidQuantity = partsArray.controls.some(partControl => {
        const part = partControl.value;
        return !part.quantity || part.quantity < 1;
      });
      if (hasInvalidQuantity) {
        return true;
      }
    }
    
    // Check additional items
    for (let i = 0; i < this.additionalItemsArray.length; i++) {
      const partsArray = this.getAdditionalPartsArray(i);
      const hasInvalidQuantity = partsArray.controls.some(partControl => {
        const part = partControl.value;
        return !part.quantity || part.quantity < 1;
      });
      if (hasInvalidQuantity) {
        return true;
      }
    }
    
    return false;
  }

  hasMissingDescriptions(): boolean {
    // Check regular items
    for (let i = 0; i < this.itemsArray.length; i++) {
      const partsArray = this.getPartsArray(i);
      const hasMissingDescription = partsArray.controls.some(partControl => {
        const part = partControl.value;
        return !part.part || part.part.trim() === '';
      });
      if (hasMissingDescription) {
        return true;
      }
    }
    
    // Check additional items
    for (let i = 0; i < this.additionalItemsArray.length; i++) {
      const partsArray = this.getAdditionalPartsArray(i);
      const hasMissingDescription = partsArray.controls.some(partControl => {
        const part = partControl.value;
        return !part.description || part.description.trim() === '';
      });
      if (hasMissingDescription) {
        return true;
      }
    }
    
    return false;
  }

  hasItemsWithoutParts(): boolean {
    for (let i = 0; i < this.itemsArray.length; i++) {
      const partsArray = this.getPartsArray(i);
      if (partsArray.length === 0) {
        return true;
      }
    }
    return false;
  }

  getValidationErrors(): string[] {
    const errors: string[] = [];
    
    // Check quotation number first
    if (this.quotationNumberError) {
      errors.push(this.quotationNumberError);
    }
    
    if (this.isCheckingQuotationNumber) {
      errors.push('Please wait while we validate the quotation number.');
    }
    
    // Form validation
    if (!this.quotationForm.valid) {
      errors.push('Please fill in all required fields.');
    }
    
    if (this.hasItemsWithoutParts()) {
      errors.push('All items must have at least one part.');
    }
    
    if (this.hasMissingDescriptions()) {
      errors.push('All parts must have a description.');
    }
    
    if (this.hasInvalidQuantities()) {
      errors.push('All parts must have a quantity of at least 1.');
    }
    
    if (this.hasZeroPricedItems()) {
      errors.push('All parts must have a unit price of at least 0.01.');
    }
    
    if (this.calculateSubtotal() === 0) {
      errors.push('Total amount cannot be zero. Please add parts with valid prices.');
    }
    
    return errors;
  }

  getButtonDisabledReasons(): string[] {
    const reasons: string[] = [];
    
    if (this.isGenerating) {
      reasons.push('Currently generating quotation');
    }
    
    if (!this.quotationForm.valid) {
      const invalidFields = this.getInvalidFields();
      reasons.push(`Form is invalid - Missing required fields: ${invalidFields.join(', ')}`);
    }
    
    if (this.hasZeroPricedItems()) {
      reasons.push('Some parts have zero or invalid prices');
    }
    
    if (this.hasItemsWithoutParts()) {
      const itemsWithoutParts = this.getItemsWithoutPartsDetails();
      reasons.push(`Items without parts: ${itemsWithoutParts.join(', ')}`);
    }
    
    if (this.calculateSubtotal() === 0) {
      reasons.push('Total amount is zero - Add parts with prices to items');
    }
    
    return reasons;
  }
  
  getInvalidFields(): string[] {
    const invalidFields: string[] = [];
    
    // Check quotation info
    const quotationInfo = this.quotationForm.get('quotationInfo');
    if (quotationInfo?.get('quotationNumber')?.invalid) invalidFields.push('Quotation Number');
    
    const clientInfo = this.quotationForm.get('clientInfo');
    if (clientInfo?.get('name')?.invalid) invalidFields.push('Client Name');
    if (clientInfo?.get('email')?.invalid) invalidFields.push('Client Email');
    
    const projectInfo = this.quotationForm.get('projectInfo');
    if (projectInfo?.get('name')?.invalid) invalidFields.push('Project Name');
    
    // Check items
    for (let i = 0; i < this.itemsArray.length; i++) {
      const item = this.itemsArray.at(i);
      if (item.get('itemHeader')?.invalid) {
        invalidFields.push(`Item ${i + 1} Description`);
      }
    }
    
    // Check additional items
    for (let i = 0; i < this.additionalItemsArray.length; i++) {
      const additionalItem = this.additionalItemsArray.at(i);
      if (additionalItem.get('description')?.invalid) {
        invalidFields.push(`Additional Item ${i + 1} Description`);
      }
    }
    
    return invalidFields;
  }
  
  getItemsWithoutPartsDetails(): string[] {
    const itemsWithoutParts: string[] = [];
    
    for (let i = 0; i < this.itemsArray.length; i++) {
      const partsArray = this.getPartsArray(i);
      if (partsArray.length === 0) {
        itemsWithoutParts.push(`Item ${i + 1}`);
      }
    }
    
    return itemsWithoutParts;
  }

  showValidationErrors(errors: string[]): void {
    // Scroll to first invalid field
    const firstInvalidField = document.querySelector('.form-input.error, .form-textarea.error');
    if (firstInvalidField) {
      firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    // Show a more professional error message
    const errorMessage = errors.length === 1 ? errors[0] : 
      `Please address the following issues:\n• ${errors.join('\n• ')}`;
    
    alert(errorMessage);
  }

  onSubmit(): void {
    const formValue = this.quotationForm.value;
    
    // Log the item hierarchy before processing
    console.log('\n=== QUOTATION ITEM HIERARCHY ===');
    console.log(`Total items: ${formValue.items?.length || 0}`);
    
    if (formValue.items && formValue.items.length > 0) {
      formValue.items.forEach((item: any, index: number) => {
        console.group(`Item ${index + 1}: ${item.itemHeader || 'No Header'}`);
        console.log('Description:', item.description || 'No description');
        console.log('Unit:', item.unit || 'Pcs');
        console.log('Quantity:', item.quantity || 1);
        console.log('Unit Price:', item.unitPrice || 0);
        
        if (item.parts && item.parts.length > 0) {
          console.group('Parts:');
          item.parts.forEach((part: any, partIndex: number) => {
            console.group(`Part ${partIndex + 1}`);
            console.log('Description:', part.description || part.part || 'No description');
            console.log('Unit:', part.unit || 'Pcs');
            console.log('Quantity:', part.quantity || 1);
            console.log('Unit Price:', part.unitPrice || 0);
            console.log('Total:', (part.quantity || 0) * (part.unitPrice || 0));
            console.groupEnd();
          });
          console.groupEnd();
        } else {
          console.log('No parts for this item');
        }
        console.groupEnd();
      });
    } else {
      console.log('No items in the quotation');
    }
    console.log('=== END OF ITEM HIERARCHY ===\n');
    
    const validationErrors = this.getValidationErrors();
    
    if (validationErrors.length > 0) {
      // Show more professional error handling
      this.showValidationErrors(validationErrors);
      return;
    }
    
    this.isGenerating = true;
    
    // Transform hierarchical items to flat structure for backend
    const flattenedItems: any[] = [];
    let currentItemIndex = 0;
    
    // Process regular items
    formValue.items.forEach((item: ItemType, index: number) => {
      if (item.parts && item.parts.length > 0) {
        // Add item header
        const itemImages = item.images ? item.images.map((img: any) => {
          try {
            // Ensure we have valid image data
            if (img && img.data && typeof img.data === 'string') {
              return img.data;
            }
            return null;
          } catch (error) {
            console.error('Error processing image data:', error);
            return null;
          }
        }).filter((img: string | null) => img !== null) : [];
        
        flattenedItems.push({
          description: item.itemHeader,
          quantity: 1,
          unit: 'ITEM',
          unitPrice: 0,
          isItemHeader: true,
          itemIndex: currentItemIndex,
          images: itemImages // Include validated images array
        });
        
        // Debug logging
        console.log(`Item "${item.itemHeader}" has ${itemImages.length} images in submission`);
        
        // Add all parts under this item
        item.parts.forEach((part: PartType, partIndex: number) => {
          // Ensure description is correctly read from form - check both part and description fields
          const partDescription = part.part || part.description || '';
          
          flattenedItems.push({
            description: partDescription, // Use part field first (form control name), then description
            quantity: part.quantity || 1,
            unit: part.unit || 'Pcs',
            unitPrice: part.unitPrice || 0,
            isItemHeader: false,
            itemIndex: currentItemIndex,
            partIndex: partIndex + 1
          });
        });
        
        // Add subtotal row
        flattenedItems.push({
          description: `SUBTOTAL`,
          quantity: 1,
          unit: '',
          unitPrice: this.calculateItemSubtotal(currentItemIndex),
          isSubtotal: true,
          itemIndex: currentItemIndex
        });
        
        currentItemIndex++;
      }
    });
    
    // Process additional items (frontend-only) - structured like regular items with header
    if (formValue.additionalItems && formValue.additionalItems.length > 0) {
      formValue.additionalItems.forEach((additionalItem: any, additionalItemIndex: number) => {
        if (additionalItem.parts && additionalItem.parts.length > 0) {
          // Process images for additional item
          const additionalItemImages = additionalItem.images ? additionalItem.images.map((img: any) => {
            try {
              // Ensure we have valid image data
              if (img && img.data && typeof img.data === 'string') {
                return img.data;
              }
              return null;
            } catch (error) {
              console.error('Error processing additional item image data:', error);
              return null;
            }
          }).filter((img: string | null) => img !== null) : [];
          
          // Add item header for additional item (using item description)
          const itemDescription = additionalItem.description || 'Additional Item';
          flattenedItems.push({
            description: itemDescription,
            quantity: 1,
            unit: 'ITEM',
            unitPrice: 0,
            isItemHeader: true,
            itemIndex: currentItemIndex,
            images: additionalItemImages, // Include images with the header
            isAdditionalItem: true // Mark as additional item
          });
          
          // Debug logging
          console.log(`Additional Item "${itemDescription}" has ${additionalItemImages.length} images in submission`);
          
          // Add all parts under this additional item
          additionalItem.parts.forEach((part: any, partIndex: number) => {
            // Ensure description is correctly read from form
            const partDescription = part.description || part.part || '';
            
            flattenedItems.push({
              description: partDescription, // Use description field from form
              quantity: part.quantity || 1,
              unit: part.unit || 'NOS',
              unitPrice: part.unitPrice || 0,
              isItemHeader: false,
              itemIndex: currentItemIndex,
              partIndex: partIndex + 1,
              isAdditionalItem: true // Mark as additional item
            });
          });
          
          // Add subtotal row for additional item
          const calculatedIndex = additionalItemIndex;
          flattenedItems.push({
            description: `SUBTOTAL`,
            quantity: 1,
            unit: '',
            unitPrice: this.calculateAdditionalItemSubtotal(calculatedIndex),
            isSubtotal: true,
            itemIndex: currentItemIndex,
            isAdditionalItem: true // Mark as additional item
          });
          
          currentItemIndex++;
        }
      });
    }
    
    const quotationRequest: QuotationRequest = {
      quotationNumber: formValue.quotationInfo.quotationNumber, // Manual quotation number
      clientInfo: formValue.clientInfo,
      projectInfo: formValue.projectInfo,
      items: flattenedItems, // Now includes both regular and additional items
      terms: formValue.terms,
      bankDetails: formValue.bankDetails,
      currency: formValue.terms.currency, // Extract currency to top level
      discountPercentage: formValue.discountPercentage,
      vatPercentage: formValue.vatPercentage
    };

    if (this.isEditMode && this.quotationId) {
      // Build hierarchical items structure (kept for potential future DB sync)
      const updateItems: any[] = [];

      // Regular items with parts
      if (formValue.items && formValue.items.length > 0) {
        formValue.items.forEach((item: any) => {
          const parts = (item.parts || []).map((part: any) => ({
            description: part.part || part.description || '', // Check part field first (form control name)
            unit: part.unit || 'Pcs',
            quantity: part.quantity || 1,
            unitPrice: part.unitPrice || 0,
            productId: part.productId || null,
            isCustomPart: part.isCustomPart || !part.productId
          }));

          updateItems.push({
            itemHeader: item.itemHeader || '',
            description: item.description || item.itemHeader || '',
            quantity: 1,
            unit: 'ITEM',
            unitPrice: 0,
            productId: null,
            parts
          });
        });
      }

      // Additional items (frontend-only) - structured like regular items with header
      if (formValue.additionalItems && formValue.additionalItems.length > 0) {
        formValue.additionalItems.forEach((additionalItem: any) => {
          const parts = (additionalItem.parts || []).map((part: any) => ({
            description: part.description || '', // Additional items use description field
            unit: part.unit || 'NOS',
            quantity: part.quantity || 1,
            unitPrice: part.unitPrice || 0,
            productId: null,
            isCustomPart: true
          }));

          // For additional items, use the item's description field as the header
          const itemDescription = additionalItem.description || (parts.length > 0 ? parts[0].description : 'Additional Item');
          
          updateItems.push({
            itemHeader: itemDescription, // Use item description as header
            description: itemDescription,
            quantity: 1,
            unit: 'ITEM',
            unitPrice: 0,
            productId: null,
            parts,
            isAdditionalItem: true // Mark as additional item
          });
        });
      }

      // Calculate totals
      const subtotal = this.calculateSubtotal();
      const vatAmount = this.calculateVATAmount();
      const totalAmount = this.calculateTotal();

      // Derive base quotation reference and next revision number
      const baseNumber: string = this.originalQuotationNumber || formValue.quotationInfo.quotationNumber || '';
      const match = baseNumber.match(/^(PQ\d{8})(?:-REV(\d+))?$/i);
      const baseRef = match ? match[1] : baseNumber.split('-')[0];
      const revisionQuotationNumber = this.getNextRevisionNumber(baseNumber);

      // Use revision number when editing
      const revisionRequest: QuotationRequest = {
        ...quotationRequest,
        quotationNumber: revisionQuotationNumber,
        discountPercentage: formValue.discountPercentage,
        vatPercentage: formValue.vatPercentage,
        // Inform backend that this is a revision of an existing quotation
        isRevision: true,
        quoteRef: baseRef
      };

      this.quotationService.generateAndDownloadBothPDFs(revisionRequest).subscribe({
        next: (result: any) => {
          this.quotationService.setCurrentQuotation(result.quotation);
          this.isGenerating = false;
          alert(`Revision ${revisionQuotationNumber} generated successfully.`);
          this.router.navigate(['/quotations']);
        },
        error: (error: any) => {
          this.isGenerating = false;
          console.error('Error generating quotation revision:', error);

          let errorMessage = 'Error generating quotation revision. ';
          if (error.status === 413) {
            errorMessage += 'The request is too large, possibly due to image size. Please use smaller images.';
          } else if (error.status === 500) {
            errorMessage += 'Server error occurred. Please try again or contact support.';
          } else if (error.status === 409) {
            errorMessage = 'Error: This quotation number already exists. Please use a different quotation number.';
          } else if (error.error && error.error.message) {
            errorMessage += error.error.message;
          } else {
            errorMessage += 'Please try again. If the problem persists, try removing images and adding them back.';
          }

          alert(errorMessage);
        }
      });
    } else {
      // Generate quotation and automatically download both PDFs
      this.quotationService.generateAndDownloadBothPDFs(quotationRequest).subscribe({
        next: (result: any) => {
          this.quotationService.setCurrentQuotation(result.quotation);
          this.isGenerating = false;
          console.log('Quotation generated successfully');
        },
        error: (error: any) => {
          this.isGenerating = false;
          console.error('Error generating quotation:', error);
          
          // Provide more specific error messages
          let errorMessage = 'Error generating quotation. ';
          if (error.status === 413) {
            errorMessage += 'The request is too large, possibly due to image size. Please use smaller images.';
          } else if (error.status === 500) {
            errorMessage += 'Server error occurred. Please try again or contact support.';
          } else if (error.status === 409) {
            errorMessage = 'Error: This quotation number already exists. Please use a different quotation number.';
          } else if (error.error && error.error.message) {
            errorMessage += error.error.message;
          } else {
            errorMessage += 'Please try again. If the problem persists, try removing images and adding them back.';
          }
          
          alert(errorMessage);
        }
      });
    }
  }

  exportToExcel(): void {
    const currentQuotation = this.quotationService.getCurrentQuotation();
    if (currentQuotation) {
      this.quotationService.exportToExcel(currentQuotation).subscribe({
        next: (response) => {
          window.open(`${API_CONFIG.BASE_URL}${response.downloadUrl}`, '_blank');
        },
        error: (error) => {
          console.error('Export error:', error);
          alert('Error exporting to Excel');
        }
      });
    }
  }

  exportToPDF(): void {
    const currentQuotation = this.quotationService.getCurrentQuotation();
    if (currentQuotation) {
      this.quotationService.exportToPDF(currentQuotation).subscribe({
        next: (response) => {
          window.open(`${API_CONFIG.BASE_URL}${response.downloadUrl}`, '_blank');
        },
        error: (error) => {
          console.error('Export error:', error);
          alert('Error exporting to PDF');
        }
      });
    }
  }

  downloadQuotationPDF(): void {
    const currentQuotation = this.quotationService.getCurrentQuotation();
    if (currentQuotation) {
      this.quotationService.exportToPDF(currentQuotation).subscribe({
        next: (response) => {
          window.open(`${API_CONFIG.BASE_URL}${response.downloadUrl}`, '_blank');
        },
        error: (error) => {
          console.error('Error downloading quotation PDF:', error);
          alert('Error downloading quotation PDF. Please try again.');
        }
      });
    }
  }

  downloadBOMPDF(): void {
    const currentQuotation = this.quotationService.getCurrentQuotation();
    if (currentQuotation) {
      this.quotationService.exportBOMToPDF(currentQuotation).subscribe({
        next: (response) => {
          window.open(`${API_CONFIG.BASE_URL}${response.downloadUrl}`, '_blank');
        },
        error: (error) => {
          console.error('Error downloading BOM PDF:', error);
          alert('Error downloading BOM PDF. Please try again.');
        }
      });
    }
  }

  downloadQuotationExcel(): void {
    const currentQuotation = this.quotationService.getCurrentQuotation();
    if (currentQuotation) {
      this.quotationService.exportToExcel(currentQuotation).subscribe({
        next: (response) => {
          window.open(`${API_CONFIG.BASE_URL}${response.downloadUrl}`, '_blank');
        },
        error: (error) => {
          console.error('Error downloading quotation Excel:', error);
          alert('Error downloading quotation Excel. Please try again.');
        }
      });
    }
  }

  downloadBOMExcel(): void {
    const currentQuotation = this.quotationService.getCurrentQuotation();
    if (currentQuotation) {
      this.quotationService.exportBOMToExcel(currentQuotation).subscribe({
        next: (response) => {
          window.open(`${API_CONFIG.BASE_URL}${response.downloadUrl}`, '_blank');
        },
        error: (error) => {
          console.error('Error downloading BOM Excel:', error);
          alert('Error downloading BOM Excel. Please try again.');
        }
      });
    }
  }

  // Load existing quotation for editing
  loadQuotationForEdit(quotationId: string): void {
    this.isLoading = true;
    
    this.quotationService.getQuotationById(quotationId).subscribe({
      next: (quotation) => {
        console.log('Loaded quotation for editing:', quotation);
        this.populateFormFromQuotation(quotation);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading quotation for edit:', error);
        alert('Error loading quotation data. Please try again.');
        this.isLoading = false;
        this.router.navigate(['/quotations']);
      }
    });
  }

  // Transform database quotation structure back to form structure
  populateFormFromQuotation(quotation: any): void {
    try {
      // Parse terms if it's a JSON string
      let terms: any = {};
      if (quotation.terms) {
        try {
          terms = typeof quotation.terms === 'string' ? JSON.parse(quotation.terms) : quotation.terms;
        } catch (e) {
          console.error('Error parsing terms:', e);
          terms = {};
        }
      }

      // Transform the hierarchical items structure
      const transformedItems = this.transformQuotationItemsToFormStructure(quotation.items || []);

      // Populate the form with quotation data
      this.quotationForm.patchValue({
        quotationInfo: {
          quotationNumber: quotation.quotationNumber || ''
        },
        clientInfo: {
          name: quotation.clientName || '',
          email: quotation.clientEmail || '',
          phone: quotation.clientPhone || '',
          address: quotation.clientAddress || '',
          contactPerson: '' // This field might not exist in DB, keep empty
        },
        projectInfo: {
          name: quotation.projectName || '',
          location: '',
          inquiryNo: '',
          inquiryDate: quotation.quotationDate || new Date().toISOString().split('T')[0],
          drawingNo: ''
        },
        terms: {
          deliveryTime: terms.deliveryTime || '6-8 weeks for furniture and 8-12 weeks for fumecupboard and safety cabinets after receiving downpayment',
          paymentTerms: terms.paymentTerms || '50% advance payment, 50% balance payment before order collection',
          warranty: terms.warranty || '10 Years for the phenolic worktop, 1 Year for the other items',
          currency: terms.currency || 'AED'
        },
        // Derive VAT applicability and discount from stored pricing fields
        vatApplicable: (quotation.vatRate || 0) > 0,
        discountPercentage: this.calculateDiscountPercentageFromQuotation(quotation),
        vatPercentage: quotation.vatRate || 5
      });

      // Clear existing items and populate with transformed data
      const itemsArray = this.quotationForm.get('items') as FormArray;
      itemsArray.clear();
      
      transformedItems.forEach(item => {
        itemsArray.push(this.createItemFormFromData(item));
      });
      
      // Store original quotation number for validation
      this.originalQuotationNumber = quotation.quotationNumber || '';

      // For edit mode, automatically compute and display the next revision number
      // E.g., if original is PQ25121234, show PQ25121234-REV1
      // If original is PQ25121234-REV1, show PQ25121234-REV2
      const quotationNumberControl = this.quotationForm.get('quotationInfo.quotationNumber');
      if (quotationNumberControl && this.originalQuotationNumber) {
        const nextRevNumber = this.getNextRevisionNumber(this.originalQuotationNumber);
        quotationNumberControl.setValue(nextRevNumber);
      }
      
      console.log('Form populated successfully with quotation data');
      
    } catch (error) {
      console.error('Error populating form from quotation:', error);
      alert('Error loading quotation data. Some fields may not be populated correctly.');
    }
  }

  // Calculate discount percentage using stored subtotal, VAT and total amount
  private calculateDiscountPercentageFromQuotation(quotation: any): number {
    // If discount percentage is already stored in the database, use it directly
    if (quotation.discountPercentage !== undefined && quotation.discountPercentage !== null) {
      return Number(quotation.discountPercentage);
    }

    // Otherwise, reverse-engineer from the totals
    const subtotal = Number(quotation.subtotal || 0);
    const vatAmount = Number(quotation.vatAmount || 0);
    const totalAmount = Number(quotation.totalAmount || 0);
    const vatRate = Number(quotation.vatRate || 5);

    if (!subtotal || subtotal <= 0) {
      return 0;
    }

    // Correct formula to reverse-engineer discount percentage:
    // Given: totalAmount = (subtotal - discountAmount) + vatAmount
    // And: vatAmount = (subtotal - discountAmount) * (vatRate / 100)
    // Therefore: totalAmount = (subtotal - discountAmount) * (1 + vatRate/100)
    // So: subtotal - discountAmount = totalAmount / (1 + vatRate/100)
    // Thus: discountAmount = subtotal - (totalAmount / (1 + vatRate/100))
    
    const subtotalAfterDiscount = totalAmount / (1 + vatRate / 100);
    const discountAmount = subtotal - subtotalAfterDiscount;
    
    if (discountAmount <= 0) {
      return 0;
    }

    const discountPercentage = (discountAmount / subtotal) * 100;
    // Round to 2 decimal places for a clean UI value
    return Math.round(discountPercentage * 100) / 100;
  }

  // Transform database items back to hierarchical form structure
  // Supports both:
  // 1) New hierarchical structure from backend (items already have `parts` arrays)
  // 2) Legacy flat structure where parent/child is expressed via `parentItemId`
  transformQuotationItemsToFormStructure(dbItems: any[]): any[] {
    if (!dbItems || dbItems.length === 0) {
      return [];
    }

    console.log('transformQuotationItemsToFormStructure: Processing', dbItems.length, 'items');
    
    const hasParentIds = dbItems.some(item => !!item.parentItemId);
    const hasPartsArrays = dbItems.some(item => Array.isArray(item.parts));
    
    console.log('hasParentIds:', hasParentIds, 'hasPartsArrays:', hasPartsArrays);

    // Case 1: Backend already returns hierarchical items with `parts`
    if (!hasParentIds && hasPartsArrays) {
      return dbItems.map(dbItem => {
        // Parse images if they're stored as JSON string
        let images: string[] = [];
        if (dbItem.images) {
          try {
            if (typeof dbItem.images === 'string') {
              console.log(`Parsing images JSON string for item "${dbItem.itemHeader || dbItem.description}"`);
              const parsed = JSON.parse(dbItem.images);
              images = Array.isArray(parsed) ? parsed : [];
              console.log(`  Parsed ${images.length} images`);
            } else if (Array.isArray(dbItem.images)) {
              images = dbItem.images;
              console.log(`Item "${dbItem.itemHeader || dbItem.description}" has ${images.length} images (already array)`);
            }
          } catch (e) {
            console.error('Error parsing images:', e);
            images = [];
          }
        } else {
          console.log(`Item "${dbItem.itemHeader || dbItem.description}" has no images property`);
        }
        
        return {
          id: dbItem.id,
          itemHeader: dbItem.itemHeader || dbItem.customDescription || dbItem.description || '',
          description: dbItem.description || dbItem.customDescription || dbItem.itemHeader || '',
          unit: dbItem.unit || 'ITEM',
          quantity: dbItem.quantity || 1,
          unitPrice: dbItem.unitPrice || 0,
          images: images,
          parts: (dbItem.parts || []).map((part: any) => ({
            id: part.id,
            part: part.customDescription || part.description || '',
            description: part.customDescription || part.description || '',
            unit: part.unit || 'Pcs',
            quantity: part.quantity || 1,
            unitPrice: part.unitPrice || 0,
            productId: part.productId,
            isCustomPart: !part.productId
          }))
        };
      });
    }

    // Case 2: Legacy flat structure with parentItemId
    const itemsMap = new Map();
    const rootItems: any[] = [];

    // Helper function to parse images from database
    const parseImages = (dbItem: any): string[] => {
      if (!dbItem.images) {
        return [];
      }
      
      try {
        // If images is a string (JSON), parse it
        if (typeof dbItem.images === 'string') {
          const parsed = JSON.parse(dbItem.images);
          return Array.isArray(parsed) ? parsed : [];
        }
        // If images is already an array, return it
        if (Array.isArray(dbItem.images)) {
          return dbItem.images;
        }
        return [];
      } catch (e) {
        console.error('Error parsing images:', e);
        return [];
      }
    };

    // Group items by their hierarchical structure
    dbItems.forEach(dbItem => {
      if (!dbItem.parentItemId) {
        // This is a root item (item header)
        // Parse images from the database item
        const images = parseImages(dbItem);
        console.log(`Root item "${dbItem.customDescription || dbItem.description}" has ${images.length} images`);
        
        const item = {
          id: dbItem.id,
          itemHeader: dbItem.customDescription || dbItem.description || '',
          description: dbItem.customDescription || dbItem.description || '',
          unit: dbItem.unit || 'Pcs',
          quantity: dbItem.quantity || 1,
          unitPrice: dbItem.unitPrice || 0,
          parts: [],
          images: images // Populate images from database
        };
        itemsMap.set(dbItem.id, item);
        rootItems.push(item);
      }
    });
    
    // Add parts to their respective parent items
    dbItems.forEach(dbItem => {
      if (dbItem.parentItemId && itemsMap.has(dbItem.parentItemId)) {
        const parentItem = itemsMap.get(dbItem.parentItemId);
        parentItem.parts.push({
          id: dbItem.id,
          part: dbItem.customDescription || dbItem.description || '',
          description: dbItem.customDescription || dbItem.description || '',
          unit: dbItem.unit || 'Pcs',
          quantity: dbItem.quantity || 1,
          unitPrice: dbItem.unitPrice || 0,
          productId: dbItem.productId,
          isCustomPart: !dbItem.productId
        });
      }
    });
    
    return rootItems;
  }

  // Create form group from existing item data
  createItemFormFromData(itemData: any): FormGroup {
    const itemForm = this.fb.group({
      itemHeader: [itemData.itemHeader || '', Validators.required],
      description: [itemData.description || ''],
      parts: this.fb.array([]),
      images: this.fb.array([])
    });

    // Add parts to the item
    const partsArray = itemForm.get('parts') as FormArray;
    if (itemData.parts && itemData.parts.length > 0) {
      itemData.parts.forEach((partData: any) => {
        partsArray.push(this.createPartForm(partData));
      });
    }

    // Add images to the item
    const imagesArray = itemForm.get('images') as FormArray;
    if (itemData.images && Array.isArray(itemData.images) && itemData.images.length > 0) {
      console.log(`Loading ${itemData.images.length} images for item "${itemData.itemHeader}"`);
      itemData.images.forEach((imageData: string, index: number) => {
        if (imageData && typeof imageData === 'string') {
          // Ensure image data has data URL prefix if it's missing
          let processedImageData = imageData;
          if (!imageData.startsWith('data:image/')) {
            // If it's just base64 without prefix, try to detect format or default to JPEG
            // Check if it looks like base64
            if (/^[A-Za-z0-9+/=]+$/.test(imageData)) {
              processedImageData = `data:image/jpeg;base64,${imageData}`;
              console.log(`  Image ${index + 1}: Added data URL prefix (assumed JPEG)`);
            } else {
              console.warn(`  Image ${index + 1}: Invalid base64 format, skipping`);
              return;
            }
          }
          
          // Estimate file size from base64 data (base64 is ~33% larger than binary)
          const base64Length = processedImageData.includes(',') 
            ? processedImageData.split(',')[1].length 
            : processedImageData.length;
          const estimatedSize = Math.round((base64Length * 3) / 4);
          
          // Extract filename - try to preserve original or use default
          const fileName = `image_${index + 1}.jpg`;
          
          // Create image form with base64 data
          imagesArray.push(this.createImageForm(processedImageData, fileName, estimatedSize));
          console.log(`  Added image ${index + 1} (length: ${imageData.length}, estimated size: ${estimatedSize} bytes)`);
        } else {
          console.warn(`  Skipping invalid image data at index ${index}:`, typeof imageData);
        }
      });
      console.log(`Successfully loaded ${imagesArray.length} images for item "${itemData.itemHeader}"`);
    } else {
      console.log(`No images found for item "${itemData.itemHeader}" - images:`, itemData.images);
    }

    return itemForm;
  }
}
