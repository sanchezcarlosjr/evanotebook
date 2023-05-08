import {PROMISE_RESOLVE_VOID} from 'rxdb/plugins/utils';
import type {
  P2PConnectionHandler,
  P2PConnectionHandlerCreator,
  P2PMessage,
  P2PPeer
} from 'rxdb/plugins/replication-p2p';
import {SyncOptionsP2P} from "rxdb/plugins/replication-p2p";
import P2PNode from "./P2PNode";
import * as url from "./url";
import {filter, tap} from "rxjs";


export async function getConnectionHandlerLibP2P(
  id: string = ''
): Promise<P2PConnectionHandlerCreator> {
  const p2p = new P2PNode();
  await p2p.initialize(url.read('mas').split(","));
  url.write("ma", await p2p.multiaddress);
  return (options: SyncOptionsP2P<any>): P2PConnectionHandler  => {
    return {
      error$: p2p.globalError$,
      connect$: p2p.globalConnect$,
      disconnect$: p2p.globalDisconnect$,
      message$: p2p.globalMessage$.pipe(
        tap(x => console.log("MESSAGE", x)),
      ),
      response$: p2p.globalResponse$.pipe(
        tap(x => console.log("RESPONSE", x)),
      ),
      async send(peer: P2PPeer, message: P2PMessage) {
        console.log(peer, message);
        (peer as any).send(JSON.stringify(message));
      },
      destroy() {
        p2p.globalError$.complete();
        p2p.globalConnect$.complete();
        p2p.globalDisconnect$.complete();
        p2p.globalMessage$.complete();
        p2p.globalResponse$.complete();
        return PROMISE_RESOLVE_VOID;
      }
    };
  };
}
