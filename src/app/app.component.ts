import {Component, OnInit} from '@angular/core';
import EditorJS from "@editorjs/editorjs";
// @ts-ignore
import Header from '@editorjs/header';
// @ts-ignore
import List from '@editorjs/list';
// @ts-ignore
import Marker from '@editorjs/marker';
import {retrieve, Shell} from "./shell/shell";
// @ts-ignore
import Alert from 'editorjs-alert';
// @ts-ignore
import Checklist from '@editorjs/checklist';
// @ts-ignore
import Embed from '@editorjs/embed';
// @ts-ignore
import InlineImage from 'editorjs-inline-image';
// @ts-ignore
import Button from "./Button.js";
import {Cell} from "./cell";
// @ts-ignore
import BreakLine from 'editorjs-break-line';

@Component({
  selector: 'app-root', templateUrl: './app.component.html', styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  editor: EditorJS | null = null;

  ngOnInit() {
    this.editor = new EditorJS({
      holder: 'editor-js',
      autofocus: true,
      // @ts-ignore
      logLevel: "ERROR",
      data: JSON.parse(retrieve("c") || '"{}"'),
      tools: {
        header: {
          class: Header,
          inlineToolbar: ['link']
        },
        list: {
          class: List,
          inlineToolbar: ['link', 'bold']
        },
        marker: {
          class: Marker
        },
        code: {
          class: Cell,
          config: {
            language: 'javascript'
          }
        },
        button: {
          class: Button,
          inlineToolbar: false,
        },
        checklist: {
          class: Checklist,
          inlineToolbar: true,
        },
        breakLine: {
          class: BreakLine,
          inlineToolbar: true,
        },
        embed: {
          class: Embed,
          inlineToolbar: true,
        },
        image: {
          class: InlineImage,
          inlineToolbar: true,
          config: {
            embed: {
              display: true,
            },
            unsplash: {
              appName: retrieve("ua"),
              clientId: retrieve("uc")
            }
          }
        },
        alert: {
          class: Alert,
          inlineToolbar: true,
          config: {
            defaultType: 'primary',
            messagePlaceholder: 'Enter something'
          },
        }
      }
    });
    this.editor.isReady.then(() => {
      const shell = new Shell(this.editor as EditorJS, window);
      shell.start();
    });
  }

}
