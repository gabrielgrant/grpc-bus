import {
  IGBCallInfo,
  IGBCreateCallResult,
  IGBCallEvent,
} from '../proto';
import { Subject } from 'rxjs/Subject';

export interface ICallHandle {
  // Send a message on a streaming call
  write?(msg: any): void;

  // Register a callback handler on a streaming call.
  on?(eventId: string, callback: (arg: any) => void): void;

  // Remove all handlers for an event on a streaming call.
  off?(eventId: string): void;

  // Call to terminate this call on a streaming call.
  end?(): void;
}

export class Call implements ICallHandle {
  public disposed: Subject<Call> = new Subject<Call>();
  private eventHandlers: { [id: string]: ((arg: any) => void)[] } = {};

  constructor(public clientId: number,
              private info: IGBCallInfo,
              private callMeta: any,
              private callback: (error?: any, response?: any) => void) {
  }

  public on(eventId: string, callback: (arg: any) => void): void {
    let handlers = this.eventHandlers[eventId];
    if (!handlers) {
      handlers = [];
      this.eventHandlers[eventId] = handlers;
    }
    handlers.push(callback);
  }

  public off(eventId: string) {
    delete this.eventHandlers[eventId];
  }

  public handleCreateResponse(msg: IGBCreateCallResult) {
    if (msg.result === 0) {
      return;
    }
    if (msg.error_details) {
      this.terminateWithError(msg.error_details);
    } else {
      this.terminateWithError('Error ' + msg.result);
    }
  }

  public handleEvent(msg: IGBCallEvent) {
    let data = JSON.parse(msg.data);
    this.emit(msg.event, data);
    if (this.callback) {
      if (msg.event === 'error') {
        this.terminateWithError(data);
      } else if (msg.event === 'data') {
        this.terminateWithData(data);
      }
    }
  }

  public dispose() {
    this.disposed.next(this);
  }

  private terminateWithError(error: any) {
    if (this.callback) {
      this.callback(error, undefined);
    } else {
      this.emit('error', error);
    }
    this.dispose();
  }

  private terminateWithData(data: any) {
    this.callback(undefined, data);
    this.dispose();
  }

  private emit(eventId: string, arg: any) {
    let handlers = this.eventHandlers[eventId];
    if (!handlers) {
      return;
    }
    for (let handler of handlers) {
      handler(arg);
    }
  }
}
