import {concatMap, filter, firstValueFrom, Observable, tap} from "rxjs";
import {RxDatabase} from "rxdb/dist/types/types";
import {RxDocument} from "rxdb";

export class DocumentObserver {
  private tasks: Promise<any>[] = [];

  constructor(
    private documentId: string,
    private db: Observable<RxDatabase>,
    private collection: string = 'view',
  ) {
  }

  wait() {
    return new Promise<boolean>(
      resolve => queueMicrotask(async () => {
        await Promise.allSettled(this.tasks);
        resolve(true);
      })
    );
  }

  static setup(db: Observable<RxDatabase>, documentId: string = 'environment', collection: string = 'view') {
    return new DocumentObserver(documentId, db, collection).createProxy();
  }

  init() {
    return firstValueFrom(
      this.db.pipe(
        concatMap((d: RxDatabase) => d[this.collection].findOne(this.documentId).exec()),
        tap((d: RxDocument) => {
          if (d && d._data) {
            Object.assign(this, d._data);
          }
        }))
    );
  }

  get(path: string = '') {
    return this.db.pipe(
      concatMap((d: RxDatabase) => d[this.collection].findOne(this.documentId).exec()),
      filter(x => !!x),
      concatMap((d: RxDocument) => d.get$('_data' + `${path ? '.' : ''}${path}`)),
    );
  }

  createProxy() {
    return new Proxy(this, {
      get(target: DocumentObserver, p: string | symbol, receiver: any): any {
        if (typeof p === 'string' && p[p.length - 1] === '$') {
          return target.get(p.slice(0, -1));
        }
        // @ts-ignore
        return Reflect.get(...arguments);
      },
      set(target: DocumentObserver, path: string | symbol, value: any, receiver: any): any {
        target.tasks.push(target.set(path, value));
        // @ts-ignore
        return this;
      }
    });
  }

  // Consult https://github.com/lgandecki/modifyjs
  async set(p: string | symbol, newValue: any, operation: string = '$set') {
    const result = await firstValueFrom(this.db.pipe(concatMap(d => d[this.collection].insertCRDT({
      selector: {
        id: {$exists: true}
      },
      ifMatch: {
        [operation]: {
          [p]: newValue
        }
      },
      ifNotMatch: {
        $set: {
          id: this.documentId,
          [p]: newValue
        }
      }
    }))));
    // @ts-ignore
    this[p] = result._data[p];
    // @ts-ignore
    return result._data[p];
  }

  inc(p: string | symbol, newValue: any) {
    return this.set(p, newValue, '$inc');
  }

  min(p: string | symbol, newValue: any) {
    return this.set(p, newValue, '$min');
  }

  max(p: string | symbol, newValue: any) {
    return this.set(p, newValue, '$max');
  }

  unset(p: string | symbol, newValue: any) {
    return this.set(p, newValue, '$unset');
  }

  push(p: string | symbol, newValue: any) {
    return this.set(p, newValue, '$push');
  }

  pushAll(p: string | symbol, newValue: any) {
    return this.set(p, newValue, '$pushAll');
  }

  addToSet(p: string | symbol, newValue: any) {
    return this.set(p, newValue, '$addToSet');
  }

  pullAll(p: string | symbol, newValue: any) {
    return this.set(p, newValue, '$pullAll');
  }

  rename(p: string | symbol, newValue: any) {
    return this.set(p, newValue, '$rename');
  }

}
