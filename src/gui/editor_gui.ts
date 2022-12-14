import { Diagnostics, DiagnosticSeverity } from "../assembler/diagnostics";



class EditorGui {
  private text : HTMLTextAreaElement;
  private hints : HTMLElement;
  private lines : HTMLElement;
  private line_height : number;

  constructor(container : HTMLElement, onupdate : () => void) {
    this.text = container.querySelector("textarea");
    this.hints = container.querySelector(".hints");
    this.lines = container.querySelector(".lines");
    this.line_height = parseFloat(window.getComputedStyle(this.text).lineHeight);

    this.update();
    this.text.addEventListener("input", () => { this.update(); });
    this.text.addEventListener("input", () => { onupdate(); });
  }

  private update() {
    this.hints.textContent = "";
    this.lines.textContent = "";

    this.text.style.height = "0px";
    
    
    const full_height = this.text.scrollHeight;
    const lines = Math.floor(full_height / this.line_height);

    this.text.style.height = "calc(" + String(full_height) + "px - 1rem)";

    this.lines.textContent = (() => {
      let result = "";
      for(const n of [...Array(lines).keys()]) {
        result += String(n+1).padStart(4, '0') + '\n';
      }
      return result;
    })();
  }

  value() : string {
    return this.text.value;
  }
  
  update_hints(diagnostics : Diagnostics) {
    this.hints.textContent = "";
  
    const filled_lines : Set<number> = new Set();
  
    for(const dia of diagnostics.messages) {
      if(!filled_lines.has(dia.near_line)) {
        filled_lines.add(dia.near_line);
        const entry = document.createElement("span");
        entry.title = dia.description;
        entry.textContent = (() => {
          switch(dia.severity) {
            case DiagnosticSeverity.error: return '!';
            case DiagnosticSeverity.disabled_ext: return '+';
            case DiagnosticSeverity.warning: return 'i';
            case DiagnosticSeverity.info: return 'i';
            default: return "?";
          }
        })();
        entry.classList.add((() => {
          switch(dia.severity) {
            case DiagnosticSeverity.error: return 'err';
            case DiagnosticSeverity.disabled_ext: return 'ext';
            case DiagnosticSeverity.warning: return 'wrn';
            case DiagnosticSeverity.info: return 'inf';
            default: return "inf";
          }
        })());
        entry.style.top = String(this.line_height * (dia.near_line-1)) + "px";
  
        this.hints.appendChild(entry);
      }
    }
  }
}

export { EditorGui };