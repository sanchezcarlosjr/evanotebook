import {
  concatMap,
  filter,
  finalize,
  first,
  firstValueFrom,
  from,
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
import { createLibp2p, Libp2p as Libp2pType } from 'new-libp2p';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { bootstrap } from '@libp2p/bootstrap';
import { kadDHT } from '@libp2p/kad-dht';
import { mplex } from '@libp2p/mplex';
import { webRTCDirect, webRTC } from '@libp2p/webrtc';
import { webSockets } from '@libp2p/websockets';
import { webTransport } from '@libp2p/webtransport';
import { circuitRelayTransport } from 'new-libp2p/circuit-relay';
import { identifyService } from 'new-libp2p/identify';
import { pushable } from "it-pushable";
import { pipe } from "it-pipe";
import { multiaddr, protocols } from "@multiformats/multiaddr";
import { fromString, toString } from "uint8arrays";
import { AddressOrPair, SignerOptions } from "@polkadot/api/types";
import { IEvent } from "@polkadot/types/types";

export interface Protocol {
  connect: (options: any) => any;
  send: (options: any) => any;
}

type GearMessageProtocol = Partial<IMessageSendOptions> & {
  providerAddress?: string;
  destination: string;
  payload: any;
  keyrings: (AddressOrPair|Partial<SignerOptions> | undefined)[];
  gasLimit?: any;
}

interface GearProtocolOptions extends GearApiOptions {
  metadataPlainText?: string
}

export class GearProtocol implements Protocol {
  private gearApi?: GearApi;
  private meta?: ProgramMetadata;
  private initializationPromise: Promise<GearProtocol>;

  constructor(options: GearProtocolOptions = {}) {
    this.initializationPromise  = this.init(options);
  }

  async init(options:  GearProtocolOptions = {}) {
    options = Object.assign(options, {providerAddress: 'wss://testnet.vara.rs'});
    this.gearApi = await GearApi.create(options);
    this.meta = getProgramMetadata("0x" + options.metadataPlainText);
    return this;
  }

  connect() {
    const unsub: (() => any) | null = null;
    return new Observable<any[]>(
      (subscriber: Subscriber<any>) => {
        this.initializationPromise.then(protocol => protocol.gearApi?.query.system.events((events) => subscriber.next(events)));
      }).pipe(
      finalize(() => {
        if (unsub) {
          // unsub();
        }
      })
    );
  }

  async send(message: GearMessageProtocol) {
    await this.initializationPromise;
    message = Object.assign(message, {
      // You should choose something wisely. Find out how https://wiki.gear-tech.io/docs/api/calculate-gas
      gasLimit: 508_337_712*2,
      value: 0
    });
    const gearEvents = this.listenUserMessageEvents(message.destination);
    const messageEvents = this.signAndSend(message);
    return firstValueFrom(gearEvents.pipe(
      concatMap(gearEvent => messageEvents.pipe(filter(({k}) => k === gearEvent.k), map(_ => gearEvent.v))),
      first()
    ));
  }
  private signAndSend(message: GearMessageProtocol) {
    const extrinsic = this.gearApi?.message.send(message as IMessageSendOptions, this.meta);
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

  listenUserMessageEvents(destination: string) {
    return this.connect().pipe(
      map(events =>
         events.map(({event}: {event: IEvent<any, any>}) => {
          // @ts-ignore
          if (this.gearApi.events?.gear?.UserMessageSent?.is(event)) {
            const {
              data: {
                // @ts-ignore
                message: {source, details}
              }
            } = event;
            if (source.eq(destination)) {
              // @ts-ignore
              return {k: details.toHex(), v: this.meta.createType(0, event?.data?.toHuman()?.message?.payload)};
            }
            return null;
          }
          return null;
        })
      ),
      concatMap(x => from(x)),
      filter(x => x !== null)
    ) as Observable<{k: string, v: any}>;
  }
}

export class Libp2p {
     private _node?: Libp2pType;
     get isAWebWorker(): boolean {
       // @ts-ignore
       return ('undefined' !== typeof WorkerGlobalScope) && ("function" === typeof importScripts) && (navigator instanceof WorkerNavigator)
     }
     async send(options: {peer: string, multicodecs: string[]|string, message: string}) {
      const ma = multiaddr(options.peer);
      const connection = await this._node?.dial(ma);
      const outgoing_stream = await connection?.newStream(options.multicodecs);
      const sender = pushable();
      pipe(sender, outgoing_stream);
      sender.push(fromString(options.message));
     }
     get WEBRTC_CODE() {
      return protocols('webrtc').code;
     }
     get node() {
        return this._node;
     }
     async connect(options: {multicodecs: string[]|string} = {multicodecs: "/echo/1.0.0"}) {
         return new Observable((subscriber) => {
            (async () => {
              this._node = await createLibp2p({
                transports: [
                  webSockets(),
                  webTransport(),
                  ...(this.isAWebWorker ? [] : [webRTC(),webRTCDirect()]),
                  circuitRelayTransport({
                    discoverRelays: 1
                  })
                ],
                connectionEncryption: [noise()],
                streamMuxers: [yamux(), mplex()],
                peerDiscovery: [
                  bootstrap({
                    list: [
                      '/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
                      '/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb',
                      '/dnsaddr/bootstrap.libp2p.io/p2p/QmZa1sAxajnQjVM8WjWXoMbmPd7NsWhfKsPkErzpm9wGkp',
                      '/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ',
                      '/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt'
                    ]
                  })
                ],
                connectionGater: {
                  denyDialMultiaddr: () => {
                    return false
                  }
                },
                services: {
                  identify: identifyService(),
                  dht: kadDHT({
                    clientMode: true
                  })
                }
              })
              this._node.addEventListener('peer:discovery', (evt) => {
                const peerInfo = evt.detail;
                this._node?.dial(peerInfo.id);
                console.log(peerInfo.toString());
              });

              this._node.addEventListener('peer:connect', (evt) => {
                const peerId = evt.detail;
                console.log(peerId.toString());
              });

              // Listen for peers disconnecting
              this._node.addEventListener('peer:disconnect', (evt) => {
                console.log(evt.detail);
              });

              const self = this;
              await this._node.handle(options.multicodecs, ({ stream, connection }) => {
                pipe(
                  stream,
                  async function* (source: any) {
                    for await (const buf of source) {
                      const incoming = toString(buf.subarray(),'utf-8');
                      subscriber.next({
                        ready: true,
                        id: self._node?.peerId.toString(),
                        remotePeer: connection.remotePeer.toString(),
                        message: incoming,
                        connection: self
                      });
                      yield buf
                    }
                  },
                  stream
                )
              })

              await this._node.start();

              subscriber.next({
                ready: true,
                peerId: this._node.peerId.toString(),
                connection: this
              });
            })()
         }).pipe(
          startWith({
            ready: false,
            options,
            connection: this
          })
         )

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
// @ts-ignore
globalThis.Libp2p = Libp2p;
