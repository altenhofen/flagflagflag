import { Injectable } from '@nestjs/common';
import { Observable, Subject, filter } from 'rxjs';

export interface ConfigUpdatedEvent {
  environmentId: string;
  version: number;
}

export interface ConfigEventBus {
  publish(event: ConfigUpdatedEvent): void;
  forEnvironment(environmentId: string): Observable<ConfigUpdatedEvent>;
}

@Injectable()
export class ConfigEventService implements ConfigEventBus {
  private readonly events = new Subject<ConfigUpdatedEvent>();

  publish(event: ConfigUpdatedEvent): void {
    this.events.next(event);
  }

  forEnvironment(environmentId: string): Observable<ConfigUpdatedEvent> {
    return this.events.pipe(filter((event) => event.environmentId === environmentId));
  }
}
