import {
  Component,
  OnInit,
  signal,
  computed,
  inject,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CreditNoteService } from '../../services/credit-note.service';
import { NotificationService } from '../../../cuadreEnv/services/notification.service';
import { TranslationService } from '../../../cuadreEnv/services/translation.service';
import { CreditNoteFormComponent } from './credit-note-form.component';
import { ListPaginationComponent } from '../../../cuadreEnv/components/list-pagination/list-pagination.component';
import { IconDirective } from '@coreui/icons-angular';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  ContainerComponent,
  SpinnerComponent,
} from '@coreui/angular';
import type { CreditNote } from '../../../../app/models/credit-note';

@Component({
  selector: 'app-credit-notes',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ContainerComponent,
    CardComponent,
    CardBodyComponent,
    ButtonDirective,
    IconDirective,
    SpinnerComponent,
    CreditNoteFormComponent,
    ListPaginationComponent,
  ],
  templateUrl: './credit-notes.component.html',
  styleUrls: ['./credit-notes.component.scss'],
})
export class CreditNotesComponent implements OnInit {
  readonly translationService = inject(TranslationService);
  private creditNoteService = inject(CreditNoteService);
  private notificationService = inject(NotificationService);

  @ViewChild('creditNoteFormModal') creditNoteFormModal!: CreditNoteFormComponent;

  creditNotes = signal<CreditNote[]>([]);
  isLoading = signal<boolean>(false);
  searchTerm = '';

  currentPage = signal<number>(1);
  pageSize = signal<number>(10);

  isCreateModalOpen = false;
  selectedCreditNote: CreditNote | null = null;

  readonly filteredCreditNotes = computed(() => {
    const term = this.searchTerm.toLowerCase().trim();
    if (!term) return this.creditNotes();
    return this.creditNotes().filter(
      (n) =>
        (n.creditNoteNumber || '').toLowerCase().includes(term) ||
        (n.ncf || '').toLowerCase().includes(term) ||
        (n.billingNumber || '').toLowerCase().includes(term) ||
        (n.customerName || '').toLowerCase().includes(term),
    );
  });

  readonly pagedCreditNotes = computed(() => {
    const list = this.filteredCreditNotes();
    const start = (this.currentPage() - 1) * this.pageSize();
    return list.slice(start, start + this.pageSize());
  });

  readonly totalRefundedAmount = computed(() => {
    return this.creditNotes().reduce((acc, n) => acc + (n.amountTotal || 0), 0);
  });

  ngOnInit() {
    this.loadCreditNotes();
  }

  async loadCreditNotes() {
    this.isLoading.set(true);
    try {
      const res = await this.creditNoteService.getCreditNotes();
      if (res?.success && res.data) {
        this.creditNotes.set(res.data);
      }
    } catch (e: any) {
      console.error('Error loading credit notes:', e);
    } finally {
      this.isLoading.set(false);
    }
  }

  onPageChange(page: number) {
    this.currentPage.set(page);
  }

  onSearchChange() {
    this.currentPage.set(1);
  }

  openCreateModal(invoiceId?: string) {
    if (this.creditNoteFormModal) {
      this.creditNoteFormModal.open(invoiceId);
    } else {
      this.isCreateModalOpen = true;
    }
  }

  onCreditNoteCreated(newNote: CreditNote) {
    this.loadCreditNotes();
    this.selectedCreditNote = newNote;
  }

  viewNoteDetail(note: CreditNote) {
    this.selectedCreditNote = note;
  }

  printCreditNote() {
    this.notificationService.info('Preparando impresión de nota de crédito...');
    setTimeout(() => {
      window.print();
    }, 200);
  }
}
