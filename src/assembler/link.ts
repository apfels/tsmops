import { AssemblerSettings, BuildResult, LineNumber } from "./assembler_types";
import { Diagnostics } from "./diagnostics";

class Link {
  private readonly settings : AssemblerSettings;
  private readonly first_end : LineNumber = undefined;

  build : BuildResult = new BuildResult();
  diagnostics : Diagnostics = new Diagnostics();

  constructor(settings : AssemblerSettings, build : BuildResult, first_end : number) {
    this.settings = settings;
    this.first_end = first_end;
    this.build = build;
    this.link();
  }

  private link() {
    for(const e of this.build.link_table.entries()) {
      const target = (this.settings.empty_line_jumps)
        ?  [...this.build.line_offsets.keys()].find(x => x && x >= e[1].to)
        : this.build.line_offsets.get(e[1].to);
      if(target == null) {
        this.diagnostics.error(e[1].from, "Jump does not target any instruction.");
      }
      if(target > this.first_end) {
        this.diagnostics.extension(e[1].from, "Jump past end instruction is an extension.", this.settings.past_end);
      }
      this.build.executable[e[0]] = target;
    }
    if(this.build.executable.length > this.settings.program_size) {
      this.diagnostics.error(1, "Program is too large.");
    }
  }
}

export { Link };