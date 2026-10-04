import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OnuFormComponent } from './onu-form.component';

describe('OnuFormComponent', () => {
  let component: OnuFormComponent;
  let fixture: ComponentFixture<OnuFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OnuFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OnuFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
