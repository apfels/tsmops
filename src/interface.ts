import { Assemble } from "./assembler/assemble";
import { Link } from "./assembler/link";
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

  private readonly check_extended_syntax = document.querySelector("#check-extended-syntax") as HTMLInputElement;

  private readonly editor_gui : EditorGui = new EditorGui(this.editor_container, () => { this.clear_build(); });
  private readonly memory_gui : MemoryGui = new MemoryGui(this.memory_container, MachineUi.memory_size);

  private current_executable : number[];

  constructor() {
    this.clear_build();

    this.settings_btn.onclick = () => { this.toggle_settings(); };
    this.build_btn.onclick = () => { this.rebuild(); };
    this.run_btn.onclick = () => { this.run_vm(); };
    this.save_btn.onclick = () => { this.download_code(); }

    window.addEventListener("keydown", (e) => {
      if(e.ctrlKey && e.key == "e") { e.preventDefault(); this.toggle_settings(); }
      if(e.ctrlKey && e.key == "Enter") { e.preventDefault(); this.rebuild(); }
      if(e.ctrlKey && e.key == " ") { e.preventDefault(); this.run_vm(); }
      if(e.ctrlKey && e.key == "s") { e.preventDefault(); this.download_code(); }
    });
  }

  download_code() {
    const anchor = document.createElement("a");
    const now = new Date();
    anchor.download =
      `tsmops_${now.getUTCFullYear().toString().padStart(4,'0')}` +
      `_${now.getUTCMonth().toString().padStart(2,'0')}` +
      `_${now.getUTCDate().toString().padStart(2,'0')}` +
      `_${now.getUTCHours().toString().padStart(2,'0')}` +
      `_${now.getUTCMinutes().toString().padStart(2,'0')}.asm`;
    anchor.href = `data:text/plain,${encodeURIComponent(this.editor_gui.value())}`;
    anchor.click();
  }

  clear_build() {
    this.run_btn.disabled = true;
    this.current_executable = undefined;
    this.memory_gui.reset(MachineUi.memory_size);
  }

  rebuild() {
    const ext_syntax : boolean = this.check_extended_syntax.checked;
    const code = this.editor_gui.value();
    const asm = new Assemble({
      nop:              ext_syntax,
      empty_line_jumps: ext_syntax,
      jump_address:     ext_syntax,
      multiple_labels:  ext_syntax,
      past_end:         ext_syntax,
    }, code);
    this.editor_gui.update_hints(asm.diagnostics);
    if(!asm.diagnostics.error_state) {
      this.memory_gui.reset(MachineUi.memory_size);
      this.memory_gui.assign(asm.result.executable);
      this.current_executable = asm.result.executable;
      this.run_btn.disabled = false;
    }
    else {
      this.clear_build();
    }
  };

  async run_vm() {
    if(this.current_executable == null) { return; }
    const memory = this.current_executable.concat(Array(MachineUi.memory_size-this.current_executable.length).fill(0));
    const vm = new MopsMachine(memory, {
      input() {
        const value = parseInt(prompt("input", "0"));
        console.log("input", value);
        return value;
      },
      output(value) {
        alert("output: " + value);
        console.log("output", value);
      }
    });
    for(const ev of vm.run()) {
      console.log(format_object(ev));
      await new Promise(r => setTimeout(r, 500));
    }
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