import { MathfieldElement } from 'mathlive';
import {InteractiveBlock} from "./InteractiveBlock";
import {ComputeEngine} from "@cortex-js/compute-engine";
import {Block} from "./Block";
MathfieldElement.fontsDirectory = "/assets/fonts/";
MathfieldElement.soundsDirectory = "/assets/sounds/";

export class MathBlock extends InteractiveBlock {
  private readonly inputMathFieldElement: MathfieldElement;
  private computeEngine: ComputeEngine;
  private outputMathField: MathfieldElement | undefined;
  protected override shellOptions: any[] = [
    {
      cmd: "Evaluate (Ctrl+Alt+m)",
      listener: () => this.dispatchShellRun(),
      event: "shell.math.Evaluate"
    },
    {
      cmd: "Simplify (Ctrl+Alt+i)",
      listener: () => this.simplify(),
      event: "shell.math.Simplify",
    },
    {
      cmd: "Approximate (Ctrl+Alt+n)",
      listener: () => this.dispatchNumericApproximation(),
      event: "shell.math.N",
    },
    {
      cmd: "Clear",
      listener: () => this.clear(),
      event: "clear",
    }
  ];
  constructor(block: Block) {
    super(block);
    this.computeEngine = new ComputeEngine();
    this.inputMathFieldElement = new MathfieldElement();
    this.inputMathFieldElement.readonly = !!block?.readOnly;
    if (!block?.readOnly) {
      this.outputMathField = new MathfieldElement();
      this.outputMathField.readonly  = true;
      this.outputMathField.classList.add('output-math-field', 'hide');
    }
  }
  render(){
    const mathBlock = document.createElement('section');
    mathBlock.appendChild(this.inputMathFieldElement);
    this.inputMathFieldElement.value = this.block.data.doc ?? "";
    if (!this.block.readOnly) {
      this.loadEvents();
      mathBlock.appendChild(this.outputMathField as MathfieldElement);
      this.changeOutputMathField(this.block.data.output ?? "");
    }
    return mathBlock;
  }

  private loadEvents() {
    this.inputMathFieldElement.addEventListener('keydown', (event) => {
      if (event.key === "Enter" || event.ctrlKey && event.key === "v" || event.key === "Backspace") {
        event.stopPropagation();
      }
    });
    this.inputMathFieldElement.addEventListener('paste', (event) => {
      event.stopPropagation();
    });
    this.inputMathFieldElement.addEventListener('input',(ev) => {
      this.block.block?.dispatchChange();
    });
    this.inputMathFieldElement.addEventListener('keydown', (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "m" && keyboardEvent.ctrlKey && keyboardEvent.altKey) {
        keyboardEvent.preventDefault();
        this.dispatchShellRun();
      }
      if (keyboardEvent.key === "i" && keyboardEvent.ctrlKey && keyboardEvent.altKey) {
        keyboardEvent.preventDefault();
        this.simplify();
      }
      if (keyboardEvent.key === "n" && keyboardEvent.ctrlKey && keyboardEvent.altKey) {
        keyboardEvent.preventDefault();
        this.dispatchNumericApproximation();
      }
    }, false);
  }

  static get isReadOnlySupported(): boolean {
    return true;
  }

  override get doc() {
    return this.inputMathFieldElement?.value ?? "";
  }

  override get output() {
    return this.outputMathField?.value ?? "";
  }

  // https://github.com/mdgaziur/EditorJS-LaTeX/blob/master/src/index.js
  static get toolbox() {
    return {
      title: "Math",
      //icon: '<svg width="17" height="15" viewBox="0 0 336 276" xmlns="http://www.w3.org/2000/svg"><path d="M291 150V79c0-19-15-34-34-34H79c-19 0-34 15-34 34v42l67-44 81 72 56-29 42 30zm0 52l-43-30-56 30-81-67-66 39v23c0 19 15 34 34 34h178c17 0 31-13 34-29zM79 0h178c44 0 79 35 79 79v118c0 44-35 79-79 79H79c-44 0-79-35-79-79V79C0 35 35 0 79 0z"/></svg>'
      icon: '<svg id="Layer_1" enable-background="new 0 0 506.1 506.1" height="512" viewBox="0 0 506.1 506.1" width="512" xmlns="http://www.w3.org/2000/svg"><path d="m489.609 0h-473.118c-9.108 0-16.491 7.383-16.491 16.491v473.118c0 9.107 7.383 16.491 16.491 16.491h473.119c9.107 0 16.49-7.383 16.49-16.491v-473.118c0-9.108-7.383-16.491-16.491-16.491zm-16.49 473.118h-440.138v-440.137h440.138z"/><path d="m367.278 240.136v-62.051c0-8.836-7.163-16-16-16s-16 7.164-16 16v147.377c0 15.024 18.993 21.77 28.457 10.03 34.691 18.107 77.146-6.988 77.146-46.831.001-37.966-39-63.416-73.603-48.525zm20.802 69.327c-11.47 0-20.802-9.332-20.802-20.802s9.332-20.802 20.802-20.802 20.802 9.332 20.802 20.802-9.332 20.802-20.802 20.802z"/><path d="m112.397 200.262h-14.014c-8.836 0-16 7.164-16 16s7.164 16 16 16h14.014c8.291 0 15.037 6.746 15.037 15.037v4.998c-30.589-10.389-62.216 12.536-62.216 44.609 0 34.402 35.954 57.331 67.13 42.629 10.128 9.747 27.086 2.537 27.086-11.521v-80.715c0-25.936-21.101-47.037-47.037-47.037zm-.071 111.752c-8.331 0-15.108-6.777-15.108-15.108s6.777-15.108 15.108-15.108 15.108 6.777 15.108 15.108-6.778 15.108-15.108 15.108z"/><path d="m287.786 243.114c-6.248-6.248-16.379-6.249-22.627 0l-18.11 18.11-18.11-18.11c-6.249-6.249-16.379-6.249-22.627 0-6.249 6.249-6.249 16.379 0 22.627l18.11 18.11-18.11 18.11c-6.248 6.248-6.248 16.379 0 22.627s16.378 6.249 22.627 0l18.11-18.11 18.11 18.11c6.246 6.248 16.377 6.249 22.627 0 6.249-6.249 6.249-16.379 0-22.627l-18.11-18.11 18.11-18.11c6.249-6.248 6.249-16.379 0-22.627z"/></svg>'
    };
  }

  changeOutputMathField(value: string) {
    // @ts-ignore
    this.outputMathField.value = value;
    // @ts-ignore
    this.outputMathField.classList[value === "" ? "add" : "remove"]("hide");
  }

  override dispatchShellRun() {
    this.changeOutputMathField(this.computeEngine.parse(this.inputMathFieldElement?.value).evaluate().latex ?? "");
  }

  override clear() {
    this.changeOutputMathField("");
  }

  private simplify() {
    this.changeOutputMathField(this.computeEngine.parse(this.inputMathFieldElement?.value).simplify().latex ?? "");
  }

  private dispatchNumericApproximation() {
    this.changeOutputMathField(this.computeEngine.parse(this.inputMathFieldElement?.value).N().latex ?? "");
  }
}
