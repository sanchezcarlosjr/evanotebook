/// <reference lib="webworker" />
import { createRxDatabase } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
( async () => {
  const database = await createRxDatabase({
    name: 'EvaNotebook',
    storage: getRxStorageDexie()
  });

  database.addCollections({
    humans: {
      schema: {
        title: 'x',
        version: 0,
        primaryKey: 'passportId',
        type: 'object',
        properties: {
          passportId: {
            type: 'string',
            maxLength: 100 // <- the primary key must have set maxLength
          },
          firstName: {
            type: 'string'
          },
          lastName: {
            type: 'string'
          },
          age: {
            description: 'age in years',
            type: 'integer',

            // number fields that are used in an index, must have set minimum, maximum and multipleOf
            minimum: 0,
            maximum: 150,
            multipleOf: 1
          }
        },
        required: ['firstName', 'lastName', 'passportId'],
        indexes: ['age']
      }
    },
  });
})();


// @ts-ignore
onconnect = (e) => {
  const port = e.ports[0];

  port.onmessage = (e: MessageEvent) => {
    const workerResult = `Result: ${e.data[0] * e.data[1]}`;
    port.postMessage(workerResult);
  };
  
};
