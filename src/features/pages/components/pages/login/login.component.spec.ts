import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ButtonModule, CardModule, FormModule, GridModule } from '@coreui/angular';
import { provideRouter } from '@angular/router';
import { LoginComponent } from './login.component';
import { IconModule } from '@coreui/icons-angular';
import { IconSetService } from '@coreui/icons-angular';
import { iconSubset } from '../../../../../app/icons/icon-subset';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let iconSetService: IconSetService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [FormModule, CardModule, GridModule, ButtonModule, IconModule, LoginComponent],
    providers: [IconSetService, provideRouter([])]
})
    .compileComponents();
  });

  beforeEach(() => {
    iconSetService = TestBed.inject(IconSetService);
    iconSetService.icons = { ...iconSubset };

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
