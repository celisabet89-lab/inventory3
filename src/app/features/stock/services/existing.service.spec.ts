import { TestBed } from '@angular/core/testing';

import { ExistingService } from './existing.service';

describe('ExistingService', () => {
  let service: ExistingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ExistingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
