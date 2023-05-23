import {Language} from "./language";
import {Extension} from "@codemirror/state";
import {html} from "@codemirror/lang-html";

export class Html extends Language {
  get name() {
    return 'html';
  }
  override dispatchShellRun() {
    super.dispatchShellRun();
    this.rewrite(this.mostRecentCode);
    super.dispatchShellStop();
    return true;
  }
  rewrite(input: string) {
    this.cell.children[1].innerHTML = input;
    this.execHtml(this.cell.children[1] as HTMLElement);
  }
  // Remove repeated code
  private execHtml(html: HTMLElement) {
    let elements: any = [];
    try {
      elements = html.getElementsByTagName('script');
    } catch (e) {
    }
    for (let i = 0; i < elements.length; i++) {
      const scriptElement = elements.item(i) as any;
      const clonedElement = document.createElement("script");
      Array.from(scriptElement.attributes).forEach((attribute: any) => {
        clonedElement.setAttribute(attribute.name, attribute.value);
      });
      clonedElement.text = scriptElement.text;
      scriptElement.parentNode.replaceChild(clonedElement, scriptElement);
    }
  }
  override getExtensions(): Extension[] {
    return [html()];
  }
}
