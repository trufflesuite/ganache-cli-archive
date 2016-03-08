# SYNOPSIS

Limited RPC client intended for quick testing and development. Uses ethereumjs to simulate a full client and make development of Ethereum applications much faster.

 **YES**, `ethereumjs-testrpc` supports events! :tada:


# INSTALL

```Bash
npm install -g ethereumjs-testrpc
```

**Using Windows?** See our [Windows install instructions](https://github.com/ethereumjs/testrpc/wiki/Installing-TestRPC-on-Windows).

# USAGE

##### Command Line

```Bash
$ testrpc <options>
```

Options:

* `--port` or `-p`: Port number to listen on.

##### Library

As a Web3 provider:

```
var TestRPC = require("ethereumjs-testrpc");
web3.setProvider(TestRPC.provider());
```

As a general http server:

```
var TestRPC = require("ethereumjs-testrpc");
var server = TestRPC.server();
server.listen(port, function() {...});
```

# IMPLEMENTED METHODS

The RPC methods currently implemented are:


* `eth_accounts`
* `eth_blockNumber`
* `eth_call`
* `eth_coinbase`
* `eth_compileSolidity`
* `eth_estimateGas`
* `eth_gasPrice`
* `eth_getBalance`
* `eth_getBlockByNumber`
* `eth_getBlockByHash`
* `eth_getCode` (only supports block number “latest”)
* `eth_getCompilers`
* `eth_getFilterChanges`
* `eth_getFilterLogs`
* `eth_getLogs`
* `eth_getStorageAt`
* `eth_getTransactionByHash`
* `eth_getTransactionCount`
* `eth_getTransactionReceipt`
* `eth_hashrate`
* `eth_mining`
* `eth_newBlockFilter`
* `eth_newFilter` (includes log/event filters)
* `eth_sendTransaction`
* `eth_sendRawTransaction`
* `eth_sign`
* `eth_uninstallFilter`
* `web3_clientVersion`

There’s also special non-standard methods that aren’t included within the original RPC specification:

* `evm_snapshot` : Snapshot the state of the blockchain at its current place. Takes no parameters. Returns the integer id of the snapshot created.
* `evm_revert` : Revert the state of the blockchain to a previous snapshot. Takes one parameter. Reverts to the snapshot id passed, or the latest snapshot.

These methods are really powerful within automated testing frameworks. Example uses for these methods are:

* `evm_snapshot` : Run at the beginning of each test or test suite, snapshotting the state of the evm.
* `evm_revert` : Run at the end of each test or test suite, reverting back to a known clean state.

# TESTING

Run tests via:

```
$ npm test
```

# LICENSE
[MPL-2.0](https://tldrlegal.com/license/mozilla-public-license-2.0-(mpl-2))
