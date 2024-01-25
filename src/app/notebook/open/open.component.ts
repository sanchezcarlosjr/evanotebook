import {Component, OnInit} from "@angular/core";
import {MatDialog} from "@angular/material/dialog";
import * as url from "../shell/url";
import {DatabaseManager} from "../shell/DatabaseManager";

@Component({
  selector: 'app-opener',
  templateUrl: './open.component.html',
  styleUrls: ['./open.component.css']
})
export class OpenComponent implements OnInit {
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
    this.channel.port2.onmessage = (event: MessageEvent) => window.open(
      this.getNotebookLocation(event.data.row), "_blank"
    );
  }


  getNotebookLocation(item: any) {
    return `${location.origin}?p=${url.read('p')}&n=${item.title}`
  }

  triggerFileInput() {
    document.getElementById('notebook-file')?.click();
  }

  async importNotebook(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const blocks = JSON.parse(await input.files[0].text()).blocks;
      await this.manager.bulkInsertBlocks(blocks);
    }
  }
}
