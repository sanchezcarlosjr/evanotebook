import {Language} from "./language";
import {Observable, shareReplay} from "rxjs";
import {Extension} from "@codemirror/state";
import {python} from "@codemirror/lang-python";
import {stringToHTML} from "../stringToHTML";

const pyodide = new Observable<{
  runPython: (code: string) => any
  setStdout(options: { batched: (input: string) => void }): void;
  runPythonAsync(s: string): Promise<any>;
}>(subscriber => {
  // @ts-ignore
  loadPyodide().then(async (instance) => {
    await instance.loadPackage("micropip");
    const micropip = instance.pyimport("micropip");
    await micropip.install("pandas");
    await micropip.install("numpy");
    await micropip.install("scikit-learn");
    await micropip.install("matplotlib");
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
      const code = `BLOCK_ID = "${this.editorJsTool?.block?.id}"\n${this.mostRecentCode}`;
      instance.runPythonAsync(code).then((output: string) => {
        this.write(output);
        this.stop();
      }).catch((e: any) => {
        this.rewrite(`<pre class="py-error wrap">${e.message}</pre>`);
      });
    });
    return true;
  }

  write(input: string) {
    this.cell.children[1].appendChild(stringToHTML(input));
  }

  rewrite(input: string) {
    this.cell.children[1].appendChild(stringToHTML(input));
  }

  override getExtensions(): Extension[] {
    return [python()];
  }

}
