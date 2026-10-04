import { TestBed } from '@angular/core/testing';

import { OnuService } from './onu.service';

describe('OnuService', () => {
  let service: OnuService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OnuService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
