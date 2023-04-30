import mermaid, { MermaidConfig } from "mermaid";
import {EditorJsTool} from "./EditorJsTool";
import {randomCouchString} from "rxdb/plugins/utils";
import { EditorState } from '@codemirror/state';
import {
  crosshairCursor,
  dropCursor,
  EditorView,
  highlightActiveLineGutter,
  highlightSpecialChars, keymap,
  lineNumbers,
  rectangularSelection
} from '@codemirror/view';
import {bracketMatching, foldGutter, foldKeymap, indentOnInput, language} from '@codemirror/language';
import {defaultKeymap, history, historyKeymap} from "@codemirror/commands";
import {autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap} from "@codemirror/autocomplete";
import {searchKeymap} from "@codemirror/search";
import {linter, lintGutter, lintKeymap} from "@codemirror/lint";
import {espresso} from "thememirror";
import {esLint, javascript} from "@codemirror/lang-javascript";
import {BlockAPI} from "@editorjs/editorjs";
import {BehaviorSubject, filter, first} from "rxjs";


function generateId(prefix: string) {
  return `${prefix}${randomCouchString(10)}`;
}

export class MermaidTool {
  private code: string;
  private caption: string;
  private readOnly: boolean | undefined;
  private block: BlockAPI | undefined;
  private svgSubject = new BehaviorSubject<Element|undefined>(undefined);

  static config(config: MermaidConfig) {
    mermaid.initialize(config);
  }

  static get toolbox() {
    return {
      title: 'mermaid',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><path fill="#000" d="M.16.63h2.12l1.603 4.713h.02L5.42.63h2.12v6.852H6.13V2.626h-.02L4.43 7.482H3.27L1.59 2.674h-.02v4.808H.16V.63z"/></svg>'
    };
  }

  static get isReadOnlySupported() {
    return true;
  }

  constructor({ data, readOnly, block }: EditorJsTool) {
    this.code = data.code;
    this.caption = data.caption;
    this.readOnly = readOnly;
    this.block = block;
  }

  parse(code: string, preview: Element) {
    preview.innerHTML = '';
    return mermaid.render(generateId('svg-'), code)
      .then((renderResult) => {
        preview.insertAdjacentHTML('afterbegin', renderResult.svg);
        return preview;
      })
      .catch((e) => {
        preview.innerHTML = e.message;
        preview.classList.add('py-error');
        return undefined;
      });
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.classList.add('mermaid-wrapper');
    this.stopPropagation(wrapper);
    this.createEditor(wrapper);
    this.createPreview(wrapper);
    this.createCaption(wrapper);
    return wrapper;
  }

  private createCaption(wrapper: HTMLDivElement) {
    const caption = document.createElement('div');
    if (this.readOnly && this.caption) {
      caption.innerText = this.caption;
      this.svgSubject.pipe(
        filter(svg => svg !== undefined),
        first()
        // @ts-ignore
      ).subscribe((element: Element) => {
          const aElement = document.createElement('a');
          aElement.target = '_blank';
          caption.innerText = '';
          aElement.innerText = this.caption;
          aElement.addEventListener('click', (event) => {
            if (aElement.href) {
              return;
            }
            const svg = element.children[0].cloneNode(true) as Element;
            svg.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:xlink', 'http://www.w3.org/1999/xlink');
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.1.1/css/all.min.css';
            link.integrity = 'sha512-KfkfwYDsLkIlwQp6LFnl8zNdLGxu9YAA1QvwINks4PhcElQSvqcyVLLD9aMhXd13uQjoXtEKNosOWaZqXgel0g==';
            link.crossOrigin = 'anonymous';
            link.referrerPolicy = 'no-referrer';
            svg.appendChild(link);
            svg.setAttribute('style', '');
            const styleElement = document.createElement('style');
            styleElement.textContent = `
@font-face {
  font-family: "Fira Code Regular";
  src: url(https://notebook.sanchezcarlosjr.com/assets/fonts/FiraCode-Regular.woff);
  font-display: swap;
}
* :not(i) {
  font-family: "Fira Code Regular",apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif !important;
  letter-spacing: 0;
}
          `;
            svg.appendChild(styleElement);
            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(svg as SVGElement);
            aElement.setAttribute('href', URL.createObjectURL(new Blob([svgString], { type: 'image/svg+xml' })));
          });
          caption.appendChild(aElement);
      });
      caption.classList.add('center');
      wrapper.appendChild(caption);
    }
    if (!this.readOnly) {
      caption.classList.add('cdx-input');
      // @ts-ignore
      caption.setAttribute('contenteditable', !this.readOnly);
      // @ts-ignore
      caption.dataset.placeholder = 'Caption';
      caption.innerText = this.caption ? this.caption : '';
      wrapper.appendChild(caption);
      caption.addEventListener('change', () => {
        this.block?.dispatchChange();
      });
    }
  }

  private createPreview(wrapper: HTMLDivElement) {
    const preview = document.createElement('div');
    preview.classList.add('cdx-block', 'center');
    wrapper.appendChild(preview);
    if (this.code) {
      setTimeout(() => this.parse(this.code, preview).then(svg => this.svgSubject.next(svg)), 0);
    }
  }

  private stopPropagation(wrapper: HTMLDivElement) {
    wrapper.addEventListener('keydown', (event) => {
      if (event.key === "Enter" || event.ctrlKey && event.key === "v" || event.key === "Backspace") {
        event.stopPropagation();
      }
    });
    wrapper.addEventListener('paste', (event) => {
      event.stopPropagation();
    });
  }

  validate(savedData: any) {
    return savedData.code.trim() !== '';
  }

  createEditor(wrapper: HTMLElement) {
    if (this.readOnly) {
      return;
    }
    wrapper.appendChild(document.createElement('div'));
    new EditorView({
      parent: wrapper.children[0],
      state: EditorState.create({
        doc:  this.code ? this.code : '',
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
              this.parse(this.code, wrapper.children[1]);
              this.block?.dispatchChange();
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
            ...foldKeymap
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
        ]
      })
    })
  }

  save(element: HTMLElement) {
    return {
      code: this.code,
      caption: element.children[2]?.textContent ?? ""
    }
  }
}
