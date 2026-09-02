import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListbillingComponent } from './components/listbilling/listbilling.component';
import { CreatebillingComponent } from './components/createbilling/createbilling.component';

export const routes: Routes = [
  {
    path: '',
    component: ListbillingComponent,
    data: { title: 'Facturación y Comprobantes Fiscales' },
  },
  {
    path: 'create',
    component: CreatebillingComponent,
    data: { title: 'Nueva Factura' },
  },
  {
    path: 'quotationNo/:quotationNo',
    component: CreatebillingComponent,
    data: { title: 'Facturar Cotización' },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class BillingRoutingModule {}
