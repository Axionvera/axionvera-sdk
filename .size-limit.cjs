module.exports = [
  {
    path: "packages/core/dist/index.mjs",
    limit: "200 KB",
    modifyEsbuildConfig(config) {
      config.platform = "node";
      config.external = [
        ...(config.external ?? []),
        "@stellar/stellar-sdk",
        "axios",
        "ethers",
        "@aws-sdk/client-cloudwatch-logs",
        "stream",
        "http",
        "https",
        "url",
        "zlib",
        "timers",
      ];
      return config;
    },
  },
  {
    path: "packages/react/dist/index.mjs",
    limit: "20 KB",
    modifyEsbuildConfig(config) {
      config.platform = "node";
      config.external = [
        ...(config.external ?? []),
        "react",
        "@axionvera/core",
      ];
      return config;
    },
  },
];

