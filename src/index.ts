import "./static/index.sass"
import "./static/index.html"

import { MachineUi } from "./gui/interface";

window.addEventListener("DOMContentLoaded", () => {
  const machine_ui : MachineUi = new MachineUi();
});