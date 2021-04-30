import commonjs from "rollup-plugin-commonjs";
import resolve from "rollup-plugin-node-resolve";
import builtins from "rollup-plugin-node-builtins";
import {terser} from 'rollup-plugin-terser';
import nodeGlobals from "rollup-plugin-node-globals";

const production = process.env.NODE_ENV === "production";

export default [{
    input: './js/setup.js',
    output: {
        file: "app.js",
        format: "iife"
    },
    plugins: [
        resolve({browser: true, preferBuiltins: true}),
        commonjs({extensions: [".js"]}),
        builtins(),
        nodeGlobals()
    ].concat(production ? [terser()] : [])
}, {
    input: './extension/background.js',
    output: {
        file: "extension/app.js",
        format: "iife"
    },
    plugins: [
        resolve({browser: true, preferBuiltins: true}),
        commonjs({extensions: [".js"]}),
        builtins(),
        nodeGlobals()
    ].concat(production ? [terser()] : [])
}];