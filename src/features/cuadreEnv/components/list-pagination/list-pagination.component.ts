import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { TranslationService } from '../../services/translation.service';
import {
  PaginationComponent,
  PageItemDirective,
  PageLinkDirective,
} from '@coreui/angular';

@Component({
  selector: 'app-list-pagination',
  standalone: true,
  templateUrl: './list-pagination.component.html',
  styleUrl: './list-pagination.component.scss',
  imports: [
    CommonModule,
    PaginationComponent,
    PageItemDirective,
    PageLinkDirective,
  ],
})
export class ListPaginationComponent {
  readonly translationService = inject(TranslationService);

  @Input() currentPage = 1;
  @Input() pageSize = 10;
  @Input() totalItems = 0;
  @Input() label = 'items';
  @Output() pageChange = new EventEmitter<number>();

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalItems / this.pageSize));
  }

  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.pageChange.emit(page);
  }

  onPageInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    if (!isNaN(value) && value >= 1 && value <= this.totalPages) {
      this.onPageChange(value);
    } else {
      input.value = this.currentPage.toString();
    }
  }
}
