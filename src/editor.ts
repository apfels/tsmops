import { Diagnostics, DiagnosticSeverity } from "./diagnostics";

function editor_setup() {
  const editor_area = document.querySelector("#editor-area") as HTMLElement;
  const editor_lines = document.querySelector("#editor-lines");
  const editor_hints = document.querySelector("#editor-hints");

  const update_lines = () => {
    editor_hints.textContent = "";
    editor_lines.textContent = "";

    editor_area.style.height = "0px";
    
    const line_height = parseFloat(window.getComputedStyle(editor_area).lineHeight);
    const full_height = editor_area.scrollHeight;
    const lines = Math.floor(full_height / line_height);

    editor_area.style.height = "calc(" + String(full_height) + "px - 1rem)";

    editor_lines.textContent = (() => {
      let result = "";
      for(const n of [...Array(lines).keys()]) {
        result += String(n+1).padStart(4, '0') + '\n';
      }
      return result;
    })();
  };

  update_lines();
  editor_area.addEventListener("input", update_lines);
}

function editor_hints(diagnostics : Diagnostics) {
  const editor_hints = document.querySelector("#editor-hints");
  const editor_area = document.querySelector("#editor-area");
  const line_height = parseFloat(window.getComputedStyle(editor_area).lineHeight);

  editor_hints.textContent = "";

  const filled_lines : Set<number> = new Set();

  for(const dia of diagnostics.messages) {
    if(!filled_lines.has(dia.near_line)) {
      filled_lines.add(dia.near_line);
      console.log(filled_lines);
      const entry = document.createElement("span");
      entry.title = dia.description;
      entry.textContent = (() => {
        switch(dia.severity) {
          case DiagnosticSeverity.error: return '!';
          case DiagnosticSeverity.extension: return '+';
          case DiagnosticSeverity.warning: return '!';
          case DiagnosticSeverity.info: return 'i';
          default: return "?";
        }
      })();
      entry.classList.add((() => {
        switch(dia.severity) {
          case DiagnosticSeverity.error: return 'err';
          case DiagnosticSeverity.extension: return 'ext';
          case DiagnosticSeverity.warning: return 'wrn';
          case DiagnosticSeverity.info: return 'inf';
          default: return "inf";
        }
      })());
      entry.style.top = String(line_height * (dia.near_line-1)) + "px";

      editor_hints.appendChild(entry);
    }
  }
}

export { editor_setup, editor_hints };