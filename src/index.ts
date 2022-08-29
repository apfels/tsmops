import "./static/index.sass"
import "./static/index.html"

import { Assemble } from "./assemble";
import { EditorGui } from "./editor";
import {MemoryGui} from "./memory"

window.addEventListener("DOMContentLoaded", () => {
  const settings_btn : HTMLInputElement = document.querySelector("#settings-btn");
  const build_btn : HTMLInputElement = document.querySelector("#build-btn");
  const settings_pane = document.querySelector("#settings-pane") as HTMLElement;
  const editor_container = document.querySelector("#editor-pane").querySelector("main") as HTMLTextAreaElement;
  const memory_container = document.querySelector("#memory-pane").querySelector("main");

  const editor_gui = new EditorGui(editor_container);
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

  const rebuild = () => {
    const code = editor_gui.value();
    const asm = new Assemble({ replace_mnemonics: new Map([["div","dd"]]) }, code);
    editor_gui.update_hints(asm.diagnostics);
    if(!asm.diagnostics.error_state) {
      memory_gui.initialize(72);
      memory_gui.assign(asm.result.executable);
    }
    else {
      memory_gui.initialize(72);
    }
  };

  build_btn.onclick = rebuild;
  document.addEventListener("keypress", (e) => {
    if(e.key == "Enter" && e.ctrlKey) { rebuild(); }
  });

  editor_gui.initialize();
});