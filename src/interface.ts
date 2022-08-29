import { Assemble } from "./assembler/assemble";
import { EditorGui } from "./editor";
import { MemoryGui } from "./memory";
import { MopsMachine } from "./vm/vm";

function format_object(o : any) {
  let str = "";
  if(o instanceof Object) {
    str += o.constructor.name != "Object" ? (o.constructor.name + " {") : "{";
    let ps = [];
    for(const [k,v] of Object.entries(o)) {
      ps.push(k + ":" + format_object(v));
    }
    str += ps.join(", ") + "}";
  }
  else {
    str += String(o);
  }
  return str;
}

class MachineUi {
  static memory_size : number = 72;

  private readonly settings_btn : HTMLInputElement = document.querySelector("#settings-btn");
  private readonly build_btn : HTMLInputElement = document.querySelector("#build-btn");
  private readonly run_btn : HTMLInputElement = document.querySelector("#run-btn");
  private readonly end_btn : HTMLInputElement = document.querySelector("#end-btn");
  private readonly save_btn : HTMLInputElement = document.querySelector("#save-btn");

  private readonly settings_pane = document.querySelector("#settings-pane") as HTMLElement;
  private readonly editor_container = document.querySelector("#editor-pane").querySelector("main") as HTMLTextAreaElement;
  private readonly memory_container = document.querySelector("#memory-pane").querySelector("main");

  private readonly editor_gui : EditorGui = new EditorGui(this.editor_container, this.clear_build);
  private readonly memory_gui : MemoryGui = new MemoryGui(this.memory_container, MachineUi.memory_size);

  private current_executable : number[];

  constructor() {
    this.clear_build();

    this.settings_btn.onclick = () => { this.toggle_settings(); };
    this.build_btn.onclick = () => { this.rebuild(); };
    this.run_btn.onclick = () => { this.run_vm(); };

    document.addEventListener("keypress", (e) => {
      if(e.ctrlKey && e.key == "q") { this.toggle_settings(); }
      if(e.ctrlKey && e.key == "Enter") { this.rebuild(); }
      if(e.ctrlKey && e.key == " ") { this.rebuild(); }
    });
  }

  clear_build() {
    this.run_btn.disabled = true;
    this.current_executable = undefined;
  }

  rebuild() {
    const code = this.editor_gui.value();
    const asm = new Assemble({ replace_mnemonics: new Map([["div","dd"]]) }, code);
    this.editor_gui.update_hints(asm.diagnostics);
    if(!asm.diagnostics.error_state) {
      this.memory_gui.reset(MachineUi.memory_size);
      this.memory_gui.assign(asm.result.executable);
      this.current_executable = asm.result.executable;
      this.run_btn.disabled = false;
    }
    else {
      this.memory_gui.reset(MachineUi.memory_size);
    }
  };

  run_vm() {
    const memory = this.current_executable.concat(Array(MachineUi.memory_size-this.current_executable.length).fill(0));
    const vm = new MopsMachine(memory, {
      event(ev) {
        console.log(format_object(ev));
        
      },
      input() {
        const value = parseInt(prompt("input", "0"));
        console.log("input", value);
        return value;
      },
      output(value) {
        alert("output: " + value);
        console.log("output", value);
      },
      halt() {
        console.log("halt");
      },
    });
    vm.run();
  }

  toggle_settings() {
    if(this.settings_pane.classList.contains("settings-hidden")) {
      this.settings_pane.classList.add("settings-shown");
      this.settings_pane.classList.remove("settings-hidden");
    }
    else {
      this.settings_pane.classList.add("settings-hidden");
      this.settings_pane.classList.remove("settings-shown");
    }
  };
}

export { MachineUi };