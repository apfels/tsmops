import { Assemble } from "./assembler/assemble";
import { Link } from "./assembler/link";
import { EditorGui } from "./editor";
import { MemoryGui } from "./memory";
import { MopsMachine } from "./vm/vm";
import * as Event from "./vm/event";
import { ArgType, ExecutionComparison, ExecutionOperator, Operation } from "./platform";

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

function nice_operator_string(opr : number) {
  switch(opr) {
    case ExecutionOperator.add: return "+";
    case ExecutionOperator.sub: return "-";
    case ExecutionOperator.mul: return "×";
    case ExecutionOperator.div: return "÷";
    case ExecutionOperator.mod: return "%";
    case ExecutionOperator.cmp: return "<=>";
    default: return "";
  }
}

function nice_comparison_string(cmp : number) {
  switch(cmp) {
    case ExecutionComparison.eq: return "=";
    case ExecutionComparison.lt: return "<";
    case ExecutionComparison.gt: return ">";
    default: return "?";
  }
}

const fetch_anim = [
  {backgroundColor: "#6f6"},
  {backgroundColor: "initial"},
];
const read_anim = [
  {backgroundColor: "#66f"},
  {backgroundColor: "initial"},
];
const write_anim = [
  {backgroundColor: "#f66"},
  {backgroundColor: "initial"},
];
const halt_anim = [
  {filter: "opacity(0.5) brightness(0.5)"},
  {filter: "opacity(1) brightness(1)"},
];
const anim_settings = {
  duration: 500,
  fill: "none" as FillMode,
};

class MachineUi {
  static memory_size : number = 72;

  private readonly vm_view : HTMLElement = document.querySelector("#vm-view");

  private readonly settings_btn : HTMLInputElement = document.querySelector("#settings-btn");
  private readonly build_btn : HTMLInputElement = document.querySelector("#build-btn");
  private readonly run_btn : HTMLInputElement = document.querySelector("#run-btn");
  private readonly end_btn : HTMLInputElement = document.querySelector("#end-btn");
  private readonly save_btn : HTMLInputElement = document.querySelector("#save-btn");

  private readonly settings_pane = document.querySelector("#settings-pane") as HTMLElement;
  private readonly editor_container = document.querySelector("#editor-pane").querySelector("main") as HTMLTextAreaElement;
  private readonly memory_container = document.querySelector("#memory-pane").querySelector("main");

  private readonly reg_ip = document.querySelector("#reg-ip") as HTMLInputElement;
  private readonly reg_ir_lo = document.querySelector("#reg-ir-lo") as HTMLInputElement;
  private readonly reg_ir_hi = document.querySelector("#reg-ir-hi") as HTMLInputElement;
  private readonly reg_decode = document.querySelector("#reg-decode") as HTMLInputElement;

  private readonly reg_acc = document.querySelector("#reg-acc") as HTMLInputElement;
  private readonly reg_opr = document.querySelector("#reg-opr") as HTMLInputElement;
  private readonly reg_opd = document.querySelector("#reg-opd") as HTMLInputElement;
  private readonly reg_cmp = document.querySelector("#reg-cmp") as HTMLInputElement;
  private readonly reg_res = document.querySelector("#reg-res") as HTMLInputElement;

  private readonly reg_in = document.querySelector("#reg-in") as HTMLInputElement;
  private readonly reg_out = document.querySelector("#reg-out") as HTMLInputElement;

  private readonly input_queue_area = document.querySelector("#input-queue-area") as HTMLTextAreaElement;
  private readonly output_history_area = document.querySelector("#output-history-area") as HTMLTextAreaElement;

  private readonly check_extended_syntax = document.querySelector("#check-extended-syntax") as HTMLInputElement;
  private readonly range_anim_time = document.querySelector("#range-anim-time") as HTMLInputElement;

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

  reg_element_from_name(name : string) {
    switch(name) {
      case "ip" : return this.reg_ip;
      case "ir_lo" : return this.reg_ir_lo;
      case "ir_hi" : return this.reg_ir_hi;
      case "acc" : return this.reg_acc;
      case "opr" : return this.reg_opr;
      case "opd" : return this.reg_opd;
      case "cmp" : return this.reg_cmp;
      case "res" : return this.reg_res;
      case "in" : return this.reg_in;
      case "out" : return this.reg_out;
    }
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
    this.output_history_area.value = "";
    this.input_queue_area.disabled = true;
    const memory = this.current_executable.concat(Array(MachineUi.memory_size-this.current_executable.length).fill(0));
    const vm = new MopsMachine(memory, {
      input: () => {
        const lines = this.input_queue_area.value.split("\n");
        const value = lines[0] ? parseInt(lines[0]) : parseInt(prompt("Next Input", "0"));
        this.input_queue_area.value = lines.splice(1).join("\n");
        this.input_queue_area.animate(read_anim, anim_settings);
        this.reg_in.value = value.toString();
        console.log("input", value);
        return value;
      },
      output: (value) => {
        if(this.output_history_area.value != "") {
          this.output_history_area.value += "\n";
        }
        this.output_history_area.value += value.toString();
        this.output_history_area.animate(write_anim, anim_settings);
        console.log("output", value);
      }
    });
    for(const ev of vm.run()) {
      console.log(format_object(ev));

      if(ev instanceof Event.Fetch) {
        this.memory_gui.element_at(ev.address).animate(fetch_anim, anim_settings);
        this.memory_gui.element_at(ev.address+1)?.animate(fetch_anim, anim_settings);
      }
      else if(ev instanceof Event.MemoryRead) {
        this.memory_gui.element_at(ev.address).animate(read_anim, anim_settings);
      }
      else if(ev instanceof Event.MemoryWrite) {
        this.memory_gui.element_at(ev.address).animate(write_anim, anim_settings);
        this.memory_gui.assign([ev.value], ev.address);
      }
      else if(ev instanceof Event.RegisterRead) {
        const reg_element = this.reg_element_from_name(ev.target);
        reg_element.animate(read_anim, anim_settings);
      }
      else if(ev instanceof Event.RegisterWrite) {
        const reg_element = this.reg_element_from_name(ev.target);
        reg_element.animate(write_anim, anim_settings);
        if(ev.target == "opr") {
          reg_element.value = nice_operator_string(ev.value);
        }
        else {
          if(ev.target == "res") {
            this.reg_acc.value = ev.value.toString();
            this.reg_acc.animate(write_anim, anim_settings);
          }
          reg_element.value = ev.value.toString();
        }
      }
      else if(ev instanceof Event.Decode) {
        const op_name = Operation[ev.instruction.instruction.operation];
        const arg_prefix = (() => {
          switch(ev.instruction.instruction.arg_type) {
            case ArgType.adr_dst:
            case ArgType.adr_src: return "$";
            case ArgType.tar:     return "#$";
            default:              return "";
          }
        })();
        const arg_value = ( ev.instruction.instruction.arg_type == ArgType.none ? "" : ev.argument.toString() );
        
        this.reg_decode.value = op_name + " " + arg_prefix + arg_value;
        this.reg_decode.animate(write_anim, anim_settings);
      }
      else if(ev instanceof Event.FailState) {
        alert("Machine has entered fail state: " + ev.message);
      }
      else if(ev instanceof Event.Halt) {
        this.vm_view.animate(halt_anim, anim_settings);
        break;
      }

      const anim_time = parseInt(this.range_anim_time.max) - parseInt(this.range_anim_time.value) ?? 0.01;
      await new Promise(r => setTimeout(r, 100*anim_time));
    }

    this.input_queue_area.disabled = false;
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