import { ArgType, CodedInstruction, ExecutionComparison, ExecutionOperator, InstructionSet, Operation } from "../platform";
import { MopsByte } from "./mops_byte";
import * as Event from "./mops_event";

class MopsMemory {
  values : MopsByte[] = [];
}

class MopsControl {
  ip : MopsByte = new MopsByte(0);
  ir_lo : MopsByte = new MopsByte(0);
  ir_hi : MopsByte = new MopsByte(0);

  decode : CodedInstruction = undefined;
  arg_cache : MopsByte;
}

class MopsExecution {
  acc : MopsByte = new MopsByte(0);
  opd : MopsByte = new MopsByte(0);
  opr : MopsByte = new MopsByte(0);
  cmp : MopsByte = new MopsByte(0);
}

interface CallbackHandler {
  input : () => number;
  output : (value : number) => void;
}

class MopsMachine {
  private memory : MopsMemory = new MopsMemory();
  private control : MopsControl = new MopsControl();
  private execution : MopsExecution = new MopsExecution();
  private callbacks : CallbackHandler;
  private halted : boolean = false;

  constructor(values : number[], callbacks : CallbackHandler) {
    const len = new MopsByte(this.memory.values.length).value; // throw if too large
    this.assign_memory(values);
    this.callbacks = callbacks;
  }

  private assign_memory(values : number[], start : number = 0) {
    for(const [i, v] of values.entries()) {
      if(i+start < 0 || i+start > this.memory.values.length) { throw "Invalid Address!"; }
      this.memory.values[i+start] = new MopsByte(v);
    }
  }

  read_memory(i : number) : number {
    if(i < 0 || i > this.memory.values.length) { throw "Invalid Address!"; }
    return this.memory.values[i].value;
  }

  private *fetch() {
    const addr = this.control.ip;
    const lo = this.memory.values[addr.value];
    const hi = this.memory.values[addr.value+1] ?? new MopsByte(0);
    yield new Event.Fetch({
      address:addr.value,
      lo:lo.value,
      hi:hi.value
    });

    this.control.ir_lo = lo;
    yield new Event.RegisterWrite({
      target:"ir_lo",
      value:lo.value
    });

    this.control.ir_hi = hi;
    yield new Event.RegisterWrite({
      target:"ir_hi",
      value:hi.value
    });
  }

  private *decode() {
    const instr = InstructionSet.find(x => x.opcode == this.control.ir_lo.value);
    this.control.decode = instr;
    yield new Event.Decode({
      instruction:instr,
      argument:this.control.ir_hi.value
    });

    this.control.ip = new MopsByte( this.control.ip.value + ((instr.instruction.arg_type==ArgType.none) ? 1 : 2) );
    yield new Event.RegisterWrite({
      target:"ip",
      value:this.control.ip.value
    });
  }

  private *fetch_operand() {
    if(this.control.decode.instruction.arg_type == ArgType.adr_src) {
      const addr = this.control.ir_hi;
      const val = this.memory.values[addr.value];
      yield new Event.MemoryRead({
        address:addr.value,
        value:val.value
      });

      this.control.arg_cache = val;
    }
    else if(this.control.decode.instruction.arg_type != ArgType.none) {
      this.control.arg_cache = this.control.ir_hi;
    }
  }

  private *exec_ld(val : MopsByte) {
    this.execution.acc = val;
    yield new Event.RegisterWrite({
      target:"acc",
      value:val.value
    });
  }

  private *exec_st(adr : MopsByte) {
    const val = this.execution.acc;
    yield new Event.RegisterRead({
      target:"acc",
      value:this.execution.acc.value
    });

    this.memory.values[adr.value] = val;
    yield new Event.MemoryWrite({
      address:adr.value,
      value:val.value
    });
  }

  private *exec_in(adr : MopsByte) {
    const val = this.callbacks.input();
    yield new Event.RegisterRead({
      target:"in",
      value:val
    });

    this.memory.values[adr.value] = new MopsByte(val);
    yield new Event.MemoryWrite({
      address:adr.value,
      value:val
    });
  }

  private *exec_out(val : MopsByte) {
    this.callbacks.output(val.value);
    yield new Event.RegisterWrite({
      target:"out",
      value:val.value
    });
  }

  private *exec_math(operator : ExecutionOperator, operand : MopsByte) {
    const opr = new MopsByte(operator);
    this.execution.opr = opr;
    yield new Event.RegisterWrite({
      target:"opr",
      value:operator
    });

    this.execution.opd = operand;
    yield new Event.RegisterWrite({
      target:"opd",
      value:operand.value
    });

    const result = new MopsByte((() => {
      switch(operator) {
        case ExecutionOperator.add: return this.execution.acc.value + operand.value;
        case ExecutionOperator.sub: return this.execution.acc.value - operand.value;
        case ExecutionOperator.mul: return this.execution.acc.value * operand.value;
        case ExecutionOperator.div: return this.execution.acc.value / operand.value;
        case ExecutionOperator.mod: return this.execution.acc.value % operand.value;
      }
    })());
    this.execution.acc = result;
    yield new Event.RegisterWrite({
      target:"res",
      value:result.value
    });
  }

  private *exec_cmp(operand : MopsByte) {
    this.execution.opr = new MopsByte(ExecutionOperator.cmp);
    yield new Event.RegisterWrite({
      target:"opr",
      value:ExecutionOperator.cmp
    });

    this.execution.opd = operand;

    yield new Event.RegisterWrite({
      target:"opd",
      value:operand.value
    });

    const cmp = new MopsByte((() => {
      if(this.execution.acc.value < this.execution.opd.value) { return ExecutionComparison.lt; }
      if(this.execution.acc.value == this.execution.opd.value) { return ExecutionComparison.eq; }
      if(this.execution.acc.value > this.execution.opd.value) { return ExecutionComparison.gt; }
      console.log("ERR!!");
      return undefined;
    })());

    this.execution.cmp = cmp;
    yield new Event.RegisterWrite({
      target:"cmp",
      value:cmp.value
    });
  }

  private *exec_jmp(tar : MopsByte) {
    this.control.ip = tar;
    yield new Event.RegisterWrite({
      target:"ip",
      value:tar.value
    });
  }

  private *exec_branch(condition : ExecutionComparison, tar : MopsByte) {
    const cmp = this.execution.cmp.value;
    yield new Event.RegisterRead({
      target:"cmp",
      value:cmp
    });

    if(cmp == condition) {
      yield* this.exec_jmp(tar);
    }
  }

  private *execute() {
    const arg = this.control.arg_cache;
    const op = this.control.decode.instruction.operation;

    switch(op) {
      case Operation.nop:
        break;
      case Operation.ld:
        yield* this.exec_ld(arg);
        break;
      case Operation.st:
        yield* this.exec_st(arg);
        break;
      case Operation.in:
        yield* this.exec_in(arg);
        break;
      case Operation.out:
        yield* this.exec_out(arg);
        break;
      case Operation.add:
        yield* this.exec_math(ExecutionOperator.add, arg);
        break;
      case Operation.sub:
        yield* this.exec_math(ExecutionOperator.sub, arg);
        break;
      case Operation.mul:
        yield* this.exec_math(ExecutionOperator.mul, arg);
        break;
      case Operation.div:
        yield* this.exec_math(ExecutionOperator.div, arg);
        break;
      case Operation.mod:
        yield* this.exec_math(ExecutionOperator.mod, arg);
        break;
      case Operation.cmp:
        yield* this.exec_cmp(arg);
        break;
      case Operation.jmp:
        yield* this.exec_jmp(arg);
        break;
      case Operation.jlt:
        yield* this.exec_branch(ExecutionComparison.lt, arg);
        break;
      case Operation.jeq:
        yield* this.exec_branch(ExecutionComparison.eq, arg);
        break;
      case Operation.jgt:
        yield* this.exec_branch(ExecutionComparison.gt, arg);
        break;
      case Operation.end:
        this.halted = true;
        break;
    }
  }

  private *cycle() {
    yield* this.fetch();
    yield* this.decode();
    yield* this.fetch_operand();
    yield* this.execute();
  }

  *run() {
    try {
      this.halted = false;
      while(!this.halted) {
        yield* this.cycle();
      }
    } catch(e) {
      yield new Event.FailState({message:"Runtime Error!"});
      throw e;
    }
    yield new Event.Halt();
  }
}

export { MopsMachine };