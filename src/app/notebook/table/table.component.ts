import {Component, Input, ViewChild} from '@angular/core';
import {MatTableDataSource} from "@angular/material/table";
import {MatPaginator} from "@angular/material/paginator";
import {MatSort} from "@angular/material/sort";
import {Generate} from "@jsonforms/core";

@Component({
  selector: 'app-table',
  templateUrl: './table.component.html',
  styleUrls: ['./table.component.css']
})
export class TableComponent {
  @Input() port: MessagePort | undefined;
  displayedColumns: string[] = [];
  dataSource :any[] = [];

  constructor() {
  }

  ngOnInit(): void {
    if (!this.port) {
      return;
    }
    // @ts-ignore
    this.port.onmessage = (event: MessageEvent) => {
      if (event.data.type === 'data') {
        this.dataSource.push(event.data.data);
      }
    };
    this.port?.postMessage({'type': 'ready'});
  }

}
