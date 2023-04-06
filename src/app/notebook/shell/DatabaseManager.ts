import {BehaviorSubject, filter, map, Observable} from "rxjs";
import {OutputData} from "@editorjs/editorjs";
import {addRxPlugin, createRxDatabase, RxCollection, RxDatabaseBase, RxDumpDatabaseAny} from 'rxdb';
import {getRxStorageDexie} from 'rxdb/plugins/storage-dexie';
import {RxDBUpdatePlugin} from 'rxdb/plugins/update';
import brotli from "./brotli";
import * as url from "./url";
import * as Brotli from "../../../assets/brotli_wasm/brotli_wasm";
import {replicateRxCollection} from "rxdb/plugins/replication";
import {getCRDTSchemaPart, RxDBcrdtPlugin} from 'rxdb/plugins/crdt';
import {OutputBlockData} from "@editorjs/editorjs/types/data-formats/output-data";
import * as _ from 'lodash';
import {RxDBJsonDumpPlugin} from 'rxdb/plugins/json-dump';
import {replicateP2P} from "rxdb/plugins/replication-p2p";
import {getConnectionHandlerPeerJS} from "./getConnectionHandlerPeerJS";

addRxPlugin(RxDBUpdatePlugin);
addRxPlugin(RxDBcrdtPlugin);
addRxPlugin(RxDBJsonDumpPlugin);
// https://github.com/httptoolkit/brotli-wasm/blob/main/test/brotli.spec.ts
export const dataToBase64 = (data: Uint8Array | number[]) => btoa(String.fromCharCode(...data));
export const base64ToData = (base64: string) => new Uint8Array(
  [...atob(base64)].map(c => c.charCodeAt(0))
);


type BlockRow = OutputBlockData&{createdBy?: string, index?: number, lastEditedBy?: string};

export class DatabaseManager {
  private _uuid: string | undefined;
  get database(): RxDatabaseBase<Promise<any>, any> | undefined {
    return this._database;
  }
  private subject = new BehaviorSubject<{ type: string, payload: any }>({type: '', payload: null});
  private _database: RxDatabaseBase<Promise<any>, any> | undefined;
  private txt = document.createElement("textarea");
  private textEncoder = new TextEncoder();
  private textDecoder = new TextDecoder();
  private brotli: typeof Brotli | undefined;

  constructor() {
  }

  async start() {
    this.brotli = await brotli;
    this._database = await createRxDatabase({
      name: 'eva_notebook',
      storage: getRxStorageDexie()
    });
    await this._database.addCollections({
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
            lastEditedBy: {
              type: 'string',
            },
            index: {
              type: 'number'
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
          required: ['id', 'type', 'data', 'lastEditedBy', 'createdBy'],
          crdt: {
            field: 'crdts'
          }
        }
      }
    });
    this._uuid = this.setupPeer();
    await this.registerPreviousVersion();
    try {
      // @ts-ignore
      await this.replicatePool(this._database.blocks);
    } catch (e){}
  }

  private async registerPreviousVersion() {
    if (url.has("c")) {
      const editor = await this.readBlocksFromURL();
      await this.removeAllBlocks();
      editor.blocks.map((block: any, index: number) => block.index = index);
      // @ts-ignore
      await this._database?.blocks.bulkInsert(editor.blocks);
    }
    window.addEventListener('keydown', async (event: KeyboardEvent )=>{
      if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        this.writeCollectionURL({
          version: '2.26.5',
          // @ts-ignore
          blocks: await this._database?.blocks.find().exec()
        });
      }
    });
  }

  async replicatePool(collection: any) {
    return await replicateP2P(
      {
        collection: collection,
        secret: "",
        topic: this._uuid as string,
        connectionHandlerCreator: getConnectionHandlerPeerJS(this._uuid),
        pull: {},
        push: {}
      }
    );
  }

  replicateWithURL(collection: {[name: string]: RxCollection<any, {}, {}, {}>}) {
    const self = this;
    return replicateRxCollection({
      collection,
      replicationIdentifier: 'query-parameter://notebook.sanchezcarlosjr.com',
      live: false,
      retryTime: 5 * 1000,
      waitForLeadership: false,
      autoStart: true,
      push: {
        async handler(docs) {
          self.writeCollectionURL(docs);
          return new Promise((resolve, reject) => resolve([]));
        },
        batchSize: 1,
        modifier: d => d
      },
      pull: {
        async handler(lastCheckpoint, batchSize) {
          let remoteDocuments = [];
          try {
            remoteDocuments = self.readBlocksFromURL();
            console.log(remoteDocuments);
          } catch (e) {}
          return {
            documents: remoteDocuments as {_deleted: boolean}[],
            checkpoint: remoteDocuments.length === 0 ? lastCheckpoint : {
              id: remoteDocuments[0].uuid,
              time: remoteDocuments[0].time
            }
          };
        },
        batchSize: 2,
        modifier: d => d
      },
    })
  }

  compress(input: string, options?: any) {
    // @ts-ignore
    return dataToBase64(this.brotli?.compress(this.textEncoder.encode(input), options));
  }

  decodeHtmlEntities(html: string) {
    this.txt.innerHTML = html;
    return this.txt.value;
  }

  upsert(data: any) {
    // @ts-ignore
    return this._database.blocks.insertCRDT({
      selector: {
        id: { $exists: false }
      },
      ifMatch: {
        $set: data
      },
      ifNotMatch: {
        $set: data
      }
    })
  }

  decompress(base64: string) {
    return this.textDecoder.decode(this.brotli?.decompress(base64ToData(base64)));
  }

  collection(name: string): Observable<BlockRow[]> {
    // @ts-ignore
    return this._database[name]?.find({
      sort: [{index: 'asc'}]
    }).$.pipe(
      filter(x => !!x)
    );
  }
  insert$() {
    // @ts-ignore
    return this._database?.blocks.insert$.pipe(
      map((x: any) => x.documentData),
      filter((documentData: any) => documentData.lastEditedBy != this._uuid)
    );
  }
  remove$() {
    // @ts-ignore
    return this._database?.blocks.remove$.pipe(
      map((x: any) => x.documentData),
      filter((documentData: any) => documentData.lastEditedBy != this._uuid)
    );
  }

  exportDatabase() {
    return this._database?.exportJSON();
  }

  importDatabase(json: RxDumpDatabaseAny<RxCollection>) {
    return this._database?.importJSON(json);
  }

  update$() {
    // @ts-ignore
    return this._database?.blocks.update$.pipe(
      map((x: any) => x.documentData),
      filter((documentData: any) => documentData.lastEditedBy != this._uuid)
    );
  }

  index(name: string) {
    // @ts-ignore
    return this._database[name]?.find().$.pipe(
        map((x: any) => x)
      );
  }

  loadChannel() {
    return new MessageChannel();
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
  readBlocksFromURL() {
    return JSON.parse(this.decodeHtmlEntities(this.decompress(url.read("c"))));
  }
  writeCollectionURL(collection: any, key: string = "c") {
    url.write(key, this.compress(JSON.stringify(collection)));
  }
  setupPeer() {
    return url.read("p") || url.write("p", crypto.randomUUID());
  }
  createNewDatabase() {
    return undefined;
  }
  async addBlock(block: BlockRow) {
    // @ts-ignore
    block.createdBy = this._uuid;
    block.lastEditedBy = this._uuid;
    // @ts-ignore
    await this._database?.blocks?.insertCRDT({
      ifMatch: {
        $set: block
      }
    });
  }
  async removeBlock(id: string) {
    // @ts-ignore
    const block = await this._database.blocks.findOne(id).exec();
    block.updateCRDT({
      ifMatch: {
        $set: {
          lastEditedBy: this._uuid
        }
      }
    })
    // @ts-ignore
    return await block.remove();
  }
  async changeBlock(blockRow: BlockRow) {
    // @ts-ignore
    const block = await this._database.blocks.findOne(blockRow.id).exec();
    if (!block) {
      return block;
    }
    if (_.isEqual(blockRow.data, block._data.data)) {
      return block;
    }
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
    return this._database.blocks.find().remove();
  }

}
