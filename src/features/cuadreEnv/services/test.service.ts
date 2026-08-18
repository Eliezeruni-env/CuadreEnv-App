import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TestService {
  constructor(private http: HttpClient) {}

  loginTest() {
    const body = {
      email: 'test@admin.com',
      password: '123456',
      deviceId: 'web-browser',
    };
    return this.http.post(`${environment.apiUrl}/auth/login`, body);
  }

  health() {
    return this.http.get(`${environment.apiUrl}/hc`);
  }
}
