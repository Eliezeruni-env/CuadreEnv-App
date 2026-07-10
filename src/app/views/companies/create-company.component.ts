import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CompanyService } from '../../services/company.service';
import { AuthService } from '../../services/auth.service';
import { IconDirective } from '@coreui/icons-angular';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  ColComponent,
  ContainerComponent,
  FormControlDirective,
  FormDirective,
  InputGroupComponent,
  InputGroupTextDirective,
  RowComponent,
  AlertComponent,
  SpinnerComponent
} from '@coreui/angular';

@Component({
  selector: 'app-create-company',
  templateUrl: './create-company.component.html',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ContainerComponent,
    RowComponent,
    ColComponent,
    CardComponent,
    CardBodyComponent,
    FormDirective,
    FormControlDirective,
    ButtonDirective,
    AlertComponent,
    SpinnerComponent,
    IconDirective,
    InputGroupComponent,
    InputGroupTextDirective
  ]
})
export class CreateCompanyComponent implements OnInit {
  companyForm: FormGroup;
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  constructor(
    private fb: FormBuilder,
    private companyService: CompanyService,
    private authService: AuthService,
    private router: Router
  ) {
    this.companyForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      address: ['', [Validators.maxLength(250)]],
      phone: ['', [Validators.maxLength(50)]]
    });
  }

  ngOnInit() {
    // If the user already has a company, redirect to dashboard
    if (this.authService.companyId()) {
      this.router.navigate(['/dashboard']);
    }
  }

  async onSubmit() {
    if (this.companyForm.invalid) {
      this.companyForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const val = this.companyForm.value;

    try {
      const createdCompany = await this.companyService.createCompany({
        name: val.name,
        address: val.address || null,
        phone: val.phone || null
      });

      // Update companyId in authService
      if (createdCompany && createdCompany.id) {
        this.authService.companyId.set(createdCompany.id);
        this.router.navigate(['/dashboard']);
      } else {
        // Fallback: reload state
        window.location.reload();
      }
    } catch (e: any) {
      const serverMsg = e?.response?.data?.message || e?.message;
      const errors = e?.response?.data?.errors;
      this.errorMessage.set(errors && errors.length > 0 ? errors.join(', ') : serverMsg || 'Failed to create company.');
    } finally {
      this.isLoading.set(false);
    }
  }

  logout() {
    this.authService.logout();
  }
}
