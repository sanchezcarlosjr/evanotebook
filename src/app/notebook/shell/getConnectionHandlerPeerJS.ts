import {filter, Subject} from 'rxjs';
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

export function getConnectionHandlerPeerJS(
  id: string = randomCouchString(10),
  peerOptions?: PeerJSOption
): P2PConnectionHandlerCreator {
  return (options: any) => {
    const peer = new Peer(id, peerOptions);
    const connect$ = new Subject<P2PPeer>();
    const disconnect$ = new Subject<P2PPeer>();
    const message$ = new Subject<PeerWithMessage>();
    const response$ = new Subject<PeerWithResponse>();
    const error$ = new Subject<RxError | RxTypeError>();
    const connections = new Map<string, DataConnection>();

    peer.on('open', function (id) {
      connectToPeers();
    });

    // @ts-ignore
    window.addEventListener('peer.connect', (event:CustomEvent) => {
      if (event.detail?.port) {
        message$.asObservable().pipe(
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
      dataConnection.id = dataConnection.peer;
      connections.set(dataConnection.peer, dataConnection);
      dataConnection.on('data', (messageOrResponse: any) => {
        try {
          messageOrResponse = JSON.parse(messageOrResponse.toString());
        } catch (e) {
        }
        if (messageOrResponse.result) {
          response$.next({
            peer: dataConnection as DataConnection&{id: string},
            response: messageOrResponse
          });
        } else {
          message$.next({
            peer: dataConnection as DataConnection&{id: string},
            message: messageOrResponse
          });
        }
      });
      dataConnection.on('open', function () {
        connect$.next( dataConnection as DataConnection&{id: string});
      });
      dataConnection.on('close', function () {
        connections.delete(dataConnection.peer);
        disconnect$.next( dataConnection as DataConnection&{id: string});
      });
      dataConnection.on('error', (error: any) => {
        error$.next(newRxError('RC_P2P_PEER', {
          error
        }));
      });
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
      dataConnection.id = dataConnection.peer;
      connections.set(dataConnection.peer, dataConnection);
      dataConnection.on('data', (messageOrResponse: any) => {
        messageOrResponse = JSON.parse(messageOrResponse.toString());
        if (messageOrResponse.result) {
          response$.next({
            peer: dataConnection as DataConnection&{id: string},
            response: messageOrResponse
          });
        } else {
          message$.next({
            peer: dataConnection as DataConnection&{id: string},
            message: messageOrResponse
          });
        }
      });
      dataConnection.on('open', () => {
        connect$.next( dataConnection as DataConnection&{id: string});
      });
      dataConnection.on('close', () => {
        connections.delete(dataConnection.peer);
        disconnect$.next( dataConnection as DataConnection&{id: string});
      });
      dataConnection.on('error', (error: any) => {
        error$.next(newRxError('RC_P2P_PEER', {
          error
        }));
      });
    });

    peer.on('error', function (error) {
      error$.next(newRxError('RC_P2P_PEER', {
        error
      }));
    });

    peer.on('disconnected', function () {
      peer.reconnect();
    });

    const handler: P2PConnectionHandler = {
      error$,
      connect$,
      disconnect$,
      message$,
      response$,
      async send(peer: P2PPeer|DataConnection, message: P2PMessage) {
        (peer as DataConnection).send(JSON.stringify(message));
      },
      destroy() {
        peer.destroy();
        error$.complete();
        connect$.complete();
        disconnect$.complete();
        message$.complete();
        response$.complete();
        return PROMISE_RESOLVE_VOID;
      }
    };
    return handler;
  };
}
