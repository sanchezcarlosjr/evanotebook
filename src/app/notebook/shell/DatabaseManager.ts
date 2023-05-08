import {BehaviorSubject, filter, firstValueFrom, map, Observable, shareReplay, Subscriber, tap, switchMap} from "rxjs";
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
import {getConnectionHandlerLibP2P} from "./getConnectionHandlerLibP2P";
import {RxDBLeaderElectionPlugin} from 'rxdb/plugins/leader-election';
import {enforceOptions} from "broadcast-channel";
import {randomCouchString} from "rxdb/plugins/utils";
import {DocumentObserver} from "./documentObserver";

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
            createdAt: new Date(y._data.createdAt)
          }))).sort(
            (a: { createdAt: Date }, b: { createdAt: Date }) => b.createdAt.getTime() - a.createdAt.getTime()
          )
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
      globalThis.tap = tap;
      // @ts-ignore
      globalThis.map = map;
      // @ts-ignore
      globalThis.filter = filter;
      url.write("t", this.topic);
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
      return this.readBlocksFromURL();
    }
    if (url.has("u")) {
      return fetch(url.read("u"));
    }
    return [];
  }

  async replicateCollections() {
    if (!this._database)
      return;
    const handler = await getConnectionHandlerLibP2P(this._uuid);
    // @ts-ignore
    await this.replicatePool(this._database?.blocks, handler);
    // @ts-ignore
    // await this.replicatePool(this._database?.view, handler);
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
      map(lib => JSON.parse(this.textDecoder.decode(lib.decompress(base64ToData(url.read("c")))))?.blocks)
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

  increaseIndexes(index: number) {
    // @ts-ignore
    return this._database?.blocks?.find({
      selector: {
        index: {
          $gte: index
        },
        topic: {
          $eq: this.topic
        }
      }
    }).update({
      $inc: {
        index: 1
      },
      $set: {
        lastEditedBy: this._uuid
      }
    });
  }

  decreaseIndexes(index: number) {
    // @ts-ignore
    return this._database?.blocks?.find({
      selector: {
        index: {
          $gte: index
        },
        topic: {
          $eq: this.topic
        }
      }
    }).update({
      $inc: {
        index: -1
      },
      $set: {
        lastEditedBy: this._uuid
      }
    });
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
    this._uuid = crypto.randomUUID();
    this.topic = url.read("t") || crypto.randomUUID();
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
    window.dispatchEvent(new CustomEvent('saving'));
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
    });
  }

  async changeBlock(blockRow: BlockDocument) {
    // @ts-ignore
    if (!this._database?.blocks) {
      return;
    }
    // @ts-ignore
    const block = await this._database?.blocks?.findOne(blockRow.id).exec();
    if (!block) {
      return this.addBlock(blockRow);
    }
    if (_.isEqual(blockRow.data, block?._data?.data)) {
      return block;
    }
    window.dispatchEvent(new CustomEvent('saving'));
    return block.updateCRDT({
      ifMatch: {
        $set: {
          data: blockRow.data,
          index: blockRow.index,
          lastEditedBy: this._uuid,
          _deleted: false
        }
      }
    });
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
      type: 'paragraph',
      data: {text: ''},
      createdBy: this._uuid,
      lastEditedBy: this._uuid
    };
  }

  saveNotebookInHistory(notebook: { title: string }) {
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
              title: notebook.title,
              topic: this.topic,
              createdAt: new Date().toString()
            }
          },
          ifNotMatch: {
            $set: {
              title: notebook.title
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
        version: '2.26.5',
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
