import {Component, Injector, OnInit} from '@angular/core';
import * as url from "./shell/url";
import { createCustomElement } from '@angular/elements';
import {FormComponent} from "./form/form.component";
import {MatSnackBar} from "@angular/material/snack-bar";
import {API} from "@editorjs/editorjs";
import {Title} from "@angular/platform-browser";
import {TableComponent} from "./table/table.component";
import {MatToolbar} from "@angular/material/toolbar";
import {MatButton} from "@angular/material/button";
import {MatMenu} from "@angular/material/menu";
import {MatCard} from "@angular/material/card";

function readAsDataURL(file: File) {
  if (!file) {
    return Promise.resolve(null);
  }
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.addEventListener(
      "load",
      () => resolve(reader?.result),
      false
    );
    reader.readAsDataURL(file);
  });
}

@Component({
  selector: 'app-notebook',
  templateUrl: './notebook.component.html',
  styleUrls: ['./notebook.component.css']
})
export class NotebookComponent implements OnInit {
  isSaving = false;
  isMode2: boolean = true;
  loading: boolean = true;
  name: string = "";
  constructor(injector: Injector,private _snackBar: MatSnackBar, private titleService: Title) {
    customElements.define('nk-form', createCustomElement(FormComponent, {injector}));
    customElements.define('nk-table', createCustomElement(TableComponent, {injector}));
    customElements.define('nk-toolbar', createCustomElement(MatToolbar, {injector}));
    customElements.define('nk-button', createCustomElement(MatButton, {injector}));
    customElements.define('nk-menu', createCustomElement(MatMenu, {injector}));
    customElements.define('nk-card', createCustomElement(MatCard, {injector}));
  }
  async ngOnInit() {
    this.name = url.read("n", "EvaNotebook");
    this.titleService.setTitle(this.name);
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
              async uploadByFile(file: File) {
                const url = await readAsDataURL(file);
                return {
                  success: 1,
                  file: {
                    url,
                    name: file.name,
                    size: file.size
                  }
                }
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
        mermaid: await import("./cellTypes/MermaidBlock").then(x => x.MermaidTool),
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

  saveInUrl() {
    window.dispatchEvent(new CustomEvent('shell.SaveInUrl'));
  }

  importNotebook(event: Event) {
    // @ts-ignore
    window.dispatchEvent(new CustomEvent('shell.ImportNotebook', {detail: {file: event.target.files.item(0)}}));
  }

  updateName(name: string) {
    url.write("n", name);
    this.titleService.setTitle(name);
  }
}
