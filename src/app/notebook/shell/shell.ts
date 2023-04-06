import EditorJS, {BlockAPI, OutputData} from "@editorjs/editorjs";
import {
  debounceTime, filter,
  first, firstValueFrom,
  from,
  interval,
  map,
  Observable, skip,
  Subject,
  Subscription,
  switchMap, tap,
  throttleTime
} from 'rxjs';
import {DatabaseManager} from "./DatabaseManager";
import {SavedData} from "@editorjs/editorjs/types/data-formats/block-data";


enum JobStatus {
  created = 0, running = 1
}

function downloadFile(blobParts?: any, options?: any) {
  let blob = new Blob(blobParts, options);
  let url = window.URL.createObjectURL(blob);
  let link = document.createElement("a");
  link.download = options.filename;
  link.href = url;
  link.click();
  window.URL.revokeObjectURL(url);
}

export class Shell {
  private jobs = new Map<string, { worker: Worker, code: string, status: number, data: {}, subscription: Subscription; }>();
  private blockAddedMonitor = false;
  private blockRemoverMonitor = false;

  constructor(private editor: EditorJS, private environment: any, private databaseManager: DatabaseManager) {
    environment.addEventListener('terminal.clear', (event: CustomEvent) => {
      this.editor.blocks.getById(event.detail.payload.threadId)?.call('clear');
    });
    environment.addEventListener('shell.Fork', (event: CustomEvent) => {
      this.editor.blocks.insert('code', {code: event.detail.code, language: 'javascript'});
      this.editor.blocks.getBlockByIndex(this.editor.blocks.getCurrentBlockIndex())?.call('dispatchShellRun');
    });
    environment.addEventListener('form', (event: CustomEvent) => {
      this.editor.blocks.getById(event.detail.payload.threadId)?.call('form');
    });
    environment.addEventListener('compress', (event: CustomEvent) => {
      this.jobs.get(event.detail.payload.threadId)?.worker?.postMessage({
        event: 'compress',
        payload: this.databaseManager.compress(event.detail.payload.input, event.detail.payload.options)
      });
    });
    environment.addEventListener('decompress', (event: CustomEvent) => {
      this.jobs.get(event.detail.payload.threadId)?.worker?.postMessage({
        event: 'decompress', payload: this.databaseManager.decompress(event.detail.payload.input)
      });
    });
    environment.addEventListener('shell.CreateNewNotebook', (event: CustomEvent) => {
      this.editor.clear();
      window.dispatchEvent(new CustomEvent('shell.StopAll'));
      this.databaseManager.removeAllBlocks().then();
    });
    environment.addEventListener('shell.ExportNotebook', (event: CustomEvent) => {
      this.databaseManager.exportDatabase()?.then((data) => {
          downloadFile([JSON.stringify(data)], {type: 'application/json', filename: 'database.json'});
          event.detail?.port?.postMessage({
            event: event.detail?.payload?.event, payload: data
          });
        }
      );
    });
    environment.addEventListener('shell.ImportNotebook', async (event: CustomEvent) => {
      await this.databaseManager.importDatabase(JSON.parse(await event.detail.file.text()));
    });
    environment.addEventListener('shell.DownloadFile', (event: CustomEvent) => {
      downloadFile(event.detail.payload.blobParts, event.detail.payload.options);
    });
    environment.addEventListener('shell.Run', (event: CustomEvent) => {
      const {worker, observable} = this.fork(event.detail.payload.code, event.detail.payload.threadId);
      this.jobs.set(event.detail.payload.threadId, {
        worker,
        status: JobStatus.running,
        code: event.detail.payload.code,
        data: {},
        subscription: observable.subscribe()
      });
    });
    environment.addEventListener('shell.RunAll', () => {
      for (let i = 0; i < this.editor.blocks.getBlocksCount(); i++) {
        const block = this.editor.blocks.getBlockByIndex(i);
        block?.call('dispatchShellRun');
      }
    });
    environment.addEventListener('shell.StopAll', () => {
      for (let i = 0; i < this.editor.blocks.getBlocksCount(); i++) {
        const block = this.editor.blocks.getBlockByIndex(i);
        block?.call('dispatchShellStop');
      }
    });
    //@ts-ignore
    environment.addEventListener('localecho.println', (event: CustomEvent) => {
      this.editor.blocks.getById(event.detail.payload.threadId)?.call('println', event.detail.payload.text);
    });
    //@ts-ignore
    environment.addEventListener('plot', (event: CustomEvent) => {
      this.editor.blocks.getById(event.detail.payload.threadId)?.call('transferControlToOffscreen');
    });
    environment.addEventListener('shell.transferControlToOffscreen', (event: CustomEvent) => {
      this.jobs.get(event.detail.payload.threadId)?.worker?.postMessage({
        event: 'transferControlToOffscreen', payload: {
          canvas: event.detail.payload.canvas,
          width: event.detail.payload.width,
          height: event.detail.payload.height,
        }
      }, [event.detail.payload.canvas]);
    });
    environment.addEventListener('shell.Stop', (event: CustomEvent) => {
      this.jobs.get(event.detail.payload.threadId)?.worker.terminate();
      this.jobs.get(event.detail.payload.threadId)?.subscription.unsubscribe();
      this.jobs.delete(event.detail.payload.threadId);
      this.editor.blocks.getById(event.detail.payload.threadId)?.call('stop');
    });
    environment.addEventListener('terminal.write', (event: CustomEvent) => {
      this.editor.blocks.getById(event.detail.payload.threadId)?.call('write', event.detail.payload.text);
    });
    environment.addEventListener('terminal.rewrite', (event: CustomEvent) => {
      this.editor.blocks.getById(event.detail.payload.threadId)?.call('rewrite', event.detail.payload.text);
    });
    environment.addEventListener('speak', (event: CustomEvent) => window.speechSynthesis.speak(new SpeechSynthesisUtterance(event.detail.payload.toString())));
    environment.addEventListener('localecho.printWide', (event: CustomEvent) => {
    });
    environment.addEventListener('prompt', (event: CustomEvent) =>
      this.editor.blocks.getById(event.detail.payload.threadId)?.call('prompt', event.detail.payload.options));
    environment.addEventListener('file', (event: CustomEvent) => this.editor.blocks.getById(event.detail.payload.threadId)?.call('inputFile', event.detail.payload));
    environment.addEventListener('shell.error', (event: CustomEvent) => {
      this.environment.dispatchEvent(new CustomEvent('localecho.println', {
        bubbles: true, detail: {payload: event.detail.payload}
      }));
      this.environment.dispatchEvent(new CustomEvent('shell.Stop', {
        bubbles: true, detail: {
          payload: {threadId: event.detail.payload.threadId}
        }
      }));
    });
    environment.addEventListener('block-added', async (event: CustomEvent) => {
      const savedData: SavedData = await event.detail.target.save();
      // Peer can generate cycles because of the way it handles block-added events.
      if (this.blockAddedMonitor) {
        this.blockAddedMonitor = false;
        return;
      }
      await this.databaseManager.addBlock({
        id: savedData.id,
        type: savedData.tool,
        data: savedData.data,
        index: event.detail.index,
      });
    });
    environment.addEventListener('block-removed', async (event: CustomEvent) => {
      if (this.blockRemoverMonitor) {
        this.blockRemoverMonitor = false;
        return;
      }
      await this.databaseManager.removeBlock(event.detail.target.id);
    });
    const blockChanges$ = new Subject<BlockAPI>();
    environment.addEventListener('block-changed', async (event: CustomEvent) => {
      blockChanges$.next(event.detail);
    });
    const readDetailFromBlockChanged = async (detail: any)  => ({index: detail.index, savedData: await detail.target.save()});
    blockChanges$.pipe(
      skip(1),
      throttleTime(750),
      switchMap(detail => from(readDetailFromBlockChanged(detail))),
      filter(x => !!x),
    ).subscribe((next: {index: number, savedData: SavedData}) => {
      this.databaseManager.changeBlock({
        id: next.savedData.id,
        type: next.savedData.tool,
        data: next.savedData.data,
        index: next.index,
      });
    });
    environment.addEventListener('shell.FormMessageChannel', (event: CustomEvent) => {
      this.jobs.get(event.detail.payload.threadId)?.worker?.postMessage({
        event: 'form', payload: event.detail.payload.port
      }, [event.detail.payload.port]);
    });
    environment.addEventListener('shell.InputFile', (event: CustomEvent) => this.jobs.get(event.detail.payload.threadId)?.worker?.postMessage({
      event: 'shell.InputFile', payload: event.detail.payload.response
    }));
    environment.addEventListener('shell.Prompt', (event: CustomEvent) => this.jobs.get(event.detail.payload.threadId)?.worker?.postMessage({
      event: 'prompt', payload: event.detail.payload.response
    }));
    environment.addEventListener('localStorage.getItem', (event: CustomEvent) => event.detail.port.postMessage({
      event: 'localStorage.getItem', payload: localStorage.getItem(event.detail.payload.key)
    }));
    environment.addEventListener('localStorage.setItem', (event: CustomEvent) => localStorage.setItem(event.detail.payload.key, event.detail.payload.value));
    environment.addEventListener('localStorage.removeItem', (event: CustomEvent) => localStorage.removeItem(event.detail.payload.key));
  }

  fork(code: string, threadId: string) {
    const worker = new Worker(new URL('./process.worker', import.meta.url), {type: 'module', name: threadId});
    const channel = this.databaseManager.loadChannel();
    return {
      worker, observable: new Observable((subscriber) => {
        worker.onmessage = (event) => {
          if (event.data.event === "shell.Stop" || event.data.event === "shell.error") {
            subscriber.complete();
          }
          this.environment.dispatchEvent(new CustomEvent(event.data.event, {
            bubbles: true, detail: {
              port: worker, payload: event.data.payload
            }
          }));
        }
        worker.onerror = (event) => {
          this.environment.dispatchEvent(new CustomEvent('localecho.println', {
            bubbles: true, detail: {payload: {threadId, text: event.message}}
          }));
          this.environment.dispatchEvent(new CustomEvent('shell.Stop', {bubbles: true, detail: {payload: {threadId}}}));
          subscriber.complete();
        };
        worker.postMessage({
          event: 'exec', payload: {
            code, database: channel.port1
          }
        }, [channel.port1]);
      })
    }
  }

  start(isMode2: boolean) {
    if (!isMode2) {
      this.renderFromDatabase(isMode2);
    }
    return this;
  }

  private renderFromDatabase(isMode2: boolean) {
    this.databaseManager.start().then(() => {
      this.databaseManager.collection('blocks').pipe(
        first(),
        // @ts-ignore
        map(x => x.map(block => block._data)),
      ).subscribe((blocks) => {
        if (blocks.length === 0) {
          // @ts-ignore
          this.editor.blocks.getBlockByIndex(0)?.save().then((savedData: SavedData) => {
            this.databaseManager.addBlock({
              id: savedData.id,
              type: savedData.tool,
              data: savedData.data,
              index: 0,
            })
          });
        } else {
          this.editor.render({
            version: '2.26.5',
            blocks
          });
        }
        this.databaseManager.insert$().subscribe((block: any) => {
          this.blockAddedMonitor = true;
          this.editor.blocks.insert(block.type, block.data,  undefined, block.index, false, false, block.id);
        });
        this.databaseManager.remove$().subscribe((block: any) => {
          this.blockRemoverMonitor = true;
          this.editor.blocks.delete(this.editor.blocks.getBlockIndex(block.id));
        });
        this.databaseManager.update$().subscribe((block: any) => {
          this.blockRemoverMonitor = true;
          this.blockAddedMonitor = true;
          this.editor.blocks.update(block.id, block.data);
        });
      });
    });
  }

}
