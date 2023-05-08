import { multiaddr, protocols } from "@multiformats/multiaddr";
import { pipe } from "it-pipe";
import { fromString, toString } from "uint8arrays";
import { webRTC, webRTCDirect } from "@libp2p/webrtc";
import { webSockets } from "@libp2p/websockets";
import * as filters from "@libp2p/websockets/filters";
import { pushable, Pushable } from "it-pushable";
import { mplex } from "@libp2p/mplex";
import { createLibp2p, Libp2p } from "libp2p";
import { circuitRelayTransport } from "libp2p/circuit-relay";
import { noise } from "@chainsafe/libp2p-noise";
import {Multiaddr} from "@multiformats/multiaddr";
import {BehaviorSubject, filter, firstValueFrom, Observable, ReplaySubject, scan, Subject} from "rxjs";
import {FinalPeerEvent, kadDHT} from '@libp2p/kad-dht'
import {P2PPeer, PeerWithMessage, PeerWithResponse} from "rxdb/plugins/replication-p2p";
import {RxError, RxTypeError} from "rxdb";
import {Connection} from "@libp2p/interface-connection";

export default class P2PNode {
  private _webrtcDirectAddress = new BehaviorSubject('');
  private CIRCUIT_RELAY_CODE: number;
  private WEBRTC_CODE: number;
  private node!: Libp2p;
  public readonly globalConnect$ = new Subject<P2PPeer>();
  private outgoingStreams: Map<string, any> = new Map();
  public readonly globalDisconnect$ = new Subject<P2PPeer>();
  public readonly globalMessage$ = new ReplaySubject<PeerWithMessage>();
  public readonly globalResponse$ = new ReplaySubject<PeerWithResponse>();
  public readonly globalError$ = new Subject<RxError | RxTypeError>();

  constructor() {
    this.CIRCUIT_RELAY_CODE = 290;
    this.WEBRTC_CODE = 281;
  }

  async initialize(peerAddresses: string[]): Promise<BehaviorSubject<string>> {
    this.node = await createLibp2p({
      transports: [
        webSockets({
          filter: filters.all,
        }),
        webRTC({}),
        circuitRelayTransport({
          discoverRelays: 1
        }),
      ],
      dht: kadDHT(),
      connectionEncryption: [noise()],
      streamMuxers: [mplex()]
    });
    await this.node.start();
    const self = this;
    await this.node.handle("/echo/1.0.0", ({stream, connection}) => {
      console.log("CREATING ", connection.remotePeer.toString(), self.outgoingStreams);
      pipe(
        stream,
        async function* (source) {
          for await (const buf of source) {
            let messageOrResponse = toString(buf.subarray());
            try {
              messageOrResponse = JSON.parse(messageOrResponse.toString());
            } catch (e) {
            }
            console.log("MESSAGE", messageOrResponse);
            // @ts-ignore
            if (messageOrResponse.result) {
              self.globalResponse$.next({
                peer: self.outgoingStreams.get(connection.remotePeer.toString()),
                // @ts-ignore
                response: messageOrResponse
              });
            } else {
              self.globalMessage$.next({
                peer: {
                  id: connection.remotePeer.toString(),
                  // @ts-ignore
                  send: (message: any) => {
                    console.log("SENDING", message);
                    connection.newStream(["/echo/1.0.0"]).then(
                      (outgoing_stream: any) => {
                        const sender = pushable<Uint8Array>();
                        pipe(sender, outgoing_stream);
                        sender.push(fromString(message));
                      }
                    );
                  }
                },
                message: messageOrResponse as any
              });
            }
            yield buf;
          }
        },
        stream
      );
    });

    this.node.addEventListener("peer:connect", async (event: CustomEvent<Connection>) => {
      if (!this.isWebrtc(event.detail.remoteAddr)) {
        return;
      }
      await this.createOutgoingStream(event.detail);
    });

    this.node.addEventListener("peer:disconnect", (event: any) => {
      this.globalDisconnect$.next({
        id: event.detail.remotePeer.toString()
      });
    });
    this.node.peerStore.addEventListener("change:multiaddrs", (event: any) => {
      const { peerId } = event.detail;
      if (this.node.getMultiaddrs().length === 0 || !this.node.peerId.equals(peerId)) {
        return;
      }
      this.node.getMultiaddrs().forEach((ma) => {
        if (ma.protoCodes().includes(this.CIRCUIT_RELAY_CODE)) {
          if (ma.protos().pop()?.name === "p2p") {
            ma = ma.decapsulateCode(protocols("p2p").code);
          }
          const newWebrtcDirectAddress = multiaddr(ma.toString() + "/webrtc/p2p/" + this.node.peerId);
          const webrtcAddrString = newWebrtcDirectAddress.toString();
          if (webrtcAddrString !== this._webrtcDirectAddress?.value) {
            this._webrtcDirectAddress.next(webrtcAddrString);
          }
        }
      });
    });
    await Promise.all(peerAddresses.map((peer) => this.connect(peer)));
    return this._webrtcDirectAddress;
  }

  getConnections() {
    return this.node?.getConnections()?.map((connection) => {
      return connection.remoteAddr.toString();
    }) ?? [];
  }

  isWebrtc(ma: Multiaddr): boolean {
    return ma.protoCodes().includes(this.WEBRTC_CODE);
  }

  get multiaddress(): Promise<string> {
    return firstValueFrom(this._webrtcDirectAddress.pipe(filter(x => x !== "")));
  }

  async connect(peerAddress: string): Promise<void> {
    const ma = multiaddr(peerAddress);
    await this.node.dial(ma);
  }

  private async createOutgoingStream(connection: any, multicodecs: string[] = ["/echo/1.0.0"]) {
    const outgoing_stream = await connection.newStream(multicodecs);
    const sender = pushable<Uint8Array>();
    pipe(sender, outgoing_stream);
    const peer = {
      id: connection.remotePeer.toString(),
      // @ts-ignore
      send: (message) => {
        console.log("SEND", message);
        sender.push(fromString(message));
      }
    };
    console.log("CREATING ", connection.remotePeer.toString());
    this.outgoingStreams.set(connection.remotePeer.toString(), peer);
    this.globalConnect$.next( peer);
  }

  as() {
    return this.globalResponse$.pipe(scan((acc: any, curr: any) => {
      acc.push(curr);
      return acc;
    }, []))
  }

}
