import {filter, ReplaySubject, shareReplay, Subject, tap} from 'rxjs';
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

function setupConnection<T>(dataConnection: DataConnection&{id: string}, connections: Map<string, DataConnection>, globalResponse$: Subject<any>, globalMessage$: Subject<any>, globalConnect$: Subject<any>, globalDisconnect$: Subject<any>, globalError$: Subject<any>) {
  dataConnection.id = dataConnection.peer;
  connections.set(dataConnection.peer, dataConnection);
  dataConnection.on('data', (messageOrResponse: any) => {
    try {
      messageOrResponse = JSON.parse(messageOrResponse.toString());
    } catch (e) {
    }
    if (messageOrResponse?.message?.result) {
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
  // @ts-ignore
  window.peer = peer;
  const connections = new Map<string, DataConnection>();
  const globalConnect$ = new Subject<P2PPeer>();
  const globalDisconnect$ = new Subject<P2PPeer>();
  const globalMessage$ = new Subject<PeerWithMessage>();
  const globalResponse$ = new Subject<PeerWithResponse>();
  const globalError$ = new Subject<RxError | RxTypeError>();

  peer.on('open', function (id) {
    const peers = url.read('ps');
    if (!peers) {
      return;
    }
    peers.split(',').forEach((peerId: string) => {
      const dataConnection = peer.connect(peerId, {
        reliable: true,
      });
      // @ts-ignore
      setupConnection(dataConnection, connections, globalResponse$, globalMessage$, globalConnect$, globalDisconnect$, globalError$);
    });
  });

  peer.on('connection', (dataConnection: DataConnection) => {
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
        shareReplay(),
        filter((x: any) => x.collectionName === options.collection.name)
      ),
      response$: globalResponse$.pipe(
        shareReplay(),
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
