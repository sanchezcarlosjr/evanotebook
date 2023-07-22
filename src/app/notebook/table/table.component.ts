import {Component, Input, ViewChild, OnInit, AfterViewInit} from '@angular/core';
import {MatTableDataSource} from "@angular/material/table";
import {MatPaginator} from "@angular/material/paginator";
import {MatSort} from "@angular/material/sort";

@Component({
  selector: 'app-table',
  templateUrl: './table.component.html',
  styleUrls: ['./table.component.css']
})
export class TableComponent implements OnInit, AfterViewInit {
  @Input() port: MessagePort | any;
  displayedColumns: string[] = [];
  dataSource: MatTableDataSource<object> = new MatTableDataSource<object>([]);
  @ViewChild(MatSort) sort: MatSort | null = null;
  @ViewChild(MatPaginator) paginator: MatPaginator | null = null;

  constructor() {
  }

  ngOnInit(): void {
    if (!this.port) {
      return;
    }
    // @ts-ignore
    this.port.onmessage = (event: MessageEvent) => {
      if (event.data?.type === 'render') {
        this.displayedColumns = event.data.displayedColumns;
        this.dataSource.data = event.data.dataSource;
        this.dataSource._updateChangeSubscription();
      }
    };
    this.dataSource.filterPredicate = (data, filter) => {
      const json = JSON.stringify(data);
      try {
        return !!json.match(filter);
      } catch (e) {
        return json.includes(filter);
      }
    }
  }

  serialize(x: object) {
    return JSON.stringify(x);
  }

  ngAfterViewInit() {
    this.dataSource.sort = this.sort;
    this.dataSource.paginator = this.paginator;
  }

  applyFilter(event: Event) {
    this.dataSource.filter = (event.target as HTMLInputElement).value;
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  clickRecord(row: any) {
    this.port.postMessage({type: 'click', row});
  }
}
