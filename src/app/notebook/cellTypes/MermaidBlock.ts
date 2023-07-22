import mermaid, { MermaidConfig } from "mermaid";
import {EditorJsTool} from "./EditorJsTool";
import {randomCouchString} from "rxdb";
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
import {bracketMatching, foldGutter, foldKeymap, indentOnInput} from '@codemirror/language';
import {defaultKeymap, history, historyKeymap} from "@codemirror/commands";
import {autocompletion, closeBrackets, closeBracketsKeymap} from "@codemirror/autocomplete";
import {searchKeymap} from "@codemirror/search";
import {espresso} from "thememirror";
import {BlockAPI} from "@editorjs/editorjs";
import {BehaviorSubject, filter,firstValueFrom,first,map} from "rxjs";
import {svgToInlinedSvgDataUri,dataUriToImage,canvasToRasterBlob,download} from "export-svg";
import { mermaid as mermaidlang, mindmapTags } from 'codemirror-lang-mermaid';

function generateId(prefix: string) {
  return `${prefix}${randomCouchString(10)}`;
}

export class MermaidTool {
  private code: string;
  private readOnly: boolean | undefined;
  private block: BlockAPI | undefined;
  private svgSubject = new BehaviorSubject<Element|undefined>(undefined);
  private settings = [
    {
      name: 'Export as SVG',
      call: async () => {
        const [svg]: [string] = await this.export();
        // @ts-ignore
        window.downloadBlob(new Blob([svg],{ type: 'image/svg+xml' }), {filename: this.block.id+'.svg'});
      }
    },
    {
      name: 'Export as PNG',
      call: async () => {
        await this.exportPNG();
      }
    }
  ]

  static config(config: MermaidConfig) {
    mermaid.initialize(config);
    mermaid.run({
      suppressErrors: true,
    });
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
    this.readOnly = readOnly;
    this.block = block;
  }

  parse(code: string, preview: Element) {
    preview.innerHTML = '';
    return mermaid.render(generateId('svg-'), code)
      .then((renderResult) => {
        preview.insertAdjacentHTML('afterbegin', renderResult.svg);
        preview.classList.remove('py-error');
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
    this.stopPropagation(wrapper);
    // @ts-ignore
    wrapper.id = this.block.id;
    wrapper.classList.add('mermaid-wrapper');
    this.createEditor(wrapper);
    this.createPreview(wrapper);
    return wrapper;
  }

  renderSettings() {
    const wrapper = document.createElement('div');

    this.settings.forEach(tune => {
      let exporter = document.createElement('button');
      exporter.classList.add('cdx-settings-button');
      exporter.textContent = tune.name;
      exporter.addEventListener('click', tune.call);
      wrapper.appendChild(exporter);
    })

    return wrapper;
  }

  private export(): Promise<any> {
    return firstValueFrom(this.svgSubject.pipe(
      filter((svg: Element|undefined):boolean  => svg !== undefined),
      // @ts-ignore
      first(),
      map((element: Element) => {
        const svg = element.children[0].cloneNode(true) as Element;
    svg.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:xlink', 'http://www.w3.org/1999/xlink');
    const link = document.createElement('link');
    link.setAttribute('id', '0');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.1.1/css/all.min.css';
    link.integrity = 'sha512-KfkfwYDsLkIlwQp6LFnl8zNdLGxu9YAA1QvwINks4PhcElQSvqcyVLLD9aMhXd13uQjoXtEKNosOWaZqXgel0g==';
    link.crossOrigin = 'anonymous';
    link.referrerPolicy = 'no-referrer';
    svg.appendChild(link);
    svg.setAttribute('style', '');
    const styleElement = document.createElement('style');
    styleElement.setAttribute('id', '1');
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
    return [svgString, svg];
      })
    ))
  }

  private async exportPNG() {
    const [_,svg] = await this.export();
    svg.getElementById('0').remove();
    svg.getElementById('1').remove();
    const options = {quality: 1};
    const dataUri = await svgToInlinedSvgDataUri(svg, options);
    const img = await dataUriToImage(dataUri);
    const blob = await canvasToRasterBlob(this.imageToCanvas(img, options), options);
    download(this.block?.id+'.png', blob);
  }
  
  imageToCanvas(img: HTMLImageElement , options: {quality: number}) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", options);
    const pixelRatio = 1;
    // @ts-ignore
    canvas.width = img.width * pixelRatio;
    // @ts-ignore
    canvas.height = img.height * pixelRatio;
    // @ts-ignore
    context.fillStyle = 'white';
    // @ts-ignore
    context.fillRect(0, 0, canvas.width, canvas.height);
    // @ts-ignore
    canvas.style.width = `${canvas.width}px`;
    // @ts-ignore
    canvas.style.height = `${canvas.height}px`;
    // context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    // @ts-ignore
    context?.drawImage(img, 0, 0)
    return canvas;
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
          mermaidlang(),
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
      code: this.code
    }
  }
}