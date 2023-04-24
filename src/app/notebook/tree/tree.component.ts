import {AfterViewInit, Component, Input, OnInit} from '@angular/core';
import {FlatTreeControl} from '@angular/cdk/tree';
import {MatTreeFlatDataSource, MatTreeFlattener} from '@angular/material/tree';

@Component({
  selector: 'app-tree',
  templateUrl: './tree.component.html',
  styleUrls: ['./tree.component.css']
})
export class TreeComponent implements OnInit {
  @Input() port: MessagePort | undefined;

  private _transformer = (node: any, level: number) => {
    return {
      expandable: !!node.children && node.children.length > 0,
      name: node.name,
      level: level,
    };
  };

  treeControl = new FlatTreeControl<any>(
    node => node.level,
    node => node.expandable,
  );

  treeFlattener = new MatTreeFlattener(
    this._transformer,
    node => node.level,
    node => node.expandable,
    node => node.children,
  );

  dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);

  constructor() {
  }

  ngOnInit(): void {
    if (!this.port) {
      return;
    }
    // @ts-ignore
    this.port.onmessage = (event: MessageEvent) => {
      if (event.data.type === 'render') {
         this.dataSource.data = event.data.dataSource;
      }
    };
  }

  hasChild = (_: number, node: any) => node.expandable;
}
