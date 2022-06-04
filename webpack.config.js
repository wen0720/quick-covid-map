const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

const DEV_MODE = process.env.NODE_ENV === 'development';
console.log(process.env.NODE_ENV);

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
  devtool: DEV_MODE ? 'inline-source-map' : false,
  resolve: {
    modules: [path.resolve(__dirname, 'src'), 'node_modules'],
    extensions: ['.ts', '...'],
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
        },
        exclude: /node_modules/,
      },
      {
        test: /\.(jpg|png|svg)$/,
        type: 'asset/resource',
      },
    ]
  },
  plugins: [
    new CleanWebpackPlugin(),
    new webpack.DefinePlugin({
      process: {
        env: {
          NODE_ENV: JSON.stringify(process.env.NODE_ENV),
        }
      },
      VERSION: JSON.stringify('5fa3b9'),
    }),
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
    proxy: {
      '/api': {
        target: 'https://localhost:3000',
        pathRewrite: {
          '^/api': '',
        },
        secure: false,
      }
    }
  },
}
