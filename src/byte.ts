class MopsByte {
  static min = -9999;
  static max = 9999;
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
    if(int_value < MopsByte.min || int_value > MopsByte.max) { throw "Out of Range!"; }
    this._value = value;
  }
}

export { MopsByte }