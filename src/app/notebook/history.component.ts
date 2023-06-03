import {Component, OnInit} from "@angular/core";
import {MatDialog} from "@angular/material/dialog";
import { Clipboard } from '@angular/cdk/clipboard';
import * as url from "./shell/url";
import {DatabaseManager} from "./shell/DatabaseManager";

@Component({
  selector: 'app-history',
  template: `
    <h1 mat-dialog-title>Recent notebooks</h1>
    <div mat-dialog-content>
        <app-table [port]="channel.port1"></app-table>
    </div>
    <div mat-dialog-actions>
      <button mat-button (click)="closeDialog()">Close</button>
    </div>
  `,
})
export class HistoryComponent implements OnInit {
  channel = new MessageChannel();
  constructor(private dialog: MatDialog, private manager: DatabaseManager) {
  }

  closeDialog() {
    this.dialog.closeAll();
  }

  ngOnInit(): void {
    this.manager.history$.subscribe((dataSource) =>
        this.channel.port2.postMessage({
          type: 'render',
          displayedColumns: ['title', 'topic', 'Created At', 'Updated At', 'Created By', 'Last Edited By'],
          dataSource
        })
    );
    this.channel.port2.onmessage = (event: MessageEvent) => window.open(this.getNotebookLocation(event.data.row), "_blank");
  }

  getNotebookLocation(item: any) {
    console.log(item);
    return `${location.origin}?p=${url.read('p')}&t=${item.topic}&n=${item.title}`
  }

}
