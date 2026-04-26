import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PwaService } from './core/services/pwa.service';
import { PwaPromptsComponent } from './shared/pwa-prompts.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, PwaPromptsComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  protected readonly title = signal('repify');
  private pwa = inject(PwaService);

  ngOnInit(): void {
    this.pwa.init();
  }
}
