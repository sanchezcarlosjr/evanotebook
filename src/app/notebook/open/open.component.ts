import {Component} from "@angular/core";
import {MatDialog} from "@angular/material/dialog";
import {DatabaseManager} from "../shell/DatabaseManager";

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
      const blocks = JSON.parse(await input.files[0].text()).blocks;
      await this.manager.bulkInsertBlocks(blocks);
    }
  }

}
