import {Language} from "./language";

export class Raw extends Language {
  get name() {
    return 'raw';
  }

  override dispatchShellRun() {
    window.dispatchEvent(new CustomEvent('shell.RawRun', {
      bubbles: true, detail: {
        payload: {
          code: this.mostRecentCode,
          threadId: this.editorJsTool.block?.id
        }
      }
    }));
    return true;
  }


}
