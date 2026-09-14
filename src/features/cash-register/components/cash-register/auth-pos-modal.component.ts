import { Component, EventEmitter, Output, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ModalComponent,
  ModalHeaderComponent,
  ModalBodyComponent,
  ModalFooterComponent,
  ButtonDirective,
  ModalTitleDirective,
  FormControlDirective,
  FormLabelDirective,
} from '@coreui/angular';

@Component({
  selector: 'app-auth-pos-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ModalComponent,
    ModalHeaderComponent,
    ModalBodyComponent,
    ModalFooterComponent,
    ButtonDirective,
    ModalTitleDirective,
    FormControlDirective,
    FormLabelDirective,
  ],
  templateUrl: './auth-pos-modal.component.html',
})
export class AuthPosModalComponent {
  @ViewChild('modal') modal!: ModalComponent;
  @Output() authenticated = new EventEmitter<{ success: boolean; pin: string }>();

  visible = signal(false);
  pin = signal('');
  errorMessage = signal('');
  actionLabel = signal('Autorizar');

  open(actionLabel: string = 'Autorizar') {
    this.actionLabel.set(actionLabel);
    this.pin.set('');
    this.errorMessage.set('');
    this.visible.set(true);
  }

  close() {
    this.visible.set(false);
  }

  handleVisibleChange(event: any) {
    this.visible.set(event);
  }

  confirm() {
    const enteredPin = this.pin();
    if (!enteredPin) {
      this.errorMessage.set('Por favor, ingresa tu PIN.');
      return;
    }

    // Mock PIN validation: For now, we accept '1234'
    if (enteredPin === '1234') {
      this.errorMessage.set('');
      this.close();
      this.authenticated.emit({ success: true, pin: enteredPin });
    } else {
      this.errorMessage.set('PIN incorrecto. (Usa 1234 para pruebas)');
    }
  }
}
