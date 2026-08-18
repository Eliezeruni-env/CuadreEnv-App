import { Component } from '@angular/core';
import { FooterComponent } from '@coreui/angular';
import { TranslatePipe } from '../../../features/cuadreEnv/pipes/translate.pipe';

@Component({
  selector: 'app-default-footer',
  templateUrl: './default-footer.component.html',
  styleUrls: ['./default-footer.component.scss'],
  imports: [TranslatePipe]
})
export class DefaultFooterComponent extends FooterComponent {
  constructor() {
    super();
  }
}

