enum DiagnosticSeverity {
  info,
  warning,
  extension,
  error,
}

interface DiagnosticEntry {
  severity : DiagnosticSeverity;
  near_line : number;
  description : string;
}

class Diagnostics {
  error_state : boolean = false;
  messages : DiagnosticEntry[] = [];

  private raise(severity : DiagnosticSeverity, near_line : number, description : string) {
    this.messages.push({severity: severity, near_line: near_line, description: description});
  }

  info(near_line : number, description : string) {
    this.raise(DiagnosticSeverity.info, near_line, description);
  }

  warning(near_line : number, description : string) {
    this.raise(DiagnosticSeverity.warning, near_line, description);
  }

  extension(near_line : number, description : string, enabled : boolean) {
    this.raise(DiagnosticSeverity.extension, near_line, description);
    if(!enabled) { this.error_state = true; }
  }

  error(near_line : number, description : string) {
    this.raise(DiagnosticSeverity.error, near_line, description);
    this.error_state = true;
  }

  append(other : Diagnostics) : Diagnostics {
    this.messages.push(...other.messages);
    this.error_state = this.error_state || other.error_state;
    return this;
  }
}

export { Diagnostics };