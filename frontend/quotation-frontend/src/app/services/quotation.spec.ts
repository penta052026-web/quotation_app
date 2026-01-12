import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { QuotationService } from './quotation';

describe('QuotationService', () => {
  let service: QuotationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [QuotationService]
    });
    service = TestBed.inject(QuotationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
