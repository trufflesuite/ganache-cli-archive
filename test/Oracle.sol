contract Oracle{
  bytes32 public blockhash0;
  uint public lastBlock;
  function Oracle(){
    blockhash0 = block.blockhash(0);
  }
  function currentBlock() returns (uint) {
    return 1;
  }
  function setCurrentBlock() {
    lastBlock = 1;
  }
}
