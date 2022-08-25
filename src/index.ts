import "./static/index.sass"
import "./static/index.html"

import { Assemble } from "./assemble";

window.addEventListener("DOMContentLoaded", () => {
  const settings_btn : HTMLInputElement = document.querySelector("#settings-btn");
  const build_btn : HTMLInputElement = document.querySelector("#build-btn");

  const settings_pane = document.querySelector("#settings-pane");
  const editor_pane = document.querySelector("#editor-pane");

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
    const code = editor_pane.querySelector("main").innerText;
    const asm = new Assemble({ replace_mnemonics: new Map([["div","dd"]]) }, code);
    console.log(asm.result.executable);
  };
});