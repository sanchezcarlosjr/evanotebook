import {Observable, Subject} from "rxjs";
import {EditorJsTool} from "../EditorJsTool";
import {EditorView} from "codemirror";
import {EditorState,Extension} from "@codemirror/state";
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
import {lintGutter} from "@codemirror/lint";
import {stringToHTML} from "../stringToHTML";

export abstract class Language {
  protected doc$: Subject<string> = new Subject();
  protected editorView?: EditorView;
  constructor(protected code: string, protected editorJsTool: EditorJsTool | undefined = undefined, protected cell: HTMLElement) {
  }
  dispatchShellRun(): boolean {
    if (!this.editorJsTool?.readOnly) {
      this.clear();
      this.dispatchShellStop();
      this.cell?.children[0].classList.add('progress');
    }
    return true;
  }
  stop() {
    if (!this.editorJsTool?.readOnly) {
      this.cell?.children[0].classList.remove('progress');
    }
  }
  write(input: string) {
    this.cell.children[1].appendChild(stringToHTML(input));
  }
  rewrite(input: string) {
    this.cell.children[1].appendChild(stringToHTML(input));
  }
  dispatchShellStop() {
    window.dispatchEvent(new CustomEvent('shell.Stop', {
      bubbles: true, detail: {
        payload: {
          threadId: this.editorJsTool?.block?.id
        }
      }
    }));
    return true;
  }
  get mostRecentCode() {
    return this.editorView?.state?.doc?.toString() || this.code
  }
  docChanges$(): Observable<string> {
    return this.doc$;
  }
  destroyEditor(): void {
    this.editorView?.destroy();
  }
  clear() {
    //@ts-ignore
    this.cell.children[1].innerHTML = "";
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
          lintGutter(),
          ...this.getExtensions()
        ]
      })
    });
  }

  abstract get name(): string;

  getExtensions(): Extension[] {
    return [];
  }
}
