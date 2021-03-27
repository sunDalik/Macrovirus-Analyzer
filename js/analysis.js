import {detectVBAStomping} from "./vba_stomping_detection";
import {functionDeclarationRegex, functionEndRegex, functionUsageRegex, removeComments} from "./deobfuscation";

const suspiciousWords = [
    // Auto execution triggers
    "Sub Workbook_Open()",
    "Sub Document_Open()",

    // File system operations
    "Kill",
    "CreateTextFile",
    "Open",
    "Get",

    // File downloading
    "Microsoft.XMLHTTP",

    // File execution
    "Shell",
    "Create" // https://docs.microsoft.com/en-us/windows/win32/cimwin32prov/create-method-in-class-win32-process
];

export function analyzeCode(sourceCode, pcode) {
    let safe = true;
    let output = "";
    const foundWords = [];
    for (const word of suspiciousWords) {
        //if (code.includes(word)) foundWords.push(word);
        if (new RegExp(`\\b${word}\\b`, "i").test(sourceCode)) {
            foundWords.push(word);
            safe = false;
        }
    }

    if (detectVBAStomping(pcode, sourceCode)) {
        safe = false;
        output += "Detected VBA stomping!\n";
    }

    if (safe) return "Module is safe!\n";
    else {
        if (foundWords.length !== 0) {
            output += "Module contains suspicious commands:\n";
            for (const word of foundWords) {
                output += "\n<li>" + word + "</li>";
            }
        }
    }
    return output;
}

export function parseVBAFunctions(oleFile) {
    const VBAFunctions = [];
    let id = 0;
    for (const module of oleFile.macroModules) {
        const moduleCode = prepareForAnalysis(module.sourceCode);
        let currentFunction = null;
        for (const line of moduleCode.split("\n")) {
            if (currentFunction !== null) {
                if (functionEndRegex.test(line)) {
                    currentFunction = null;
                } else {
                    currentFunction.body.push(line);
                }
            } else {
                const matchResult = line.match(functionDeclarationRegex);
                if (matchResult && matchResult.groups) {
                    currentFunction = {id: id++, name: matchResult.groups.functionName, dependencies: [], body: []};
                    VBAFunctions.push(currentFunction);
                }
            }
        }
    }

    for (const func of VBAFunctions) {
        const body = func.body.join("\n");
        for (const func2 of VBAFunctions) {
            if (func === func2) continue;
            if (functionUsageRegex(func2.name).test(body)) {
                func.dependencies.push(func2.id);
            }
        }
    }

    console.log(VBAFunctions);
    return VBAFunctions;
}

export function prepareForAnalysis(code) {
    //TODO collapse long lines
    code = removeComments(code);
    return code;
}