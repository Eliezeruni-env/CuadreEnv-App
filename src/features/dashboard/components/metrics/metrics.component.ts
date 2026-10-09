import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ChartData, ChartOptions } from 'chart.js';
import { ChartjsComponent } from '@coreui/angular-chartjs';
import {
  ContainerComponent,
  SpinnerComponent,
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { SaleService } from '../../../sales/services/sale.service';
import { CashRegisterService } from '../../../cash-register/services/cash-register.service';
import { AccountReceivableService } from '../../../payments/services/account-receivable.service';
import { CustomerService } from '../../../customers/services/customer.service';
import { AuthService } from '../../../cuadreEnv/services/auth.service';
import { TranslationService } from '../../../cuadreEnv/services/translation.service';

export interface TopProductItem {
  name: string;
  units: number;
  percentage: number;
  icon: string;
}

export interface PaymentBreakdown {
  cashAmount: number;
  cashPct: number;
  cardAmount: number;
  cardPct: number;
  transferAmount: number;
  transferPct: number;
  creditAmount: number;
  creditPct: number;
  total: number;
}

@Component({
  selector: 'app-metrics',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ContainerComponent,
    ChartjsComponent,
    SpinnerComponent,
    IconDirective,
  ],
  templateUrl: './metrics.component.html',
  styleUrls: ['./metrics.component.scss'],
})
export class MetricsComponent implements OnInit {
  private saleService = inject(SaleService);
  private cashService = inject(CashRegisterService);
  private receivableService = inject(AccountReceivableService);
  private customerService = inject(CustomerService);
  public authService = inject(AuthService);
  public translationService = inject(TranslationService);

  isLoading = signal<boolean>(true);

  // Filters
  selectedDateRange = signal<string>('month');
  selectedPeriod = signal<'7D' | '30D' | '90D' | '1A'>('7D');

  // Key KPI signals
  totalRevenue = signal<number>(0);
  totalSalesCount = signal<number>(0);
  averageTicket = signal<number>(0);
  totalCashIn = signal<number>(0);
  totalCashOut = signal<number>(0);
  totalCustomersCount = signal<number>(0);
  totalUnitsSold = signal<number>(0);

  // Top Products list
  topProducts = signal<TopProductItem[]>([]);

  // Payment Breakdown
  paymentBreakdown = signal<PaymentBreakdown>({
    cashAmount: 0,
    cashPct: 0,
    cardAmount: 0,
    cardPct: 0,
    transferAmount: 0,
    transferPct: 0,
    creditAmount: 0,
    creditPct: 0,
    total: 0,
  });

  // Charts
  chartSalesOverTime: ChartData = { labels: [], datasets: [] };
  chartPaymentMethods: ChartData = { labels: [], datasets: [] };
  chartCashFlow: ChartData = { labels: [], datasets: [] };

  // Sales trend line chart options
  salesChartOptions: ChartOptions = {
    maintainAspectRatio: false,
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => ` Venta: RD$ ${(context.parsed.y || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 }, color: '#64748b' },
      },
      y: {
        beginAtZero: true,
        suggestedMin: 0,
        suggestedMax: 100,
        grid: { color: 'rgba(0, 0, 0, 0.05)' },
        ticks: {
          precision: 0,
          font: { size: 11 },
          color: '#64748b',
          callback: (value) => `RD$ ${Number(value).toLocaleString('es-DO')}`,
        },
      },
    },
  };

  // Donut chart options
  donutChartOptions: any = {
    maintainAspectRatio: false,
    responsive: true,
    cutout: '72%',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: any) => ` ${context.label}: RD$ ${(Number(context.raw) || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
        },
      },
    },
  };

  // Cash flow bar chart options
  cashFlowOptions: ChartOptions = {
    maintainAspectRatio: false,
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { boxWidth: 12, usePointStyle: true, pointStyle: 'circle' },
      },
      tooltip: {
        callbacks: {
          label: (context) => ` ${context.dataset.label}: RD$ ${(context.parsed.y || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 }, color: '#64748b' },
      },
      y: {
        beginAtZero: true,
        suggestedMin: 0,
        suggestedMax: 100,
        grid: { color: 'rgba(0, 0, 0, 0.05)' },
        ticks: {
          precision: 0,
          font: { size: 11 },
          color: '#64748b',
          callback: (value) => `RD$ ${Number(value).toLocaleString('es-DO')}`,
        },
      },
    },
  };

  readonly isAuthorized = computed(() => {
    return (
      this.authService.isSuperUser() ||
      this.authService.hasRole(['Admin', 'SuperUser', 'Auditor', 'Audit'])
    );
  });

  ngOnInit() {
    if (this.isAuthorized()) {
      this.loadMetricsData();
    } else {
      this.isLoading.set(false);
    }
  }

  setPeriod(period: '7D' | '30D' | '90D' | '1A') {
    this.selectedPeriod.set(period);
    this.updateSalesTrendChart();
  }

  private cachedSales: any[] = [];

  async loadMetricsData() {
    this.isLoading.set(true);

    try {
      const [salesRes, cashRes, custRes] = await Promise.all([
        this.saleService.getSales().catch(() => ({ success: false, data: [] })),
        this.cashService.getCashRegisters().catch(() => ({ success: false, data: [] })),
        this.customerService.getCustomers({ pageNumber: 1, pageSize: 200 } as any).catch(() => ({ success: false, data: [] })),
      ]);

      const sales = (salesRes?.success && salesRes.data)
        ? salesRes.data.filter((s: any) => !s.isCancelled)
        : [];
      this.cachedSales = sales;

      const cashRegisters = (cashRes?.success && cashRes.data) ? cashRes.data : [];
      const customers = (custRes?.success && custRes.data) ? custRes.data : [];

      // 1. Calculate Summary KPIs
      const revenue = sales.reduce((sum: number, s: any) => sum + (s.totalAmount || s.total || 0), 0);
      this.totalRevenue.set(revenue);
      this.totalSalesCount.set(sales.length);
      this.averageTicket.set(sales.length > 0 ? revenue / sales.length : 0);
      this.totalCustomersCount.set(customers.length);

      // 2. Sales Over Time (Line Chart)
      this.updateSalesTrendChart();

      // 3. Payment Methods Breakdown (Donut Chart)
      let cashTotal = 0;
      let cardTotal = 0;
      let transferTotal = 0;
      let creditTotal = 0;

      sales.forEach((s: any) => {
        const amt = Number(s.totalAmount || s.total || 0);
        const m = (s.paymentMethod || s.method || 'Efectivo').toLowerCase();
        if (m.includes('tarjeta') || m.includes('card')) {
          cardTotal += amt;
        } else if (m.includes('transf') || m.includes('banc')) {
          transferTotal += amt;
        } else if (m.includes('cred') || m.includes('créd')) {
          creditTotal += amt;
        } else {
          cashTotal += amt;
        }
      });

      const methodsSum = cashTotal + cardTotal + transferTotal + creditTotal || revenue || 0;
      const divisor = methodsSum > 0 ? methodsSum : 1;
      this.paymentBreakdown.set({
        cashAmount: cashTotal,
        cashPct: methodsSum > 0 ? Math.round((cashTotal / divisor) * 1000) / 10 : 0,
        cardAmount: cardTotal,
        cardPct: methodsSum > 0 ? Math.round((cardTotal / divisor) * 1000) / 10 : 0,
        transferAmount: transferTotal,
        transferPct: methodsSum > 0 ? Math.round((transferTotal / divisor) * 1000) / 10 : 0,
        creditAmount: creditTotal,
        creditPct: methodsSum > 0 ? Math.round((creditTotal / divisor) * 1000) / 10 : 0,
        total: methodsSum,
      });

      const isZeroPayments = cashTotal === 0 && cardTotal === 0 && transferTotal === 0 && creditTotal === 0;
      this.chartPaymentMethods = {
        labels: isZeroPayments ? ['Sin operaciones registradas'] : ['Efectivo', 'Tarjeta', 'Transferencia', 'Crédito'],
        datasets: [
          {
            backgroundColor: isZeroPayments
              ? ['#e2e8f0']
              : ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'],
            borderWidth: isZeroPayments ? 0 : 2,
            borderColor: '#ffffff',
            hoverOffset: isZeroPayments ? 0 : 4,
            data: isZeroPayments ? [1] : [cashTotal, cardTotal, transferTotal, creditTotal],
          },
        ],
      };

      // 4. Cash Flow: Entradas vs Salidas operativas
      let totalIn = 0;
      let totalOut = 0;
      cashRegisters.forEach((cr: any) => {
        totalIn += Number(cr.totalIn || cr.inAmount || 0);
        totalOut += Number(cr.totalOut || cr.outAmount || 0);
      });
      this.totalCashIn.set(totalIn);
      this.totalCashOut.set(totalOut);

      // Build daily cash flow bar chart (last 7 days)
      const flowDays: string[] = [];
      const inData: number[] = [];
      const outData: number[] = [];

      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const label = d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short' });
        flowDays.push(label);

        // Map movements from active session if matching day
        inData.push(i === 0 ? (totalIn || revenue) : 0);
        outData.push(i === 0 ? totalOut : 0);
      }

      this.chartCashFlow = {
        labels: flowDays,
        datasets: [
          {
            label: 'Entradas de Caja',
            backgroundColor: '#0d9488',
            borderRadius: 4,
            data: inData,
          },
          {
            label: 'Salidas de Caja',
            backgroundColor: '#f43f5e',
            borderRadius: 4,
            data: outData,
          },
        ],
      };

      // 5. Top Products Sold & Units Sold
      const productCounts: Record<string, number> = {};
      let totalUnits = 0;

      sales.forEach((s: any) => {
        (s.items || s.saleDetails || s.details || []).forEach((it: any) => {
          const name = it.productName || it.description || `Producto #${it.productId || 1}`;
          const qty = Number(it.quantity) || 1;
          productCounts[name] = (productCounts[name] || 0) + qty;
          totalUnits += qty;
        });
      });

      this.totalUnitsSold.set(totalUnits);

      const icons = ['📦', '🧴', '👕', '👟', '💼'];
      const sortedNames = Object.keys(productCounts)
        .sort((a, b) => productCounts[b] - productCounts[a])
        .slice(0, 5);

      const maxUnits = sortedNames.length > 0 ? productCounts[sortedNames[0]] : 1;

      if (sortedNames.length > 0) {
        this.topProducts.set(
          sortedNames.map((name, index) => ({
            name,
            units: productCounts[name],
            percentage: Math.round((productCounts[name] / (maxUnits || 1)) * 100),
            icon: icons[index % icons.length],
          }))
        );
      } else {
        this.topProducts.set([
          { name: 'Producto 1', units: 0, percentage: 0, icon: '📦' },
          { name: 'Producto 2', units: 0, percentage: 0, icon: '🧴' },
          { name: 'Producto 3', units: 0, percentage: 0, icon: '👕' },
          { name: 'Producto 4', units: 0, percentage: 0, icon: '👟' },
          { name: 'Producto 5', units: 0, percentage: 0, icon: '💼' },
        ]);
      }
    } catch {
      // ignore
    } finally {
      this.isLoading.set(false);
    }
  }

  updateSalesTrendChart() {
    const daysCount = this.selectedPeriod() === '7D' ? 7 : this.selectedPeriod() === '30D' ? 30 : this.selectedPeriod() === '90D' ? 90 : 365;

    const salesByDate: Record<string, number> = {};
    this.cachedSales.forEach((s: any) => {
      const dateKey = (s.createdAt || s.date || '').split('T')[0];
      if (dateKey) {
        salesByDate[dateKey] = (salesByDate[dateKey] || 0) + (s.totalAmount || s.total || 0);
      }
    });

    const labels: string[] = [];
    const dataPoints: number[] = [];

    const step = daysCount > 90 ? 30 : daysCount > 30 ? 7 : 1;
    const numPoints = Math.min(Math.ceil(daysCount / step), 12);

    for (let i = numPoints - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i * step);
      const iso = d.toISOString().split('T')[0];
      const displayLabel = d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short' });
      labels.push(displayLabel);
      dataPoints.push(salesByDate[iso] || 0);
    }

    // If all zero and we have revenue, place revenue on last point for clean display
    const salesSeries: number[] = [...dataPoints];
    const hasNoSales = !salesSeries.some((val) => val > 0);
    if (hasNoSales && this.totalRevenue() > 0 && salesSeries.length > 0) {
      salesSeries[salesSeries.length - 1] = this.totalRevenue();
    }

    this.chartSalesOverTime = {
      labels,
      datasets: [
        {
          label: 'Ventas (RD$)',
          backgroundColor: 'rgba(79, 70, 229, 0.08)',
          borderColor: '#4f46e5',
          borderWidth: 2.5,
          pointBackgroundColor: '#4f46e5',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.4,
          data: salesSeries,
        },
      ],
    };
  }
}
