module.exports = exports = function(yargs) {
  return yargs
    .option('p', {
      group: 'Network:',
      alias: 'port',
      default: 8545,
      describe: 'port to bind to',
      check: val => val >= 1 && val <= 65535
    })
    .option('h', {
      group: 'Network:',
      alias: 'host',
      default: '127.0.0.1',
      describe: 'host to bind to'
    })
    .option('a', {
      group: 'Accounts:',
      alias: 'accounts',
      describe: 'number of accounts to generate at startup',
      type: 'number',
      default: 10
    })
    .option('e', {
      group: 'Accounts:',
      alias: 'defaultBalanceEther',
      describe: 'Amount of ether to assign each test account',
      type: 'number',
      default: 100.0
    })
    .option('account', {
      group: 'Accounts:',
      describe: "Account data in the form '<private_key>,<initial_balance>', can be specified multiple times. Note that private keys are 64 characters long and must be entered as an 0x-prefixed hex string. Balance can either be input as an integer, or as a 0x-prefixed hex string with either form specifying the initial balance in wei.",
      type: 'array',
      demandOption: false
    })
    .option('acctKeys', {
      group: 'Accounts:',
      describe: 'saves generated accounts and private keys as JSON object in specified file',
      normalize: true,
      demandOption: false
    })
    .option('n', {
      group: 'Accounts:',
      alias: 'secure',
      describe: 'Lock accounts by default',
      type: 'boolean',
      default: false
    })
    .option('unlock', {
      group: 'Accounts:',
      describe: 'Comma-separated list of accounts or indices to unlock',
      demandOption: false
    })
    .option('f', {
      group: 'Chain:',
      alias: 'fork',
      describe: "URL and block number of another currently running Ethereum client from which this client should fork. Example: 'http://127.0.0.1:9545@12345'",
      demandOption: false
    })
    .option('db', {
      group: 'Chain:',
      describe: 'directory to save chain db',
      normalize: true,
      demandOption: false
    })
    .option('s', {
      group: 'Chain:',
      alias: 'seed',
      describe: 'seed value for PRNG',
      defaultDescription: "Random value, unless -d is specified",
      conflicts: 'd',
      demandOption: false
    })
    .option('d', {
      group: 'Chain:',
      alias: 'deterministic',
      describe: 'uses fixed (hardcoded) seed for identical results from run-to-run',
      conflicts: 's',
      type: 'boolean',
      default: false,
      demandOption: false
    })
    .option('m', {
      group: 'Chain:',
      alias: 'mnemonic',
      describe: 'bip39 mnemonic phrase for generating a PRNG seed, which is in turn used for hierarchical deterministic (HD) account generation',
      demandOption: false
    })
    .option('noVMErrorsOnRPCResponse', {
      group: 'Chain:',
      describe: 'Do not transmit transaction failures as RPC errors. Enable this flag for error reporting behaviour which is compatible with other clients such as geth and Parity.',
      type: 'boolean',
      default: false
    })
    .option('b', {
      group: 'Chain:',
      alias: 'blockTime',
      describe: 'Block time in seconds. Will instamine if option omitted. Avoid using unless your test cases require a specific mining interval.',
      demandOption: false
    })
    .option('i', {
      group: 'Chain:',
      alias: 'networkId',
      type: 'number',
      describe: "Network ID to be returned by 'net_version'. ",
      defaultDescription: "System time at process start.",
      demandOption: false
    })
    .option('g', {
      group: 'Chain:',
      alias: 'gasPrice',
      describe: 'The price of gas in wei',
      type: 'number',
      default: 20000000000
    })
    .option('l', {
      group: 'Chain:',
      alias: 'gasLimit',
      describe: 'The block gas limit',
      type: 'number',
      default: 0x6691b7
    })
    .option('debug', {
      group: 'Other:',
      describe: 'Output VM opcodes for debugging',
      type: 'boolean',
      default: false
    })
    .option('verbose', {
      group: 'Other:',
      describe: 'Log all requests and responses to stdout',
      type: 'boolean',
      default: false
    })
    .option('mem', {
      group: 'Other:',
      describe: 'Only show memory output, not tx history',
      type: 'boolean',
      default: false
    })
    .showHelpOnFail(false, 'Specify -h, -?, or --help for available options') 
    .help('h')
    .alias('h', ['?', 'help'])
}
