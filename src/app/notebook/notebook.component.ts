import {Component, Injector, OnInit} from '@angular/core';
import * as url from "./shell/url";
import * as brotli from "../../assets/brotli_wasm/brotli_wasm";
import { createCustomElement } from '@angular/elements';
import {FormComponent} from "./form/form.component";
import {MatSnackBar} from "@angular/material/snack-bar";
import {API} from "@editorjs/editorjs";

@Component({
  selector: 'app-notebook',
  templateUrl: './notebook.component.html',
  styleUrls: ['./notebook.component.css']
})
export class NotebookComponent implements OnInit {
  isSaving = false;
  isMode2: boolean = true;
  loading: boolean = true;
  constructor(injector: Injector,private _snackBar: MatSnackBar) {
    const formElement = createCustomElement(FormComponent, {injector});
    customElements.define('nk-form', formElement);
  }
  async ngOnInit() {
    const EditorJS = await import("@editorjs/editorjs");
    this.isMode2 = url.read("m") === "2";
    const editor = new EditorJS.default({
      holder: 'editor-js',
      autofocus: true,
      readOnly: this.isMode2,
      // @ts-ignore
      logLevel: "ERROR",
      onChange(api: API, event: CustomEvent) {
         window.dispatchEvent(event);
      },
      tools: {
        header: {
          // @ts-ignore
          class: await import("@editorjs/header").then(x => x.default),
          inlineToolbar: ['link']
        },
        list: {
          // @ts-ignore
          class: await import("@editorjs/list").then(x => x.default),
          inlineToolbar: ['link', 'bold']
        },
        marker: {
          // @ts-ignore
          class: await import("@editorjs/marker").then(x => x.default),
        },
        code: {
          class: await import("./cellTypes/CodeBlock").then(x => x.CodeBlock),
          config: {
            language: 'javascript'
          },
          inlineToolbar: true
        },
        checklist: {
          // @ts-ignore
          class: await import("@editorjs/checklist").then(x => x.default),
          inlineToolbar: true,
        },
        Color: {
          // @ts-ignore
          class: await import("editorjs-text-color-plugin").then(x => x.default),
          config: {
            colorCollections: ['#EC7878','#9C27B0','#673AB7','#3F51B5','#0070FF','#03A9F4','#00BCD4','#4CAF50','#8BC34A','#CDDC39', '#FFF'],
            defaultColor: '#FF1300',
            type: 'text',
            customPicker: true
          }
        },
        attaches: {
          // @ts-ignore
          class: await import("@editorjs/attaches").then(x => x.default),
          config: {
            uploader: {
              uploadByFile(file: File){
                if (file.type.startsWith("text/")) {
                  file = new File([file], file.name, { type: "text/plain" });
                }
                return new Promise(resolve => resolve({success: 1, file: {
                    url: URL.createObjectURL(file),
                    name: file.name,
                    size: file.size
                }}))
              },
            }
          }
        },
        mathlive: {
          class: await import("./cellTypes/MathBlock").then(x => x.MathBlock),
          inlineToolbar: true,
        },
        // @ts-ignore
        delimiter: await import("@editorjs/delimiter").then(x => x.default),
        // @ts-ignore
        Strikethrough: await import("@sotaproject/strikethrough").then(x => x.default),
        // @ts-ignore
        embed: {
          // @ts-ignore
          class: await import("@editorjs/embed").then(x => x.default),
          inlineToolbar: true,
        },
        table: {
          // @ts-ignore
          class: await import("@editorjs/table").then(x => x.default),
          inlineToolbar: true,
          config: {
            rows: 2,
            cols: 3,
          },
        },
        image: {
          // @ts-ignore
          class: await import("editorjs-inline-image").then(x => x.default),
          inlineToolbar: true,
          config: {
            embed: {
              display: true,
            },
            unsplash: {
              appName: url.read("ua"),
              clientId: url.read("uc")
            }
          }
        },
        // @ts-ignore
        mermaid: await import("editorjs-mermaid").then(x => x.default),
        alert: {
          // @ts-ignore
          class: await import("editorjs-alert").then(x => x.default),
          inlineToolbar: true,
          config: {
            defaultType: 'primary',
            messagePlaceholder: 'Enter something'
          },
        }
      },
      onReady() {
        // @ts-ignore
        import("editorjs-drag-drop").then(x => x.default).then(DragDrop => new DragDrop(editor));
      }
    });
    this.loading = false;
    editor.isReady.then(() => import('./shell/DatabaseManager').then(lib => new lib.DatabaseManager()))
      .then(manager => import("./shell/shell")
        .then(lib => new lib.Shell(editor as any, window, manager).start(this.isMode2)));
    if (!this.isMode2) {
      window.addEventListener('saving', () => {
        this.isSaving = true;
        setTimeout(() => {
          this.isSaving = false;
        }, 2000);
      });
      window.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.ctrlKey && e.key === "F9") {
          this.runAll();
        }
      });
    }
    // @ts-ignore
    window.addEventListener('openSnackBar' , (e: CustomEvent) =>
      this._snackBar.open(e.detail.payload.message, e.detail.payload.action)
    );
  }

  runAll() {
    window.dispatchEvent(new CustomEvent('shell.RunAll'));
  }

  stopAll() {
    window.dispatchEvent(new CustomEvent('shell.StopAll'));
  }

  createNewNotebook() {
    window.dispatchEvent(new CustomEvent('shell.CreateNewNotebook'));
  }

  exportNotebook() {
    window.dispatchEvent(new CustomEvent('shell.ExportNotebook'));
  }

  importNotebook(event: Event) {
    // @ts-ignore
    window.dispatchEvent(new CustomEvent('shell.ImportNotebook', {detail: {file: event.target.files.item(0)}}));
  }
}
