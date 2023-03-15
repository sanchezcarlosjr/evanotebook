import {from, interval, MonoTypeOperatorFunction, Observable, Subscription, switchMap, tap} from 'rxjs';
import EditorJS, {OutputData} from "@editorjs/editorjs";
import Swal from 'sweetalert2'

export function save(query: string, expression: string) {
  const url = new URL(window.location.toString());
  url.searchParams.set(query, btoa(expression));
  window.history.pushState({}, "", url);
  return expression;
}

export function retrieve(query: string, defaultValue="") {
  return atob((new URL(document.location.toString())).searchParams.get(query) || defaultValue);
}

enum JobStatus {
  created = 0,
  running = 1
}

export class Shell {
  private Toast = Swal.mixin({
    toast: true,
    position: 'top-right',
    iconColor: 'white',
    customClass: {
      popup: 'colored-toast'
    },
    showConfirmButton: false,
    timer: 1200,
    timerProgressBar: true
  })
  private jobs = new Map<string, {worker: Worker, code: string, status: number, data: {}, subscription: Subscription; }>();
  constructor(private editor: EditorJS, private environment: any) {
    environment.addEventListener('terminal.clear', (event: CustomEvent) => {
      this.editor.blocks.getById(event.detail.payload.threadId)?.call('clear');
    });
    environment.addEventListener('shell.Fork', (event: CustomEvent) => {
      this.editor.blocks.insert('code', {code: event.detail.code, language: 'javascript'});
      this.editor.blocks.getBlockByIndex(this.editor.blocks.getCurrentBlockIndex())?.call('dispatchShellRun');
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
    //@ts-ignore
    environment.addEventListener('localecho.println', (event: CustomEvent) => {
      this.editor.blocks.getById(event.detail.payload.threadId)?.call('println', event.detail.payload.text);
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
    environment.addEventListener('speak', (event: CustomEvent) =>  window.speechSynthesis.speak(new SpeechSynthesisUtterance(event.detail.payload.toString())));
    environment.addEventListener('localecho.printWide', (event: CustomEvent) => {});
    environment.addEventListener('prompt', (event: CustomEvent) =>
      this.editor.blocks.getById(event.detail.payload.threadId)?.call('prompt', event.detail.payload.text)
    );
    environment.addEventListener('shell.Prompt', (event: CustomEvent) =>
      this.jobs.get(event.detail.payload.threadId)?.worker?.postMessage({event: 'prompt', payload: event.detail.payload.response})
    );
    environment.addEventListener('localStorage.getItem', (event: CustomEvent) => event.detail.port.postMessage({event: 'localStorage.getItem', payload: localStorage.getItem(event.detail.payload.key)}));
    environment.addEventListener('localStorage.setItem', (event: CustomEvent) => localStorage.setItem(event.detail.payload.key, event.detail.payload.value));
    environment.addEventListener('localStorage.removeItem', (event: CustomEvent) => localStorage.removeItem(event.detail.payload.key));
  }

  fork(userInput: string, threadId: string) {
    const worker = new Worker(new URL('./process.worker', import.meta.url), {type: 'module', name: threadId});
    return {
      worker,
      observable: new Observable((subscriber) => {
        worker.onmessage = (event) => {
          if (event.data.event === "shell.Stop") {
            subscriber.complete();
          }
          this.environment.dispatchEvent(new CustomEvent(event.data.event, {
            bubbles: true,
            detail: {
              port: worker,
              payload: event.data.payload
            }
          }));
        }
        worker.onerror = (event) => {
          console.error(event);
          this.environment.dispatchEvent(new CustomEvent('localecho.println', {bubbles: true, detail: {payload: {threadId, text: event.message}}}));
          this.environment.dispatchEvent(new CustomEvent('shell.Stop', {bubbles: true, detail: {payload: {threadId}}}));
          subscriber.complete();
        };
        worker.postMessage({event: 'exec', payload: userInput});
      })
    }
  }

  private async checkpoint() {
    const outputData = await this.editor.save();
    if (outputData.blocks.length === 0) {
      return;
    }
    this.Toast.fire({
      icon: 'info',
      title: 'Saving...'
    })
    save('c', JSON.stringify(outputData));
  }

  start() {
    this.environment.addEventListener('keydown', (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "s" && keyboardEvent.ctrlKey) {
        keyboardEvent.preventDefault();
        this.checkpoint();
      }
    });
    interval(1000*35).subscribe(() => this.checkpoint());
  }

}
