import EditorJS from "@editorjs/editorjs";
import {interval, Observable, Subscription} from 'rxjs';
import * as BrotliWasmType from "../../assets/brotli_wasm/brotli_wasm";
import {retrieve, urlDatabase} from "./url-database";

// https://github.com/httptoolkit/brotli-wasm/blob/main/test/brotli.spec.ts
const dataToBase64 = (data: Uint8Array | number[]) => btoa(String.fromCharCode(...data));
const base64ToData = (base64: string) => new Uint8Array(
  [...atob(base64)].map(c => c.charCodeAt(0))
);

enum JobStatus {
  created = 0, running = 1
}

export class Shell {
  private jobs = new Map<string, { worker: Worker, code: string, status: number, data: {}, subscription: Subscription; }>();
  // https://stackoverflow.com/questions/7394748/whats-the-right-way-to-decode-a-string-that-has-special-html-entities-in-it?lq=1
  private txt = document.createElement("textarea");
  private textEncoder = new TextEncoder();
  private textDecoder = new TextDecoder();

  constructor(private editor: EditorJS, private environment: any, private brotli: typeof BrotliWasmType) {
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
      for(let i=0; i<this.editor.blocks.getBlocksCount(); i++) {
        const block = this.editor.blocks.getBlockByIndex(i);
        block?.call('dispatchShellRun');
      }
    });
    environment.addEventListener('shell.StopAll', () => {
      for(let i=0; i<this.editor.blocks.getBlocksCount(); i++) {
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
      },[event.detail.payload.canvas]);
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
    environment.addEventListener('compress', (event: CustomEvent) => {
      this.jobs.get(event.detail.payload.threadId)?.worker?.postMessage({
        event: 'compress', payload: this.compress(event.detail.payload.input, event.detail.payload.options)
      });
    });
    environment.addEventListener('decompress', (event: CustomEvent) => {
      this.jobs.get(event.detail.payload.threadId)?.worker?.postMessage({
        event: 'decompress', payload: this.decompress(event.detail.payload.input)
      });
    });
    environment.addEventListener('speak', (event: CustomEvent) => window.speechSynthesis.speak(new SpeechSynthesisUtterance(event.detail.payload.toString())));
    environment.addEventListener('localecho.printWide', (event: CustomEvent) => {});
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

  decodeHtmlEntities(html: string) {
    this.txt.innerHTML = html;
    return this.txt.value;
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
            code
          }
        });
      })
    }
  }

  start(isMode2: boolean) {
    const c = retrieve("c") as string;
    if (c) {
      this.editor.render(JSON.parse(this.decodeHtmlEntities(this.decompress(c)))).then(
        () => {
          if (isMode2) {
            window.dispatchEvent(new CustomEvent('shell.RunAll'));
          }
        }
      );
    }
    if (!isMode2) {
      this.environment.addEventListener('keydown', (keyboardEvent: KeyboardEvent) => {
        if (keyboardEvent.key === "s" && keyboardEvent.ctrlKey) {
          keyboardEvent.preventDefault();
          this.checkpoint();
        }
      });
      interval(1000 * 35).subscribe(() => this.checkpoint());
    }
  }

  private async checkpoint() {
    const outputData = await this.editor.save();
    if (outputData.blocks.length === 0) {
      return;
    }
    this.environment.dispatchEvent(new CustomEvent('saving', {bubbles: true}));
    urlDatabase('c', this.compress((JSON.stringify(outputData))));
  }

  private compress(input: string, options?: any) {
    return dataToBase64(this.brotli.compress(this.textEncoder.encode(input), options));
  }

  private decompress(base64: string) {
    return this.textDecoder.decode(this.brotli.decompress(base64ToData(base64)));
  }


}
