const os = require('os');

function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];

  for (const interfaceName in interfaces) {
    for (const iface of interfaces[interfaceName]) {
      if (iface.internal || iface.family !== 'IPv4') continue;
      ips.push(iface.address);
    }
  }

  return ips;
}

module.exports = {
  getLocalIPs,
};

