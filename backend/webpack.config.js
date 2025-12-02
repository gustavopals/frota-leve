const path = require('path');

module.exports = function (options, webpack) {
  return {
    ...options,
    externals: {
      // Marca bcrypt como external para evitar problemas com webpack
      bcrypt: 'commonjs bcrypt',
    },
    module: {
      rules: [
        ...options.module.rules,
        {
          test: /\.html$/,
          loader: 'ignore-loader',
        },
      ],
    },
    resolve: {
      ...options.resolve,
      fallback: {
        ...options.resolve?.fallback,
        'mock-aws-s3': false,
        'aws-sdk': false,
        nock: false,
      },
    },
    plugins: [
      ...options.plugins,
      new webpack.IgnorePlugin({
        resourceRegExp: /^(mock-aws-s3|aws-sdk|nock)$/,
      }),
    ],
  };
};
