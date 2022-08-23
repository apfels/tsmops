import "./index.sass"
import "./index.html"

window.addEventListener("DOMContentLoaded", () => {
  const settings_btn : HTMLInputElement = document.querySelector("#settings-btn");
  const settings_pane = document.querySelector("#settings-pane");
  settings_btn.onclick = () => {
    if(settings_pane.classList.contains("settings-hidden")) {
      settings_pane.classList.add("settings-shown");
      settings_pane.classList.remove("settings-hidden");
    }
    else {
      settings_pane.classList.add("settings-hidden");
      settings_pane.classList.remove("settings-shown");
    }
  }
});