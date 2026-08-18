import { Component, Input, TemplateRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableDirective } from '@coreui/angular';
import { TranslationService } from '../../services/translation.service';

@Component({
  selector: 'app-table',
  templateUrl: './table.component.html',
  styleUrls: ['./table.component.scss'],
  standalone: true,
  imports: [CommonModule, TableDirective],
})
export class TableComponent {
  readonly translationService = inject(TranslationService);
  @Input() columns: Array<{ field: string; label: string }> = [];
  @Input() rows: any[] = [];
  @Input() loading = false;
  @Input() emptyMessage = '';
  // Optional custom row template: parent can pass a TemplateRef that receives the row as $implicit
  @Input() rowTemplate?: TemplateRef<any>;
}

