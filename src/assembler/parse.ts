import { AsmArgument, AssemblerSettings, LineNumber, ParseTree, Token, TokenType } from "./assembler_types";
import { Diagnostics } from "./diagnostics";
import { ArgType, BuiltinAliases, CodedInstruction, Instruction, InstructionSet, MOPS_MAX_INTEGER, MOPS_MIN_INTEGER, Operation } from "../platform";

class Parse {
  private readonly settings : AssemblerSettings;
  private current_line : LineNumber = 0;
  private real_mnemonics : Map<string,Operation> = new Map();

  parse_tree : ParseTree = new ParseTree();
  first_end : LineNumber = undefined;
  diagnostics : Diagnostics = new Diagnostics();

  constructor(settings : AssemblerSettings, code : string) {
    this.settings = settings;
    this.real_mnemonics = new Map(
      Object.entries(Operation)
      .filter(x => typeof(x[1])=="number")
      .map(x => [ this.settings.replace_mnemonics.get(x[0]) ?? x[0], x[1] as Operation ]) );
    this.parse(code);
  }

  private check_range(word : string) {
    const val = parseInt(word);
    if(val < MOPS_MIN_INTEGER) {
      this.diagnostics.error(this.current_line, "Number too low to represent.");
    }
    else if(val > MOPS_MAX_INTEGER) {
      this.diagnostics.error(this.current_line, "Number too high to represent.");
    }
    return val;
  }

  private lex_integer(word : string) : Token | null {
    if(!/^[-+]?[0-9]+$/.test(word)) {
      this.diagnostics.error(this.current_line, "Integer is invalid.");
      return null;
    }

    return {token_type: TokenType.integer, value: this.check_range(word)};
  }

  private lex_address(word : string) : Token | null {
    if(!/^[0-9]+$/.test(word)) {
      this.diagnostics.error(this.current_line, "Address is invalid.");
      return null;
    }
    return {token_type: TokenType.address, value: this.check_range(word)};
  }

  private lex_line_num(word : string) : Token | null {
    if(!/^[0-9]+$/.test(word)) {
      this.diagnostics.error(this.current_line, "Line reference is invalid.");
      return null;
    }
    return {token_type: TokenType.line_num, value: this.check_range(word)};
  }

  private lex_label_def(word : string) : Token | null {
    if(!/^[_a-zA-Z][_a-zA-Z0-9]*$/.test(word)) {
      this.diagnostics.error(this.current_line, "Label definition is invalid.");
      return null;
    }
    return {token_type: TokenType.label_def, value: word};
  }

  private lex_identifier(word : string) : Token | null {
    if(!/^[_a-zA-Z][_a-zA-Z0-9]*$/.test(word)) {
      this.diagnostics.error(this.current_line, "Identifier is invalid.");
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
      this.diagnostics.extension(this.current_line, "Address targets are an extension.", true);
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
      this.diagnostics.error(this.current_line, "First token is not a mnemonic.");
      return;
    }
    const operation = this.real_mnemonics.get(toks[0].value as string);
    const matching = InstructionSet.filter(x => x.instruction.operation == operation);

    const nullary : CodedInstruction = matching.find(x => x.instruction.arg_type == ArgType.none);
    if(toks.length == 1 && nullary) {
      if(nullary.instruction.operation == Operation.nop) {
        this.diagnostics.extension(this.current_line, "NOP is an extension.", this.settings.nop);
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
      this.diagnostics.error(this.current_line, "Superfluous token found.");
    }
    else if(toks.length == 1 && !nullary) {
      this.diagnostics.error(this.current_line, "Missing argument.");
    }
    else {
      this.diagnostics.error(this.current_line, "Wrong token found.")
    }
  }

  private interpret_labels(toks : Token[]) {
    for(const t of toks) {
      if(t.token_type != TokenType.label_def) {
        this.diagnostics.error(this.current_line, "Different token after label definition.")
        return;
      }

      const canonical = (t.value as string).toLowerCase();
      if(this.parse_tree.labels.has(canonical)) {
        this.diagnostics.error(this.current_line, "Redefinition of label.");
      }
      this.parse_tree.labels.set(canonical, this.current_line);
    }
  }

  private interpret_line(toks : Token[]) {
    let idx = toks.findIndex(x => x.token_type == TokenType.label_def);
    idx = idx<0? toks.length : idx;

    const instruction = toks.slice(0, idx).filter(x => x.token_type != TokenType.white);
    const labels = toks.slice(idx);

    if(instruction.length > 0 && toks[0].token_type == TokenType.white) {
      this.diagnostics.extension(this.current_line, "Whitespace before mnemonics is an extension.", this.settings.initial_white);
    }
    if(instruction.length == 0 && labels.length > 0) {
      this.diagnostics.extension(this.current_line, "Labels on empty lines are an extension.", this.settings.empty_line_jumps);
    }
    if(labels.length > 1) {
      this.diagnostics.extension(this.current_line, "Multiple labels per line are an extension.", this.settings.multiple_labels);
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
}

export { Parse };