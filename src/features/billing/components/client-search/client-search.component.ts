import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CustomerService } from '../../../customers/services/customer.service';
import type { CustomerDto } from '../../../cuadreEnv/types/api';
import type { HeaderDto } from '../../../../app/models/billing';

@Component({
  selector: 'app-client-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './client-search.component.html',
  styleUrls: ['./client-search.component.scss'],
})
export class ClientSearchComponent implements OnInit {
  private customerService = inject(CustomerService);

  @Input() set initialHeader(h: HeaderDto | null | undefined) {
    if (h) {
      this.header = { ...h };
    }
  }

  @Output() headerChange = new EventEmitter<HeaderDto>();

  customers = signal<CustomerDto[]>([]);

  header: HeaderDto = {
    clientId: 1,
    clientName: 'Consumidor Final',
    billingTypeId: 1, // Contado
    voucherTypeId: 1, // Consumidor Final B02
    warehouseId: 1,
    rncOrCedula: '000-0000000-0',
    paymentTermDays: 30,
  };

  async ngOnInit() {
    await this.loadCustomers();
    this.emitHeader();
  }

  async loadCustomers() {
    try {
      const res = await this.customerService.getCustomers();
      if (res?.success && res.data) {
        this.customers.set(res.data);
      }
    } catch {
      // Fallback customer
      this.customers.set([
        { id: 1, name: 'Consumidor Final', identification: '000-0000000-0' } as any,
      ]);
    }
  }

  onClientSelected(clientId: number) {
    const cust = this.customers().find((c) => c.id === clientId);
    if (cust) {
      this.header.clientName = cust.name;
      this.header.rncOrCedula = cust.identification || '';
      // If client has tax ID, suggest B01 (Crédito fiscal)
      if (cust.identification && cust.identification.length > 5 && this.header.voucherTypeId === 1) {
        this.header.voucherTypeId = 2;
      }
    }
    this.emitHeader();
  }

  resetClient() {
    this.header.clientId = 1;
    this.header.clientName = 'Consumidor Final';
    this.header.rncOrCedula = '000-0000000-0';
    this.header.voucherTypeId = 1;
    this.emitHeader();
  }

  emitHeader() {
    this.headerChange.emit({ ...this.header });
  }
}
