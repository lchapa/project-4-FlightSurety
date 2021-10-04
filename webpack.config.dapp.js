const webpack = require('webpack')
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
//const nodeExternals = require('webpack-node-externals')

module.exports = {
  entry: [path.join(__dirname, "src/dapp/index.js")],
  output: {
    path: path.join(__dirname, "prod/dapp"),
  },
  target: 'web',
  module: {
    rules: [
	{
	    test: /\.m?js$/,
	    exclude: /node_modules/,
	    use: {
	      loader: 'babel-loader',
	      options: {
	        presets: ['@babel/preset-env']
	      }
	    }
	},
	{
		test: /\.css$/,
		use: ["style-loader", "css-loader"]
	},
	{
		test: /\.(png|svg|jpg|gif)$/,
		type: 'asset/resource'
       //use: ['file-loader']
	},
    {
       test: /\.html$/,
       use: "html-loader",
       exclude: /node_modules/
    }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({ 
      template: path.join(__dirname, "src/dapp/index.html"),
      title: 'Development',
    }),
    new webpack.DefinePlugin({
        'process.env.NODE_DEBUG': JSON.stringify('development')
    }),
    new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
    }),
  ],
  resolve: {
	  	extensions: [".js"],
		fallback: { 
	  		stream: require.resolve('stream-browserify'),
	  		crypto: require.resolve('crypto-browserify'),
	  		os: require.resolve('os-browserify/browser'),
	  		http: require.resolve('stream-http'),
	        https: require.resolve('https-browserify'),
	        process: require.resolve('process')
	  	},
		alias: {
	        process: "process/browser"
	     }
  },
  devServer: {
	  	open : true,
	    port: 9000
  }
};
