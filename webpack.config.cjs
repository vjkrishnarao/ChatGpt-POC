const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const HtmlInlineScriptPlugin = require('html-inline-script-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: {
    cards: './src/cards-entry.jsx',
    sendmoney: './src/sendmoney-entry.jsx'
  },
  output: {
    path: path.resolve(__dirname, 'public/dist'),
    filename: '[name]-bundle.js',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(png|jpg|jpeg|gif|webp|svg)$/i,
        type: 'asset/inline'
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.jsx']
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
      filename: '../cards.html',
      chunks: ['cards'],
      inject: 'body',
      inlineSource: '.(js|css)$'
    }),
    new HtmlWebpackPlugin({
      template: './src/index.html',
      filename: '../sendmoney.html',
      chunks: ['sendmoney'],
      inject: 'body',
      inlineSource: '.(js|css)$'
    }),
    new HtmlInlineScriptPlugin()
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'public')
    },
    compress: true,
    port: 8080,
    hot: true
  }
};
