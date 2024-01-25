import {Component, Injector, OnInit} from '@angular/core';
import * as url from "./shell/url";
import { createCustomElement } from '@angular/elements';
import {MatSnackBar} from "@angular/material/snack-bar";
import {API} from "@editorjs/editorjs";
import {TableComponent} from "./table/table.component";
import {MatToolbar} from "@angular/material/toolbar";
import {MatButton} from "@angular/material/button";
import {MatMenu} from "@angular/material/menu";
import {TreeComponent} from "./tree/tree.component";
import {TitleSubjectService} from "../title-subject.service";
import {MatDialog} from "@angular/material/dialog";
import {ShareDialogComponent} from "./share-dialog.component";
import {HistoryComponent} from "./history.component";
import {DatabaseManager} from "./shell/DatabaseManager";
import {transformBulkEditorChanges} from "./transform-bulk-editor-changes";
import { OpenComponent } from './open/open.component';

function readAsDataURL(file: File): Promise<string> {
  if (!file) {
    return Promise.resolve("");
  }
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.addEventListener(
      "load",
      () => resolve(reader?.result as string ?? ""),
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
  isMode2 = true;
  loading = true;
  name = "";
  hideMainToolbar = false;
  constructor(
    private injector: Injector,
    private _snackBar: MatSnackBar,
    private titleService: TitleSubjectService,
    private dialog: MatDialog,
    private database: DatabaseManager,
    ) {
  }
  async ngOnInit() {
    const EditorJS = await import("@editorjs/editorjs");
    this.isMode2 = url.read("m") === "2";
    this.hideMainToolbar = this.isMode2;
    const editor = new EditorJS.default({
      holder: 'editor-js',
      autofocus: true,
      readOnly: this.isMode2,
      // @ts-ignore
      logLevel: "ERROR",
      onChange(api: API, event: CustomEvent | CustomEvent[]) {
        const bulkEditorChanges = transformBulkEditorChanges(Array.isArray(event) ? event : [event]);
        window.dispatchEvent(new CustomEvent('bulk-editor-changes', {detail: bulkEditorChanges}))
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
             uploadByFile: this.uploadByFile.bind(this),
           }
         }
        },
        mathlive: {
          class: await import("./cellTypes/MathBlock").then(x => x.MathBlock),
          inlineToolbar: true,
        },
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
            },
            uploader: {
              uploadByFile: this.uploadByFile.bind(this)
            }
          }
        },
        mermaid: await import("./cellTypes/MermaidBlock").then(x => x.MermaidTool),
        // @ts-ignore
        toc: await import("@phigoro/editorjs-toc").then(x => x.default),
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
    this.titleService.setTitle(url.read("n", "EvaNotebook"));
    this.name = this.titleService.getTitle();
    editor.isReady
      .then(() => import("./shell/shell")
        .then(lib =>
          new lib.Shell(editor as any, window, this.database).start(this.isMode2)
      ).then(shell => shell.registerHistoryChanges(this.titleService)).then(
        () => {
          customElements.define('nk-table', createCustomElement(TableComponent, {injector: this.injector}));
          customElements.define('nk-tree', createCustomElement(TreeComponent, {injector: this.injector}));
          customElements.define('nk-toolbar', createCustomElement(MatToolbar, {injector: this.injector}));
          customElements.define('nk-button', createCustomElement(MatButton, {injector: this.injector}));
          customElements.define('nk-menu', createCustomElement(MatMenu, {injector: this.injector}));
        }
    ));
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

  async uploadByFile(file: File) {
    let resourceUrl = "";
    try {
      if (url.has("lg")) {
        const formData = new FormData();
        formData.append('file', file, file.name);
        const LOCAL_GATEWAY = url.read("lg");
        const response = await fetch(LOCAL_GATEWAY, {
          method: 'POST',
          body: formData
        }).then(r => r.json());
        if (!response.Hash) {
          throw new Error("No hash returned");
        }
        const GLOBAL_GATEWAY = url.read("gg") ?? LOCAL_GATEWAY;
        resourceUrl = `${GLOBAL_GATEWAY}${response.Hash}?filename=${response.Name || response.name || file.name}`;
      }
    } catch (e) {return;}
    resourceUrl = resourceUrl || await readAsDataURL(file);
    return {
      success: 1,
      file: {
        url: resourceUrl,
        name: file.name,
        size: file.size
      }
    }
  }

  runAll() {
    window.dispatchEvent(new CustomEvent('shell.RunAll'));
  }

  stopAll() {
    window.dispatchEvent(new CustomEvent('shell.StopAll'));
  }

  createNewNotebook() {
    location.href = `${location.origin}?p=${url.read('p')}`;
  }

  exportNotebook() {
    window.dispatchEvent(new CustomEvent('shell.ExportNotebook'));
  }

  saveInUrl() {
    window.dispatchEvent(new CustomEvent('shell.SaveInUrl'));
  }

  updateName(name: string) {
    url.write("n", name);
    this.titleService.setTitle(name);
  }

  shareNotebook() {
    this.dialog.open(ShareDialogComponent);
  }

  openFile() {
    this.dialog.open(OpenComponent);
  }

  openRecent() {
    this.dialog.open(HistoryComponent);
  }

  modeZen() {
    this.hideMainToolbar = true;
  }
}
