import { BlockTool } from "@editorjs/editorjs";
import {Block} from "./Block";

export abstract class InteractiveBlock implements BlockTool {
  protected shellOptions: any[] = [
    {
      cmd: "Run (Ctrl+Alt+M)",
      listener: () => this.dispatchShellRun(),
      event: "shell.Run",
    },
    {
      cmd: "Stop (Ctrl+Alt+C)",
      listener: () => this.dispatchShellStop(),
      event: "shell.Stop",
    },
    {
      cmd: "Clear",
      listener: () => this.clear(),
      event: "clear",
    }
  ];
  protected constructor(protected block: Block) {}
  renderSettings() {
    const wrapper = document.createElement('div');
    wrapper.classList.add('ce-popover__items');
    this.shellOptions.forEach(tune => {
      let button = document.createElement('div');
      button.classList.add('cdx-settings-button');
      button.innerHTML = tune.cmd;
      wrapper.appendChild(button);
      button.addEventListener('click', () => {
        tune.listener();
      });
    });
    return wrapper;
  }
  save(blockContent: any): any {
    return {
      doc: this.doc,
      output: this.output,
    };
  }
  get doc() {
    return "";
  }
  get output() {
    return "";
  }
  dispatchShellRun() {
  }
  clear() {
  }
  dispatchShellStop() {
    this.clear();
  }
  abstract render(): HTMLElement;
}
