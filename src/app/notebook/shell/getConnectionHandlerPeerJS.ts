import {filter, ReplaySubject, Subject, tap} from 'rxjs';
import {PROMISE_RESOLVE_VOID, randomCouchString} from 'rxdb/plugins/utils';
import type {
  P2PConnectionHandler,
  P2PConnectionHandlerCreator,
  P2PMessage,
  P2PPeer,
  PeerWithMessage,
  PeerWithResponse
} from 'rxdb/plugins/replication-p2p';

import {newRxError, RxError, RxTypeError} from 'rxdb';
import * as url from "./url";
import {SyncOptionsP2P} from "rxdb/plugins/replication-p2p";
import {PeerJSOption, Peer, DataConnection} from "peerjs";

function setupConnection<T>(dataConnection: DataConnection&{id: string}, globalResponse$: Subject<any>, globalMessage$: Subject<any>, globalConnect$: Subject<any>, globalDisconnect$: Subject<any>, globalError$: Subject<any>) {
  dataConnection.id = dataConnection.peer;
  dataConnection.on('open', function () {
    globalConnect$.next(dataConnection as DataConnection & { id: string });
  });
  dataConnection.on('data', (messageOrResponse: any) => {
    try {
      messageOrResponse = JSON.parse(messageOrResponse.toString());
    } catch (e) {
    }
    if (messageOrResponse?.message.result) {
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
        message: messageOrResponse?.message || messageOrResponse
      });
    }
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
  window.peerGlobalMessage$ = globalMessage$;

  peer.on('open', function (id) {
    const peers = url.read('ps');
    if (!peers) {
      return;
    }
    peers.split(',').forEach((peerId: string) => {
      const dataConnection = peer.connect(peerId, {
        reliable: true
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

  peer.on('close', function () {
    globalError$.next(newRxError('RC_P2P_PEER', {
      error: new Error('peerjs connection closed')
    }));
  });

  peer.on('disconnected', function () {
    peer.reconnect();
  });

  return (options: SyncOptionsP2P<any>) => {
    const handler: P2PConnectionHandler = {
      error$: globalError$,
      connect$: globalConnect$.pipe(
        tap(peer =>
          window.dispatchEvent(new CustomEvent('openSnackBar', {detail: {payload: {message: `Peer ${peer.id} has connected.`, action: "Got it!"}}}))
        )
      ),
      disconnect$: globalDisconnect$.pipe(
        tap(peer => window.dispatchEvent(new CustomEvent('openSnackBar', {detail: {payload: {message: `Peer ${peer.id} has disconnected.`, action: "Got it!"}}})))
      ),
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
