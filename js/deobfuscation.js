import {readSetting, SETTINGS} from "./local_storage";

const varName = "[A-Za-z][A-Za-z0-9_\-]*";

export const functionDeclarationRegex = new RegExp(`^[ \\t]*((Public|Private)[ \\t]+)?(Sub|Function)[ \\t]+(?<functionName>${varName})[ \\t]*\\(.*\\)[ \\t]*$`, 'm');
export const functionEndRegex = new RegExp(`^[ \\t]*End[ \\t]*(Sub|Function)[ \\t]*$`, 'm');
export const functionUsageRegex = (funName) => new RegExp(`^(?:[^"]*?"[^"]*?")*?[^"]*?\\b${funName}\\b.*$`, 'm');
const forRegex = new RegExp(`^[ \\t]*For[ \\t]+(?<iteratorVariable>${varName})[ \\t]*=[ \\t]*$`);

const variableDeclarationRegex = new RegExp(`(^[ \\t]*(Set|Dim)[ \\t]+(?<variableName>${varName}).*?$)|(^[ \\t]*(?<variableName2>${varName})([ \\t]*\\(.+?\\))?[ \\t]*=.*?$)`);
const commentRegex = new RegExp(`^(?<before_comment>(?:[^"]*?"[^"]*?")*?[^"]*?)(?<comment>'.*)$`);
const lineBreakRegex = new RegExp(` _(\r\n|\r|\n)`, "g");

const blocks = [{start: "Sub", end: "End"},
    {start: "Function", end: "End"},
    {start: "Do", end: "Loop"},
    {start: "For", end: "Next"},
    {start: "If", end: "End"},
    {start: "Select", end: "End"},
    {start: "SyncLock", end: "End"},
    {start: "Try", end: "End"},
    {start: "While", end: "End"},
    {start: "With", end: "End"}
];

export function deobfuscateCode(code) {
    let deobfuscatedCode = code;
    //TODO allow preserving original indentation?
    deobfuscatedCode = shrinkSpaces(deobfuscatedCode);
    if (readSetting(SETTINGS.removeComments)) deobfuscatedCode = removeComments(deobfuscatedCode);
    if (readSetting(SETTINGS.removeDeadCode)) deobfuscatedCode = removeDeadCode(deobfuscatedCode);
    if (readSetting(SETTINGS.renameVariables)) deobfuscatedCode = renameVariables(deobfuscatedCode);
    deobfuscatedCode = indentCode(deobfuscatedCode);
    return deobfuscatedCode;
}

function shrinkSpaces(code) {
    const codeLines = code.split("\n");
    for (let i = codeLines.length - 1; i >= 0; i--) {
        codeLines[i] = codeLines[i].trim();
        if (codeLines[i] === "") codeLines.splice(i, 1);
    }
    code = codeLines.join("\n");

    //code = code.replace(/\t/g, ' ');
    //code = code.replace(/  +/g, ' ');
    return code;
}

function indentCode(code) {
    //TODO allow changing indent symbol (e.g. 2 spaces instead of 4)
    const blockIndent = "    ";
    let blockStack = [];

    const codeLines = code.split("\n");
    for (let i = 0; i < codeLines.length; i++) {
        let lvlMod = 0;
        codeLines[i] = codeLines[i].trim();
        const matchResult = codeLines[i].match(new RegExp("^[ \\t]*((Private|Public)[ \\t]+)?(?<firstWord>\\b[A-Za-z]+?\\b).*?$"));
        if (matchResult) {
            const firstWord = matchResult.groups.firstWord;
            const blockStart = blocks.find(b => b.start === firstWord);
            if (blockStart) {
                blockStack.push(blockStart);
                lvlMod = -1;
            } else if (blockStack.length > 0 && blockStack[blockStack.length - 1].end === firstWord) {
                const poppedBlock = blockStack.pop();
                if (poppedBlock.start === "Sub" || poppedBlock.start === "Function") {
                    codeLines.splice(i + 1, 0, "");
                }
            }
        }
        for (let lvl = 0; lvl < blockStack.length + lvlMod; lvl++) {
            codeLines[i] = blockIndent + codeLines[i];
        }
    }
    code = codeLines.join("\n");
    return code;
}

// lower case
const autoExecFunctions = ["document_open"];

export function removeComments(code) {
    let codeLines = code.split("\n");
    for (let i = 0; i < codeLines.length; i++) {
        codeLines[i] = codeLines[i].replace(commentRegex, "$<before_comment>");
    }
    return codeLines.join("\n");
}

export function collapseLongLines(code) {
    return code.replaceAll(lineBreakRegex, " ");
}

function renameVariables(code) {
    //todo block-aware renaming?
    //todo type-aware names?
    //todo function arguments renaming
    //todo dont rename occurences in strings
    const functions = [];
    const newFuncs = [];

    let codeLines = code.split("\n");
    for (const line of codeLines) {
        const matchResult = line.match(functionDeclarationRegex);
        if (matchResult) {
            const functionName = matchResult.groups.functionName;
            functions.push(functionName.toLowerCase());
        }
    }

    let iterator = 0;
    for (const func of functions) {
        if (autoExecFunctions.includes(func)) continue;
        const new_func_name = "fun_" + iterator;
        for (let i = 0; i < codeLines.length; i++) {
            codeLines[i] = codeLines[i].replaceAll(new RegExp(`\\b${func}\\b`, "gi"), new_func_name);
        }
        newFuncs.push(new_func_name);
        iterator++;
    }

    const variables = [];

    for (const line of codeLines) {
        const matchResult = line.match(variableDeclarationRegex);
        if (matchResult) {
            if (matchResult.groups.variableName) {
                variables.push(matchResult.groups.variableName.toLowerCase());
            } else if (matchResult.groups.variableName2) {
                variables.push(matchResult.groups.variableName2.toLowerCase());
            }
        }
    }

    iterator = 0;
    for (const variable of variables) {
        if (newFuncs.includes(variable)) continue;
        const new_var_name = "var_" + iterator;
        for (let i = 0; i < codeLines.length; i++) {
            codeLines[i] = codeLines[i].replaceAll(new RegExp(`\\b${variable}\\b`, "gi"), new_var_name);
        }
        iterator++;
    }

    return codeLines.join("\n");
}

function removeDeadCode(code) {
    /*
    Notes:
    Functions and Subs can't be "unused" because they can be called directly from a document's list of macro scripts by a user
     */
    code = removeUnusedVariables(code);
    return code;
}

function removeUnusedVariables(code) {
    /*
    Notes:
    You cannot assign a value to an array that was not declared with Dim
    //todo should account for SCOPE of variables
     */
    const variables = [];

    let codeLines = code.split("\n");
    for (const line of codeLines) {
        if (variableDeclarationRegex.test(line)) {
            const groups = line.match(variableDeclarationRegex).groups;
            if (groups.variableName) {
                variables.push(groups.variableName);
            } else if (groups.variableName2) {
                variables.push(groups.variableName2);
            }

            if (groups.variableName && groups.variableName2) {
                console.log("Excuse me?! RemoveUnusedVariables method matched variable declaration using two regexes simultaneously");
            }
        }
    }

    for (const variable of variables) {
        let used = false;
        for (const line of codeLines) {
            if (new RegExp(`\\b${variable}\\b`).test(line)) {
                const matchResult = line.match(variableDeclarationRegex);
                if (!matchResult || (matchResult.groups.variableName && matchResult.groups.variableName !== variable) || (matchResult.groups.variableName2 && matchResult.groups.variableName2 !== variable)) {
                    used = true;
                    break;
                }
            }
        }
        if (!used) {
            codeLines = codeLines.filter(line => !(new RegExp(`\\b${variable}\\b`).test(line)));
        }
    }

    return codeLines.join("\n");
}

function logicalAnalysis(code) {
    const codeLines = code.split("\n");
    const resultCode = "";
    const stack = [];
    const variables = {};
    for (const line of codeLines) {
        if (functionDeclarationRegex.test(line)) {
            const groups = line.match(functionDeclarationRegex).groups;
            stack.push(groups.functionName);
        }
    }
    return resultCode;
}