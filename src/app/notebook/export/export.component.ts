import {Component} from "@angular/core";
import {MatDialog} from "@angular/material/dialog";
import * as url from "../shell/url";
import {DatabaseManager} from "../shell/DatabaseManager";

@Component({
  selector: 'app-exporter',
  templateUrl: './export.component.html',
  styleUrls: ['./export.component.css']
})
export class ExportComponent {
  channel = new MessageChannel();
  constructor(private dialog: MatDialog, private manager: DatabaseManager) {
  }

  closeDialog() {
    this.dialog.closeAll();
  }

  async export() {
    console.log(await this.manager.exportDatabase());
  }

  async exportNotebook() {
    console.log(await this.manager.exportNotebook(url.read("p")));
  }

  async destroy() {
    this.manager.destroy();
  }

}
