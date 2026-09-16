"use strict";

const assert = require("assert");
const Core = require("../network.js");

function run(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

run("calculates 192.168.1.130/26 correctly", () => {
  const result = Core.calculateSubnet("192.168.1.130", 26);
  assert.strictEqual(result.network, "192.168.1.128");
  assert.strictEqual(result.broadcast, "192.168.1.191");
  assert.strictEqual(result.firstHost, "192.168.1.129");
  assert.strictEqual(result.lastHost, "192.168.1.190");
  assert.strictEqual(result.usableHosts, 62);
  assert.strictEqual(result.mask, "255.255.255.192");
  assert.strictEqual(result.wildcard, "0.0.0.63");
});

run("handles /31 as point-to-point usable addresses", () => {
  const result = Core.calculateSubnet("10.0.0.4", 31);
  assert.strictEqual(result.network, "10.0.0.4");
  assert.strictEqual(result.broadcast, "10.0.0.5");
  assert.strictEqual(result.firstHost, "10.0.0.4");
  assert.strictEqual(result.lastHost, "10.0.0.5");
  assert.strictEqual(result.usableHosts, 2);
});

run("handles /32 as a single host route", () => {
  const result = Core.calculateSubnet("203.0.113.9", 32);
  assert.strictEqual(result.network, "203.0.113.9");
  assert.strictEqual(result.broadcast, "203.0.113.9");
  assert.strictEqual(result.firstHost, "203.0.113.9");
  assert.strictEqual(result.lastHost, "203.0.113.9");
  assert.strictEqual(result.usableHosts, 1);
});

run("splits a /24 into four /26 subnets", () => {
  const result = Core.splitSubnet("192.168.10.42", 24, 26);
  assert.strictEqual(result.count, 4);
  assert.strictEqual(result.rows[0].network, "192.168.10.0");
  assert.strictEqual(result.rows[1].network, "192.168.10.64");
  assert.strictEqual(result.rows[2].network, "192.168.10.128");
  assert.strictEqual(result.rows[3].network, "192.168.10.192");
});

run("builds a valid VLSM plan", () => {
  const result = Core.buildVlsmPlan("10.20.0.0", 22, [
    { name: "Office", hosts: 240 },
    { name: "Lab", hosts: 110 },
    { name: "Cameras", hosts: 50 },
  ]);

  assert.strictEqual(result.allocations[0].network, "10.20.0.0");
  assert.strictEqual(result.allocations[0].prefix, 24);
  assert.strictEqual(result.allocations[1].network, "10.20.1.0");
  assert.strictEqual(result.allocations[1].prefix, 25);
  assert.strictEqual(result.allocations[2].network, "10.20.1.128");
  assert.strictEqual(result.allocations[2].prefix, 26);
});

run("rejects invalid IPv4 octets", () => {
  assert.throws(() => Core.calculateSubnet("192.168.1.999", 24));
});

console.log("\nAll NetScope tests passed.");
