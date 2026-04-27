import { WorkoutPost } from '../../../core/models/workout-post.model';
import { Component, output } from '@angular/core';
import { WalkTrackerComponent } from './walk-tracker.component';

@Component({
  selector: 'app-walk-modal',
  imports: [WalkTrackerComponent],
  template: `
    <app-walk-tracker (onClose)="onClose.emit()" (onPublish)="onPublish.emit($event)" />
  `,
})
export class WalkModalComponent {
  readonly onClose = output<void>();
  readonly onPublish = output<WorkoutPost>();
}
