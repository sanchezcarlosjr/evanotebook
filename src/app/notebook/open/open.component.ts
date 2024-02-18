import {Component} from "@angular/core";
import {MatDialog} from "@angular/material/dialog";
import {DatabaseManager} from "../shell/DatabaseManager";
import * as url from "../shell/url";
import { BlockDocument } from "../shell/DatabaseManager";

@Component({
  selector: 'app-opener',
  templateUrl: './open.component.html',
  styleUrls: ['./open.component.css']
})
export class OpenComponent {
  channel = new MessageChannel();
  constructor(private dialog: MatDialog, private manager: DatabaseManager) {
  }

  closeDialog() {
    this.dialog.closeAll();
  }

  triggerFileInput() {
    document.getElementById('notebook-file')?.click();
  }

  async importNotebook(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const currentBlocks = (await this.manager.exportNotebook(url.read("p"), url.read("t"))).blocks;
      let currentMaxndex = currentBlocks.reduce((max, _, index) => Math.max(max, index), 0);
      let newBlocks = JSON.parse(await input.files[0].text()).blocks;
      newBlocks = newBlocks.map((block: BlockDocument) => {
        if (block && block.index !== undefined) {
          block.index = currentMaxndex;
          currentMaxndex += 1;
        }
        return block;
      }).filter((block: BlockDocument | undefined) => block !== undefined).forEach;
      const item = await this.manager.bulkInsertBlocks(newBlocks, url.read("p"), url.read("t"));
      if (item) {
        window.location.href = `${location.origin}?t=${item.topic ?? ""}&p=${item.peer ?? ""}`;
      }
    }
  }
}
