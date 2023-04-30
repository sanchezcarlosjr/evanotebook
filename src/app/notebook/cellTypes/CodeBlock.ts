import {EditorView} from "codemirror"
import {esLint, javascript} from "@codemirror/lang-javascript"
import {EditorState} from "@codemirror/state"
// @ts-ignore
import EditorjsCodeflask from '@calumk/editorjs-codeflask';
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
import {EditorJsTool} from "./EditorJsTool";
import {InteractiveBlock} from "./InteractiveBlock";
import {environment} from "../../../environments/environment";
import {randomCouchString} from "rxdb/plugins/utils";

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

function loadPyscript() {
  if (document.getElementById('pyscript-css')) {
    return;
  }
  const link = document.createElement('link');
  link.id = "pyscript-css";
  link.rel = 'stylesheet';
  link.href = '/assets/pyscript/pyscript.css';
  document.head.appendChild(link);
  const script = document.createElement('script');
  script.src = '/assets/pyscript/pyscript.js';
  script.defer = true;
  document.body.appendChild(script);
  const element = document.createElement('py-config');
  element.innerHTML = `
    packages = ["matplotlib", "pandas"]
    terminal = false
    [splashscreen]
    enabled = false
  `;
  document.body.appendChild(element);
}

/**
 * From https://gomakethings.com/converting-a-string-into-markup-with-vanilla-js/
 * Convert a template string into HTML DOM nodes
 * @param  {String} str The template string
 * @return {Node}       The template HTML
 */
function stringToHTML(str: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(str, 'text/html');
  return doc.body.firstChild;
}

export class CodeBlock extends InteractiveBlock {
  private editorView: EditorView | undefined;
  private cell: HTMLDivElement | undefined;
  private input: HTMLInputElement | null = null;
  private language: string;
  private readonly outputCell: string;
  private code: string;

  constructor(private obj: EditorJsTool) {
    super(obj);
    this.language = (obj.data.language === undefined) ? obj.config.language : obj.data.language;
    this.code = obj.data.code ?? "";
    this.outputCell = obj.data.output ?? "";
  }

  static get toolbox() {
    return {
      icon: '<svg width="14" height="14" viewBox="0 -1 14 14" xmlns="http://www.w3.org/2000/svg" > <path d="M3.177 6.852c.205.253.347.572.427.954.078.372.117.844.117 1.417 0 .418.01.725.03.92.02.18.057.314.107.396.046.075.093.117.14.134.075.027.218.056.42.083a.855.855 0 0 1 .56.297c.145.167.215.38.215.636 0 .612-.432.934-1.216.934-.457 0-.87-.087-1.233-.262a1.995 1.995 0 0 1-.853-.751 2.09 2.09 0 0 1-.305-1.097c-.014-.648-.029-1.168-.043-1.56-.013-.383-.034-.631-.06-.733-.064-.263-.158-.455-.276-.578a2.163 2.163 0 0 0-.505-.376c-.238-.134-.41-.256-.519-.371C.058 6.76 0 6.567 0 6.315c0-.37.166-.657.493-.846.329-.186.56-.342.693-.466a.942.942 0 0 0 .26-.447c.056-.2.088-.42.097-.658.01-.25.024-.85.043-1.802.015-.629.239-1.14.672-1.522C2.691.19 3.268 0 3.977 0c.783 0 1.216.317 1.216.921 0 .264-.069.48-.211.643a.858.858 0 0 1-.563.29c-.249.03-.417.076-.498.126-.062.04-.112.134-.139.291-.031.187-.052.562-.061 1.119a8.828 8.828 0 0 1-.112 1.378 2.24 2.24 0 0 1-.404.963c-.159.212-.373.406-.64.583.25.163.454.342.612.538zm7.34 0c.157-.196.362-.375.612-.538a2.544 2.544 0 0 1-.641-.583 2.24 2.24 0 0 1-.404-.963 8.828 8.828 0 0 1-.112-1.378c-.009-.557-.03-.932-.061-1.119-.027-.157-.077-.251-.14-.29-.08-.051-.248-.096-.496-.127a.858.858 0 0 1-.564-.29C8.57 1.401 8.5 1.185 8.5.921 8.5.317 8.933 0 9.716 0c.71 0 1.286.19 1.72.574.432.382.656.893.671 1.522.02.952.033 1.553.043 1.802.009.238.041.458.097.658a.942.942 0 0 0 .26.447c.133.124.364.28.693.466a.926.926 0 0 1 .493.846c0 .252-.058.446-.183.58-.109.115-.281.237-.52.371-.21.118-.377.244-.504.376-.118.123-.212.315-.277.578-.025.102-.045.35-.06.733-.013.392-.027.912-.042 1.56a2.09 2.09 0 0 1-.305 1.097c-.2.323-.486.574-.853.75a2.811 2.811 0 0 1-1.233.263c-.784 0-1.216-.322-1.216-.934 0-.256.07-.47.214-.636a.855.855 0 0 1 .562-.297c.201-.027.344-.056.418-.083.048-.017.096-.06.14-.134a.996.996 0 0 0 .107-.396c.02-.195.031-.502.031-.92 0-.573.039-1.045.117-1.417.08-.382.222-.701.427-.954z" /> </svg>',
      title: 'Code'
    };
  }

  static get sanitize(){
    return {
      language: false,
      code: true,
      output: true
    }
  }

  static get isReadOnlySupported(): boolean {
    return true
  }

  run() {
    if (!this.obj.readOnly) {
      this.cell?.children[0].classList.add('progress');
    }
  }

  stop() {
    if (!this.obj.readOnly) {
      this.cell?.children[0].classList.remove('progress');
    }
    this.input = null;
  }

  inputFile(options: any) {
    const input = document.createElement('input');
    input.classList.add('prompt', 'cdx-button');
    this.cell?.children[1].appendChild(input);
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
    }, false);
  }

  override clear() {
    //@ts-ignore
    this.cell.children[1].innerHTML = "";
  }

  write(text: string) {
    //@ts-ignore
    this.cell.children[1].appendChild(stringToHTML(text));
  }

  rewrite(text: string) {
    //@ts-ignore
    this.cell.children[1].innerHTML = text;
  }

  println(text: any) {
    this.write(text + "\n");
  }

  transferControlToOffscreen() {
    const canvas = document.createElement("canvas");
    this.cell?.children[1].classList.add('center');
    this.cell?.children[1].appendChild(canvas);
    const offscreenCanvas = canvas.transferControlToOffscreen();
    window.dispatchEvent(new CustomEvent('shell.transferControlToOffscreen', {
      bubbles: true, detail: {
        payload: {
          canvas: offscreenCanvas,
          width: this.cell?.clientWidth,
          height: 400,
          threadId: this.obj.block?.id
        }
      }
    }));
  }

  // TODO: We must have to remove duplicate code. This is a temporary solution.
  form() {
    const frameElement = document.createElement("nk-form");
    frameElement.classList.add('w100');
    const channel = new MessageChannel();
    window.dispatchEvent(new CustomEvent('shell.FormMessageChannel', {
      bubbles: true, detail: {
        payload: {
          port: channel.port2,
          threadId: this.obj.block?.id
        }
      }
    }));
    // @ts-ignore
    frameElement.port  = channel.port1;
    this.cell?.children[1].appendChild(frameElement);
  }

  createTable() {
    const frameElement = document.createElement("nk-table");
    frameElement.classList.add('w100');
    const channel = new MessageChannel();
    window.dispatchEvent(new CustomEvent('shell.TableMessageChannel', {
      bubbles: true, detail: {
        payload: {
          port: channel.port2,
          threadId: this.obj.block?.id
        }
      }
    }));
    // @ts-ignore
    frameElement.port  = channel.port1;
    this.cell?.children[1].appendChild(frameElement);
  }

  captureStream(constraints?: MediaStreamConstraints | undefined) {
    navigator.mediaDevices.getUserMedia({video: true, audio: false})
      .then(stream => {
        const videoTrack = stream.getVideoTracks()[0];
        // @ts-ignore https://developer.mozilla.org/en-US/docs/Web/API/ImageCapture
        const imageCapture = new ImageCapture(videoTrack);
        const feedSubscribers = () => {
          imageCapture.grabFrame()
            .then((imageBitmap: ImageBitmap) => {
              window.dispatchEvent(new CustomEvent('shell.transferStreamToOffscreen', {
                bubbles: true, detail: {
                  payload: {
                    message: imageBitmap,
                    threadId: this.obj.block?.id
                  }
                }
              }));
              requestAnimationFrame(feedSubscribers);
            });
        }
        feedSubscribers();
      })
      .catch(error => {
        console.warn(error);
        window.dispatchEvent(new CustomEvent('openSnackBar', {detail: {
           payload: {
             message: 'Error accessing camera.',
             action: 'Close'
           }
        }}));
      });
  }

  createTree() {
    const frameElement = document.createElement("nk-tree");
    frameElement.classList.add('w100');
    const channel = new MessageChannel();
    window.dispatchEvent(new CustomEvent('shell.TreeMessageChannel', {
      bubbles: true, detail: {
        payload: {
          port: channel.port2,
          threadId: this.obj.block?.id
        }
      }
    }));
    // @ts-ignore
    frameElement.port  = channel.port1;
    this.cell?.children[1].appendChild(frameElement);
  }

  prompt(payload: { placeholder?: string, type?: string }) {
    if (this.input) {
      return;
    }
    this.input = document.createElement('input');
    this.input.classList.add('prompt', 'cdx-input');
    this.input.placeholder = payload?.placeholder ?? "Write your message";
    this.input.type = payload?.type ?? "text";
    this.cell?.children[1].appendChild(this.input);
    this.input.addEventListener('keydown', (event) => {
      if (event.key === "Enter") {
        event.stopPropagation();
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

  override dispatchShellRun() {
    if (this.language !== "javascript") {
      return false;
    }
    if (!this.obj.readOnly) {
      this.clear();
      this.dispatchShellStop();
    }
    window.dispatchEvent(new CustomEvent('shell.Run', {
      bubbles: true, detail: {
        payload: {
          // @ts-ignore
          code: this.editorView?.state?.doc?.toString() || this.code,
          threadId: this.obj.block?.id
        }
      }
    }));
    this.run();
    return true;
  }

  override dispatchShellStop() {
    if (this.language !== "javascript") {
      return false;
    }
    window.dispatchEvent(new CustomEvent('shell.Stop', {
      bubbles: true, detail: {
        payload: {
          threadId: this.obj.block?.id
        }
      }
    }));
    return true;
  }

  override renderSettings() {
    const wrapper = super.renderSettings();
    let languagesSelect = document.createElement("select");
    languagesSelect.classList.add("small");
    for (const language of ["javascript", "python"]) {
      const option = document.createElement("option");
      option.value = language;
      option.innerText = language;
      if(language === this.language) {
        option.selected = true;
      }
      languagesSelect.appendChild(option);
    }
    languagesSelect.classList.add('w100');
    languagesSelect.addEventListener('change', (event) => {
      // @ts-ignore
      this.language = event.target.value;
      this.loadLanguage();
    });
    wrapper.appendChild(languagesSelect);
    return wrapper;
  }
  render() {
    this.cell = document.createElement('div');
    this.cell.addEventListener('keydown', (event) => {
      if (event.key === "Enter" || event.ctrlKey && event.key === "v" || event.key === "Backspace") {
        event.stopPropagation();
      }
    });
    this.cell.addEventListener('paste', (event) => {
      event.stopPropagation();
    });
    this.cell.classList.add('cell');
    this.loadLanguage();
    return this.cell;
  }

  // TODO: Strategy Pattern
  private loadLanguage() {
    if (!this.cell) {
      return;
    }
    this.cell.innerHTML = "";
    if(this.language === "javascript") {
      const editor = document.createElement('section');
      editor.classList.add('editor');
      this.cell.appendChild(editor);
      if (!this.obj.readOnly) {
        this.loadJavaScriptEditor(editor);
      }
      const output = document.createElement('section');
      output.classList.add('output', 'flex-wrap');
      this.cell.appendChild(output);
      output.innerHTML = this.outputCell;
    }
    if(this.language === "python") {
      loadPyscript();
      this.editorView?.destroy();
      const editor = document.createElement('section');
      editor.classList.add('editor');
      this.cell.appendChild(editor);
      if (!this.obj.readOnly) {
        const python = document.createElement('py-repl');
        python.innerHTML = this.code;
        editor.appendChild(python);
        // @ts-ignore
        python.addEventListener('doc-changed', (event: CustomEvent) => {
          this.code = event.detail as string;
          this.block.block?.dispatchChange();
        });
        // @ts-ignore
        python.addEventListener('output-changed', (event: CustomEvent) => {
          this.block.block?.dispatchChange();
        });
      }
      editor.addEventListener('keydown', (event) => {
        if (event.key === "Enter" || event.ctrlKey && event.key === "v" || event.key === "Backspace") {
          event.stopPropagation();
        }
      });
      editor.addEventListener('paste', (event) => {
        event.stopPropagation();
      });
      const output = document.createElement('div');
      output.innerHTML = this.outputCell;
      output.id = this.block.block?.id || "";
      output.classList.add('output', 'flex-wrap');
      editor.children[0]?.setAttribute('output', output.id);
      this.cell.appendChild(editor);
      this.cell.appendChild(output);
    }
  }

  validate(savedData: any) {
    return savedData.code.trim() !== '';
  }

  override save(blockContent: any): any {
    return {
      code: this.code,
      language: this.language,
      output: this.cell?.children[1].innerHTML ?? ""
    }
  }

  private loadJavaScriptEditor(editor: HTMLElement) {
    this.editorView = new EditorView({
      parent: editor,
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
              this.code = update.state.doc.toString();
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
