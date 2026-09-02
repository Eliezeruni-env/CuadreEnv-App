import { Directive, HostListener, ElementRef } from '@angular/core';

@Directive({
  selector: '[appPhoneMask]',
  standalone: true,
})
export class PhoneMaskDirective {
  constructor(private el: ElementRef<HTMLInputElement>) {}

  @HostListener('input', ['$event'])
  onInputChange(event: any) {
    let input = this.el.nativeElement.value.replace(/\D/g, '');
    if (input.length > 10) {
      input = input.substring(0, 10);
    }

    let formatted = '';
    if (input.length === 0) {
      formatted = '';
    } else if (input.length <= 3) {
      formatted = `(${input}`;
    } else if (input.length <= 6) {
      formatted = `(${input.slice(0, 3)}) ${input.slice(3)}`;
    } else {
      formatted = `(${input.slice(0, 3)}) ${input.slice(3, 6)}-${input.slice(6)}`;
    }

    this.el.nativeElement.value = formatted;
  }
}

@Directive({
  selector: '[appRncMask]',
  standalone: true,
})
export class RncMaskDirective {
  constructor(private el: ElementRef<HTMLInputElement>) {}

  @HostListener('input', ['$event'])
  onInputChange(event: any) {
    let input = this.el.nativeElement.value.replace(/\D/g, '');
    if (input.length > 11) {
      input = input.substring(0, 11);
    }

    let formatted = '';
    if (input.length <= 9) {
      // Formato RNC (9 dígitos): 1-01-12345-6
      if (input.length <= 1) {
        formatted = input;
      } else if (input.length <= 3) {
        formatted = `${input.slice(0, 1)}-${input.slice(1)}`;
      } else if (input.length <= 8) {
        formatted = `${input.slice(0, 1)}-${input.slice(1, 3)}-${input.slice(3)}`;
      } else {
        formatted = `${input.slice(0, 1)}-${input.slice(1, 3)}-${input.slice(3, 8)}-${input.slice(8)}`;
      }
    } else {
      // Formato Cédula (11 dígitos): 001-1234567-8
      if (input.length <= 3) {
        formatted = input;
      } else if (input.length <= 10) {
        formatted = `${input.slice(0, 3)}-${input.slice(3)}`;
      } else {
        formatted = `${input.slice(0, 3)}-${input.slice(3, 10)}-${input.slice(10)}`;
      }
    }

    this.el.nativeElement.value = formatted;
  }
}
