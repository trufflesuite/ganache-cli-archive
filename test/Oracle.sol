contract Oracle{
  bytes32 public blockhash0;
  function Oracle(){
    blockhash0 = block.blockhash(0);
  }
}