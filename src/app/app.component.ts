import {Component, OnInit} from '@angular/core';
import * as brotli from '../assets/brotli_wasm/brotli_wasm';
import {retrieve} from "./shell/url-database";

@Component({
  selector: 'app-root', templateUrl: './app.component.html', styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  isSaving = false;
  isMode2: boolean = true;

  async ngOnInit() {
    const EditorJS = await import("@editorjs/editorjs");
    this.isMode2 = retrieve("m") === "2";
    const editor = new EditorJS.default({
      holder: 'editor-js',
      autofocus: true,
      readOnly: this.isMode2,
      // @ts-ignore
      logLevel: "ERROR",
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
        mathlive: {
          class: await import("./cellTypes/MathBlock").then(x => x.MathBlock),
          inlineToolbar: true,
        },
        embed: {
          // @ts-ignore
          class: await import("@editorjs/embed").then(x => x.default),
          inlineToolbar: true,
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
              appName: "",
              clientId: ""
            }
          }
        },
        alert: {
          // @ts-ignore
          class: await import("editorjs-alert").then(x => x.default),
          inlineToolbar: true,
          config: {
            defaultType: 'primary',
            messagePlaceholder: 'Enter something'
          },
        }
      }
    });
    editor.isReady.then(() => brotli.default("/assets/brotli_wasm/brotli_wasm_bg.wasm")).then(_ =>
      import("./shell/shell").then(lib => new lib.Shell(editor as any, window, brotli).start(this.isMode2)))
      .then();
    if (!this.isMode2) {
      window.addEventListener('saving', () => {
        this.isSaving = true;
        setTimeout(() => {
          this.isSaving = false;
        }, 2000);
      });
    }
  }

  runAll() {
    window.dispatchEvent(new CustomEvent('shell.RunAll'));
  }

  stopAll() {
    window.dispatchEvent(new CustomEvent('shell.StopAll'));
  }
}
