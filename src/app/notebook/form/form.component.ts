import {Component, Input, OnDestroy, OnInit} from '@angular/core';
import { angularMaterialRenderers } from '@jsonforms/angular-material';
import { Generate } from '@jsonforms/core';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-form',
  templateUrl: './form.component.html',
  styleUrls: ['./form.component.css']
})
export class FormComponent implements OnInit {
  @Input() port: MessagePort | undefined;
  uischema = {type: ""};
  data = null;
  schema = {};
  renderers = angularMaterialRenderers;
  ngOnInit(): void {
    // @ts-ignore
    this.port.onmessage = (event: MessageEvent) => {
      if (event.data.type === 'setOptions') {
        this.data = event.data.options.data ?? null;
        this.schema  = event.data.options.schema ?? undefined;
        this.uischema = event.data.options.uischema ?? Generate.uiSchema(this.schema);
      }
    };
    this.port?.postMessage({'type': 'ready'});
  }
  get isValidForm() {
    return this.schema && this.uischema.type !== "";
  }
  dataChange(data: any) {
    if (data === null)
      return;
    this.port?.postMessage({'type': 'data', data});
  }
}
