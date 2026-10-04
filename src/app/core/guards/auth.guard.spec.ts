import { TestBed } from '@angular/core/testing';
import { CanActivateChildFn } from '@angular/router';

import { authGuard } from './auth.guard';

describe('authGuard', () => {
  // @ts-ignore
  const executeGuard: CanActivateChildFn = (...guardParameters) =>
      TestBed.runInInjectionContext(() => {
        // @ts-ignore
        return authGuard(...guardParameters);
      });

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
