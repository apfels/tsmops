import { AssemblerSettings, BuildResult } from "./assembler_types";
import { Parse } from "./parse";
import { Compile } from "./compile";
import { Link } from "./link";
import { Diagnostics } from "./diagnostics";

class Assemble {
  result : BuildResult;
  diagnostics : Diagnostics = new Diagnostics();

  constructor(partial_settings : Partial<AssemblerSettings>, code : string) {
    const settings = new AssemblerSettings(partial_settings);
    const parse = new Parse(settings, code);
    const compile = new Compile(settings, parse.parse_tree, parse.first_end);
    const link = new Link(settings, compile.build, parse.first_end);

    this.result = link.build;

    this.diagnostics
      .append(parse.diagnostics)
      .append(compile.diagnostics)
      .append(link.diagnostics);
  }
}

export { Assemble };