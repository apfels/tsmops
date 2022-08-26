import { AsmInstruction, AssemblerSettings, BuildResult, ParseTree } from "./assembler_types";
import { Diagnostics } from "./diagnostics";
import { InstructionSet, Operation } from "./platform";

class Compile {
  private readonly settings : AssemblerSettings;
  private readonly parse_tree : ParseTree = new ParseTree();
  private readonly first_end : number;

  build : BuildResult = new BuildResult();
  diagnostics : Diagnostics = new Diagnostics();

  constructor(settings : AssemblerSettings, parse_tree : ParseTree, first_end : number) {
    this.settings = settings;
    this.parse_tree = parse_tree;
    this.first_end = first_end;
    this.compile();
  }

  private push_bytes(pi : AsmInstruction, arg? : number) {
    if(this.diagnostics.error_state) { return; }
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
      this.diagnostics.error(pi.line, "Internal Error: unhandled argument type.")
    }
  }

  private compile() {
    const size_lower_bound = this.parse_tree.instruction_lines.size / 2;
    const last_instruction = [...this.parse_tree.instruction_lines.values()].pop();
    const end = this.parse_tree.instruction_lines.get(this.first_end);

    if(size_lower_bound > this.settings.program_size) {
      this.diagnostics.error(last_instruction.line, "Program too large.");
      return;
    }

    for(const lbl of this.parse_tree.labels) {
      if(lbl[1] > last_instruction.line) {
        this.diagnostics.error(lbl[1], "Label does not belong to any instruction.");
      }
    }

    for(const ln of this.parse_tree.instruction_lines.values()) {
      this.compile_instruction(ln);
    }

    if(this.first_end != null && last_instruction.instruction.operation != Operation.end) {
      this.diagnostics.info(this.first_end, "Code following an end instruction.")
    }

    if(!this.first_end) {
      this.diagnostics.extension(last_instruction?.line ?? 1, "Omitted end instruction is an extension.", this.settings.past_end);
    }
  }
}

export { Compile };