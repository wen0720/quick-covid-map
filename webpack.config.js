const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: process.env.NODE_ENV,
  context: path.resolve('src'),
  entry: {
    map: './ts/map.ts',
  },
  output: {
    path: path.resolve('dist'),
    filename: '[name].js',
  },
  resolve: {
    extensions: ['.ts', '...'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
        },
        exclude: /node_modules/,
      },
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './html/map.html',
      filename: 'map.html',
    }),
  ],
  devServer: {
    port: 3001,
    host: '0.0.0.0',
    hot: true,
    // https: true,
  },
}
