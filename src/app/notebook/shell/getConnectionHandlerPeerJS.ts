import {filter, Subject, tap} from 'rxjs';
import {PROMISE_RESOLVE_VOID, randomCouchString} from 'rxdb/plugins/utils';
import type {
  P2PConnectionHandler,
  P2PConnectionHandlerCreator,
  P2PMessage,
  P2PPeer,
  PeerWithMessage,
  PeerWithResponse
} from 'rxdb/plugins/replication-p2p';

import {DataConnection, Peer, PeerConnectOption, PeerJSOption} from 'peerjs';
import {newRxError, RxError, RxTypeError} from 'rxdb';
import * as url from "./url";
import {SyncOptionsP2P} from "rxdb/plugins/replication-p2p";

function connectToPeers() {
  const peers = url.read('ps');
  if (!peers) {
    return;
  }
  peers.split(',').forEach((peerId: string) => {
    window.dispatchEvent(new CustomEvent('peer.connect', {
      detail: {
        payload: {
          options: {
            options: {
              peerId
            }
          }
        }
      }
    }));
  });
}

function setupConnection<T>(dataConnection: DataConnection&{id: string}, connections: Map<string, DataConnection>, globalResponse$: Subject<any>, globalMessage$: Subject<any>, globalConnect$: Subject<any>, globalDisconnect$: Subject<any>, globalError$: Subject<any>) {
  dataConnection.id = dataConnection.peer;
  connections.set(dataConnection.peer, dataConnection);
  dataConnection.on('data', (messageOrResponse: any) => {
    try {
      messageOrResponse = JSON.parse(messageOrResponse.toString());
    } catch (e) {
    }
    if (messageOrResponse.message.result) {
      globalResponse$.next({
        peer: dataConnection as DataConnection & { id: string },
        // @ts-ignore
        collectionName: messageOrResponse.collectionName,
        response: messageOrResponse.message
      });
    } else {
      globalMessage$.next({
        peer: dataConnection as DataConnection & { id: string },
        // @ts-ignore
        collectionName: messageOrResponse.collectionName,
        message: messageOrResponse.message
      });
    }
  });
  dataConnection.on('open', function () {
    globalConnect$.next(dataConnection as DataConnection & { id: string });
  });
  dataConnection.on('close', function () {
    connections.delete(dataConnection.peer);
    globalDisconnect$.next(dataConnection as DataConnection & { id: string });
  });
  dataConnection.on('error', (error: any) => {
    globalError$.next(newRxError('RC_P2P_PEER', {
      error
    }));
  });
}

export function getConnectionHandlerPeerJS(
  id: string = randomCouchString(10),
  peerOptions?: PeerJSOption
): P2PConnectionHandlerCreator {
  const peer = new Peer(id, peerOptions);
  const connections = new Map<string, DataConnection>();
  const globalConnect$ = new Subject<P2PPeer>();
  const globalDisconnect$ = new Subject<P2PPeer>();
  const globalMessage$ = new Subject<PeerWithMessage>();
  const globalResponse$ = new Subject<PeerWithResponse>();
  const globalError$ = new Subject<RxError | RxTypeError>();

  peer.on('open', function (id) {
    connectToPeers();
  });

  // @ts-ignore
  window.addEventListener('peer.connect', (event:CustomEvent) => {
    if (event.detail?.port) {
      globalMessage$.asObservable().pipe(
        filter((peerWithMessage: PeerWithMessage) => peerWithMessage.peer.id === event.detail.payload.options?.options.peerId)
      ).subscribe((peerWithMessage: PeerWithMessage) => {
        event.detail?.port?.postMessage({
          event: event.detail.payload.options?.event, payload: peerWithMessage.message
        });
      });
    }
    if (connections.has(event.detail.payload.options.options.peerId)) {
      return;
    }
    const dataConnection = peer.connect(event.detail.payload.options.options.peerId, {
      reliable: true,
    });
    // @ts-ignore
    setupConnection(dataConnection, connections, globalResponse$, globalMessage$, globalConnect$, globalDisconnect$, globalError$);
  });

  // @ts-ignore
  window.addEventListener('peer.send', (event:CustomEvent) => {
    const dataConnection = connections.get(event.detail.payload.peerId);
    if (!dataConnection) {
      return;
    }
    dataConnection.send(event.detail.payload.message);
  });

  peer.on('connection', (dataConnection: DataConnection) => {
    if (connections.has(dataConnection.peer)) {
      return;
    }
    // @ts-ignore
    setupConnection(dataConnection, connections, globalResponse$, globalMessage$, globalConnect$, globalDisconnect$, globalError$);
  });

  peer.on('error', function (error) {
    globalError$.next(newRxError('RC_P2P_PEER', {
      error
    }));
  });

  peer.on('disconnected', function () {
    peer.reconnect();
  });

  return (options: SyncOptionsP2P<any>) => {
    const handler: P2PConnectionHandler = {
      error$: globalError$,
      connect$: globalConnect$,
      disconnect$: globalDisconnect$,
      message$: globalMessage$.pipe(
        filter((x: any) => x.collectionName === options.collection.name)
      ),
      response$: globalResponse$.pipe(
        filter((x: any) => x.collectionName === options.collection.name)
      ),
      async send(peer: P2PPeer|DataConnection, message: P2PMessage) {
        (peer as DataConnection).send(JSON.stringify({collectionName: options.collection.name, message}));
      },
      destroy() {
        peer.destroy();
        globalError$.complete();
        globalConnect$.complete();
        globalDisconnect$.complete();
        globalMessage$.complete();
        globalResponse$.complete();
        return PROMISE_RESOLVE_VOID;
      }
    };
    return handler;
  };
}
