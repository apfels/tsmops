import { Assemble } from "../assembler/assemble";
import { AssemblerSettings, BuildResult } from "../assembler/assembler_types";
import { MopsMachine } from "../vm/mops_machine";
import { EditorGui } from "./editor_gui";
import { MemoryGui } from "./memory_gui";
import * as Event from "../vm/mops_event";
import { ArgType, ExecutionComparison, ExecutionOperator, Operation } from "../platform";
import { MopsByte } from "../vm/mops_byte";

class MachineGuiElements {
  readonly vm_view = document.querySelector("#vm-view");

  readonly editor_main = document.querySelector("#editor-pane").querySelector("main");
  readonly memory_main = document.querySelector("#memory-pane").querySelector("main");

  readonly settings_pane = document.querySelector("#settings-pane") as HTMLElement;

  readonly reg = {
    ip     : document.querySelector("#reg-ip")     as HTMLInputElement,
    ir_lo  : document.querySelector("#reg-ir-lo")  as HTMLInputElement,
    ir_hi  : document.querySelector("#reg-ir-hi")  as HTMLInputElement,
    decode : document.querySelector("#reg-decode") as HTMLInputElement,
    acc    : document.querySelector("#reg-acc")    as HTMLInputElement,
    opr    : document.querySelector("#reg-opr")    as HTMLInputElement,
    opd    : document.querySelector("#reg-opd")    as HTMLInputElement,
    cmp    : document.querySelector("#reg-cmp")    as HTMLInputElement,
    res    : document.querySelector("#reg-res")    as HTMLInputElement,
    in     : document.querySelector("#reg-in")     as HTMLInputElement,
    out    : document.querySelector("#reg-out")    as HTMLInputElement,
  };

  named_reg(name : string) : HTMLInputElement {
    switch(name) {
      case "ip" : return this.reg.ip;
      case "ir_lo" : return this.reg.ir_lo;
      case "ir_hi" : return this.reg.ir_hi;
      case "decode" : return this.reg.decode;
      case "acc" : return this.reg.acc;
      case "opr" : return this.reg.opr;
      case "opd" : return this.reg.opd;
      case "cmp" : return this.reg.cmp;
      case "res" : return this.reg.res;
      case "in" : return this.reg.in;
      case "out" : return this.reg.out;
    }
  }

  readonly queue_area   = document.querySelector("#input-queue-area")    as HTMLTextAreaElement;
  readonly history_area = document.querySelector("#output-history-area") as HTMLTextAreaElement;

  readonly setting = {
    check_extended_syntax : document.querySelector("#check-extended-syntax") as HTMLInputElement,
    range_anim_time       : document.querySelector("#range-anim-time")       as HTMLInputElement,
  };

  readonly button = {
    settings : document.querySelector("#settings-btn") as HTMLInputElement,
    build    : document.querySelector("#build-btn")    as HTMLInputElement,
    run      : document.querySelector("#run-btn")      as HTMLInputElement,
    end      : document.querySelector("#end-btn")      as HTMLInputElement,
    save     : document.querySelector("#save-btn")     as HTMLInputElement,
  }
}

class MachineGuiState {
  settings_open = false;
  running = false;
  precompile_timeout_id : ReturnType<typeof setTimeout>;
  current_build : BuildResult = undefined;
  current_run : AsyncGenerator<Event.MopsEvent>;
}

function date_string() {
  const now = new Date();
  return `${now.getUTCFullYear().toString().padStart(4,'0')}` +
  `_${now.getUTCMonth().toString().padStart(2,'0')}` +
  `_${now.getUTCDate().toString().padStart(2,'0')}` +
  `_${now.getUTCHours().toString().padStart(2,'0')}` +
  `_${now.getUTCMinutes().toString().padStart(2,'0')}`;
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

function limit_textarea(element : HTMLTextAreaElement) {
  const lines = element.value.split("\n");
  element.value =
    lines
    .map(x => (x.match(/[+-]?[0-9]{0,4}/)??[])[0])
    .filter((x,i) => { return x != "" || i == lines.length-1 })
    .join("\n");
}

const fetch_anim = [
  {backgroundColor: "#6f6"},
  {backgroundColor: "#6f6"},
  {backgroundColor: "initial"},
];
const read_anim = [
  {backgroundColor: "#66f"},
  {backgroundColor: "#66f"},
  {backgroundColor: "initial"},
];
const write_anim = [
  {backgroundColor: "#f66"},
  {backgroundColor: "#f66"},
  {backgroundColor: "initial"},
];
const halt_anim = [
  {filter: "opacity(0.5) brightness(0.5)"},
  {filter: "opacity(0.5) brightness(0.5)"},
  {filter: "opacity(1) brightness(1)"},
];
const anim_settings = {
  duration: 1500,
  fill: "none" as FillMode,
};

class MachineGui {
  static readonly memory_size = 72;
  static readonly program_size = 64;
  static readonly precompile_delay = 250;

  private readonly dom = new MachineGuiElements();
  private readonly state = new MachineGuiState();
  private readonly editor_gui : EditorGui;
  private readonly memory_gui : MemoryGui;

  constructor() {
    this.editor_gui = new EditorGui(this.dom.editor_main, () => { this.update_action() });
    this.memory_gui = new MemoryGui(this.dom.memory_main, MachineGui.memory_size);

    this.clear_build();
    this.clear_regs();
    this.close_settings();
    this.dom.button.run.disabled = true;
    this.dom.button.end.disabled = true;

    this.dom.queue_area.oninput = () => { limit_textarea(this.dom.queue_area) };

    this.initialize_buttons();
  }

  initialize_buttons() {
    this.dom.button.settings.onclick = () => { this.settings_action(); };
    this.dom.button.build.onclick    = () => { this.build_action(); };
    this.dom.button.run.onclick      = () => { this.run_action(); };
    this.dom.button.end.onclick      = () => { this.end_action(); };
    this.dom.button.save.onclick     = () => { this.save_action(); };

    window.addEventListener("keydown", (ev) => {
      if(ev.ctrlKey) {
        if(ev.key == "e")         { ev.preventDefault(); this.dom.button.settings.click(); }
        if(ev.key == "Enter")     { ev.preventDefault(); this.dom.button.build.click(); }
        if(ev.key == " ")         { ev.preventDefault(); this.dom.button.run.click(); }
        if(ev.key == "Backspace") { ev.preventDefault(); this.dom.button.end.click(); }
        if(ev.key == "s")         { ev.preventDefault(); this.dom.button.save.click(); }
        if(ev.key == ".")         { ev.preventDefault(); this.step_action(); }
        if(ev.key == "ArrowLeft") { ev.preventDefault(); this.decrement_speed(); }
        if(ev.key == "ArrowRight"){ ev.preventDefault(); this.increment_speed(); }
      }
    });
  }


  settings_action() {
    if(this.state.settings_open) { this.close_settings(); }
    else                         { this.open_settings(); }
  }

  build_action() {
    if(this.state.running) { return; }
    const success = this.make_build();
    if(success) {
      this.dom.button.build.disabled = true;
      this.dom.button.run.disabled = false;
    }
  }

  async run_action() {
    this.disable_editor();
    this.dom.button.build.disabled = true;
    this.dom.button.end.disabled = false;
    if(this.state.running) {
      this.dom.button.run.classList.add("run");
      this.dom.button.run.classList.remove("pause");
      this.state.running = false;
    }
    else {
      this.dom.button.run.classList.add("pause");
      this.dom.button.run.classList.remove("run");
      this.start_if_not_running();
      this.state.running = true;
      this.run_until_paused(() => { this.end_action() });
    }
  }

  end_action() {
    this.dom.button.end.disabled = true;
    this.dom.button.build.disabled = false;
    this.dom.button.run.classList.add("run");
    this.dom.button.run.classList.remove("pause");
    this.state.running = false;
    this.state.current_run = undefined;
    this.enable_editor();
  }

  save_action() {
    const anchor = document.createElement("a");
    anchor.download = "tsmpos_" + date_string() + ".asm";
    anchor.href = `data:text/plain,${encodeURIComponent(this.editor_gui.value())}`;
    anchor.click();
  }

  step_action() {
    if(this.state.running || !this.state.current_build) { return; }
    if(this.start_if_not_running()) {
      this.state.current_run.next();
    }
    this.state.current_run.next().then((e) => {if(e.done) {this.state.current_run = undefined;}});
  }

  update_action() {
    this.end_action();
    this.dom.button.run.disabled = true;
    this.time_precompile(MachineGui.precompile_delay);
    this.clear_build();
    this.clear_regs();
  }


  start_if_not_running() {
    if(!this.state.current_run) {
      this.memory_gui.reset(MachineGui.memory_size);
      this.clear_regs();
      this.memory_gui.assign(this.state.current_build.executable);
      this.state.current_run = this.run_machine();
      return true;
    }
    return false;
  }


  enable_editor() {
    this.dom.editor_main.querySelector("textarea").disabled = false;
  }

  disable_editor() {
    this.dom.editor_main.querySelector("textarea").disabled = true;
  }

  open_settings() {
    this.state.settings_open = true;
    this.dom.settings_pane.classList.add("settings-shown");
    this.dom.settings_pane.classList.remove("settings-hidden");
    const inputs = this.dom.settings_pane.querySelectorAll("input");
    for(const i of inputs) { i.disabled = false; }
  }

  close_settings() {
    this.state.settings_open = false;
    this.dom.settings_pane.classList.add("settings-hidden");
    this.dom.settings_pane.classList.remove("settings-shown");
    const inputs = this.dom.settings_pane.querySelectorAll("input");
    for(const i of inputs) { i.disabled = true; }
    this.time_precompile(MachineGui.precompile_delay);
  }

  get_settings() : Partial<AssemblerSettings> {
    return {
      memory_size : MachineGui.memory_size,
      program_size : MachineGui.program_size,
      empty_line_jumps : this.dom.setting.check_extended_syntax.checked,
      jump_address : this.dom.setting.check_extended_syntax.checked,
      multiple_labels : this.dom.setting.check_extended_syntax.checked,
      nop : this.dom.setting.check_extended_syntax.checked,
      past_end : this.dom.setting.check_extended_syntax.checked,
    };
  }

  increment_speed() {
    this.dom.setting.range_anim_time.value = Math.min(
      parseInt(this.dom.setting.range_anim_time.value)+1,
      parseInt(this.dom.setting.range_anim_time.max)
    ).toString();
  }

  decrement_speed() {
    this.dom.setting.range_anim_time.value = Math.max(
      parseInt(this.dom.setting.range_anim_time.value)-1,
      parseInt(this.dom.setting.range_anim_time.min)
    ).toString();
  }


  make_build() : boolean {
    const asm = new Assemble(this.get_settings(), this.editor_gui.value());
    if(asm.diagnostics.error_state) { return false; }
    this.state.current_build = asm.result;
    this.memory_gui.assign(asm.result.executable);
    return true;
  }

  clear_build() {
    this.state.current_build = undefined;
    this.memory_gui.reset(MachineGui.memory_size);
  }

  clear_regs() {
    for(const reg of Object.entries(this.dom.reg)) {
      if(reg[0] == "opr" || reg[0] == "cmp" || reg[0] == "decode") {
        reg[1].value = "";
      }
      else {
        reg[1].value = "0000";
      }
    }
    this.dom.history_area.value = "";
  }

  time_precompile(ms : number) {
    clearTimeout(this.state.precompile_timeout_id);
    this.state.precompile_timeout_id = setTimeout(() => {
      const asm = new Assemble(this.get_settings(), this.editor_gui.value());
      this.editor_gui.update_hints(asm.diagnostics);
    }, ms);
  }

  async run_until_paused(when_done : () => void) {
    const proxy = (gen) => {return{
      next() { return gen.next(); },
      [Symbol.asyncIterator]() { return this; },
      [Symbol.iterator]() { return this; },
    }};

    for await(const v of proxy(this.state.current_run)) {
      if(!this.state.running) { return; }
    }
    when_done();
  }

  async *run_machine() {
    const padded_memory = this.state.current_build.executable.concat(
      Array(MachineGui.memory_size - this.state.current_build.executable.length)
      .fill(0));

    const machine = new MopsMachine(padded_memory, {
      input : () => {
        const lines = this.dom.queue_area.value.split("\n");
        const user_value = lines[0] ?
          lines[0] :
          prompt("Nothing queued. Next input: ", "0");
        if(Object.is(NaN, parseInt(user_value))) {
          alert("Not valid: " + user_value + ". Using 0.");
        }

        const value = parseInt(user_value) || 0;

        this.dom.queue_area.value = lines.splice(1).join("\n");
        this.dom.queue_area.animate(read_anim, anim_settings);
        this.dom.reg.in.value = MopsByte.format(value);
        console.log("input", value);
        return value;
      },
      output : (value) => {
        if(this.dom.history_area.value != "") {
          this.dom.history_area.value += "\n";
        }
        this.dom.history_area.value += MopsByte.format(value);
        this.dom.history_area.animate(write_anim, anim_settings);
        console.log("output", value);
      }
    }).run();

    for(const ev of machine) {
      if(!this.state.running) { yield; }

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
        const reg_element = this.dom.named_reg(ev.target);
        reg_element.animate(read_anim, anim_settings);
      }
      else if(ev instanceof Event.RegisterWrite) {
        const reg_element = this.dom.named_reg(ev.target);
        reg_element.animate(write_anim, anim_settings);
        if(ev.target == "opr") {
          reg_element.value = nice_operator_string(ev.value);
        }
        else if(ev.target == "cmp") {
          reg_element.value = nice_comparison_string(ev.value);
        }
        else {
          if(ev.target == "res") {
            this.dom.reg.acc.value = MopsByte.format(ev.value);
            this.dom.reg.acc.animate(write_anim, anim_settings);
          }
          reg_element.value = MopsByte.format(ev.value);
        }
      }
      else if(ev instanceof Event.Decode) {
        const op_name = Operation[ev.instruction.instruction.operation];
        const arg_prefix = (() => {
          switch(ev.instruction.instruction.arg_type) {
            case ArgType.adr_dst: return "→ $"
            case ArgType.adr_src: return "← $";
            case ArgType.tar:     return "→ $";
            default:              return "";
          }
        })();
        const arg_value = ( ev.instruction.instruction.arg_type == ArgType.none ? "" : ev.argument.toString() );
        
        this.dom.reg.decode.value = op_name + " " + arg_prefix + arg_value;
        this.dom.reg.decode.animate(write_anim, anim_settings);
      }
      else if(ev instanceof Event.FailState) {
        alert("Machine has entered fail state: " + ev.message);
      }
      else if(ev instanceof Event.Halt) {
        this.dom.vm_view.animate(halt_anim, anim_settings);
        break;
      }

      const anim_time = parseInt(this.dom.setting.range_anim_time.max) - parseInt(this.dom.setting.range_anim_time.value) ?? 0.01;
      await new Promise(r => setTimeout(r, 100*anim_time));
    }
  }
}

export { MachineGui };