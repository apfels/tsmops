import { CodedInstruction, ExecutionComparison } from "../platform";

export class Fetch {
  address : number;
  lo : number;
  hi? : number;

  constructor(from : Required<Fetch>) {
    Object.assign(this, from);
  }
}

export class MemoryRead {
  address : number;
  value : number;

  constructor(from : Required<MemoryRead>) {
    Object.assign(this, from);
  }
}

export class MemoryWrite {
  address : number;
  value : number;

  constructor(from : Required<MemoryWrite>) {
    Object.assign(this, from);
  }
}

export type RegisterName =
  "ip" |
  "ir_lo" |
  "ir_hi" |
  "acc" |
  "opd" |
  "opr" |
  "res" |
  "cmp" |
  "in" |
  "out";

export class RegisterRead {
  target : RegisterName;
  value : number;

  constructor(from : Required<RegisterRead>) {
    Object.assign(this, from);
  }
}

export class RegisterWrite {
  target : RegisterName;
  value : number;

  constructor(from : Required<RegisterWrite>) {
    Object.assign(this, from);
  }
}

export class Decode {
  instruction : CodedInstruction;
  argument : number;

  constructor(from : Required<Decode>) {
    Object.assign(this, from);
  }
}

export class FailState {
  message : string;

  constructor(from : Required<FailState>) {
    Object.assign(this, from);
  }
}

export class Halt {}

export type MopsEvent = Fetch | MemoryRead | MemoryWrite | RegisterRead | RegisterWrite | Decode | FailState | Halt;