"use strict";

(function (global) {
  const UINT32_MAX = 0xFFFFFFFF;

  function assertPrefix(prefix) {
    const value = Number(prefix);
    if (!Number.isInteger(value) || value < 0 || value > 32) {
      throw new Error("CIDR prefix must be an integer from 0 to 32.");
    }
    return value;
  }

  function ipToInt(ip) {
    if (typeof ip !== "string") {
      throw new Error("IPv4 address must be text.");
    }

    const parts = ip.trim().split(".");
    if (parts.length !== 4) {
      throw new Error("IPv4 address must contain four octets.");
    }

    const octets = parts.map((part) => {
      if (!/^\d{1,3}$/.test(part)) {
        throw new Error("Each IPv4 octet must be a number from 0 to 255.");
      }

      const value = Number(part);
      if (value < 0 || value > 255) {
        throw new Error("Each IPv4 octet must be between 0 and 255.");
      }
      return value;
    });

    return (
      octets[0] * 16777216 +
      octets[1] * 65536 +
      octets[2] * 256 +
      octets[3]
    );
  }

  function intToIp(value) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 0 || number > UINT32_MAX) {
      throw new Error("IPv4 integer is outside the valid 32-bit range.");
    }

    const a = Math.floor(number / 16777216);
    const remainderA = number % 16777216;
    const b = Math.floor(remainderA / 65536);
    const remainderB = remainderA % 65536;
    const c = Math.floor(remainderB / 256);
    const d = remainderB % 256;

    return [a, b, c, d].join(".");
  }

  function blockSizeFromPrefix(prefix) {
    const cidr = assertPrefix(prefix);
    return Math.pow(2, 32 - cidr);
  }

  function maskIntFromPrefix(prefix) {
    const cidr = assertPrefix(prefix);
    if (cidr === 0) return 0;
    return Math.pow(2, 32) - Math.pow(2, 32 - cidr);
  }

  function maskFromPrefix(prefix) {
    return intToIp(maskIntFromPrefix(prefix));
  }

  function wildcardFromPrefix(prefix) {
    return intToIp(UINT32_MAX - maskIntFromPrefix(prefix));
  }

  function networkInt(ipInt, prefix) {
    const blockSize = blockSizeFromPrefix(prefix);
    return Math.floor(ipInt / blockSize) * blockSize;
  }

  function broadcastInt(ipInt, prefix) {
    const network = networkInt(ipInt, prefix);
    return network + blockSizeFromPrefix(prefix) - 1;
  }

  function usableCount(prefix) {
    const cidr = assertPrefix(prefix);
    const total = blockSizeFromPrefix(cidr);

    if (cidr === 32) return 1;
    if (cidr === 31) return 2;
    return Math.max(0, total - 2);
  }

  function usableRange(network, broadcast, prefix) {
    const cidr = assertPrefix(prefix);

    if (cidr === 32) {
      return { first: network, last: network };
    }

    if (cidr === 31) {
      return { first: network, last: broadcast };
    }

    return {
      first: network + 1,
      last: broadcast - 1,
    };
  }

  function binary32(value) {
    return Number(value).toString(2).padStart(32, "0");
  }

  function legacyClass(ipIntValue) {
    const firstOctet = Math.floor(ipIntValue / 16777216);

    if (firstOctet === 0) return "Special / reserved";
    if (firstOctet >= 1 && firstOctet <= 126) return "Class A (legacy)";
    if (firstOctet === 127) return "Class A / loopback";
    if (firstOctet >= 128 && firstOctet <= 191) return "Class B (legacy)";
    if (firstOctet >= 192 && firstOctet <= 223) return "Class C (legacy)";
    if (firstOctet >= 224 && firstOctet <= 239) return "Class D / multicast";
    return "Class E / reserved";
  }

  function inRange(value, startIp, endIp) {
    const start = ipToInt(startIp);
    const end = ipToInt(endIp);
    return value >= start && value <= end;
  }

  function scopeOf(ipIntValue) {
    if (ipIntValue === ipToInt("0.0.0.0")) return "Unspecified";
    if (ipIntValue === ipToInt("255.255.255.255")) return "Limited broadcast";

    if (inRange(ipIntValue, "10.0.0.0", "10.255.255.255")) return "Private (RFC 1918)";
    if (inRange(ipIntValue, "172.16.0.0", "172.31.255.255")) return "Private (RFC 1918)";
    if (inRange(ipIntValue, "192.168.0.0", "192.168.255.255")) return "Private (RFC 1918)";
    if (inRange(ipIntValue, "127.0.0.0", "127.255.255.255")) return "Loopback";
    if (inRange(ipIntValue, "169.254.0.0", "169.254.255.255")) return "Link-local";
    if (inRange(ipIntValue, "100.64.0.0", "100.127.255.255")) return "Shared / CGNAT";
    if (inRange(ipIntValue, "224.0.0.0", "239.255.255.255")) return "Multicast";
    if (inRange(ipIntValue, "240.0.0.0", "255.255.255.254")) return "Reserved / experimental";
    if (inRange(ipIntValue, "192.0.2.0", "192.0.2.255")) return "Documentation (TEST-NET-1)";
    if (inRange(ipIntValue, "198.51.100.0", "198.51.100.255")) return "Documentation (TEST-NET-2)";
    if (inRange(ipIntValue, "203.0.113.0", "203.0.113.255")) return "Documentation (TEST-NET-3)";
    if (inRange(ipIntValue, "198.18.0.0", "198.19.255.255")) return "Benchmark testing";

    return "Public / globally routable candidate";
  }

  function calculateSubnet(ip, prefix) {
    const cidr = assertPrefix(prefix);
    const ipIntValue = ipToInt(ip);
    const network = networkInt(ipIntValue, cidr);
    const broadcast = broadcastInt(ipIntValue, cidr);
    const range = usableRange(network, broadcast, cidr);
    const blockSize = blockSizeFromPrefix(cidr);

    return {
      ip,
      prefix: cidr,
      ipInt: ipIntValue,
      networkInt: network,
      broadcastInt: broadcast,
      network: intToIp(network),
      broadcast: intToIp(broadcast),
      firstHost: intToIp(range.first),
      lastHost: intToIp(range.last),
      usableHosts: usableCount(cidr),
      totalAddresses: blockSize,
      mask: maskFromPrefix(cidr),
      wildcard: wildcardFromPrefix(cidr),
      className: legacyClass(ipIntValue),
      scope: scopeOf(ipIntValue),
      binary: binary32(ipIntValue),
      networkBinary: binary32(network),
      broadcastBinary: binary32(broadcast),
      hostOffset: ipIntValue - network,
      position: blockSize === 1 ? 0 : (ipIntValue - network) / (blockSize - 1),
    };
  }

  function splitSubnet(ip, currentPrefix, newPrefix, limit = 32) {
    const base = calculateSubnet(ip, currentPrefix);
    const targetPrefix = assertPrefix(newPrefix);

    if (targetPrefix <= base.prefix) {
      throw new Error("New prefix must be longer than the current prefix.");
    }

    const count = Math.pow(2, targetPrefix - base.prefix);
    const targetBlockSize = blockSizeFromPrefix(targetPrefix);
    const rows = [];
    const maxRows = Math.min(count, limit);

    for (let index = 0; index < maxRows; index += 1) {
      const network = base.networkInt + index * targetBlockSize;
      const broadcast = network + targetBlockSize - 1;
      const range = usableRange(network, broadcast, targetPrefix);

      rows.push({
        index: index + 1,
        prefix: targetPrefix,
        network: intToIp(network),
        firstHost: intToIp(range.first),
        lastHost: intToIp(range.last),
        broadcast: intToIp(broadcast),
        usableHosts: usableCount(targetPrefix),
      });
    }

    return {
      base,
      newPrefix: targetPrefix,
      count,
      truncated: count > limit,
      rows,
    };
  }

  function smallestTraditionalPrefixForHosts(hosts) {
    const requested = Number(hosts);

    if (!Number.isInteger(requested) || requested <= 0) {
      throw new Error("Host requirements must be positive integers.");
    }

    const neededAddresses = requested + 2;
    const hostBits = Math.ceil(Math.log2(neededAddresses));
    const prefix = 32 - hostBits;

    if (prefix < 0) {
      throw new Error("Requested host count is too large for IPv4.");
    }

    return prefix;
  }

  function buildVlsmPlan(baseIp, basePrefix, requirements) {
    const base = calculateSubnet(baseIp, basePrefix);

    if (!Array.isArray(requirements) || requirements.length === 0) {
      throw new Error("Add at least one VLSM requirement.");
    }

    const normalized = requirements.map((requirement, index) => {
      const name = String(requirement.name || `Segment ${index + 1}`).trim();
      const hosts = Number(requirement.hosts);

      if (!Number.isInteger(hosts) || hosts <= 0) {
        throw new Error(`Invalid host requirement for "${name}".`);
      }

      const prefix = smallestTraditionalPrefixForHosts(hosts);
      return { name, hosts, prefix };
    });

    normalized.sort((a, b) => {
      if (b.hosts !== a.hosts) return b.hosts - a.hosts;
      return a.name.localeCompare(b.name);
    });

    let cursor = base.networkInt;
    const allocations = [];

    normalized.forEach((requirement) => {
      const blockSize = blockSizeFromPrefix(requirement.prefix);
      const alignedNetwork = Math.ceil(cursor / blockSize) * blockSize;
      const broadcast = alignedNetwork + blockSize - 1;

      if (broadcast > base.broadcastInt) {
        throw new Error(
          `The base network ${base.network}/${base.prefix} is too small for all requirements.`
        );
      }

      const range = usableRange(alignedNetwork, broadcast, requirement.prefix);
      const usable = usableCount(requirement.prefix);

      allocations.push({
        ...requirement,
        networkInt: alignedNetwork,
        broadcastInt: broadcast,
        network: intToIp(alignedNetwork),
        broadcast: intToIp(broadcast),
        firstHost: intToIp(range.first),
        lastHost: intToIp(range.last),
        usableHosts: usable,
        waste: usable - requirement.hosts,
        blockSize,
      });

      cursor = broadcast + 1;
    });

    const usedAddresses = allocations.reduce((sum, item) => sum + item.blockSize, 0);
    const remainingAddresses = base.totalAddresses - usedAddresses;

    return {
      base,
      allocations,
      requestedHosts: normalized.reduce((sum, item) => sum + item.hosts, 0),
      usedAddresses,
      remainingAddresses,
      utilization: base.totalAddresses
        ? (usedAddresses / base.totalAddresses) * 100
        : 0,
    };
  }

  function parseCidr(value) {
    if (typeof value !== "string") {
      throw new Error("CIDR value must be text.");
    }

    const match = value.trim().match(/^([^/]+)\/(\d{1,2})$/);
    if (!match) {
      throw new Error("Use CIDR notation such as 10.20.0.0/22.");
    }

    return {
      ip: match[1].trim(),
      prefix: assertPrefix(Number(match[2])),
    };
  }

  const api = {
    ipToInt,
    intToIp,
    maskFromPrefix,
    wildcardFromPrefix,
    blockSizeFromPrefix,
    usableCount,
    calculateSubnet,
    splitSubnet,
    buildVlsmPlan,
    parseCidr,
    smallestTraditionalPrefixForHosts,
  };

  global.NetScopeCore = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
