import EditorJS, {BlockAPI, OutputBlockData} from "@editorjs/editorjs";
import {
  firstValueFrom,
  Observable,
  Subscription
} from 'rxjs';
import {BlockDocument, DatabaseManager} from "./DatabaseManager";
import {SavedData} from "@editorjs/editorjs/types/data-formats/block-data";
import * as Rx from "rxjs";
import {TitleSubjectService} from "../../title-subject.service";
import * as url from "./url";
import {MqttService} from 'ngx-mqtt';
import {webSocket} from "rxjs/webSocket";

enum JobStatus {
  created = 0, running = 1
}

function downloadFile(blobParts?: any, options?: any) {
  let blob = new Blob(blobParts, options);
  downloadBlob(blob);
}

function downloadBlob(blob: Blob, options?: any) {
  let url = window.URL.createObjectURL(blob);
  let link = document.createElement("a");
  link.download = options.filename;
  link.href = url;
  link.click();
  window.URL.revokeObjectURL(url);
}


export class Shell {
  private jobs = new Map<string, { worker: Worker, code: string, status: number, data: {}, subscription: Subscription; }>();
  private peerAddBlock = false;
  private peerRemoveBlock = false;
  private peerChangeBlock = false;
  constructor(private editor: EditorJS, private environment: any, private databaseManager: DatabaseManager) {
    environment.webWorkers = this.jobs;
    environment.downloadBlob = downloadBlob;
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
      this.databaseManager.compress(event.detail.payload.input, event.detail.payload.options).subscribe(payload =>
        this.jobs.get(event.detail.payload.threadId)?.worker?.postMessage({
          event: 'compress',
          payload
        })
      )
    });
    environment.addEventListener('decompress', (event: CustomEvent) => {
      this.databaseManager.decompress(event.detail.payload.input).subscribe(payload =>
        this.jobs.get(event.detail.payload.threadId)?.worker?.postMessage({
          event: 'decompress', payload
        })
      )
    });
    environment.addEventListener('shell.SaveInUrl', (event: CustomEvent) => {
      this.databaseManager.saveInUrl();
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
    environment.addEventListener('shell.RequestCanvas', (event: CustomEvent) => {
      this.editor.blocks.getById(event.detail.payload.threadId)?.call('transferControlToOffscreen');
    });
    //@ts-ignore
    environment.addEventListener('shell.RequestCaptureStream', (event: CustomEvent) => {
      this.editor.blocks.getById(event.detail.payload.threadId)?.call('captureStream');
    });
    //@ts-ignore
    environment.addEventListener('shell.transferStreamToOffscreen', (event: CustomEvent) => {
      this.jobs.get(event.detail.payload.threadId)?.worker?.postMessage({
        event: 'transferStreamToOffscreen', payload: {
          message: event.detail.payload.message
        }
      }, [event.detail.payload.message]);
    });
    //@ts-ignore
    environment.addEventListener('table', (event: CustomEvent) => {
      this.editor.blocks.getById(event.detail.payload.threadId)?.call('createTable');
    });
    //@ts-ignore
    environment.addEventListener('tree', (event: CustomEvent) => {
      this.editor.blocks.getById(event.detail.payload.threadId)?.call('createTree');
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
    environment.addEventListener('bulk-editor-changes', async ({detail}: any) => {
      const operations: CustomEvent[] = detail.filter((operation: CustomEvent) =>
        this.editor.blocks.getById(operation.detail.target.id) || operation.type === 'block-removed');
      for (const operation of operations) {
        const savedData: SavedData = await operation.detail.target.save();
        const block = {
          id: savedData.id,
          type: savedData.tool,
          data: savedData.data,
          index: editor.blocks.getBlockIndex(savedData.id)
        };
        switch (operation.type) {
          case 'block-added': {
            if (this.peerAddBlock) {
              this.peerAddBlock = false;
              return;
            }
            await this.databaseManager.addBlock(block);
            break;
          }
          case 'block-removed': {
            if (this.peerRemoveBlock) {
              this.peerRemoveBlock = false;
              return;
            }
            await this.databaseManager.removeBlock(block.id);
            break;
          }
          case 'block-changed': {
            if (this.peerChangeBlock) {
              this.peerChangeBlock = false;
              return;
            }
            await this.databaseManager.changeBlock(block);
            break;
          }
          case 'block-moved': {
            if (this.peerChangeBlock) {
              this.peerChangeBlock = false;
              return;
            }
            const fromIndex = Math.min(operation.detail.fromIndex, operation.detail.toIndex);
            const toIndex = Math.max(operation.detail.fromIndex, operation.detail.toIndex);
            for(let i = fromIndex; i <= toIndex; i++) {
              await this.databaseManager.updateBlockIndexById(this.editor.blocks.getBlockByIndex(i)?.id ?? "", i);
            }
            break;
          }
        }
      }
    });
    environment.addEventListener('shell.FormMessageChannel', (event: CustomEvent) => {
      this.jobs.get(event.detail.payload.threadId)?.worker?.postMessage({
        event: 'form', payload: event.detail.payload.port
      }, [event.detail.payload.port]);
    });
    environment.addEventListener('shell.TableMessageChannel', (event: CustomEvent) => {
      this.jobs.get(event.detail.payload.threadId)?.worker?.postMessage({
        event: 'table', payload: event.detail.payload.port
      }, [event.detail.payload.port]);
    });
    environment.addEventListener('shell.TreeMessageChannel', (event: CustomEvent) => {
      this.jobs.get(event.detail.payload.threadId)?.worker?.postMessage({
        event: 'tree', payload: event.detail.payload.port
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
    environment.Rx = Rx;
    environment.Mqtt = MqttService;
    environment.webSocket = webSocket;
  }

  fork(code: string, threadId: string) {
    const worker = new Worker(new URL('./process.worker', import.meta.url), {type: 'module', name: threadId});
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
            code,
            href: location.href
          }
        });
      })
    };
  }

  async start(isMode2: boolean) {
    await this.renderFromDatabase(isMode2);
    return this;
  }

  history$(): Observable<any> {
    return this.databaseManager.history$;
  }

  registerHistoryChanges(titleService: TitleSubjectService) {
    titleService.get$().subscribe((title) =>
      this.databaseManager.updateHistory({title}).then()
    );
    return this;
  }

  private async renderFromDatabase(isMode2: boolean) {
    try {
      const blockCollection = await this.databaseManager.start();
      const documents = await firstValueFrom(blockCollection);
      let blocks: BlockDocument[] = await this.processDocuments(documents);
      if (blocks.length === 0 && !url.has("ps")) {
        blocks.push(this.databaseManager.generateDefaultBlock());
        this.databaseManager.upsert(blocks[0]);
      }
      await this.renderEditor(blocks, isMode2);
      await this.addDatabaseEventHandlers(isMode2);
    } catch (error) {
      console.error('Error in renderFromDatabase:', error);
    }
  }

  private async processDocuments(documents: any[]) {
    let blocks: BlockDocument[] = [];
    if (documents.length > 0) {
      for (const [index, block] of documents.entries()) {
        if (block && block?.index !== index) {
          await this.databaseManager.updateIndex(block, index);
        }
        if (block && block?.index >= 0) {
          blocks.push(block);
        }
        if (block && block?.index < 0) {
          await this.databaseManager.removeBlock(block.id);
        }
      }
    }
    return blocks;
  }

  private async renderEditor(blocks: BlockDocument[], isMode2: boolean) {
    if (url.has("ps") && blocks.length <= 1 && blocks[0]?.data?.text === "")
      return;
    await this.editor.render({ version: '2.27.0', blocks });
    const newBlocks: OutputBlockData[] = await this.databaseManager.registerUrlProviders();
    if (newBlocks.length > 0) {
      await this.editor.render({ version: '2.27.0', blocks: newBlocks });
      if (isMode2) {
        window.dispatchEvent(new CustomEvent('shell.RunAll'));
      } else {
        await this.databaseManager.removeAllBlocks();
        await this.databaseManager.bulkInsertBlocks(newBlocks);
      }
    } else if (isMode2) {
      window.dispatchEvent(new CustomEvent('shell.RunAll'));
    }
  }

  private async addDatabaseEventHandlers(isMode2: boolean) {
    if (location.hash) {
      document.getElementById(location.hash.substring(1))?.scrollIntoView({
        behavior: "smooth",
        block: "start",
        inline: "start"
      });
    }
    this.databaseManager.insert$()?.subscribe((block: any) => this.handleBlockInsert(block));
    this.databaseManager.remove$()?.subscribe((block: any) => this.handleBlockRemove(block));
    this.databaseManager.update$()?.subscribe((block: any) => this.handleBlockUpdate(block));
    this.databaseManager.replicateCollections().then();
    if (isMode2) return;
    window.addEventListener('keydown', (event: KeyboardEvent) => this.handleKeyPress(event));
  }

  private handleBlockInsert(block: any) {
    this.peerAddBlock = true;
    this.editor.blocks.insert(block.type, block.data, undefined, block.index, false, false, block.id);
  }

  private handleBlockRemove(block: any) {
    this.peerRemoveBlock = true;
    this.editor.blocks.delete(this.editor.blocks.getBlockIndex(block.id));
  }

  private handleBlockUpdate(block: any) {
    this.peerRemoveBlock = true;
    this.peerAddBlock = true;
    this.peerChangeBlock = true;
    const toId = this.editor.blocks.getBlockByIndex(block.index)?.id ?? "";
    if (block.id !== toId) {
      this.editor.blocks.move(block.index, this.editor.blocks.getBlockIndex(block.id));
    }
    this.editor.blocks.update(block.id, block.data);
  }

  private handleKeyPress(event: KeyboardEvent) {
    if (event.ctrlKey && event.key === 's') {
      event.preventDefault();
      this.databaseManager.saveInUrl();
    }
  }


}
