pragma solidity ^0.4.2;

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

contract Example2 {
  function getValueProxy(Example addr) returns (uint) {
    return addr.value();
  }
}
