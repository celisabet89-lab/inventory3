import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OnuListComponent } from './onu-list.component';

describe('OnuListComponent', () => {
  let component: OnuListComponent;
  let fixture: ComponentFixture<OnuListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OnuListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OnuListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
