Disclaimer: EtherSim is beta and is currently under development.

What is EtherSim
======

[![Join the chat at https://gitter.im/iurimatias/embark-framework](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/iurimatias/embark-framework?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

EtherSim is a Limited Ethereum RPC simulator for testing and development purposes. EtherSim is used by the [Embark Framework](https://github.com/iurimatias/embark-framework)

Installation
======

```Bash
$ npm install -g ethersim
```

Usage - as a RPC Server
======

```Bash
$ ethersim
```

Usage - as a Lib
======

```Javascript
var ethersim = require('ethersim');
var web3 = require('web3');

web3.setProvider(ethersim.web3Provider());
```

Caveats
======

Currently EtherSim does not support Events. If used as a lib, all calls must be done asynchronously

