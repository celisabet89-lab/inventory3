import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OnuAssignmentComponent } from './onu-assignment.component';

describe('OnuAssignmentComponent', () => {
  let component: OnuAssignmentComponent;
  let fixture: ComponentFixture<OnuAssignmentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OnuAssignmentComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OnuAssignmentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
