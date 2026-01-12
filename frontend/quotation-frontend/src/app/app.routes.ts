import { Routes } from '@angular/router';
import { QuotationForm } from './components/quotation-form/quotation-form';
import { QuotationsList } from './components/quotations-list/quotations-list';

export const routes: Routes = [
  { path: '', redirectTo: '/quotations', pathMatch: 'full' },
  { path: 'quotations', component: QuotationsList },
  { path: 'create', component: QuotationForm },
  { path: 'edit/:id', component: QuotationForm },
  { path: '**', redirectTo: '/quotations' }
];
