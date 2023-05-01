import {Observable} from "rxjs";

export interface Language {
  dispatchShellRun(): boolean;
  loadEditor(cell: HTMLElement): void;
  dispatchShellStop(): boolean;
  docChanges$(): Observable<string>;
  outputChanges$(): Observable<void>;
  destroyEditor(): void;
  clear(): void;
  stop(): void;
  get name(): string;
}
