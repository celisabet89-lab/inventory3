import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private loadingCount = 0;
  isLoading = signal(false);

  show(): void {
    this.loadingCount++;
    this.isLoading.set(true);
  }

  hide(): void {
    this.loadingCount--;
    if (this.loadingCount <= 0) {
      this.loadingCount = 0;
      this.isLoading.set(false);
    }
  }
}
