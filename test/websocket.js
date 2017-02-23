var TestRPC = require("../index.js");
var assert = require('assert');
var ParityApi = require('@parity/parity.js').Api;

describe("websocket", () => {
  // BEGIN terribleness
  // TODO: find a better way to do this.
  // parity.js is designed for browsers where `WebSocket` is globally accessible
  var originalGlobalWebSocket;
  before(() => {
    originalGlobalWebSocket = global.WebSocket;
    global.WebSocket = require('ws');
  });
  after(() => {
    global.WebSocket = originalGlobalWebSocket;
  });
  // END terribleness

  var webSocketServer;
  var api;
  before(() => {
    webSocketServer = TestRPC.webSocketServer({ network_id: "5", webSocketServer: { port: 1337 } });
    const transport = new ParityApi.Transport.Ws('ws://localhost:1337');
    api = new ParityApi(transport);
  });
  after(() => {
    return new Promise((resolve, reject) => {
      if (webSocketServer)
        webSocketServer.close(() => resolve())
      else
        resolve();
    });
  });

  it("net.version", () => {
    return api.net.version().then((version) => {
      assert.strictEqual(version, "5");
    });
  });

  it("eth.gasPrice", () => {
    return api.eth.gasPrice().then((gasPrice) => {
      assert.deepEqual(gasPrice, { s: 1, e: 10, c: [ 20000000000 ] });
    });
  });
});
