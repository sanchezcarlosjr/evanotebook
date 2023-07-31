import {
  concatMap,
  filter,
  finalize,
  first,
  firstValueFrom,
  map,
  Observable,
  startWith,
  Subject,
  Subscriber,
  tap
} from "rxjs";
import {IMqttServiceOptions, MqttService} from 'ngx-mqtt';
import {webSocket, WebSocketSubject} from "rxjs/webSocket";
import {
  GearApi,
  getProgramMetadata,
  GearKeyring,
  CreateType,
  IMessageSendOptions,
  GearApiOptions,
  ProgramMetadata
} from '@gear-js/api';


export interface Protocol {
  connect: (options: any) => any;
  send: (options: any) => any;
}

interface GearMessageProtocol extends IMessageSendOptions {
  providerAddress: string;
  keyrings: any[];
}

interface GearProtocolOptions extends GearApiOptions {
  metadataPlainText?: string
}

export class GearProtocol implements Protocol {
  private gearApi?: GearApi;
  private meta?: ProgramMetadata;
  async init(options:  GearProtocolOptions = {}) {
    options = Object.assign(options, {providerAddress: 'wss://testnet.vara.rs'});
    this.gearApi = await GearApi.create(options);
    this.meta = getProgramMetadata("0x" + options.metadataPlainText);
    return new GearProtocol();
  }

  connect() {
    let unsub: (() => any) | null = null;
    return new Observable<{ k: string, v: any }>((subscriber: Subscriber<any>) => {
      this.gearApi?.query.system.events((events) => subscriber.next(events));
    }).pipe(finalize(() => unsub && unsub()));
  }

  async send(message: GearMessageProtocol) {
    message = Object.assign(message, {
      keyrings: [],
      // You should choose something wisely. Find out how https://wiki.gear-tech.io/docs/api/calculate-gas
      gasLimit: 508_337_712*2,
      value: 0
    });
    const gearEvents = await this.listenGearSystemEvents(message);
    const messageEvents = this.signAndSend(message);
    return firstValueFrom(gearEvents.pipe(
      concatMap(gearEvent => messageEvents.pipe(filter(({k}) => k === gearEvent.k), map(_ => gearEvent.v))),
      first()
    ));
  }
  private signAndSend(message: GearMessageProtocol) {
    let extrinsic = this.gearApi?.message.send(message, this.meta);
    const messageEvents = new Subject<{ k: string }>();
    // @ts-ignore
    extrinsic?.signAndSend(...message.keyrings, ({events, status}) => {
      // @ts-ignore
      if (status?.Finalized)
        return;
      // @ts-ignore
      const queuedMessages = events.filter(({event}) => event.method === "MessageQueued").map(({event}) => event?.data?.id?.toHex());
      if (queuedMessages.length === 0)
        return;
      messageEvents.next({k: queuedMessages[0] + '0001'});
    });
    return messageEvents;
  }

  private async listenGearSystemEvents(message: GearMessageProtocol) {
    const gearEvents = new Subject<{ k: string, v: any }>();
    const unsub = await this.gearApi?.query.system.events((events) => {
      events.forEach(({event}) => {
        // @ts-ignore
        if (gearApi.events?.gear?.UserMessageSent?.is(event)) {
          const {
            data: {
              // @ts-ignore
              message: {source, details}
            }
          } = event;
          if (source.eq(message.destination)) {
            // @ts-ignore
            gearEvents.next({k: details.toHex(), v: this.meta.createType(0, event?.data?.toHuman()?.message?.payload)});
          }
        }
      })
    });
    return gearEvents.pipe(finalize(() => unsub ? unsub(): 0));
  }
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
    options = {
      protocol: 'wss',
      hostname: 'test.mosquitto.org',
     // @ts-ignore
      topic: "eva-main",
      port: 8081,
      ...options
   };
    this.mqtt = new MqttService(options);
    return this.mqtt?.observe(options.topic).pipe(
      map(message => ({
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
globalThis.Mqtt = MqttService;
// @ts-ignore
globalThis.Websocket = WebSocket;
// @ts-ignore
globalThis.GearApi = GearApi;
// @ts-ignore
globalThis.getProgramMetadata = getProgramMetadata;
// @ts-ignore
globalThis.GearKeyring = GearKeyring;
// @ts-ignore
globalThis.CreateType = CreateType;
// @ts-ignore
globalThis.GearProtocol = GearProtocol;
