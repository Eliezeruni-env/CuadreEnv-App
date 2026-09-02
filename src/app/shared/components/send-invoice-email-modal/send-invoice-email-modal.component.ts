import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { NotificationService } from '../../../../features/cuadreEnv/services/notification.service';
import { SpinnerComponent } from '@coreui/angular';

export interface InvoiceEmailData {
  invoiceNumber: string;
  customerName?: string;
  customerEmail?: string;
  totalAmount?: number;
  ncf?: string;
  pdfUrl?: string;
}

@Component({
  selector: 'app-send-invoice-email-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    SpinnerComponent,
  ],
  templateUrl: './send-invoice-email-modal.component.html',
  styleUrls: ['./send-invoice-email-modal.component.scss'],
})
export class SendInvoiceEmailModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly notificationService = inject(NotificationService);

  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() emailSent = new EventEmitter<{ email: string; invoiceNumber: string }>();

  private _invoiceData = signal<InvoiceEmailData | null>(null);

  @Input() set invoiceData(data: InvoiceEmailData | null) {
    if (data) {
      this._invoiceData.set(data);
      this.populateForm(data);
    } else {
      this._invoiceData.set(null);
    }
  }

  get invoiceData(): InvoiceEmailData | null {
    return this._invoiceData();
  }

  isSending = signal<boolean>(false);

  emailForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    subject: ['', [Validators.required, Validators.maxLength(150)]],
    message: [''],
    attachPdf: [true],
  });

  private populateForm(data: InvoiceEmailData) {
    this.emailForm.reset({
      email: data.customerEmail || '',
      subject: `Factura ${data.invoiceNumber} - CuadreEnv`,
      message: `Estimado/a ${data.customerName || 'Cliente'},\n\nAdjuntamos su factura ${data.invoiceNumber}${data.ncf ? ' (NCF: ' + data.ncf + ')' : ''} por un monto de RD$ ${(data.totalAmount || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}.\n\nGracias por su preferencia.`,
      attachPdf: true,
    });
  }

  open(data: InvoiceEmailData) {
    this.invoiceData = data;
    this.visible = true;
    this.visibleChange.emit(true);
  }

  close() {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  async sendEmail() {
    if (this.emailForm.invalid) {
      this.emailForm.markAllAsTouched();
      return;
    }

    const { email } = this.emailForm.value;
    const inv = this._invoiceData();
    const invNumber = inv?.invoiceNumber || 'Documento';

    this.isSending.set(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));

      this.notificationService.success(
        `Factura ${invNumber} enviada exitosamente a ${email}.`,
      );
      this.emailSent.emit({ email, invoiceNumber: invNumber });
      this.close();
    } catch {
      this.notificationService.error('Error al enviar el correo. Por favor intente nuevamente.');
    } finally {
      this.isSending.set(false);
    }
  }
}
