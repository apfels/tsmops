import { Instruction } from "./platform"

export enum TokenType {
  white,
  integer,
  address,
  line_num,
  label_def,
  identifier,
}

export interface Token {
  token_type: TokenType;
  value: number | string | null;
}

export type LineNumber = number;

export interface AsmValue {
  value : number;
}
export interface AsmLineNumber {
  line_number : number;
}
export interface AsmAddress {
  address : number;
}
export interface AsmIdentifier {
  identifier: string;
}
export type AsmArgument = AsmValue | AsmLineNumber | AsmAddress | AsmIdentifier | null;

export class AsmInstruction {
  instruction : Instruction;
  argument : AsmArgument;
  line : number;
}

export class ParseTree {
  instruction_lines : Map<LineNumber,AsmInstruction> = new Map();
  labels : Map<string, LineNumber> = new Map();
}

export class LinkEntry {
  from : LineNumber;
  to : LineNumber;
}

export class BuildResult {
  executable : number[] = [];
  line_offsets : Map<LineNumber,number> = new Map();
  link_table : Map<number,LinkEntry> = new Map();
}

export class AssemblerSettings {
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