import {detectVBAStomping} from "./vba_stomping_detection";
import {
    dllDeclarationRegex,
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
    "AutoOpen",
    "Workbook_BeforeClose"
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
    "Create", // https://docs.microsoft.com/en-us/windows/win32/cimwin32prov/create-method-in-class-win32-process
    "CreateObject",
    "GetObject"
];

const suspiciousRegex = [
    {regex: /Options\..+[ \t]*=/, description: "Modifies word settings"}
];

export function analyzeFile(oleFile) {
    let safe = true;
    let output = "";

    const stompingDetectionResult = detectVBAStomping(oleFile);
    if (stompingDetectionResult.length > 0) {
        safe = false;
        output += "<div class='mb-s'>Detected <b>VBA stomping</b>!\nKeywords missing from source code:</div>";
        for (const res of stompingDetectionResult) {
            output += `<li>Module: ${res.module.name}, Keyword: ${res.keyword}</li>`;
        }
        output += "\n";
    }

    for (const func of oleFile.VBAFunctions) {
        if (!isAutoExec(func.name)) continue;
        let fullBody = func.body.join("\n") + "\n";
        const foundWords = [];
        const funcDependencies = getAllDependencies(func, oleFile.VBAFunctions);
        for (const dependency of funcDependencies) {
            fullBody += dependency.body.join("\n") + "\n";
        }
        fullBody = prepareForAnalysis(fullBody);

        if (funcDependencies.some(f => f.type === FuncType.DLL)) {
            foundWords.push("Executes DLLs");
            safe = false;
        }

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
            output += `<div class='mb-s'>Autoexec function <b>${func.name}</b> contains suspicious commands:</div>`;
            for (const word of foundWords) {
                output += "<li>" + word + "</li>";
            }
            output += "\n";
        }
    }

    if (safe) {
        oleFile.isMalicious = false;
        return "File is safe!\n";
    } else {
        oleFile.isMalicious = true;
        return output;
    }
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
                let matchResult = line.match(functionDeclarationRegex);
                if (matchResult && matchResult.groups) {
                    currentFunction = {
                        id: id++,
                        name: matchResult.groups.functionName,
                        dependencies: [],
                        body: [],
                        type: FuncType.Normal
                    };
                    VBAFunctions.push(currentFunction);
                    continue;
                }

                matchResult = line.match(dllDeclarationRegex);
                if (matchResult && matchResult.groups) {
                    VBAFunctions.push({
                        id: id++,
                        name: matchResult.groups.functionName,
                        dependencies: [],
                        body: [],
                        type: FuncType.DLL
                    });
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

function getAllDependencies(func, VBAFunctions) {
    const findDependencies = (currFunc, fullDependencies) => {
        for (const id of currFunc.dependencies) {
            const dep = VBAFunctions.find(f => f.id === id);
            if (!fullDependencies.includes(dep)) {
                fullDependencies.push(dep);
                findDependencies(dep, fullDependencies);
            }
        }
        return fullDependencies;
    };

    return findDependencies(func, []);
}

export const FuncType = Object.freeze({Normal: 0, DLL: 1});