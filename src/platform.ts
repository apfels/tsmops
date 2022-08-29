enum Opcode {
  nop     = 0,
  ld_adr  = 10,
  ld_val  = 11,
  st_adr  = 12,
  in_adr  = 20,
  out_adr = 22,
  out_val = 23,
  add_adr = 30,
  add_val = 31,
  sub_adr = 32,
  sub_val = 33,
  mul_adr = 34,
  mul_val = 35,
  div_adr = 36,
  div_val = 37,
  mod_adr = 38,
  mod_val = 39,
  cmp_adr = 40,
  cmp_val = 41,
  jmp     = 50,
  jlt     = 52,
  jeq     = 54,
  jgt     = 56,
  end     = 60,
}

enum Operation {
  nop,
  ld,
  st,
  in,
  out,
  add,
  sub,
  mul,
  div,
  mod,
  cmp,
  jmp,
  jlt,
  jeq,
  jgt,
  end,
}

enum ArgType {
  none,
  adr_src,
  adr_dst,
  tar,
  val,
}

interface Instruction {
  operation: Operation;
  arg_type: ArgType;
}

interface CodedInstruction {
  instruction: Instruction;
  opcode: Opcode;
}

const InstructionSet : CodedInstruction[] = [
  {instruction: {operation: Operation.nop, arg_type: ArgType.none},    opcode: Opcode.nop},
  {instruction: {operation: Operation.ld,  arg_type: ArgType.adr_src}, opcode: Opcode.ld_adr},
  {instruction: {operation: Operation.ld,  arg_type: ArgType.val},     opcode: Opcode.ld_val},
  {instruction: {operation: Operation.st,  arg_type: ArgType.adr_dst}, opcode: Opcode.st_adr},
  {instruction: {operation: Operation.in,  arg_type: ArgType.adr_dst}, opcode: Opcode.in_adr},
  {instruction: {operation: Operation.out, arg_type: ArgType.adr_src}, opcode: Opcode.out_adr},
  {instruction: {operation: Operation.out, arg_type: ArgType.val},     opcode: Opcode.out_val},
  {instruction: {operation: Operation.add, arg_type: ArgType.adr_src}, opcode: Opcode.add_adr},
  {instruction: {operation: Operation.add, arg_type: ArgType.val},     opcode: Opcode.add_val},
  {instruction: {operation: Operation.sub, arg_type: ArgType.adr_src}, opcode: Opcode.sub_adr},
  {instruction: {operation: Operation.sub, arg_type: ArgType.val},     opcode: Opcode.sub_val},
  {instruction: {operation: Operation.mul, arg_type: ArgType.adr_src}, opcode: Opcode.mul_adr},
  {instruction: {operation: Operation.mul, arg_type: ArgType.val},     opcode: Opcode.mul_val},
  {instruction: {operation: Operation.div, arg_type: ArgType.adr_src}, opcode: Opcode.div_adr},
  {instruction: {operation: Operation.div, arg_type: ArgType.val},     opcode: Opcode.div_val},
  {instruction: {operation: Operation.mod, arg_type: ArgType.adr_src}, opcode: Opcode.mod_adr},
  {instruction: {operation: Operation.mod, arg_type: ArgType.val},     opcode: Opcode.mod_val},
  {instruction: {operation: Operation.cmp, arg_type: ArgType.adr_src}, opcode: Opcode.cmp_adr},
  {instruction: {operation: Operation.cmp, arg_type: ArgType.val},     opcode: Opcode.cmp_val},
  {instruction: {operation: Operation.jmp, arg_type: ArgType.tar},     opcode: Opcode.jmp},
  {instruction: {operation: Operation.jlt, arg_type: ArgType.tar},     opcode: Opcode.jlt},
  {instruction: {operation: Operation.jeq, arg_type: ArgType.tar},     opcode: Opcode.jeq},
  {instruction: {operation: Operation.jgt, arg_type: ArgType.tar},     opcode: Opcode.jgt},
  {instruction: {operation: Operation.end, arg_type: ArgType.none},    opcode: Opcode.end},
];

const BuiltinAliases : Map<string,number> = new Map([
  ["a", 64],
  ["b", 65],
  ["c", 66],
  ["d", 67],
  ["e", 68],
  ["f", 69],
  ["g", 70],
  ["h", 71],
]);

enum ExecutionOperator {
  none = 0,
  add,
  sub,
  mul,
  div,
  mod,
  cmp,
}

enum ExecutionComparison {
  none = 0,
  lt,
  eq,
  gt,
}

export const MOPS_MIN_INTEGER = -9999;
export const MOPS_MAX_INTEGER = 9999;

export { Opcode, Operation, ArgType, Instruction, CodedInstruction, InstructionSet, BuiltinAliases, ExecutionOperator, ExecutionComparison };