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
import {DocumentObserver} from "./documentObserver";

function setupConnection<T>(dataConnection: DataConnection&{id: string}, globalResponse$: Subject<any>, globalMessage$: Subject<any>, globalConnect$: Subject<any>, globalDisconnect$: Subject<any>, globalError$: Subject<any>) {
  dataConnection.id = dataConnection.peer;
  dataConnection.on('data', (messageOrResponse: any) => {
    try {
      messageOrResponse = JSON.parse(messageOrResponse.toString());
    } catch (e) {
    }
    if (messageOrResponse?.result) {
      globalResponse$.next({
        peer: dataConnection as DataConnection & { id: string },
        response: messageOrResponse
      });
    } else {
      globalMessage$.next({
        peer: dataConnection as DataConnection & { id: string },
        message: messageOrResponse
      });
    }
  });
  dataConnection.on('open', function () {
    globalConnect$.next(dataConnection as DataConnection & { id: string });
  });
  dataConnection.on('close', function () {
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
  const globalConnect$ = new ReplaySubject<P2PPeer>();
  const globalDisconnect$ = new ReplaySubject<P2PPeer>();
  const globalMessage$ = new ReplaySubject<PeerWithMessage>();
  const globalResponse$ = new ReplaySubject<PeerWithResponse>();
  const globalError$ = new ReplaySubject<RxError | RxTypeError>();
  const peer = new Peer(id, peerOptions);
  // @ts-ignore
  window.peer = peer;

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
      setupConnection(dataConnection, globalResponse$, globalMessage$, globalConnect$, globalDisconnect$, globalError$);
    });
  });

  peer.on('connection', (dataConnection: DataConnection) => {
    // @ts-ignore
    setupConnection(dataConnection, globalResponse$, globalMessage$, globalConnect$, globalDisconnect$, globalError$);
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
      error$: globalError$.pipe(
        tap(message => console.log("getConnectionHandlerPeerJS error", message))
      ),
      connect$: globalConnect$.pipe(
        tap(message => console.log("getConnectionHandlerPeerJS connect", message))
      ),
      disconnect$: globalDisconnect$.pipe(
        tap(message => console.log("getConnectionHandlerPeerJS disconnect", message))
      ),
      message$: globalMessage$.pipe(
        tap(message => console.log("getConnectionHandlerPeerJS message", message))
      ),
      response$: globalResponse$.pipe(
        tap(message => console.log("getConnectionHandlerPeerJS response", message))
      ),
      async send(peer: P2PPeer|DataConnection, message: P2PMessage) {
        console.log(message);
        (peer as DataConnection).send(JSON.stringify(message));
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
