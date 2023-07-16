import {concatMap, distinctUntilChanged, filter, firstValueFrom, from, Observable, skip, tap} from "rxjs";
import {RxDatabase} from "rxdb/dist/types/types";
import {RxDocument} from "rxdb";
import {randomCouchString} from "rxdb/plugins/utils";

type EventLoop = { arguments: any, id: string }[];

export class DocumentObserver {
  private tasks: Promise<any>[] = [];
  public readonly rpc = new Proxy({}, {
    get: (target, prop, receiver) =>
      async (...args: any) => this.call(prop as string, args)
  });

  constructor(
    private documentId: string,
    private db: Observable<RxDatabase>,
    private collection: string = 'view',
  ) {
  }

  wait() {
    return Promise.allSettled(this.tasks);
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

  // TODO: This should be a decorator. https://github.com/tc39/proposal-decorators
  // TODO: We must implement Leader election, coordination, synchronization, loader balancer and self-stabilization algorithm as well as E2E encryption.
  // Scheduler.
  async remoteProcedure(path: string = '', callback: (params: any[]) => any) {
    const document = DocumentObserver.setup(this.db, path, this.collection);
    await document.set("queue", []);
    return (document.get('queue') as Observable<EventLoop>).pipe(
      filter(x => x && x.length > 0),
      distinctUntilChanged((prev, curr) => prev.length === curr.length),
      concatMap(async queue => {
          const request = queue[queue.length-1];
          const response = await callback(request.arguments);
          await document.set(request.id, response);
        }
      )
    )
  }

  async call(method:string, args?: any) {
    if (args && typeof args === 'object' && 'toJs' in args && typeof args.toJs === 'function') {
      args = args?.toJs();
    }
    const document = DocumentObserver.setup(this.db, method, this.collection);
    const id = randomCouchString(10);
    await document.push('queue', {id, arguments: args});
    return firstValueFrom(document.get(id).pipe(skip(1)));
  }

  createProxy() {
    return new Proxy(this, {
      get(target: DocumentObserver, property: string | symbol, receiver: any): any {
        if (typeof property === 'string' && property[property.length - 1] === '$') {
          return target.get(property.slice(0, -1));
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

  inc(p: string | symbol, newValue: number = 1) {
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
