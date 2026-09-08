module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.resolve = webpackConfig.resolve ?? {};
      webpackConfig.resolve.alias = {
        ...(webpackConfig.resolve.alias ?? {}),
        // @fluentui/react-positioning 以无扩展名方式导入 use-sync-external-store/shim，
        // webpack5 严格 ESM 无法解析目录，这里直接指向具体文件
        'use-sync-external-store/shim': require.resolve('use-sync-external-store/shim/index.js'),
      };
      return webpackConfig;
    },
  },
};