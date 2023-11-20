import {
  BehaviorSubject,
  filter,
  first,
  firstValueFrom,
  map,
  Observable,
  shareReplay,
  Subscriber,
  switchMap
} from "rxjs";
import {OutputData} from "@editorjs/editorjs";
import {addRxPlugin, createRxDatabase, RxCollection, RxDatabaseBase, RxDocument, RxDumpDatabaseAny} from 'rxdb';
import {getRxStorageDexie} from 'rxdb/plugins/storage-dexie';
import {RxDBUpdatePlugin} from 'rxdb/plugins/update';
import brotli from "./brotli";
import * as url from "./url";
import {getCRDTSchemaPart, RxDBcrdtPlugin} from 'rxdb/plugins/crdt';
import {OutputBlockData} from "@editorjs/editorjs/types/data-formats/output-data";
import * as _ from 'lodash';
import {RxDBJsonDumpPlugin} from 'rxdb/plugins/json-dump';
import {P2PConnectionHandlerCreator, replicateP2P} from "rxdb/plugins/replication-p2p";
import {getConnectionHandlerPeerJS} from "./getConnectionHandlerPeerJS";
import {RxDBLeaderElectionPlugin} from 'rxdb/plugins/leader-election';
import {enforceOptions} from "broadcast-channel";
import {randomCouchString} from "rxdb/plugins/utils";
import {DocumentObserver} from "./documentObserver";
import {Injectable} from "@angular/core";
import {EditorJS} from "./editorJS";

addRxPlugin(RxDBLeaderElectionPlugin);

addRxPlugin(RxDBUpdatePlugin);
addRxPlugin(RxDBcrdtPlugin);
addRxPlugin(RxDBJsonDumpPlugin);
// https://github.com/httptoolkit/brotli-wasm/blob/main/test/brotli.spec.ts
export const dataToBase64 = (data: Uint8Array | number[]) => btoa(String.fromCharCode(...data));
export const base64ToData = (base64: string) => new Uint8Array(
  [...atob(base64)].map(c => c.charCodeAt(0))
);

/*
  This is a workaround for the fact that idb and pubkey's Broadcast channel does not work in web workers.
  However, nowadays, the native BroadcastChannel is supported in modern browsers.
 */
enforceOptions({
  type: 'native'
});

export type BlockDocument =
  OutputBlockData
  & { createdBy?: string, index?: number, lastEditedBy?: string, topic?: string };

@Injectable({
  providedIn: 'root',
})
export class DatabaseManager {
  private _uuid: string | undefined;
  private topic: string | undefined;
  private txt = document.createElement("textarea");
  private textEncoder = new TextEncoder();
  private textDecoder = new TextDecoder();
  private brotli: Observable<any> = new Observable((subscriber) => {
    brotli.then(lib => {
      subscriber.next(lib);
      subscriber.complete();
    });
  }).pipe(shareReplay(1));
  private database$: BehaviorSubject<RxDatabaseBase<Promise<any>, any>> = new BehaviorSubject<RxDatabaseBase<Promise<any>, any>>(undefined as any);

  constructor() {
    this.setupPeer();
  }

  private _database: RxDatabaseBase<Promise<any>, any> | undefined;

  get database(): RxDatabaseBase<Promise<any>, any> | undefined {
    return this._database;
  }

  get history$() {
    // @ts-ignore
    return this.database$.pipe(
      filter(db => !!db),
      // @ts-ignore
      switchMap(db => db.history?.find().$.pipe(
        map((x: RxDocument[]) =>
          (x.map((y: any) => ({
            title: y._data.title,
            topic: y._data.topic,
            ['Created By']: y._data.createdBy,
            ['Last Edited By']: y._data.lastEditedBy,
            ['Created At']: new Date(y._data.createdAt).toLocaleString(),
            ['Updated At']: new Date(y._data.updatedAt).toLocaleString(),
          })))
        ),
      ))
    );
  }

  async start() {
    try {
      this._database = await createRxDatabase({
        name: 'eva_notebook',
        multiInstance: true,
        storage: getRxStorageDexie()
      });
      const collections = await this._database.addCollections({
        history: {
          schema: {
            title: 'history',
            version: 0,
            type: 'object',
            primaryKey: 'topic',
            properties: {
              topic: {
                type: 'string',
                maxLength: 100
              },
              createdAt: {
                type: 'string',
                maxLength: 100
              },
              updatedAt: {
                type: 'string',
                maxLength: 100
              },
              createdBy: {
                type: 'string',
                maxLength: 100
              },
              lastEditedBy: {
                type: 'string',
                maxLength: 100
              },
              title: {
                type: 'string',
                maxLength: 255
              },
              crdts: getCRDTSchemaPart()
            },
            required: ['topic'],
            crdt: {
              field: 'crdts'
            }
          }
        },
        blocks: {
          schema: {
            title: 'blocks',
            version: 0,
            primaryKey: 'id',
            type: 'object',
            properties: {
              id: {
                type: 'string',
                maxLength: 100
              },
              topic: {
                type: 'string',
                maxLength: 100,
                default: "EvaNotebook"
              },
              lastEditedBy: {
                type: 'string',
              },
              index: {
                type: 'number',
                minimum: 0,
                maximum: 1000,
                multipleOf: 1
              },
              createdBy: {
                type: 'string',
              },
              type: {
                type: 'string'
              },
              data: {
                type: 'object'
              },
              tunes: {
                type: 'object'
              },
              crdts: getCRDTSchemaPart()
            },
            required: ['id', 'type', 'data', 'index', 'lastEditedBy', 'createdBy'],
            indexes: ['index'],
            crdt: {
              field: 'crdts'
            }
          }
        },
        view: {
          schema: {
            title: 'view',
            version: 0,
            primaryKey: 'id',
            type: 'object',
            properties: {
              id: {
                type: 'string',
                maxLength: 100
              },
              m: {
                type: 'object'
              },
              crdts: getCRDTSchemaPart()
            },
            required: ['id'],
            crdt: {
              field: 'crdts'
            }
          }
        }
      });
      this.database$.next(this._database);
      // @ts-ignore
      globalThis.environment = DocumentObserver.setup(this.database$);
      // @ts-ignore
      globalThis.editor = new EditorJS({topic: this.topic, peer: this._uuid, db: this.database$});
      collections.blocks.postInsert(async (plainData, rxDocument) => {
        await this.updateHistory();
        return this.increaseIndexes(plainData.index);
      }, false);
      collections.blocks.postCreate(async (plainData, rxDocument) => {
        return this.updateHistory();
      });
      collections.blocks.postRemove(async (plainData, rxDocument) => {
        await this.updateHistory();
        return this.decreaseIndexes(plainData.index);
      }, false);
      return collections.blocks.find({
        selector: {
          topic: {
            $eq: this.topic
          }
        },
        sort: [{index: 'asc'}]
      }).$;
    } catch (e) {
      return new Observable((subscriber: Subscriber<OutputBlockData[]>) => {
        subscriber.next([this.generateDefaultBlock()]);
        subscriber.complete();
      });
    }
  }

  async registerUrlProviders() {
    if (url.has("c")) {
      return this.readBlocksFromURL().then(blocks => {
        return blocks;
      });
    }
    if (url.has("u")) {
      return fetch(url.read("u")).then(response => response.json()).then(blocks => {
        return blocks;
      });
    }
    return [];
  }

  waitForLeadership() {
    return this._database?.waitForLeadership();
  }

  async replicateCollections() {
    if (!this._database)
      return;
    url.write("t", this.topic);
    url.write("p", this._uuid);
    const handler = getConnectionHandlerPeerJS(this._uuid, {
      host: url.read("peerjshost", "0.peerjs.com"),
      port: parseInt(url.read("peerjsport", "443")),
      secure: JSON.parse(url.read("peerjssecure", "true")),
      path: url.read("peerjspath", "/"),
      key: url.read("peerjskey", "peerjs"),
    });
    // @ts-ignore
    await this.replicatePool(this._database?.blocks, handler);
    // @ts-ignore
    await this.replicatePool(this._database?.view, handler);
  }

  async replicatePool(collection: any, connectionHandlerCreator: P2PConnectionHandlerCreator) {
    if (!collection)
      return;
    return await replicateP2P(
      {
        collection: collection,
        secret: "",
        topic: this._uuid as string,
        connectionHandlerCreator,
        pull: {},
        push: {}
      }
    );
  }

  bulkInsertBlocks(blocks: BlockDocument[]) {
    blocks.forEach((block: BlockDocument, index: number) => {
      block.index = index;
      block.createdBy = this._uuid;
      block.lastEditedBy = this._uuid;
      block.topic = this.topic;
    });
    // @ts-ignore
    return this._database?.blocks.bulkInsert(blocks);
  }

  decodeHtmlEntities(html: string) {
    this.txt.innerHTML = html;
    return this.txt.value;
  }

  upsert(data: any) {
    // @ts-ignore
    return this._database.blocks.insertCRDT({
      selector: {
        id: {$exists: false}
      },
      ifMatch: {
        $set: data
      },
      ifNotMatch: {
        $set: data
      }
    });
  }

  readBlocksFromURL() {
    return firstValueFrom(this.brotli.pipe(
      map(lib => JSON.parse(this.decodeHtmlEntities(this.textDecoder.decode(lib.decompress(base64ToData(url.read("c"))))))?.blocks)
    ));
  }

  writeCollectionURL(collection: any, key: string = "c") {
    this.compress(JSON.stringify(collection)).subscribe((base64: string) => url.write(key, base64));
  }

  compress(input: string, options?: any) {
    return this.brotli.pipe(map(lib => dataToBase64(lib.compress(this.textEncoder.encode(input), options))));
  }

  decompress(base64: string) {
    return this.brotli.pipe(map(lib => this.textDecoder.decode(lib.decompress(base64ToData(base64)))));
  }

  exportDatabase() {
    return this._database?.exportJSON();
  }

  async exportCurrentNotebook() {
    // @ts-ignore
    return
  }

  importDatabase(json: RxDumpDatabaseAny<RxCollection>) {
    return this._database?.importJSON(json);
  }

  index(name: string) {
    // @ts-ignore
    return this._database[name]?.find().$.pipe(
      map((x: any) => x)
    );
  }

  insert$() {
    // @ts-ignore
    return this._database?.blocks?.insert$?.pipe(
      map((x: any) => x.documentData),
      filter((documentData: any) => documentData.lastEditedBy != this._uuid && documentData.topic === this.topic)
    );
  }

  remove$() {
    // @ts-ignore
    return this._database?.blocks?.remove$?.pipe(
      map((x: any) => x.documentData),
      filter((documentData: any) => documentData.lastEditedBy != this._uuid && documentData.topic === this.topic)
    );
  }

  update$() {
    // @ts-ignore
    return this._database?.blocks?.update$?.pipe(
      map((x: any) => x.documentData),
      filter((documentData: any) => documentData.lastEditedBy != this._uuid && documentData.topic === this.topic)
    );
  }

  async insert(name: string, outputData: OutputData) {
    // @ts-ignore
    return (await this._database[name].insertCRDT({
      ifMatch: {
        $set: outputData
      },
    }))._data;
    // @ts-ignore
  }

  async destroy() {
    await this._database?.destroy();
  }

  async modifyIndex(index: number, value: number) {
    // @ts-ignore
    const blocks = await this._database?.blocks?.find({
      selector: {
        index: {
          $gt: index
        },
        topic: {
          $eq: this.topic
        }
      }
    }).exec();
    return Promise.all(blocks.map((block: RxDocument) =>
      block.updateCRDT({
        ifMatch: {
          $inc: {
            index: value
          },
          $set: {
            lastEditedBy: this._uuid
          }
        }
      })
    ));
  }

  increaseIndexes(index: number) {
    return this.modifyIndex(index, 1);
  }

  decreaseIndexes(index: number) {
    return this.modifyIndex(index, -1);
  }

  updateIndex(block: any, index: number) {
    if (!this._database || !block?.updateCRDT) {
      return Promise.resolve();
    }
    // @ts-ignore
    return block?.updateCRDT({
      ifMatch: {
        $set: {
          lastEditedBy: this._uuid,
          index
        }
      }
    });
  }

  setupPeer() {
    this._uuid = url.read("p") || randomCouchString(10);
    this.topic = url.read("t") || randomCouchString(10);
  }

  createNewDatabase() {
    return undefined;
  }

  async addBlock(block: BlockDocument) {
    // @ts-ignore
    if (!this._database?.blocks && block.index < 0) {
      return;
    }
    block.createdBy = this._uuid;
    block.lastEditedBy = this._uuid;
    block.topic = this.topic;
    // @ts-ignore
    await this._database?.blocks?.insertCRDT({
      selector: {
        id: {$exists: false}
      },
      ifMatch: {
        $set: block
      }
    });
    window.dispatchEvent(new CustomEvent('saving'));
  }

  async removeBlock(id: string) {
    // @ts-ignore
    if (!this._database?.blocks) {
      return;
    }
    // @ts-ignore
    const block = await this._database.blocks.findOne(id).exec();
    if (!block) {
      return;
    }
    return block.updateCRDT({
      selector: {
        id: {$exists: true}
      },
      ifMatch: {
        $set: {
          id,
          _deleted: true
        }
      }
    }).then((_: any) => window.dispatchEvent(new CustomEvent('saving')));
  }

  async updateBlockIndexById(id: string, index: number) {
    // @ts-ignore
    if (!this._database?.blocks) {
      return;
    }
    // @ts-ignore
    const block = await this._database?.blocks?.findOne(id).exec();
    if (!block)
      return;
    // @ts-ignore
    return block?.updateCRDT({
      selector: {
        index: {$ne: index}
      },
      ifMatch: {
        $set: {
          index,
          lastEditedBy: this._uuid
        }
      },
    }).then((_: any) => window.dispatchEvent(new CustomEvent('saving')));
  }

  async changeBlock(blockRow: BlockDocument) {
    // @ts-ignore
    if (!this._database?.blocks) {
      return null;
    }
    // @ts-ignore
    const block = await this._database?.blocks?.findOne(blockRow.id).exec();
    if (!block) {
      return this.addBlock(blockRow);
    }
    if (_.isEqual(blockRow.data, block?._data?.data)) {
      return block;
    }
    return block.updateCRDT({
      ifMatch: {
        $set: {
          data: blockRow.data,
          index: blockRow.index,
          lastEditedBy: this._uuid
        }
      }
    }).then((_: any) => window.dispatchEvent(new CustomEvent('saving')));
  }

  removeAllBlocks() {
    // @ts-ignore
    return this._database.blocks.find({
      selector: {
        topic: {
          $eq: this.topic
        }
      }
    }).remove();
  }

  generateDefaultBlock() {
    return {
      id: randomCouchString(10),
      topic: this.topic,
      index: 0,
      type: 'header',
      data: {level: 1, text: ''},
      createdBy: this._uuid,
      lastEditedBy: this._uuid
    };
  }

  updateHistory(notebook: { title?: string } = {}) {
    // @ts-ignore
    return firstValueFrom(
      this.database$.pipe(
        filter(db => !!db),
        // @ts-ignore
        switchMap(db => db.history.insertCRDT({
          selector: {
            topic: {$exists: false}
          },
          ifMatch: {
            $set: {
              topic: this.topic,
              createdAt: new Date().toString(),
              updatedAt: new Date().toString(),
              lastEditedBy: this._uuid,
              createdBy: this._uuid,
              ...notebook
            }
          },
          ifNotMatch: {
            $set: {
              updatedAt: new Date().toString(),
              lastEditedBy: this._uuid,
              ...notebook
            }
          }
        })))
    );
  }


  saveInUrl() {
    this.database$.pipe(
      // @ts-ignore
      filter(db => !!db && !!db.blocks),
      // @ts-ignore
      switchMap(db => db.blocks.find({
          selector: {
            topic: {
              $eq: this.topic
            }
          },
          sort: [{index: 'asc'}]
        }).exec() as Promise<RxDocument[]>
      ),
    ).subscribe((blocks: RxDocument[]) => {
      this.writeCollectionURL({
        version: '2.27.0',
        blocks: blocks.map((document: any) => ({
          id: document._data.id,
          type: document._data.type,
          data: document._data.data,
          tunes: document._data.tunes,
          index: document._data.index
        }))
      })
    })
    return true;
  }
}
