export interface Product {
  id: string;
  itemCode: string;
  description: string;
  category: string;
  subcategory: string;
  unit: string;
  unitPrice: number;
  currency: string;
  specifications: string;
  dimensions: string;
  material: string;
  brand: string;
  warranty: string;
  availability: string;
}

export interface QuotationItem {
  id?: string;
  itemNo?: number;
  product?: Product;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal?: number;
  formattedPrice?: string;
  formattedTotal?: string;
  isItemHeader?: boolean;
  isSubtotal?: boolean;
  itemIndex?: number;
  partIndex?: number;
  image?: string; // Base64 image data
}

export interface ClientInfo {
  name: string;
  address: string;
  contactPerson: string;
  email: string;
  phone: string;
}

export interface ProjectInfo {
  name: string;
  location: string;
  inquiryNo: string;
  inquiryDate: string;
  drawingNo: string;
}

export interface Terms {
  deliveryTime: string;
  deliveryTerms: string;
  paymentTerms: string;
  installation: string;
  warranty: string;
  currency: string;
  offerValidity: string;
  exclusions: string;
  additionalNotes?: string;
}

export interface Pricing {
  subtotal: number;
  discountPercentage: number;
  discountAmount: number;
  discountedPrice: number;
  vatPercentage: number;
  vatAmount: number;
  totalAmount: number;
  currency: string;
}

export interface CompanyInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  manager: {
    name: string;
    title: string;
    mobile: string;
  };
  bankDetails: {
    name: string;
    accountNo: string;
    ibanAED: string;
    ibanUSD: string;
    ibanEUR: string;
    bank: string;
  };
}

export interface QuotationSummary {
  totalItems: number;
  totalQuantity: number;
  formattedSubtotal: string;
  formattedDiscountAmount: string;
  formattedDiscountedPrice: string;
  formattedVatAmount: string;
  formattedTotalAmount: string;
}

export interface Quotation {
  id: string;
  quoteRef: string;
  date: string;
  clientInfo: ClientInfo;
  projectInfo: ProjectInfo;
  items: QuotationItem[];
  pricing: Pricing;
  terms: Terms;
  companyInfo: CompanyInfo;
  notes: {
    colorNote: string;
    additionalNotes: string;
  };
  summary: QuotationSummary;
  createdAt: string;
  updatedAt: string;
}

export interface AdditionalItemPart {
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
}

export interface AdditionalItem {
  itemHeader: string; // Main item description
  parts: AdditionalItemPart[]; // Sub-parts with pricing
}

export interface BankDetails {
  name: string;
  accountNo: string;
  ibanAED: string;
  ibanUSD: string;
  ibanEUR: string;
  bank: string;
}

export interface QuotationRequest {
  quotationNumber: string;
  clientInfo: ClientInfo;
  projectInfo: ProjectInfo;
  items: QuotationItem[];
  additionalItems?: AdditionalItem[]; // Frontend-only items that follow same structure
  terms: Terms;
  bankDetails: BankDetails;
  currency?: string;
  discountPercentage?: number;
  vatPercentage?: number;
  // Revision support flags used by backend quotationService
  isRevision?: boolean;
  quoteRef?: string;
}

export interface ExportResponse {
  filePath: string;
  downloadUrl: string;
}
