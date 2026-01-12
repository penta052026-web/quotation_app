import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { QuotationsList } from './quotations-list';

describe('QuotationsList', () => {
  let component: QuotationsList;
  let fixture: ComponentFixture<QuotationsList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuotationsList, HttpClientTestingModule, RouterTestingModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QuotationsList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
