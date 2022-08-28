import "./static/index.sass"
import "./static/index.html"

import { Assemble } from "./assemble";
import { editor_hints, editor_setup } from "./editor";
import {MemoryGui} from "./memory"

window.addEventListener("DOMContentLoaded", () => {
  const settings_btn : HTMLInputElement = document.querySelector("#settings-btn");
  const build_btn : HTMLInputElement = document.querySelector("#build-btn");

  const settings_pane = document.querySelector("#settings-pane");
  const editor_area = document.querySelector("#editor-area") as HTMLTextAreaElement;

  const memory_container = document.querySelector("#memory-pane").querySelector("main");
  const memory_gui = new MemoryGui(memory_container);
  memory_gui.initialize(72);

  settings_btn.onclick = () => {
    if(settings_pane.classList.contains("settings-hidden")) {
      settings_pane.classList.add("settings-shown");
      settings_pane.classList.remove("settings-hidden");
    }
    else {
      settings_pane.classList.add("settings-hidden");
      settings_pane.classList.remove("settings-shown");
    }
  };

  build_btn.onclick = () => {
    const code = editor_area.value;
    const asm = new Assemble({ replace_mnemonics: new Map([["div","dd"]]) }, code);
    editor_hints(asm.diagnostics);
    if(!asm.diagnostics.error_state) {
      memory_gui.initialize(72);
      memory_gui.assign(asm.result.executable);
    }
  };

  editor_setup();
});