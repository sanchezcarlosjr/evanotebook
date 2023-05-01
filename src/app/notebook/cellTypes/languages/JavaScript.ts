import {Language} from "./language";
import {Observable, Subject} from "rxjs";
import {EditorView} from "codemirror"
import {esLint, javascript} from "@codemirror/lang-javascript"
import {EditorState} from "@codemirror/state"
import {espresso} from "thememirror";
import {linter, lintGutter, lintKeymap} from "@codemirror/lint";
import {
  crosshairCursor,
  dropCursor,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection
} from "@codemirror/view";
import {defaultKeymap, history, historyKeymap} from "@codemirror/commands";
import {bracketMatching, foldGutter, foldKeymap, indentOnInput} from "@codemirror/language";
import {autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap} from "@codemirror/autocomplete";
import {searchKeymap} from "@codemirror/search";
// @ts-ignore
import * as eslint from "eslint-linter-browserify";
import {EditorJsTool} from "../EditorJsTool";

// eslint configuration
const config = {
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
  env: {
    browser: true,
    node: false,
  },
  rules: {
    semi: ["warning", "always"]
  },
};

export class JavaScript implements Language {
  private doc$: Subject<string> = new Subject();
  private output$: Subject<void> = new Subject();
  private editorView?: EditorView;

  constructor(private code: string, private editorJsTool: EditorJsTool,private cell: HTMLElement) {
  }

  dispatchShellRun() {
    if (!this.editorJsTool.readOnly) {
      this.clear();
      this.dispatchShellStop();
      this.cell?.children[0].classList.add('progress');
    }
    window.dispatchEvent(new CustomEvent('shell.Run', {
      bubbles: true, detail: {
        payload: {
          code: this.editorView?.state?.doc?.toString() || this.code,
          threadId: this.editorJsTool.block?.id
        }
      }
    }));
    return true;
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

  outputChanges$(): Observable<void> {
    return this.output$;
  }

  get name() {
    return 'javascript';
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
            ...lintKeymap,
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
          javascript(),
          lintGutter(),
          linter(esLint(new eslint.Linter(), config))
        ]
      })
    });
  }

}
