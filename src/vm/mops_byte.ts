import { MOPS_MAX_INTEGER, MOPS_MIN_INTEGER } from "../platform";

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
    if(int_value < MOPS_MIN_INTEGER || int_value > MOPS_MAX_INTEGER) { throw "Out of Range!"; }
    this._value = value;
  }
}

export { MopsByte }