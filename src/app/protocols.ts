import {map, Observable, startWith, Subscriber} from "rxjs";

import {IMqttServiceOptions, MqttService} from 'ngx-mqtt';
import {webSocket, WebSocketSubject} from "rxjs/webSocket";

export interface Protocol {
  connect: (options: any) => any;
  send: (options: any) => any;
}

export class WebSocket implements Protocol {
  private subject: WebSocketSubject<unknown>| undefined = undefined;
  connect(options: any): any {
    this.subject = webSocket(options);
    return this.subject;
  }

  toJSON() {
    return undefined;
  }

  send(message: object) {
    this.subject?.next(message);
  }

}

export class WebRTC implements Protocol {
  private subscriber: Subscriber<any> | null = null;
  private state: any = null;

  constructor() {
  }

  connect(options?: { id: string }) {
    return new Observable((subscriber) => {
      //@ts-ignore
      this.state = startPeerConnection(this.generate_subscriber(subscriber, options));
      this.join(options);
    });
  }

  complete() {
    this.state.destroy();
    this.subscriber?.complete();
  }

  join(options?: { id: string }) {
    if (options && options.id) {
      this.state?.join(options.id);
    }
  }

  send(message: string) {
  }

  toJSON() {
    return undefined;
  }

  private generate_subscriber(subscriber: Subscriber<any>, options?: { id: string }) {
    this.subscriber = subscriber;
    return {
      assign_signal: (state: any) => {
        subscriber.next(
          {
            state: `Signal assignation successful!`,
            id: `${state.peer.id}`,
            connection: this
          }
        );
        if (options && options.id) {
          state.join2();
        }
      },
      peer_connection: (state: any) => {
        this.send = state.send;
        subscriber.next({"state": `Successful connection!`, ready: true, connection: this});
      },
      connection_open: (state: any) => {
        this.send = state.send;
        subscriber.next({"state": `Successful connection!`, ready: true, connection: this});
      },
      join_connection: () => {
      },
      close: () => {
        subscriber?.next({"state": "Your peer have closed the connection", ready: false});
        subscriber?.complete();
      },
      receive: (state: any, message: string) => {
        subscriber?.next({"state": "New message from peer", ready: true, message: JSON.parse(message), connection: this});
      },
      error: (state: any, error: any) => {
        subscriber?.error({"state": "Error", ready: true, error: error.message});
      },
      disconnected: () => {
        subscriber?.next({"state": `Disconnected!`, ready: true});
      }
    };
  }
}

export class MQTT implements Protocol {
  private mqtt: MqttService | null = null;

  send(options: any) {
    this.mqtt?.unsafePublish(options.topic, options.message, options.options);
  }

  toJSON() {
    return undefined;
  }

  connect(options: IMqttServiceOptions & { topic: string }) {
    options = {
       protocol: 'ws',
       hostname: 'localhost',
       port: 9001,
       ...options
    };
    this.mqtt = new MqttService(options);
    return this.mqtt?.observe(options.topic).pipe(
      map((message) => ({
        ready: true,
        ...options,
        // @ts-ignore
        message: globalThis.deserialize(message.payload.toString()),
        connection: this
      })),
      startWith({
        ready: true,
        ...options,
        connection: this
      }),
    );
  }
}
