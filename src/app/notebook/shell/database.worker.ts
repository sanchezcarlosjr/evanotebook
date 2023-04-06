/// <reference lib="webworker" />
import {addRxPlugin, createRxDatabase, RxCollection} from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import {RxDatabase} from "rxdb/dist/types/types";
import { RxDBUpdatePlugin } from 'rxdb/plugins/update';
addRxPlugin(RxDBUpdatePlugin);

import { replicateRxCollection } from 'rxdb/plugins/replication';
import {
  lastOfArray
} from 'rxdb';
import {match} from "ts-pattern";

const ports: MessagePort[] = [];

console.log("INIT WORKER");

function generate_db_creation() {
  let database: RxDatabase | undefined;
  return async () => {
    if (database) {
      return database;
    }
    database = await createRxDatabase({
      name: 'EvaNotebook',
      storage: getRxStorageDexie()
    });
    await database.addCollections({
      editor: {
        schema: {
          title: 'editor',
          version: 0,
          primaryKey: 'time',
          type: 'object',
          properties: {
            time: {
              type: 'number',
              maxLength: 100 // <- the primary key must have set maxLength
            },
            blocks: {
              type: 'array'
            },
            version: {
              type: 'string'
            }
          },
          required: ['time', 'blocks', 'version'],
          indexes: ['time']
        }
      }
    });
    // @ts-ignore
    replicateWithURL(database.editor);
    return database;
  }
}

let db = generate_db_creation();


// @ts-ignore
globalThis.addEventListener('create_db', (event: CustomEvent) => {
  // @ts-ignore
  db = generate_db_creation();
});

// @ts-ignore
globalThis.addEventListener('collection', (event: CustomEvent) => {
  // @ts-ignore
  db().then(database => database.editor.findOne({
    sort: [{ time: 'desc' }],
    // @ts-ignore
  })).then((x) => {
    x?.$.subscribe(doc => {
      event.detail.port.postMessage({type: 'collection', payload: doc._data});
    });
  });
});

// @ts-ignore
globalThis.addEventListener('update', (event: CustomEvent) => {
  // @ts-ignore
  db().then(async (database) => ({collection: database.editor, query: await database.editor.findOne({
      sort: [{ time: 'desc' }],
      // @ts-ignore
    }).exec()})).then(x => {
    if (x.query === null) {
      return x.collection.insert(event.detail.payload);
    }
    x.query.update({
      $set: event.detail.payload
    });
  }).catch(console.log);
});

// @ts-ignore
globalThis.addEventListener('echo', (event: CustomEvent) =>
  event.detail.port.postMessage({type: 'echo', payload: event.detail.payload})
);

// @ts-ignore
globaThis.addEventListener('createNewDatabase', (event: CustomEvent) => {
  db().then();
});

// @ts-ignore
globalThis.addEventListener('destroy', (event: CustomEvent) =>
  self.close()
);


// @ts-ignore
onconnect = (e) => {
  const port = e.ports[0];
  ports.push(port);
  port.onmessage = (event: MessageEvent) => {
    console.log(event);
    port.postMessage({type: 'echo', payload: "1"});
  };
};
