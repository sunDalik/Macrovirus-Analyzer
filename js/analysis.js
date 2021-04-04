import {detectVBAStomping} from "./vba_stomping_detection";
import {
    collapseLongLines,
    dllDeclarationRegex,
    functionDeclarationRegex,
    functionEndRegex,
    keywordRegex,
    removeColonDelimiters,
    removeComments, stringRegex
} from "./deobfuscation";

export const autoExecFunctions = [
    /Workbook_Open/i,
    /Document_Open/i,
    /Document_Close/i,
    /Auto_?Open/i,
    /Workbook_BeforeClose/i,
    /Main/i, //TODO check if code module name contains autoexec AND has Main sub

    // Some ActiveX stuff that I don't understand
    /\w+_Layout/i,
    /\w+_Resize/i,
    /\w+_GotFocus/i,
    /\w+_LostFocus/i,
    /\w+_MouseHover/i,
    /\w+_Click/i,
    /\w+_Change/i,
    /\w+_BeforeNavigate2/i,
    /\w+_BeforeScriptExecute/i,
    /\w+_DocumentComplete/i,
    /\w+_DownloadBegin/i,
    /\w+_DownloadComplete/i,
    /\w+_FileDownload/i,
    /\w+_NavigateComplete2/i,
    /\w+_NavigateError/i,
    /\w+_ProgressChange/i,
    /\w+_PropertyChange/i,
    /\w+_SetSecureLockIcon/i,
    /\w+_StatusTextChange/i,
    /\w+_TitleChange/i,
    /\w+_MouseMove/i,
    /\w+_MouseEnter/i,
    /\w+_MouseLeave/i,
    /\w+_OnConnecting/i,
    /\w+_FollowHyperlink/i,
    /\w+_ContentControlOnEnter/i
];

const suspiciousWords = [
    // File system operations
    "Kill",
    "CreateTextFile",
    "Open",
    "Get",

    // File execution
    "Shell",
    "Create", // https://docs.microsoft.com/en-us/windows/win32/cimwin32prov/create-method-in-class-win32-process
    "CreateObject",
    "GetObject"
];

const suspiciousStrings = [
    // File downloading
    "Microsoft.XMLHTTP",

    // May run an executable or a system command
    "Wscript.Shell"
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
            output += `<li><span class="list-flex-sb"><span>${res.keyword}</span><span class="sneaky">(${res.module.name})</span></span></li>`;
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

        for (const str of suspiciousStrings) {
            if (stringRegex(str, true).test(fullBody)) {
                foundWords.push("\"" + str + "\"");
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

    //console.log(VBAFunctions);
    return VBAFunctions;
}

export function prepareForAnalysis(code) {
    code = collapseLongLines(code);
    code = removeComments(code);
    code = removeColonDelimiters(code);
    return code;
}

export function isAutoExec(func) {
    return autoExecFunctions.some(f => f.test(func));
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