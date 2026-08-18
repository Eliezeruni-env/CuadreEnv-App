import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, takeUntil } from 'rxjs';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  FormControlDirective,
  FormSelectDirective,
  InputGroupComponent,
  InputGroupTextDirective,
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { TranslationService } from '../../services/translation.service';

export interface FilterOption {
  label: string;
  value: string | number;
}

export interface FilterConfig {
  key: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'dateRange' | 'number' | 'numberRange';
  placeholder?: string;
  options?: FilterOption[];
  min?: number | string;
  max?: number | string;
}

export type FilterValues = Record<string, unknown>;

@Component({
  selector: 'app-filter-panel',
  standalone: true,
  templateUrl: './filter-panel.component.html',
  styleUrl: './filter-panel.component.scss',
  imports: [
    CommonModule,
    FormsModule,
    CardComponent,
    CardBodyComponent,
    ButtonDirective,
    FormControlDirective,
    FormSelectDirective,
    InputGroupComponent,
    InputGroupTextDirective,
    IconDirective,
  ],
})
export class FilterPanelComponent implements OnInit, OnDestroy {
  readonly translationService = inject(TranslationService);
  @Input() config: FilterConfig[] = [];
  @Input() values: FilterValues = {};
  @Input() title = 'Filters';
  @Input() collapsed = false;
  @Output() filtersChange = new EventEmitter<FilterValues>();

  isExpanded = signal(true);

  private destroy$ = new Subject<void>();
  private debouncedText$ = new Subject<{ key: string; value: string }>();

  ngOnInit(): void {
    this.isExpanded.set(!this.collapsed);

    this.debouncedText$
      .pipe(debounceTime(300), takeUntil(this.destroy$))
      .subscribe(({ key, value }) => {
        this.updateValue(key, value);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  togglePanel(): void {
    this.isExpanded.update((current) => !current);
  }

  getValue(key: string): unknown {
    return this.values?.[key] ?? '';
  }

  getRangeValue(key: string, field: 'from' | 'to'): string | number | null {
    const value = this.values?.[key] as
      | { from?: string | number | null; to?: string | number | null }
      | undefined;
    return value?.[field] ?? '';
  }

  updateValue(key: string, value: unknown): void {
    const nextValues = { ...(this.values || {}), [key]: value };
    this.values = nextValues;
    this.emitFilters();
  }

  onTextInput(key: string, value: string): void {
    this.values = { ...(this.values || {}), [key]: value };
    this.debouncedText$.next({ key, value });
  }

  onDateRangeChange(key: string, field: 'from' | 'to', value: string): void {
    const currentValue = (this.values?.[key] as
      | { from?: string | null; to?: string | null }
      | undefined) ?? { from: null, to: null };
    const nextValue = { ...currentValue, [field]: value || null };
    this.values = { ...(this.values || {}), [key]: nextValue };
    this.emitFilters();
  }

  onNumberRangeChange(key: string, field: 'from' | 'to', value: string): void {
    const currentValue = (this.values?.[key] as
      | { from?: number | null; to?: number | null }
      | undefined) ?? { from: null, to: null };
    const parsedValue = value === '' ? null : Number(value);
    const nextValue = { ...currentValue, [field]: parsedValue };
    this.values = { ...(this.values || {}), [key]: nextValue };
    this.emitFilters();
  }

  clearFilters(): void {
    this.values = {};
    this.emitFilters();
  }

  emitFilters(): void {
    this.filtersChange.emit({ ...(this.values || {}) });
  }

  getActiveFiltersCount(): number {
    return Object.values(this.values || {}).filter((value) => {
      if (value === null || value === undefined || value === '') {
        return false;
      }

      if (typeof value === 'object') {
        return Object.values(value as Record<string, unknown>).some(
          (item) => item !== null && item !== undefined && item !== '',
        );
      }

      return true;
    }).length;
  }
}
