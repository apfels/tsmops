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
      const match = [...this.build.line_offsets].find(x => x && x[0] >= e[1].to)
      const target = match ? match[1] : null;
      if(target == null) {
        this.diagnostics.error(e[1].from, "Jump does not target anything.");
      }
      if(!this.build.line_offsets.has(e[1].to)) {
        this.diagnostics.extension(e[1].from, "Empty line jumps are an extension.", this.settings.empty_line_jumps);
      }
      if(e[1].to > this.first_end) {
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