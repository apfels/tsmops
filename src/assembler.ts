import { ArgType, BuiltinAliases, CodedInstruction, Instruction, InstructionSet, Opcode, Operation } from "./platform"

enum TokenType {
  white,
  integer,
  address,
  line_num,
  label_def,
  identifier,
}

interface Token {
  token_type: TokenType;
  value: number | string | null;
}

class AssemblerSettings {
  replace_mnemonics : Map<string,string> = new Map();
  integer_min : number = -9999;
  integer_max : number = 9999;
  program_size : number = 64;
  memory_size : number = 72;

  multiple_labels : boolean = false;
  empty_line_jumps : boolean = false;
  jump_address : boolean = false;
  past_end : boolean = false;
  nop : boolean = false;

  constructor(init?: Partial<AssemblerSettings>) {
    Object.assign(this, init);
  }
}

type LineNumber = number;

interface AsmValue {
  value : number;
}
interface AsmLineNumber {
  line_number : number;
}
interface AsmAddress {
  address : number;
}
interface AsmIdentifier {
  identifier: string;
}
type AsmArgument = AsmValue | AsmLineNumber | AsmAddress | AsmIdentifier | null;

class AsmInstruction {
  instruction : Instruction;
  argument : AsmArgument;
  line : number;
}

enum AsmDiagnosticSeverity {
  info,
  extension,
  error,
}

enum AsmDiagnosticType {
  internal,
  invalid_token,
  missing_token,
  superfluous_token,
  ambiguous,
  redefinition,
  flow_past_end,
  code_past_end,
  nop_extension,
  program_too_large,
  invalid_argument,
}

class AsmDiagnostic {
  near_line : number;
  severity : AsmDiagnosticSeverity;
  type: AsmDiagnosticType;
}

class ParseTree {
  instruction_lines : Map<LineNumber,AsmInstruction> = new Map();
  labels : Map<string, LineNumber> = new Map();
}

class LinkEntry {
  from : LineNumber;
  to : LineNumber;
}

class BuildResult {
  has_error : boolean = false;
  diagnostics : AsmDiagnostic[] = [];
  executable : number[] = [];
  line_offsets : Map<LineNumber,number> = new Map();
  link_table : Map<number,LinkEntry> = new Map();
}

class Assembler {
  private readonly settings : AssemblerSettings;
  private parse_tree : ParseTree = new ParseTree();
  private current_line : LineNumber = 0;
  private real_mnemonics : Map<string,Operation> = new Map();
  private first_end : LineNumber = undefined;

  build : BuildResult = new BuildResult();

  constructor(settings : Partial<AssemblerSettings>) {
    this.settings = new AssemblerSettings(settings);
    this.real_mnemonics = new Map(
      Object.entries(Operation)
      .filter(x => typeof(x[1])=="number")
      .map(x => [ this.settings.replace_mnemonics.get(x[0]) ?? x[0], x[1] as Operation ]) );
  }

  error_state() {
    return this.build.has_error;
  }

  raise_info(type: AsmDiagnosticType, near? : number) {
    this.build.diagnostics.push({
      near_line: near ?? this.current_line,
      severity: AsmDiagnosticSeverity.info,
      type: type});
  }
  raise_err(type: AsmDiagnosticType, near? : number) {
    this.build.diagnostics.push({
      near_line: this.current_line,
      severity: near ?? AsmDiagnosticSeverity.error,
      type: type});
    this.build.has_error = true;
  }
  raise_strict(type: AsmDiagnosticType, allow: boolean, near? : number) {
    this.build.diagnostics.push({
      near_line: near ?? this.current_line,
      severity: allow ? AsmDiagnosticSeverity.extension : AsmDiagnosticSeverity.error,
      type: type});
    this.build.has_error = this.build.has_error || !allow; // keep bad state
  }

  private lex_integer(word : string) : Token | null {
    if(!/^[-+]?[0-9]+$/.test(word)) {
      this.raise_err(AsmDiagnosticType.invalid_token);
      return null;
    }
    return {token_type: TokenType.integer, value: parseInt(word)};
  }

  private lex_address(word : string) : Token | null {
    if(!/^[0-9]+$/.test(word)) {
      this.raise_err(AsmDiagnosticType.invalid_token);
      return null;
    }
    return {token_type: TokenType.address, value: parseInt(word)};
  }

  private lex_line_num(word : string) : Token | null {
    if(!/^[0-9]+$/.test(word)) {
      this.raise_err(AsmDiagnosticType.invalid_token);
      return null;
    }
    return {token_type: TokenType.line_num, value: parseInt(word)};
  }

  private lex_label_def(word : string) : Token | null {
    if(!/^[_a-zA-Z][_a-zA-Z0-9]*$/.test(word)) {
      this.raise_err(AsmDiagnosticType.invalid_token);
      return null;
    }
    return {token_type: TokenType.label_def, value: word};
  }

  private lex_identifier(word : string) : Token | null {
    if(!/^[_a-zA-Z][_a-zA-Z0-9]*$/.test(word)) {
      this.raise_err(AsmDiagnosticType.invalid_token);
      return null;
    }
    return {token_type: TokenType.identifier, value: word};
  }

  private lex_word(word : string) : Token | null {
    if(/[-+0-9]/.test(word.charAt(0))) { return this.lex_integer(word); }
    if(word.charAt(0) === "$") { return this.lex_address(word.slice(1)); }
    if(word.charAt(0) === "#") { return this.lex_line_num(word.slice(1)); }
    if(word.charAt(0) === ":") { return this.lex_label_def(word.slice(1)); }
    return this.lex_identifier(word);
  }

  private lex_line(line : string) : Token[] {
    const result : Array<Token|null> = [];
    if(/\s/.test(line.charAt(0))) { result.push({token_type: TokenType.white, value: null}); }
    for(const word of line.split(/\s/).filter(x => x!=="")) {
      result.push(this.lex_word(word));
    }
    return result.filter(x => x);
  }

  push_instruction_and_line(instr : Instruction, arg : AsmArgument) {
    if(instr.operation == Operation.end && this.first_end == null) {
      this.first_end = this.current_line;
    }
    this.parse_tree.instruction_lines.set(
      this.current_line,
      {instruction: instr, argument: arg, line: this.current_line});
  }

  private try_val_instruction(instr : CodedInstruction, arg : Token) : boolean {
    if(arg.token_type == TokenType.integer) {
      this.push_instruction_and_line(instr.instruction, {value: arg.value as number});
      return true;
    }
    return false;
  }

  private try_adr_instruction(instr : CodedInstruction, arg : Token) : boolean {
    if(arg.token_type == TokenType.address) {
      this.push_instruction_and_line(instr.instruction, {address: arg.value as number});
      return true;
    }
    else if(arg.token_type == TokenType.identifier && BuiltinAliases.has((arg.value as string).toLowerCase()) ) {
      this.push_instruction_and_line(instr.instruction, {address: BuiltinAliases.get(arg.value as string)});
      return true;
    }
    return false;
  }

  private try_tar_instruction(instr: CodedInstruction, arg: Token) {
    if(arg.token_type == TokenType.line_num) {
      this.push_instruction_and_line(instr.instruction, {line_number: arg.value as number});
      return true;
    }
    if(arg.token_type == TokenType.identifier) {
      this.push_instruction_and_line(instr.instruction, {identifier: arg.value as string});
      return true;
    }
    if(this.settings.jump_address && arg.token_type == TokenType.address) {
      this.raise_strict(AsmDiagnosticType.invalid_token, true);
      this.push_instruction_and_line(instr.instruction, {address: arg.value as number});
      return true;
    }
    return false;
  }

  private try_unary_instruction(instr : CodedInstruction, arg: Token) : boolean {
    switch(instr.instruction.arg_type) {
      case ArgType.val:
        if(this.try_val_instruction(instr, arg)) {return true;} break;
      case ArgType.adr_src:
      case ArgType.adr_dst:
        if(this.try_adr_instruction(instr, arg)) {return true;} break;
      case ArgType.tar:
        if(this.try_tar_instruction(instr, arg)) {return true;} break;
    }

    return false;
  }

  private interpret_instruction(toks : Token[])
  {
    if(toks.length < 1) { return; }
    if(!(toks[0].token_type == TokenType.identifier) || !this.real_mnemonics.has(toks[0].value as string)) {
      this.raise_err(AsmDiagnosticType.missing_token);
      return;
    }
    const operation = this.real_mnemonics.get(toks[0].value as string);
    const matching = InstructionSet.filter(x => x.instruction.operation == operation);

    const nullary : CodedInstruction = matching.find(x => x.instruction.arg_type == ArgType.none);
    if(toks.length == 1 && nullary) {
      if(nullary.instruction.operation == Operation.nop) {
        this.raise_strict(AsmDiagnosticType.nop_extension, this.settings.nop);
      }
      this.push_instruction_and_line(nullary.instruction, null);
      return;
    }

    const unary : CodedInstruction[] = matching.filter(x => x.instruction.arg_type != ArgType.none);
    if(toks.length == 2 && unary.length > 0) {
      for(const u of unary) {
        if(this.try_unary_instruction(u, toks[1])) { return true; }
      }
    }

    if(toks.length > 2) {
      this.raise_err(AsmDiagnosticType.superfluous_token);
    } else {
      this.raise_err(AsmDiagnosticType.invalid_token);
    }
  }

  private interpret_labels(toks : Token[]) {
    for(const t of toks) {
      if(t.token_type != TokenType.label_def) {
        this.raise_err(AsmDiagnosticType.superfluous_token);
        return;
      }

      const canonical = (t.value as string).toLowerCase();
      if(this.parse_tree.labels.has(canonical)) {
        this.raise_err(AsmDiagnosticType.redefinition);
      }
      this.parse_tree.labels.set(canonical, this.current_line);
    }
  }

  private interpret_line(toks : Token[]) {
    let idx = toks.findIndex(x => x.token_type == TokenType.label_def);
    idx = idx<0? toks.length : idx;

    const instruction = toks.slice(0, idx);
    const labels = toks.slice(idx);

    if(instruction.length == 0 && labels.length > 0) {
      this.raise_strict(AsmDiagnosticType.superfluous_token, this.settings.empty_line_jumps);
    }
    if(labels.length > 1) {
      this.raise_strict(AsmDiagnosticType.superfluous_token, this.settings.multiple_labels);
    }

    this.interpret_instruction(instruction);
    this.interpret_labels(labels);
  }

  private parse(code : string) {
    for(const line of code.split(/\r?\n/)) {
      ++this.current_line;
      const real_line = line.split(";")[0];
      this.interpret_line(this.lex_line(real_line));
    }
  }

  private push_bytes(pi : AsmInstruction, arg? : number) {
    if(this.build.has_error) { return; }
    if(pi.line > this.first_end && !this.settings.past_end) { return; }
  
    const opcode = InstructionSet.find(x => x.instruction == pi.instruction).opcode;

    this.build.executable.push(opcode as number);
    if(arg != null) {
      this.build.executable.push(arg);
    }

    this.build.line_offsets.set(pi.line, this.build.executable.length - ((arg!=null) ? 2 : 1));
  }

  private compile_instruction(pi : AsmInstruction) {
    if(pi.argument == null) {
      this.push_bytes(pi);
    }
    else if("identifier" in pi.argument) {
      this.push_bytes(pi, this.parse_tree.labels.get(pi.argument.identifier));
      this.build.link_table.set(
        this.build.executable.length-1,
        {from: pi.line, to: this.parse_tree.labels.get(pi.argument.identifier)});
    }
    else if("line_number" in pi.argument) {
      this.push_bytes(pi, 0);
      this.build.link_table.set(
        this.build.executable.length-1,
        {from: pi.line, to: pi.argument.line_number});
    }
    else if("address" in pi.argument) {
      this.push_bytes(pi, pi.argument.address);
    }
    else if("value" in pi.argument) {
      this.push_bytes(pi, pi.argument.value);
    }
    else {
      this.raise_err(AsmDiagnosticType.internal);
    }
  }

  private compile() {
    const size_lower_bound = this.parse_tree.instruction_lines.size / 2;
    const last_instruction = [...this.parse_tree.instruction_lines.values()].pop();
    const end = this.parse_tree.instruction_lines.get(this.first_end);

    if(size_lower_bound > this.settings.program_size) {
      this.raise_err(AsmDiagnosticType.program_too_large);
      return;
    }

    for(const lbl of this.parse_tree.labels) {
      if(lbl[1] > last_instruction.line) {
        this.raise_err(AsmDiagnosticType.invalid_token);
      }
    }

    for(const ln of this.parse_tree.instruction_lines.values()) {
      this.compile_instruction(ln);
    }

    if(this.first_end != null && last_instruction.instruction.operation != Operation.end) {
      this.raise_info(AsmDiagnosticType.code_past_end, end.line);
    }

    if(!this.first_end) {
      this.raise_strict(AsmDiagnosticType.flow_past_end, this.settings.past_end);
    }
  }

  private link() {
    for(const e of this.build.link_table.entries()) {
      const target = (this.settings.empty_line_jumps)
        ?  [...this.build.line_offsets.keys()].find(x => x && x >= e[1].to)
        : this.build.line_offsets.get(e[1].to);
      if(target == null) {
        this.raise_err(AsmDiagnosticType.invalid_argument, e[1].from);
      }
      if(target > this.first_end) {
        this.raise_strict(AsmDiagnosticType.flow_past_end, this.settings.past_end);
      }
      this.build.executable[e[0]] = target;
    }
    if(this.build.executable.length > this.settings.program_size) {
      this.raise_err(AsmDiagnosticType.program_too_large);
    }
  }

  assemble(code : string) : BuildResult {
    this.parse(code);
    this.compile();
    this.link();
    return this.build;
  }
}

export { Assembler };