import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../../cuadreEnv/services/notification.service';
import { TranslationService } from '../../../cuadreEnv/services/translation.service';
import { IconDirective } from '@coreui/icons-angular';
import { SendInvoiceEmailModalComponent } from '../../../../app/shared/components/send-invoice-email-modal/send-invoice-email-modal.component';

export interface CompletedSaleItem {
  productId?: number;
  productCode?: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  total: number;
}

export interface CompletedSaleDto {
  id?: number;
  invoiceNumber?: string;
  date?: string;
  customerName?: string;
  customerRnc?: string;
  cashRegisterName?: string;
  cashierName?: string;
  paymentMethod?: string;
  subtotal: number;
  discount?: number;
  itbis?: number;
  total: number;
  amountReceived?: number;
  change?: number;
  notes?: string;
  items: CompletedSaleItem[];
}

@Component({
  selector: 'app-sale-completed-modal',
  standalone: true,
  imports: [CommonModule, IconDirective, SendInvoiceEmailModalComponent],
  templateUrl: './sale-completed-modal.component.html',
  styleUrls: ['./sale-completed-modal.component.scss'],
})
export class SaleCompletedModalComponent {
  @ViewChild('sendEmailModal') sendEmailModal!: SendInvoiceEmailModalComponent;

  readonly translationService = inject(TranslationService);
  private notificationService = inject(NotificationService);

  @Input() visible = false;
  @Input() saleData: CompletedSaleDto | null = null;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() newSaleRequested = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  isEmailModalOpen = false;

  get formattedDate(): string {
    if (this.saleData?.date) {
      return new Date(this.saleData.date).toLocaleString('es-DO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return new Date().toLocaleString('es-DO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  get changeAmount(): number {
    if (!this.saleData) return 0;
    if (this.saleData.change !== undefined && this.saleData.change >= 0) {
      return this.saleData.change;
    }
    const received = this.saleData.amountReceived ?? this.saleData.total ?? 0;
    return Math.max(0, received - (this.saleData.total ?? 0));
  }

  open(data: CompletedSaleDto) {
    this.saleData = data;
    this.visible = true;
    this.visibleChange.emit(true);
  }

  close() {
    this.visible = false;
    this.visibleChange.emit(false);
    this.closed.emit();
  }

  printInvoice() {
    setTimeout(() => {
      window.print();
    }, 150);
  }

  sendEmail() {
    if (!this.saleData) return;
    const invNumber = this.saleData.invoiceNumber || ('VTA-' + (this.saleData.id || '000123'));
    if (this.sendEmailModal) {
      this.sendEmailModal.open({
        invoiceNumber: invNumber,
        customerName: this.saleData.customerName || 'Consumidor Final',
        totalAmount: this.saleData.total || 0,
      });
    } else {
      this.isEmailModalOpen = true;
    }
  }

  downloadPdf() {
    setTimeout(() => {
      window.print();
    }, 150);
  }

  startNewSale() {
    this.close();
    this.newSaleRequested.emit();
  }
}
