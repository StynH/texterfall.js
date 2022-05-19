const path = require('path');
const webpack = require('webpack');
const MinifyPlugin = require("babel-minify-webpack-plugin");
const LodashModuleReplacementPlugin = require('lodash-webpack-plugin');

module.exports = {
    watch: true,
    entry: './src/index.ts',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'babel-loader',
                exclude: /node_modules/,
                sideEffects: true,
            },
        ],
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js']
    },
    output: {
        filename: 'texterfall.js',
        path: path.resolve(__dirname, 'dist'),
        libraryTarget: 'umd',
        umdNamedDefine: true
    },
    plugins: [
        new LodashModuleReplacementPlugin(),
        new MinifyPlugin({}, {})
    ]
};
