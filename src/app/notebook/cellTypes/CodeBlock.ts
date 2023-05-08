import {EditorJsTool} from "./EditorJsTool";
import {InteractiveBlock} from "./InteractiveBlock";
import {JavaScript} from "./languages/JavaScript";
import {Language} from "./languages/language";
import {match} from "ts-pattern";
import {Python} from "./languages/Python";
import {stringToHTML} from "./stringToHTML";

export class CodeBlock extends InteractiveBlock {
  private cell: HTMLDivElement;
  private input: HTMLInputElement | null = null;
  private language: Language;
  private readonly outputCell: string;
  private code: string;

  constructor(private editorJsTool: EditorJsTool) {
    super(editorJsTool);
    this.code = editorJsTool.data.code ?? "";
    this.outputCell = editorJsTool.data.output ?? "";
    this.cell = document.createElement('div');
    this.language = this.languageFactory((editorJsTool.data.language === undefined) ? editorJsTool.config.language : editorJsTool.data.language);
  }

  private languageFactory(language: string): Language {
    return match(language).with(
      "javascript", () => new JavaScript(this.code, this.editorJsTool, this.cell)
    )
      .with("python", () => new Python(this.code, this.editorJsTool, this.cell))
      .otherwise(
      () => new JavaScript(this.code, this.editorJsTool,this.cell)
    );
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

  stop() {
    this.language.stop();
    // @ TODO: Remove this because we have forms
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
            threadId: this.editorJsTool.block?.id
          }
        }
      }));
    }, false);
  }

  override clear() {
    this.language.clear();
  }

  write(text: string) {
    const html = stringToHTML(text) as HTMLElement;
    this.cell.children[1].appendChild(html);
    this.execHtml(html);
  }

  private execHtml(html: HTMLElement) {
    if (!html?.getElementsByTagName) {
      return;
    }
    const elements = html?.getElementsByTagName('script') ?? [];
    for (let i = 0; i < elements.length; i++) {
      const scriptElement = elements.item(i) as any;
      const clonedElement = document.createElement("script");
      Array.from(scriptElement.attributes).forEach((attribute: any) => {
        clonedElement.setAttribute(attribute.name, attribute.value);
      });
      clonedElement.text = scriptElement.text;
      scriptElement.parentNode.replaceChild(clonedElement, scriptElement);
    }
  }

  rewrite(text: string) {
    //@ts-ignore
    this.cell.children[1].innerHTML = text;
    this.execHtml(this.cell.children[1] as HTMLElement);
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
          threadId: this.editorJsTool.block?.id
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
          threadId: this.editorJsTool.block?.id
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
          threadId: this.editorJsTool.block?.id
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
                    threadId: this.editorJsTool.block?.id
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
          threadId: this.editorJsTool.block?.id
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
              threadId: this.editorJsTool.block?.id
            }
          }
        }));
        // @ts-ignore
        this.input.value = "";
      }
    });
  }

  override dispatchShellRun() {
    this.language.dispatchShellRun();
    return true;
  }

  override dispatchShellStop() {
    this.language.dispatchShellStop();
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
      if(language === this.language.name) {
        option.selected = true;
      }
      languagesSelect.appendChild(option);
    }
    languagesSelect.classList.add('w100');
    languagesSelect.addEventListener('change', (event) => {
      this.language.destroyEditor();
      // @ts-ignore
      this.language = this.languageFactory(event.target?.value);
      this.loadLanguage();
    });
    wrapper.appendChild(languagesSelect);
    return wrapper;
  }

  render() {
    this.cell.addEventListener('keydown', (event) => {
      if (event.key === "Enter" || event.ctrlKey && event.key === "v" || event.key === "Backspace") {
        event.stopPropagation();
      }
    });
    this.cell.addEventListener('paste', (event) => {
      event.stopPropagation();
    });
    // @ts-ignore
    this.cell.id = this.editorJsTool.block?.id ?? "";
    this.cell.classList.add('cell');
    this.loadLanguage();
    return this.cell;
  }

  private loadLanguage() {
    if (!this.cell) {
      return;
    }
    const editor = document.createElement('section');
    this.cell.appendChild(editor);
    const output = document.createElement('section');
    output.classList.add('output', 'flex-wrap');
    output.innerHTML = this.outputCell;
    this.cell.appendChild(output);
    if (!this.editorJsTool.readOnly) {
      editor.classList.add('editor');
      editor.addEventListener('keydown', (event) => {
        if (event.key === "Enter" || event.ctrlKey && event.key === "v" || event.key === "Backspace") {
          event.stopPropagation();
        }
      });
      editor.addEventListener('paste', (event) => {
        event.stopPropagation();
      });
      this.language.loadEditor(this.cell);
    }
    this.language.docChanges$().subscribe((doc: string) => {
      this.code = doc;
    });
  }

  override save(blockContent: any): any {
    return {
      code: this.code,
      language: this.language.name,
      output: this.cell?.children[1].innerHTML ?? ""
    }
  }

}
