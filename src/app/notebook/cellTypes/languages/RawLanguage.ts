import {Language} from "./language";

export class RawLanguage extends Language {
  constructor(code: string, cell: HTMLElement) {
    super(code, undefined, cell);
  }
  get name() {
    return 'raw';
  }

  override dispatchShellRun(): boolean {
    return true;
  }

  override stop() {}

  override dispatchShellStop() {
    return true;
  }

  override clear() {
  }

}
