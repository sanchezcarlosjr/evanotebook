import {Component} from "@angular/core";
import {MatDialog} from "@angular/material/dialog";
import { Clipboard } from '@angular/cdk/clipboard';
import * as url from "./shell/url";

@Component({
  selector: 'app-share-dialog',
  template: `
    <h1 mat-dialog-title>Share your notebook</h1>
    <div mat-dialog-content>
      <mat-list>
        <mat-list-item>
          <h3 matListItemTitle style="font-weight: bold">Collaborative notebook</h3>
        </mat-list-item>
        <mat-list-item>
          <span>{{collaborativeURL}}</span>
          <button mat-button (click)="copyToClipboard(collaborativeURL)">Copy Link</button>
        </mat-list-item>
      </mat-list>
    </div>
    <div mat-dialog-actions>
      <button mat-button (click)="closeDialog()">Close</button>
    </div>
  `,
})
export class ShareDialogComponent {
  constructor(public dialog: MatDialog,private clipboard: Clipboard) {
  }

  get collaborativeURL() {
    return `${location.origin}?ps=${url.read('p')}&t=${url.read('t')}&n=${url.read('n', "EvaNotebook")}`;
  }

  closeDialog() {
    this.dialog.closeAll();
  }

  copyToClipboard(str: string) {
    this.clipboard.copy(str);
  }
}
