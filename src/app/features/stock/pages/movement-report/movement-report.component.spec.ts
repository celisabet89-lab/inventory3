import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MovementReportComponent } from './movement-report.component';

describe('MovementReportComponent', () => {
  let component: MovementReportComponent;
  let fixture: ComponentFixture<MovementReportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MovementReportComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MovementReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
