 import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExistingListComponent } from './existing-list.component';

describe('ExistingListComponent', () => {
  let component: ExistingListComponent;
  let fixture: ComponentFixture<ExistingListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExistingListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExistingListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
