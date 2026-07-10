import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  id: number;
  title: string;
  message: string;
  color: 'success' | 'danger' | 'warning' | 'info' | 'primary' | 'dark';
  visible: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  toasts = signal<ToastMessage[]>([]);
  private nextId = 1;

  show(title: string, message: string, color: ToastMessage['color'] = 'info', delay = 5000) {
    const id = this.nextId++;
    const newToast: ToastMessage = {
      id,
      title,
      message,
      color,
      visible: true
    };
    
    this.toasts.update((prev) => [...prev, newToast]);

    if (delay > 0) {
      setTimeout(() => {
        this.remove(id);
      }, delay);
    }
  }

  success(message: string, title = 'Success') {
    this.show(title, message, 'success');
  }

  error(message: string, title = 'Error') {
    this.show(title, message, 'danger');
  }

  warning(message: string, title = 'Warning') {
    this.show(title, message, 'warning');
  }

  info(message: string, title = 'Notification') {
    this.show(title, message, 'info');
  }

  remove(id: number) {
    this.toasts.update((prev) =>
      prev.map((t) => (t.id === id ? { ...t, visible: false } : t))
    );
    // Cleanup from DOM array after transition completes
    setTimeout(() => {
      this.toasts.update((prev) => prev.filter((t) => t.id !== id));
    }, 400);
  }
}
