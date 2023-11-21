import {firstValueFrom, map, Observable, switchMap} from "rxjs";
import {RxDatabase} from "rxdb/dist/types/types";
import {OutputData} from "@editorjs/editorjs";
import {BlockAPI} from "@editorjs/editorjs/types/api/block";
import {BlockToolData, ToolConfig} from "@editorjs/editorjs/types/tools";
import {randomCouchString} from "rxdb";

interface Environment {
  db: Observable<RxDatabase>;
  topic?: string;
  peer?: string;
}

export class EditorJS {
  public static version: "2.26.5";
  public readonly blocks = new Blocks(this.environment);

  constructor(private environment: Environment) {
  }

  get isReady(): Promise<boolean> {
    return new Promise((resolve) => resolve(true));
  }

  save(): Promise<OutputData> {
    return firstValueFrom(this.environment.db.pipe(switchMap((db: RxDatabase) => db["blocks"].find({
        selector: {
          topic: {
            $eq: this.environment.topic ?? ""
          },
        },
        sort: [{index: 'asc'}]
      })
        .exec()),
      map(blocks => {
        return blocks.map(doc => {
          delete doc._data.crdts
          delete doc._data._deleted
          delete doc._data._deleted
          delete doc._data._attachments
          delete doc._data._rev
          delete doc._data._meta
          return doc._data
        })
      }),
      map(blocks => ({
        version: EditorJS.version, blocks
      }))));
  }
}

class Blocks {
  constructor(private environment: Environment) {
  }

  get get$() {
    return this.environment.db.pipe(switchMap((db: RxDatabase) => db["blocks"].find({
      selector: {
        topic: {
          $eq: this.environment.topic ?? ""
        }
      },
      sort: [{index: 'asc'}]
    }).$));
  }

  getById(id: string): Observable<BlockAPI | null> {
    return this.environment.db.pipe(switchMap((db: RxDatabase) => db["blocks"].findOne(id).$));
  }

  getByIndex(index: number): Observable<BlockAPI | null> {
    return this.environment.db.pipe(switchMap((db: RxDatabase) => db["blocks"].findOne({
      selector: {
        index: {
          $eq: index
        },
        topic: {
          $eq: this.environment.topic ?? ""
        }
      }
    }).$));
  }

  insert(type?: string, data?: BlockToolData, config?: ToolConfig, index?: number, needToFocus?: boolean, replace?: boolean, id?: string) {
    return this.environment.db.pipe(switchMap((db: RxDatabase) => db["blocks"].insertCRDT({
      ifMatch: {
        $set: {
          type,
          data,
          config,
          index,
          createdBy: (this.environment.peer ?? "") + "worker",
          updatedBy: (this.environment.peer ?? "") + "worker",
          id: id ?? randomCouchString(7),
          topic: this.environment.topic ?? ""
        }
      }
    })));
  };

  upsert(id?: string, data?: BlockToolData, type?: string, index?: number, config?: ToolConfig, needToFocus?: boolean, replace?: boolean) {
    return this.environment.db.pipe(switchMap((db: RxDatabase) => db["blocks"].insertCRDT({
      selector: {
        id: {$exists: true}
      },
      ifMatch: {
        $set: {
          id,
          data,
          updatedBy: (this.environment.peer ?? "") + "worker"
        }
      },
      ifNotMatch: {
        $set: {
          type,
          data,
          config,
          index,
          createdBy: (this.environment.topic ?? "") + "worker",
          updatedBy: (this.environment.peer ?? "") + "worker",
          id: id ?? randomCouchString(7),
          topic: this.environment.topic ?? ""
        }
      }
    })));
  }

  update(id: string, data: BlockToolData) {
    return this.environment.db.pipe(switchMap((db: RxDatabase) => db["blocks"].insertCRDT({
      selector: {
        id: {$exists: true}
      },
      ifMatch: {
        $set: {
          id,
          data,
          updatedBy: (this.environment.peer ?? "") + "worker"
        }
      }
    })));
  }

  delete(id: string) {
    return this.environment.db.pipe(
      switchMap((db: RxDatabase) => db["blocks"].findOne(id).exec()),
      switchMap(document => document?.updateCRDT({
        selector: {
          id: {$exists: true}
        },
        ifMatch: {
          $set: {
            id,
            updatedBy: (this.environment.peer ?? "") + "worker",
            _deleted: true
          }
        }
      }))
    );
  }
}
