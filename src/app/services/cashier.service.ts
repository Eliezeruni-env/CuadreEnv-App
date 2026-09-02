import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  CashierDto,
  CashSessionDto,
  CashSessionSummaryDto,
  CashMovementDto,
} from '../models/cashier';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class CashierService {
  private http = inject(HttpClient);
  private baseUrl = (environment.apiUrl || 'http://localhost:5000').replace(/\/$/, '') + '/v1';

  // 1. Get Cashiers from DB
  getCashiers(): Observable<CashierDto[]> {
    return this.http.get<any>(`${this.baseUrl}/Cashier`).pipe(
      map((res) => {
        const raw = Array.isArray(res) ? res : res?.data || [];
        return raw.map((c: any) => ({
          id: c.id,
          firstName: c.firstName || c.name || '',
          lastName: c.lastName || '',
          code: c.code || `CAJ-${c.id}`,
          role: c.role || 'Cajero',
          isActive: c.isActive !== false,
        }));
      }),
      catchError(() => {
        // Try fallback to Users endpoint in DB
        return this.http.get<any>(`${this.baseUrl}/User`).pipe(
          map((res) => {
            const raw = Array.isArray(res) ? res : res?.data || [];
            return raw.map((u: any) => ({
              id: u.id,
              firstName: u.firstName || u.userName || 'Usuario',
              lastName: u.lastName || '',
              code: `USR-${u.id}`,
              role: u.role || 'Cajero',
              isActive: u.isActive !== false,
            }));
          }),
          catchError(() => of([]))
        );
      })
    );
  }

  // 2. Get Active Session from DB
  getActiveSession(cashierId?: number): Observable<CashSessionDto | null> {
    const url = cashierId
      ? `${this.baseUrl}/caja/sessions/active?cashierId=${cashierId}`
      : `${this.baseUrl}/caja/sessions/active`;

    return this.http.get<any>(url).pipe(
      map((res) => {
        const data = res?.data || res;
        if (!data || data.isOpen === false || data.isClosed === true) return null;
        return {
          id: data.id,
          cashierId: data.cashierId || 1,
          openingAmount: data.openingAmount || data.balance || 0,
          closingAmount: data.closingAmount,
          creationDate: data.creationDate || data.openedAt || new Date().toISOString(),
          closedAt: data.closedAt,
          isClosed: false,
        };
      }),
      catchError(() => {
        // Query /CashRegister if /caja/sessions not yet initialized
        return this.http.get<any>(`${this.baseUrl}/CashRegister`).pipe(
          map((res) => {
            const list = Array.isArray(res) ? res : res?.data || [];
            const openReg = list.find((r: any) => r.isOpen);
            if (!openReg) return null;
            return {
              id: openReg.id,
              cashierId: openReg.cashierId || 1,
              openingAmount: openReg.balance || 0,
              creationDate: openReg.creationDate || new Date().toISOString(),
              isClosed: false,
            };
          }),
          catchError(() => of(null))
        );
      })
    );
  }

  // 3. Open Session in DB
  openSession(dto: {
    cashierId: number;
    openingAmount: number;
    pin?: string;
    name?: string;
  }): Observable<CashSessionDto> {
    return this.http.post<any>(`${this.baseUrl}/caja/sessions`, dto).pipe(
      map((res) => {
        const data = res?.data || res;
        return {
          id: data.id,
          cashierId: dto.cashierId,
          openingAmount: dto.openingAmount,
          creationDate: data.creationDate || new Date().toISOString(),
          isClosed: false,
        };
      }),
      catchError(() => {
        // Fallback to /CashRegister/open
        return this.http.post<any>(`${this.baseUrl}/CashRegister/open`, {
          name: dto.name || 'Caja Principal',
          balance: dto.openingAmount,
        }).pipe(
          map((res) => ({
            id: res?.id || 1,
            cashierId: dto.cashierId,
            openingAmount: dto.openingAmount,
            creationDate: new Date().toISOString(),
            isClosed: false,
          }))
        );
      })
    );
  }

  // 4. Close Session in DB
  closeSession(
    sessionId: number,
    dto: { closingAmount: number; observations?: string }
  ): Observable<{ success: boolean; difference: number }> {
    return this.http
      .post<any>(`${this.baseUrl}/caja/sessions/${sessionId}/close`, dto)
      .pipe(
        map((res) => ({
          success: true,
          difference: res?.difference ?? 0,
        })),
        catchError(() =>
          this.http
            .post<any>(`${this.baseUrl}/CashRegister/${sessionId}/close?closingAmount=${dto.closingAmount}`, {})
            .pipe(
              map(() => ({
                success: true,
                difference: 0,
              }))
            )
        )
      );
  }

  // 5. Get Session Summary directly from DB
  getSessionSummary(sessionId: number): Observable<CashSessionSummaryDto> {
    return this.http
      .get<any>(`${this.baseUrl}/caja/sessions/${sessionId}/summary`)
      .pipe(
        map((res) => res?.data || res),
        catchError(() => {
          // Calculate summary directly from DB CashMovements
          return this.http.get<any>(`${this.baseUrl}/CashMovement?cashRegisterId=${sessionId}`).pipe(
            map((res) => {
              const list: any[] = Array.isArray(res) ? res : res?.data || [];
              let totalCash = 0;
              let totalEntries = 0;
              let totalWithdrawals = 0;

              for (const m of list) {
                const amt = Number(m.amount) || 0;
                const type = (m.type || '').toUpperCase();
                const desc = (m.description || '').toLowerCase();

                if (type === 'IN' || type === 'ENTRADA') {
                  if (desc.includes('venta') || desc.includes('cobro')) {
                    totalCash += amt;
                  } else {
                    totalEntries += amt;
                  }
                } else if (type === 'OUT' || type === 'SALIDA') {
                  totalWithdrawals += amt;
                }
              }

              return {
                sessionId,
                openingAmount: 0,
                totalCashSales: totalCash,
                totalCardSales: 0,
                totalTransferSales: 0,
                totalChequeSales: 0,
                totalEntries,
                totalWithdrawals,
              };
            }),
            catchError(() =>
              of({
                sessionId,
                openingAmount: 0,
                totalCashSales: 0,
                totalCardSales: 0,
                totalTransferSales: 0,
                totalChequeSales: 0,
                totalEntries: 0,
                totalWithdrawals: 0,
              })
            )
          );
        })
      );
  }

  // 6. Record Cash Movement in DB
  recordMovement(dto: CashMovementDto): Observable<CashMovementDto> {
    return this.http.post<any>(`${this.baseUrl}/caja/movements`, dto).pipe(
      map((res) => res?.data || res || dto),
      catchError(() =>
        this.http.post<any>(`${this.baseUrl}/CashMovement`, {
          cashRegisterId: dto.cashSessionId,
          amount: dto.amount,
          type: dto.type === 'ENTRY' ? 'In' : 'Out',
          description: dto.concept + (dto.observations ? ` - ${dto.observations}` : ''),
        }).pipe(map((res) => res?.data || res || dto))
      )
    );
  }

  // 7. Create Sale (Idempotent POS/Caja sale) in DB
  createCajaSale(dto: {
    idempotencyKey: string;
    customerId?: number;
    date?: string;
    notes?: string;
    cashRegisterId: number;
    createBy?: string;
    items: { productId: number; quantity: number; unitPrice: number }[];
  }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/caja/sales`, dto).pipe(
      map((res) => res?.data || res),
      catchError(() =>
        this.http.post<any>(`${this.baseUrl}/Sale`, {
          customerId: dto.customerId || null,
          total: dto.items.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0),
          paidAmount: dto.items.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0),
          cashRegisterId: dto.cashRegisterId,
          details: dto.items.map((it) => ({
            productId: it.productId,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
          })),
        })
      )
    );
  }

  // 8. Add Payment to Sale in DB
  addPayment(
    saleId: number,
    dto: {
      amount: number;
      method: string;
      reference?: string;
      cashRegisterId?: number;
    }
  ): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/sale/${saleId}/payments`, dto).pipe(
      map((res) => res?.data || res)
    );
  }
}
