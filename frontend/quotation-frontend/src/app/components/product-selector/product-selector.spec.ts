import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { ProductSelector } from './product-selector';

describe('ProductSelector', () => {
  let component: ProductSelector;
  let fixture: ComponentFixture<ProductSelector>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductSelector, HttpClientTestingModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductSelector);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
