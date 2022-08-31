import "./static/index.sass"
import "./static/index.html"

import { MachineGui } from "./gui/machine_gui";

window.addEventListener("DOMContentLoaded", () => {
  const machine_gui : MachineGui = new MachineGui();
});