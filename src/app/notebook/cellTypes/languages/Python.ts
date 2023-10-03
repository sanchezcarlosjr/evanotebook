import {Language} from "./language";
import {Observable, shareReplay} from "rxjs";
import {Extension} from "@codemirror/state";
import {python} from "@codemirror/lang-python";


const pyodide = new Observable<{
  runPython: (code: string) => any
  setStdout(options: { batched: (input: string) => void }): void;
  runPythonAsync(s: string): Promise<any>;
}>(subscriber => {
  // @ts-ignore
  loadPyodide().then(async (instance) => {
    await instance.loadPackage("micropip");
    // @ts-ignore
    globalThis.pyodide = instance;
    subscriber.next(instance);
    subscriber.complete();
  });
}).pipe(shareReplay(1));

/*
   TODO: Remove Repeated code between Languages. We must move this to process worker.
   Update: Process worker is so slow. We must find a way to make it faster.
 */
export class Python extends Language {
  get name() {
    return 'python';
  }

  override dispatchShellRun() {
    super.dispatchShellRun();
    pyodide.subscribe(instance => {
      instance.setStdout({
        batched: (input: string) => {
          this.write(input + "\n");
        }
      });
      const code = `BLOCK_ID = "${this.editorJsTool?.block?.id}"
from js import document
def create_root_element(self):
    return document.getElementById(BLOCK_ID).children[1]
def display(f):
    f.canvas.create_root_element = create_root_element.__get__(create_root_element, f.canvas.__class__)
    f.canvas.show()
    return "<div></div>"
${this.mostRecentCode}`;
      instance.runPythonAsync(code).then((output: any) => {
        if (output) {
           this.write(output); 
        }
        this.stop();
      }).catch((e: any) => {
        this.rewrite(`<pre class="py-error wrap">${e.message}</pre>`);
        this.stop();
      });
    });
    return true;
  }

  override getExtensions(): Extension[] {
    return [python()];
  }

}
