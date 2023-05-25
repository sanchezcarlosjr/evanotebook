import {map, Observable, startWith, Subscriber,tap} from "rxjs";
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
    return this.subject.pipe(
      map((message) => ({
        ready: true,
        options,
        // @ts-ignore
        message,
        connection: this
      })),
      startWith({
        ready: true,
        options,
        connection: this
      })
    );
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
  private peerId = '';

  constructor() {
  }

  connect(peerId: string) {
    this.peerId = peerId;
    // @ts-ignore
    return globalThis.windowEvent('peer.connect', {
      event: 'peer.connect',
      options: {
        peerId
      }
    }).pipe(
        map(message => ({
          ready: true,
          peerId,
          // @ts-ignore
          message,
          connection: this
        })),
        startWith(({
           ready: true,
           peerId,
           connection: this
        })
      )
    );
  }

  complete() {
    this.subscriber?.complete();
  }

  send(message: string) {
    self.postMessage({event: 'peer.send', payload: {
      peerId: this.peerId,
      message
    }});
  }

  toJSON() {
    return undefined;
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
      })
    );
  }
}

// @ts-ignore
globalThis.Mqtt = MQTT;
// @ts-ignore
globalThis.WebSocket = WebSocket;
// @ts-ignore
globalThis.WebRTC = WebRTC;
