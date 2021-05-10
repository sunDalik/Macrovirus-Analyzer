import {readSetting, SETTINGS} from "./local_storage";
import {isAutoExec} from "./analysis";
import {Asc, Chr} from "./vba_functions";

const varName = "[A-Za-z][A-Za-z0-9_\-]*";

export const functionDeclarationRegex = new RegExp(`^[ \\t]*((Public|Private)[ \\t]+)?(Sub|Function)[ \\t]+(?<functionName>${varName})[ \\t]*\\(.*\\)`);
export const functionEndRegex = new RegExp(`^[ \\t]*End[ \\t]*(Sub|Function)[ \\t]*$`, 'm');
export const keywordRegex = (keyword, i = false) => {
    let flags = "g";
    if (i) flags += "i";
    return new RegExp(`^(?<before>(?:[^"]*?"[^"]*?")*?[^"]*?)\\b${keyword}\\b`, flags);
};

export const funcCallRegex = (funcName) => {
    return new RegExp(`\\b${funcName}[ \\t]*\\((?<args>.*?)\\)`, "gi");
};

export const stringRegex = (str, i = false) => {
    let flags = "g";
    if (i) flags += "i";
    return new RegExp(`\"${str}\"`, flags);
};

export const dllDeclarationRegex = new RegExp(`^[ \\t]*((Public|Private)[ \\t]+)?Declare[ \\t]+(Sub|Function)[ \\t]+(?<functionName>${varName})`);

const variableDeclarationRegex = new RegExp(`(^[ \\t]*(Set|Dim)[ \\t]+(?<variableName>${varName}).*?$)|(^[ \\t]*(?<variableName2>${varName})([ \\t]*\\(.+?\\))?[ \\t]*=.*?$)`);
const fullLineCommentRegex = new RegExp(`^[ \\t]*'.*`);
const commentRegex = new RegExp(`^(?<before_comment>(?:[^"]*?"[^"]*?")*?[^"]*?)(?<comment>'.*)`);
const lineBreakRegex = new RegExp(` _(\r\n|\r|\n)`, "g");
const colonDelimiterRegex = new RegExp(`:(?!=)`, "g");

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
    deobfuscatedCode = removeColonDelimiters(deobfuscatedCode);
    if (readSetting(SETTINGS.removeDeadCode)) deobfuscatedCode = removeDeadCode(deobfuscatedCode);
    if (readSetting(SETTINGS.renameVariables)) deobfuscatedCode = renameVariables(deobfuscatedCode);
    if (readSetting(SETTINGS.deobfuscateStrings)) deobfuscatedCode = deobfuscateStrings(deobfuscatedCode);
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

function replaceKeyword(text, keyword, new_keyword, i = false) {
    return text.replace(keywordRegex(keyword, i), "$<before>" + new_keyword);
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

export function removeComments(code) {
    let newCodeLines = [];
    for (const line of code.split("\n")) {
        if (!fullLineCommentRegex.test(line)) {
            newCodeLines.push(line.replace(commentRegex, "$<before_comment>"));
        }
    }
    return newCodeLines.join("\n");
}

export function removeColonDelimiters(code) {
    code = code.replace(colonDelimiterRegex, "\n");
    return code;
}

export function collapseLongLines(code) {
    return code.replaceAll(lineBreakRegex, " ");
}

function renameVariables(code) {
    //todo block-aware renaming?
    //todo type-aware names?
    //todo function arguments renaming
    const functions = [];
    const newFuncs = [];

    let codeLines = code.split("\n");
    for (const line of codeLines) {
        const matchResult = line.match(functionDeclarationRegex);
        if (matchResult) {
            functions.push(matchResult.groups.functionName);
        }
    }

    let iterator = 0;
    for (const func of functions) {
        if (isAutoExec(func)) continue;
        const new_func_name = "fun_" + iterator;
        for (let i = 0; i < codeLines.length; i++) {
            codeLines[i] = replaceKeyword(codeLines[i], func, new_func_name, true);
        }
        newFuncs.push(new_func_name);
        iterator++;
    }

    const variables = [];

    for (const line of codeLines) {
        const matchResult = line.match(variableDeclarationRegex);
        if (matchResult) {
            if (matchResult.groups.variableName) {
                variables.push(matchResult.groups.variableName);
            } else if (matchResult.groups.variableName2) {
                variables.push(matchResult.groups.variableName2);
            }
        }
    }

    iterator = 0;
    for (const variable of variables) {
        if (newFuncs.includes(variable)) continue;
        const new_var_name = "var_" + iterator;
        for (let i = 0; i < codeLines.length; i++) {
            codeLines[i] = replaceKeyword(codeLines[i], variable, new_var_name, true);
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

// TODO very very bad. Can find functions inside strings and doesnt support nested functions
function deobfuscateStrings(code) {
    let codeLines = code.split("\n");
    for (let i = 0; i < codeLines.length; i++) {
        codeLines[i] = codeLines[i].replace(funcCallRegex("Chr"), (match, p1, offset, string, groups) => {
            const arg = Number(groups.args);
            if (Number.isNaN(arg)) return match;
            else return "\"" + Chr(arg).toString() + "\"";
        });
        codeLines[i] = codeLines[i].replace(funcCallRegex("ChrW"), (match, p1, offset, string, groups) => {
            const arg = Number(groups.args);
            if (Number.isNaN(arg)) return match;
            else return "\"" + Chr(arg).toString() + "\"";
        });
        codeLines[i] = codeLines[i].replace(funcCallRegex("Asc"), (match, p1, offset, string, groups) => {
            const arg = groups.args;
            if (arg[0] === "\"" && arg[arg.length - 1] === "\"") return Asc(arg).toString();
            else return match;
        });
    }
    return codeLines.join("\n");
}