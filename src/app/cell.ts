import {interval, map, Subscription} from "rxjs";
// @ts-ignore
import EditorjsCodeflask from '@calumk/editorjs-codeflask';

export class Cell extends EditorjsCodeflask {
  readonly id: string = "";
  private cell: HTMLElement | undefined;
  private subscription: Subscription | undefined;
  private data: any;

  constructor(obj: any) {
    super(obj);
    this.id = obj.block.id;
    // @ts-ignore
    this.readOnly = obj.data.readOnly;
    // @ts-ignore
    this.data.language = (obj.data.language === undefined) ? obj.config.language : obj.data.language;

    // @ts-ignore
    this.data.code = (obj.data.code === undefined) ? "" : obj.data.code;

    // @ts-ignore
    this.data.output = (obj.data.output === undefined) ? "" : obj.data.output;

  }

  save(obj: any) {
    return {
      ...super.save(obj),
      //@ts-ignore
      output: this.cell.children[1].innerHTML
    };
  }

  run() {
    // @ts-ignore
    this.cell.children[0].children[0].children[2].classList.add('cdx-loader');
  }

  stop() {
    this.subscription?.unsubscribe();
    //@ts-ignore
    this.cell.children[0].children[0].children[2].classList.remove('cdx-loader');
    for (let i=(this.cell?.children.length ?? 0)-1; i > 1; i--) {
      this.cell?.removeChild(this.cell?.children[i]);
    }
  }

  clear() {
    //@ts-ignore
    this.cell.children[1].innerHTML = "";
  }

  write(text: string) {
    //@ts-ignore
    this.cell.children[1].innerHTML += text;
  }

  println(text: any) {
    this.write(text + "\n");
  }

  prompt(placeholder: string) {
    const input = document.createElement('input');
    input.classList.add('prompt', 'cdx-input');
    this.cell?.appendChild(input);
    input.placeholder = placeholder;
    input.type = "text";
    input.addEventListener('keydown', (event) => {
      if (event.key === "Enter") {
        window.dispatchEvent(new CustomEvent('shell.Prompt', {
          bubbles: true, detail: {
            payload: {
              // @ts-ignore
              response: input.value,
              threadId: this.id
            }
          }
        }));
        this.cell?.removeChild(input);
      }
    });
  }

  dispatchShellRun() {
    this.clear();
    this.dispatchShellStop();
    window.dispatchEvent(new CustomEvent('shell.Run', {
      bubbles: true, detail: {
        payload: {
          // @ts-ignore
          code: this.data.editorInstance.code,
          threadId: this.id
        }
      }
    }));
    this.run();
  }

  dispatchShellStop() {
    window.dispatchEvent(new CustomEvent('shell.Stop', {
      bubbles: true, detail: {
        payload: {
          threadId: this.id
        }
      }
    }));
  }

  render() {
    const element = super.render();
    this.cell = document.createElement('section');
    this.cell.classList.add('cell');
    const editor = document.createElement('section');
    editor.classList.add('editor');
    editor.appendChild(element);
    this.cell.appendChild(editor);
    element.append(document.createElement('div'));
    element.children[2].classList.add('progress');
    const output = document.createElement('samp');
    output.classList.add('output');
    this.cell.appendChild(output);
    //@ts-ignore
    output.innerHTML = this.data.output;

    this.cell.addEventListener('keydown', (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "m" && keyboardEvent.ctrlKey && keyboardEvent.altKey) {
        keyboardEvent.preventDefault();
        this.dispatchShellRun();
      }
      if (keyboardEvent.key === "c" && keyboardEvent.ctrlKey && keyboardEvent.altKey) {
        keyboardEvent.preventDefault();
        this.dispatchShellStop();
      }
    }, false);
    return this.cell;
  }

  renderSettings() {
    const shellOptions: [{ listener: (button: HTMLElement, cell: Cell, tune: { event: string }) => void; cmd: string; event: string }, { listener: (button: HTMLElement, cell: Cell, tune: { event: string }) => void; cmd: string; event: string }, { listener: (button: HTMLElement, cell: Cell, tune: { event: string }) => void; cmd: string; event: string }] = [
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
    const wrapper = document.createElement('div');
    wrapper.classList.add('ce-popover__items');
    shellOptions.forEach(tune => {
      let button = document.createElement('div');
      button.classList.add('ce-popover__item');
      button.innerHTML = tune.cmd;
      wrapper.appendChild(button);
      button.addEventListener('click', () => {
        tune.listener(button, this, tune);
      });
    });
    return wrapper;
  }

  static get toolbox() {
    return {
      icon: EditorjsCodeflask.toolbox.icon,
      title: 'Code'
    };
  }
}
