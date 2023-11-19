import {Language} from "./language";
import {Observable, shareReplay} from "rxjs";
import {Extension} from "@codemirror/state";
import {python} from "@codemirror/lang-python";

/**
 * @param {string} key
 * @param {any} value
 */
function jsonStringifyToObjectReplacer(key: string, value: any) {
  if (value && value.toObject) {
    return value.toObject();
  }
  if (value && value.toJs) {
    return value.toString();
  }
  if (value && value.toJSON) {
    return value.toJSON();
  }
  return value;
}


const pyodide = new Observable<{
  runPython: (code: string) => any
  setStdout(options: { batched: (input: string) => void }): void;
  runPythonAsync(s: string): Promise<any>;
  loadPackagesFromImports(code: string): Promise<void>;
}>(subscriber => {
  // @ts-ignore
  loadPyodide().then(async (instance) => {
    await instance.loadPackage("micropip");
    await instance.loadPackage('pyodide-http');
    await instance.runPythonAsync(`
from js import document

def create_root_element(self):
        return document.getElementById(BLOCK_ID).children[1]

def display(f):
        f.canvas.create_root_element = create_root_element.__get__(create_root_element, f.canvas.__class__)
        f.canvas.show()
        return "<div></div>"
import micropip

await micropip.install('requests')

import pyodide_http
pyodide_http.patch_all()
`)
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
${this.mostRecentCode}`;
      (async () => {
       await instance.loadPackagesFromImports(code);
       await instance.runPythonAsync(code)
         .then((output: any) => {
           if (output !== undefined) {
             this.write(JSON.stringify(output, jsonStringifyToObjectReplacer));
           }
           this.stop();
         }).catch((e: any) => {
         this.rewrite(`<pre class="py-error wrap">${e.message}</pre>`);
         this.stop();
       });
     })().then()
    });
    return true;
  }

  override getExtensions(): Extension[] {
    return [python()];
  }

}
