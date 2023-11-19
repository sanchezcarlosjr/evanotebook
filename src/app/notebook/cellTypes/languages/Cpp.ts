import {Language} from "./language";
import {Observable, shareReplay} from "rxjs";
import {Extension} from "@codemirror/state";
import {cpp} from "@codemirror/lang-cpp";
import {autocompletion, CompletionContext, CompletionResult} from "@codemirror/autocomplete"
import {API} from './cpp/api';
function autocompleteCpp(context: CompletionContext): CompletionResult | null {
  let word = context.matchBefore(/\w*/)
  if (!word || word.from == word.to && !context.explicit)
    return null
  return {
    from: word.from,
    options: [
      {label: "include", type: "include", apply: "#include", detail: "include library"},
      {label: "stdio.h", type: "include", apply: "#include <stdio.h>", detail: "include library"},
      {label: "function", type: "function", apply: `int f() {
      return 0;
      }`, detail: "function"},
      {label: "int", type: "function", apply: `int f() {
      return 0;
      }`, detail: "function"},
      {label: "int", type: "variable", apply: "int x=0;",detail:  "create a int variable"},
      {label: "hello world", type: "text", apply: `#include <stdio.h>
int main() {
   printf("Hello World");
   return 0;
}`, detail: "macro"}
    ]
  }
}

export class Cpp extends Language {
  get name() {
    return 'cpp';
  }

  override dispatchShellRun() {
    const api = new API({
      hostWrite: (output: string) => this.write(output),
      hostRead: () => prompt()
    });
    this.clear();
    api.compileLinkRun(this.mostRecentCode).then(console.log).catch(console.error);
    return true;
  }

  override getExtensions(): Extension[] {
    return [cpp(), autocompletion({ override: [autocompleteCpp] })];
  }

}
