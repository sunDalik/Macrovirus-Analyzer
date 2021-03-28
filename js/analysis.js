import {detectVBAStomping} from "./vba_stomping_detection";
import {
    functionDeclarationRegex,
    functionEndRegex,
    keywordRegex,
    removeColonDelimiters,
    removeComments
} from "./deobfuscation";

export const autoExecFunctions = [
    "Workbook_Open",
    "Document_Open",
    "Document_Close",
    "Auto_Open",
    "AutoOpen"
];

const suspiciousWords = [
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

const suspiciousRegex = [
    {regex: /Options\..+[ \t]*=/, description: "Modifies word settings"}
];

export function analyzeFile(oleFile) {
    let safe = true;
    let output = "";

    if (detectVBAStomping(oleFile)) {
        safe = false;
        output += "Detected VBA stomping!\n";
    }

    for (const func of oleFile.VBAFunctions) {
        if (!isAutoExec(func.name)) continue;
        let fullBody = func.body.join("\n") + "\n";
        for (const id of func.dependencies) {
            const dependency = oleFile.VBAFunctions.find(f => f.id === id);
            fullBody += dependency.body.join("\n") + "\n";
        }
        fullBody = prepareForAnalysis(fullBody);

        const foundWords = [];
        for (const word of suspiciousWords) {
            if (keywordRegex(word).test(fullBody)) {
                foundWords.push(word);
                safe = false;
            }
        }
        for (const susReg of suspiciousRegex) {
            if (susReg.regex.test(fullBody)) {
                foundWords.push(susReg.description);
                safe = false;
            }
        }

        if (foundWords.length !== 0) {
            output += `Autoexec function <b>${func.name}</b> contains suspicious commands:\n\n`;
            for (const word of foundWords) {
                output += "<li>" + word + "</li>\n";
            }
        }
    }

    if (safe) return "File is safe!\n";
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
            if (keywordRegex(func2.name).test(body)) {
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
    code = removeColonDelimiters(code);
    return code;
}

export function isAutoExec(func) {
    return autoExecFunctions.map(f => f.toLowerCase()).includes(func.toLowerCase());
}