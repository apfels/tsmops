import { MOPS_MAX_INTEGER, MOPS_MIN_INTEGER } from "../platform";

class MopsByteError extends Error {
  constructor(arg : string) {
    super(arg);
  }
}

class MopsByte {
  private _value: number;

  constructor(value : number) {
    this.value = value;
  }

  public get value(): number {
    return this._value;
  }
  public set value(value: number) {
    if(value == null) { throw "Null Byte!"; }
    const int_value = Math.trunc(value); 
    if(int_value < MOPS_MIN_INTEGER || int_value > MOPS_MAX_INTEGER) { throw new MopsByteError("Out of Range!"); }
    this._value = value;
  }

  private static readonly max_digits = MOPS_MAX_INTEGER.toString().length;

  static format(n : MopsByte | number) {
    const val = n instanceof Object ? n.value : n;
    const abs = Math.abs(val);

    return ((val==abs) ? "" : "-") + (abs.toString().padStart(MopsByte.max_digits, '0'));
  }
}

export { MopsByte, MopsByteError }