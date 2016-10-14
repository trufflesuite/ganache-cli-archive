pragma solidity ^0.4.2;

contract Oracle{
  bytes32 public blockhash0;
  uint public lastBlock;
  function Oracle(){
    blockhash0 = block.blockhash(0);
  }
  function currentBlock() returns (uint) {
    return block.number;
  }
  function setCurrentBlock() {
    lastBlock = block.number;
  }
}
