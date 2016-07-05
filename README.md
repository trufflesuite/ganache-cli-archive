# Welcome to `testrpc`

`testrpc` is a Node.js based Ethereum client for testing and development. It uses ethereumjs to simulate full client behavior and make developing Ethereum applications much faster. It also includes all popular RPC functions and features (like events) and can be run deterministically to make development a breeze.

# INSTALL

`testrpc` is written in Javascript and distributed as a Node package via `npm`. Make sure you have Node.js installed, and your environment is capable of installing and compiling `npm` modules.

```Bash
npm install -g ethereumjs-testrpc
```

**Using Windows?** See our [Windows install instructions](https://github.com/ethereumjs/testrpc/wiki/Installing-TestRPC-on-Windows).

**Ubuntu User?** Follow the basic instructions for installing [Node.js](https://nodejs.org/en/download/package-manager/#debian-and-ubuntu-based-linux-distributions) and make sure that you have `npm` installed, as well as the `build-essential` `apt` package (it supplies `make` which you will need to compile most things). Use the official Node.js packages, *do not use the package supplied by your distribution.*

Having problems? Be sure to check out the [FAQ](https://github.com/ethereumjs/testrpc/wiki/FAQ) and if you're still having issues and you're sure its a problem with `testrpc` please open an issue.

# USAGE

##### Command Line

```Bash
$ testrpc <options>
```

Options:

* `-a` or `--accounts`: Specify the number of accounts to generate at startup.
* `-b` or `--blocktime`: Specify blocktime in seconds for automatic mining. Default is 0 and no auto-mining.
* `-d` or `--deterministic`: Generate deterministic addresses based on a pre-defined mnemonic.
* `-m` or `--mnemonic`: Use a specific HD wallet mnemonic to generate initial addresses.
* `-p` or `--port`: Port number to listen on.
* `-s` or `--seed`: Use arbitrary data to generate the HD wallet mnemonic to be used.
* `-g` or `--gasPrice`: Use a custom Gas Price (defaults to 1)
* `-l` or `--gasLimit`: Use a custom Gas Limit (defaults to 0x47E7C4)
* `--debug`: Output VM opcodes for debugging

You can also specify `--account=...` (no 's') any number of times passing arbitrary private keys and their associated balances to generate initial addresses:

```
$ testrpc --account="<privatekey>,balance" [--account="<privatekey>,balance"]
```

Note that private keys are 64 characters long, and must be input as a 0x-prefixed hex string. Balance can either be input as an integer or 0x-prefixed hex value specifying the amount of wei in that account.

An HD wallet will not be created for you when using `--account`.

##### Library

As a Web3 provider:

```javascript
var TestRPC = require("ethereumjs-testrpc");
web3.setProvider(TestRPC.provider());
```

As a general http server:

```javascript
var TestRPC = require("ethereumjs-testrpc");
var server = TestRPC.server();
server.listen(port, function(err, blockchain) {...});
```

Both `.provider()` and `.server()` take a single object which allows you to specify behavior of the TestRPC. This parameter is optional. Available options are:

* `"accounts"`: `Array` of `Object`'s. Each object should have a balance key with a hexadecimal value. The key `secretKey` can also be specified, which represents the account's private key. If no `secretKey`, the address is auto-generated with the given balance. If specified, the key is used to determine the account's address.
* `"debug"`: `boolean` - Output VM opcodes for debugging
* `"logger"`: `Object` - Object, like `console`, that implements a `log()` function.
* `"mnemonic"`: Use a specific HD wallet mnemonic to generate initial addresses.
* `"port"`: Port number to listen on when running as a server.
* `"seed"`: Use arbitrary data to generate the HD wallet mnemonic to be used.
* `"total_accounts"`: `number` - Number of accounts to generate at startup.

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
* `eth_syncing`
* `eth_uninstallFilter`
* `net_listening`
* `net_peerCount`
* `net_version`
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
