contract Example {
  uint public value;

  event ValueSet(uint);

  function Example() {
    value = 5;
  }

  function setValue(uint val) {
    value = val;
    ValueSet(val);
  }
}
