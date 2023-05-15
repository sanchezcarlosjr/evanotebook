import {AfterViewInit, Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {JsonFormsAngularService, JsonFormsControl} from "@jsonforms/angular";
import {RawLanguage} from "../../cellTypes/languages/RawLanguage";
import {Subscription} from "rxjs";

@Component({
  selector: 'app-code',
  templateUrl: './code.component.html',
  styleUrls: ['./code.component.css']
})
export class CodeComponent extends JsonFormsControl  implements AfterViewInit {
  @ViewChild('code') code: ElementRef<HTMLDivElement> | undefined;
  private subscriptionEditor: Subscription | undefined;
  constructor(service: JsonFormsAngularService) {
    super(service);
  }

  override getEventValue = (event: any) => event;

  ngAfterViewInit() {
    // @ts-ignore
    const rawLanguage = new RawLanguage(this.data, this.code.nativeElement);
    this.subscriptionEditor = rawLanguage.docChanges$().subscribe((code) => {
      this.onChange(code);
    });
    rawLanguage.loadEditor();
  }

  override ngOnDestroy() {
    this.subscriptionEditor?.unsubscribe();
  }

}
