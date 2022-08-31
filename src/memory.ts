function alias_at(now : number, first : number, last : number) : string {
  if(now < first || now > last) { return "&nbsp;"; }

  return String.fromCharCode("a".charCodeAt(0) + now - first);
}

class MemoryOutOfRange {
  index : number;
  constructor(index : number) {
    this.index = index;
  }
}

class MemoryGui {
  private container : HTMLElement

  constructor(container : HTMLElement, size : number) {
    this.container = container;
    this.reset(size);
  }

  reset(size : number) {
    const row_count = Math.ceil(size / 4);
    this.container.style.gridTemplateRows = `repeat(${row_count}, 1fr)`

    this.container.textContent = "";

    for(let i=0; i<size; ++i) {
      const this_value = document.createElement("span");
      this_value.classList.add("memory-value");
      this_value.innerHTML = `${String(i).padStart(4,'0')}<input id="memory-value-${i}" type="text" disabled value="0000">${alias_at(i, 64, 71)}`

      this.container.appendChild(this_value);
    }
  }

  assign(values : number[], start : number = 0) {
    for(const [i, value] of values.entries()) {
      const value_input = document.querySelector(`#memory-value-${i+start}`) as HTMLInputElement;
      if(!value_input) { throw new MemoryOutOfRange(i+start); }
      value_input.value = String(value).padStart(4, '0');
      value_input.classList.add("assigned")
    }
  }

  element_at(address : number) : HTMLInputElement | undefined {
    return document.querySelector(`#memory-value-${address}`) as HTMLInputElement;
  }
}

export { MemoryGui }