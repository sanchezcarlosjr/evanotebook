import {EditorView} from "codemirror"
import {javascript, esLint} from "@codemirror/lang-javascript"
import {EditorState} from "@codemirror/state"
// @ts-ignore
import EditorjsCodeflask from '@calumk/editorjs-codeflask';
import {espresso} from "thememirror";
import {linter, lintGutter} from "@codemirror/lint";
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
import {lintKeymap} from "@codemirror/lint";
// @ts-ignore
import * as eslint from "eslint-linter-browserify";

interface Block {
  data?: any;
  block?: {id: string};
  config?: any;
  readOnly?: boolean;
}

const config = {
  // eslint configuration
  parserOptions: {
    ecmaVersion: 2019,
    sourceType: "module",
  },
  env: {
    browser: true,
    node: false,
  },
  rules: {
    semi: ["error", "never"]
  },
};

export class CodeBlock {
  private editorView: EditorView | undefined;
  private cell: HTMLDivElement | undefined;
  private input: HTMLInputElement | null = null;
  private shellOptions: any[] = [
    {
      cmd: "Run (Ctrl+Alt+M)",
      listener: () => this.dispatchShellRun(),
      event: "shell.Run",
    },
    {
      cmd: "Stop (Ctrl+Alt+C)",
      listener: () => this.dispatchShellStop(),
      event: "shell.Stop",
    },
    {
      cmd: "Clear",
      listener: () => this.clear(),
      event: "clear",
    }
  ];


  constructor(private obj: Block) {
    this.obj.data.language = (obj.data.language === undefined) ? obj.config.language : obj.data.language;
    this.obj.data.code = (obj.data.code === undefined) ? "" : obj.data.code;
    this.obj.data.output = (obj.data.output === undefined) ? "" : obj.data.output;
  }

  static get toolbox() {
    return {
      icon: '<svg width="14" height="14" viewBox="0 -1 14 14" xmlns="http://www.w3.org/2000/svg" > <path d="M3.177 6.852c.205.253.347.572.427.954.078.372.117.844.117 1.417 0 .418.01.725.03.92.02.18.057.314.107.396.046.075.093.117.14.134.075.027.218.056.42.083a.855.855 0 0 1 .56.297c.145.167.215.38.215.636 0 .612-.432.934-1.216.934-.457 0-.87-.087-1.233-.262a1.995 1.995 0 0 1-.853-.751 2.09 2.09 0 0 1-.305-1.097c-.014-.648-.029-1.168-.043-1.56-.013-.383-.034-.631-.06-.733-.064-.263-.158-.455-.276-.578a2.163 2.163 0 0 0-.505-.376c-.238-.134-.41-.256-.519-.371C.058 6.76 0 6.567 0 6.315c0-.37.166-.657.493-.846.329-.186.56-.342.693-.466a.942.942 0 0 0 .26-.447c.056-.2.088-.42.097-.658.01-.25.024-.85.043-1.802.015-.629.239-1.14.672-1.522C2.691.19 3.268 0 3.977 0c.783 0 1.216.317 1.216.921 0 .264-.069.48-.211.643a.858.858 0 0 1-.563.29c-.249.03-.417.076-.498.126-.062.04-.112.134-.139.291-.031.187-.052.562-.061 1.119a8.828 8.828 0 0 1-.112 1.378 2.24 2.24 0 0 1-.404.963c-.159.212-.373.406-.64.583.25.163.454.342.612.538zm7.34 0c.157-.196.362-.375.612-.538a2.544 2.544 0 0 1-.641-.583 2.24 2.24 0 0 1-.404-.963 8.828 8.828 0 0 1-.112-1.378c-.009-.557-.03-.932-.061-1.119-.027-.157-.077-.251-.14-.29-.08-.051-.248-.096-.496-.127a.858.858 0 0 1-.564-.29C8.57 1.401 8.5 1.185 8.5.921 8.5.317 8.933 0 9.716 0c.71 0 1.286.19 1.72.574.432.382.656.893.671 1.522.02.952.033 1.553.043 1.802.009.238.041.458.097.658a.942.942 0 0 0 .26.447c.133.124.364.28.693.466a.926.926 0 0 1 .493.846c0 .252-.058.446-.183.58-.109.115-.281.237-.52.371-.21.118-.377.244-.504.376-.118.123-.212.315-.277.578-.025.102-.045.35-.06.733-.013.392-.027.912-.042 1.56a2.09 2.09 0 0 1-.305 1.097c-.2.323-.486.574-.853.75a2.811 2.811 0 0 1-1.233.263c-.784 0-1.216-.322-1.216-.934 0-.256.07-.47.214-.636a.855.855 0 0 1 .562-.297c.201-.027.344-.056.418-.083.048-.017.096-.06.14-.134a.996.996 0 0 0 .107-.396c.02-.195.031-.502.031-.92 0-.573.039-1.045.117-1.417.08-.382.222-.701.427-.954z" /> </svg>',
      title: 'Code'
    };
  }


  run() {
    this.cell?.children[0].classList.add('progress');
  }

  stop() {
    this.cell?.children[0].classList.remove('progress');
    for (let i=(this.cell?.children.length ?? 0)-1; i > 1; i--) {
      this.cell?.removeChild(this.cell?.children[i]);
    }
    this.input = null;
  }

  inputFile(options: any) {
    const input = document.createElement('input');
    input.classList.add('prompt', 'cdx-button');
    this.cell?.appendChild(input);
    input.multiple = true;
    input.type = "file";
    input.accept = options?.accept ?? "";
    input.addEventListener('change', (event: any) => {
      const fileList: FileList = event.target.files;
      window.dispatchEvent(new CustomEvent('shell.InputFile', {
        bubbles: true, detail: {
          payload: {
            // @ts-ignore
            response: fileList,
            threadId: this.obj.block?.id
          }
        }
      }));
      this.cell?.removeChild(input);
    }, false);
  }

  clear() {
    //@ts-ignore
    this.cell.children[1].innerHTML = "";
  }

  write(text: string) {
    //@ts-ignore
    this.cell.children[1].innerHTML += text;
  }

  println(text: any) {
    this.write(text + "\n");
  }

  removeNode(node?: HTMLElement) {
    if (node) {
      this.cell?.removeChild(node);
    }
  }

  prompt(payload: {placeholder?: string, type?: string}) {
    if (this.input) {
      return;
    }
    this.input = document.createElement('input');
    this.input.classList.add('prompt', 'cdx-input');
    this.input.placeholder = payload?.placeholder ?? "Write your message";
    this.input.type = payload?.type ?? "text";
    this.cell?.appendChild(this.input);
    this.input.addEventListener('keydown', (event) => {
      if (event.key === "Enter") {
        window.dispatchEvent(new CustomEvent('shell.Prompt', {
          bubbles: true, detail: {
            payload: {
              // @ts-ignore
              response: this.input.value,
              threadId: this.obj.block?.id
            }
          }
        }));
        // @ts-ignore
        this.input.value = "";
      }
    });
  }

  dispatchShellRun() {
    this.clear();
    this.dispatchShellStop();
    window.dispatchEvent(new CustomEvent('shell.Run', {
      bubbles: true, detail: {
        payload: {
          code: this.editorView?.state.doc.toString(),
          threadId: this.obj.block?.id
        }
      }
    }));
    this.run();
  }

  dispatchShellStop() {
    window.dispatchEvent(new CustomEvent('shell.Stop', {
      bubbles: true, detail: {
        payload: {
          threadId: this.obj.block?.id
        }
      }
    }));
  }

  renderSettings() {
    const wrapper = document.createElement('div');
    wrapper.classList.add('ce-popover__items');
    this.shellOptions.forEach( tune => {
      let button = document.createElement('div');
      button.classList.add('cdx-settings-button');
      button.innerHTML = tune.cmd;
      wrapper.appendChild(button);
      button.addEventListener('click', () => {
        tune.listener();
      });
    });
    return wrapper;
  }

  render() {
    this.cell = document.createElement('div');
    this.cell.classList.add('cell');
    const editor = document.createElement('section');
    editor.classList.add('editor');
    this.cell.appendChild(editor);
    const output = document.createElement('samp');
    output.classList.add('output');
    this.cell.appendChild(output);
    output.innerHTML = this.obj.data.output;

    this.editorView = new EditorView({
      parent: editor,
      state: EditorState.create({
        doc: this.obj.data.code,
        extensions: [
          EditorView.lineWrapping,
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightSpecialChars(),
          history(),
          foldGutter(),
          dropCursor(),
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
            ...lintKeymap
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
    this.editorView.dom.addEventListener('keydown', (event) => {
      if (event.key === "Enter" || event.ctrlKey && event.key === "v") {
        event.stopPropagation();
      }
    });
    this.editorView.dom.addEventListener('paste', (event) => {
      event.stopPropagation();
    });
    this.cell.addEventListener('keydown', (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "m" && keyboardEvent.ctrlKey && keyboardEvent.altKey) {
        keyboardEvent.preventDefault();
        this.dispatchShellRun();
      }
      if (keyboardEvent.key === "c" && keyboardEvent.ctrlKey && keyboardEvent.altKey) {
        keyboardEvent.preventDefault();
        this.dispatchShellStop();
      }
    }, false);
    return this.cell;
  }

  save(blockContent: any) {
    return {
      code: this.editorView?.state.doc.toString(),
      language: "javascript",
      output: this.cell?.children[1].innerHTML ?? ""
    }
  }
}
