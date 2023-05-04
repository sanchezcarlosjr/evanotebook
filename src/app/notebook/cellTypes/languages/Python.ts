import {Language} from "./language";
import {Observable, shareReplay, Subject} from "rxjs";
import {EditorView} from "codemirror";
import {EditorJsTool} from "../EditorJsTool";
import {EditorState} from "@codemirror/state";
import {
  crosshairCursor,
  dropCursor,
  highlightActiveLineGutter,
  highlightSpecialChars, keymap,
  lineNumbers,
  rectangularSelection
} from "@codemirror/view";
import {defaultKeymap, history, historyKeymap} from "@codemirror/commands";
import {bracketMatching, foldGutter, foldKeymap, indentOnInput} from "@codemirror/language";
import {autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap} from "@codemirror/autocomplete";
import {searchKeymap} from "@codemirror/search";
import {espresso} from "thememirror";
import {python} from "@codemirror/lang-python";
import {stringToHTML} from "../stringToHTML";
import {lintGutter} from "@codemirror/lint";

const pyodide = new Observable<{
  runPython: (code: string) => any
  setStdout(options: {batched: (input: string) => void}): void;
  runPythonAsync(s: string): Promise<any>;
}>(subscriber => {
  // @ts-ignore
  loadPyodide().then(async (instance) => {
    await instance.loadPackage("micropip");
    const micropip = instance.pyimport("micropip");
    await micropip.install("pandas");
    await micropip.install("numpy");
    subscriber.next(instance);
    subscriber.complete();
  });
}).pipe(shareReplay(1));

/*
   TODO: Remove Repeated code between Languages. We must move this to process worker.
   Update: Process worker is so slow. We must find a way to make it faster.
 */
export class Python implements Language {
  private doc$: Subject<string> = new Subject();
  private editorView?: EditorView;

  constructor(private code: string, private editorJsTool: EditorJsTool,private cell: HTMLElement) {
  }

  dispatchShellRun() {
    if (!this.editorJsTool.readOnly) {
      this.clear();
      this.dispatchShellStop();
      this.cell?.children[0].classList.add('progress');
    }
    pyodide.subscribe(instance => {
      instance.setStdout({
        batched: (input: string) => {
          this.write(input+"\n");
        }
      });
      instance.runPythonAsync(this.editorView?.state?.doc?.toString() || this.code).then((output: string) => {
        this.write(output);
        this.stop();
      }).catch((e: any) => {
        this.rewrite(`<pre class="py-error wrap">${e.message}</pre>`);
      });
    })
    return true;
  }

  write(input: string) {
    this.cell.children[1].appendChild(stringToHTML(input));
  }

  rewrite(input: string) {
    this.cell.children[1].appendChild(stringToHTML(input));
  }

  stop() {
    if (!this.editorJsTool.readOnly) {
      this.cell?.children[0].classList.remove('progress');
    }
  }

  dispatchShellStop() {
    window.dispatchEvent(new CustomEvent('shell.Stop', {
      bubbles: true, detail: {
        payload: {
          threadId: this.editorJsTool.block?.id
        }
      }
    }));
    return true;
  }

  clear() {
    //@ts-ignore
    this.cell.children[1].innerHTML = "";
  }

  destroyEditor(): void {
    this.editorView?.destroy();
  }

  docChanges$(): Observable<string> {
    return this.doc$;
  }

  get name() {
    return 'python';
  }

  loadEditor(): void {
    this.editorView = new EditorView({
      parent: this.cell.children[0],
      state: EditorState.create({
        doc: this.code,
        extensions: [
          EditorView.lineWrapping,
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightSpecialChars(),
          history(),
          foldGutter(),
          dropCursor(),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              this.doc$.next(update.state.doc.toString());
            }
          }),
          EditorState.allowMultipleSelections.of(true),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          autocompletion(),
          rectangularSelection(),
          crosshairCursor(),
          keymap.of([
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...searchKeymap,
            ...historyKeymap,
            ...foldKeymap,
            ...completionKeymap,
            { key: 'Ctrl-Enter', run: this.dispatchShellRun.bind(this), preventDefault: true },
            { key: 'Ctrl-Alt-m', run: this.dispatchShellRun.bind(this), preventDefault: true },
            { key: 'Ctrl-Alt-c', run: this.dispatchShellStop.bind(this), preventDefault: true },
            { key: 'Shift-Enter', run: this.dispatchShellRun.bind(this), preventDefault: true },
          ]),
          espresso,
          EditorView.theme({
            "&": {
              "font-size": "0.8em",
              border: "1px solid #dcdfe6",
              "border-radius": "5px"
            },
            "&.cm-focused": {
              outline: "none"
            }
          }),
          python(),
          lintGutter()
        ]
      })
    });
  }

}
