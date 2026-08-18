import { Component, inject } from '@angular/core';
import { IconDirective } from '@coreui/icons-angular';
import { TranslationService } from '../../../../cuadreEnv/services/translation.service';
import {
  ButtonDirective,
  ColComponent,
  ContainerComponent,
  FormControlDirective,
  InputGroupComponent,
  InputGroupTextDirective,
  RowComponent
} from '@coreui/angular';

@Component({
  selector: 'app-page404',
  templateUrl: './page404.component.html',
  imports: [ContainerComponent, RowComponent, ColComponent, InputGroupComponent, InputGroupTextDirective, IconDirective, FormControlDirective, ButtonDirective]
})
export class Page404Component {
  readonly translationService = inject(TranslationService);
}

