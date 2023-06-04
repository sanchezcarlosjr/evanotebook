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
          <p>Collaborate with others peer to peer.</p>
        </mat-list-item>
        <mat-list-item>
          <span>{{collaborativeURL}}</span>
          <button mat-button (click)="copyToClipboard(collaborativeURL)">Copy Link</button>
        </mat-list-item>
        <mat-list-item>
          <h3 matListItemTitle style="font-weight: bold">Publish your notebook</h3>
          <p>Transform your notebook in an interactive one</p>
        </mat-list-item>
        <mat-list-item>
          <span>{{publicationURL}}</span>
          <button mat-button (click)="copyToClipboard(publicationURL)">Copy Link</button>
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
    const collaborativeUrl = new URL(location.href);
    collaborativeUrl.searchParams.delete("p");
    collaborativeUrl.searchParams.delete("c");
    collaborativeUrl.searchParams.delete("u");
    collaborativeUrl.searchParams.set('ps', url.read('p'));
    return collaborativeUrl.toString();
  }

  get publicationURL() {
    const publicationUrl = new URL(location.href);
    publicationUrl.searchParams.set("m", "2");
    publicationUrl.searchParams.delete("p");
    return publicationUrl.toString();
  }

  closeDialog() {
    this.dialog.closeAll();
  }

  copyToClipboard(str: string) {
    this.clipboard.copy(str);
  }
}
