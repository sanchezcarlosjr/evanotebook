import {Component, Input, OnInit, ViewChild} from '@angular/core';
import { angularMaterialRenderers } from '@jsonforms/angular-material';
import {and, Generate, isControl, rankWith, scopeEndsWith} from '@jsonforms/core';
import {CodeComponent} from "./code/code.component";
import {MatSort} from "@angular/material/sort";
import {JsonForms} from "@jsonforms/angular";

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
  isSubmitButtonAvailable = false;
  @ViewChild(JsonForms) jsonForms: JsonForms | null = null;
  renderers = [
    ...angularMaterialRenderers,
    {
      renderer: CodeComponent,
      tester: rankWith(
        6,
        and(
          isControl,
          scopeEndsWith('code')
        )
      )
    }
  ];
  readonly = false;
  state: any = {};
  ngOnInit(): void {
    if(!this.port) {
      return;
    }
    // @ts-ignore
    this.port.onmessage = (event: MessageEvent) => {
      if (event.data.type === 'setOptions') {
        this.data = event.data.options.data ?? null;
        this.schema  = event.data.options.schema ?? undefined;
        this.uischema = event.data.options.uischema ?? Generate.uiSchema(this.schema);
        this.readonly = !!event.data.options.readonly;
        this.isSubmitButtonAvailable = event.data.options.isSubmitButtonAvailable;
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
    this.state['data'] = data;
    this.postValidMessage();
  }

  onErrorChange(errors?: any[]) {
    // @ts-ignore
    this.state['hasErrors'] = errors?.length > 0;
    this.postValidMessage();
  }

  postValidMessage() {
    if(!('hasErrors' in this.state) || this.state['hasErrors'] || !('data' in this.state)) {
      return;
    }
    this.port?.postMessage({type: 'data', data: this.state['data']});
    this.state = {};
  }

  submit() {
    // @ts-ignore
    if (this.jsonForms?.previousErrors?.length > 0) {
      return;
    }
    // @ts-ignore
    this.port?.postMessage({type: 'data', data: this.jsonForms?.previousData, submit: true});
  }
}
