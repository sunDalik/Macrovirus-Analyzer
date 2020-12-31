const varName = "[A-Za-z][A-Za-z0-9_\-]*";

const functionRegex = new RegExp(`^[ \\t]*(Public|Private|)[ \\t]*(Sub|Function)[ \\t]+(?<functionName>${varName})[ \\t]*\\(.*\\)[ \\t]*$`);
const forRegex = new RegExp(`^[ \\t]*For[ \\t]+(?<iteratorVariable>${varName})[ \\t]*=[ \\t]*$`);

const variableDeclarationRegex = new RegExp(`(^[ \\t]*(Set|Dim)[ \\t]+(?<variableName>${varName}).*?$)|(^[ \\t]*(?<variableName2>${varName})([ \\t]*\\(.+?\\))?[ \\t]*=.*?$)`);
const functionDeclarationRegex = new RegExp(`^[ \\t]*((Public|Private)[ \\t]+)?(Function|Sub)[ \\t]+(?<functionName>${varName}).*?$`);

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

const settings = {
    renameVariables: true,
    removeDeadCode: true
};

export function deobfuscateCode(code) {
    let deobfuscatedCode = code;
    deobfuscatedCode = shrinkSpaces(deobfuscatedCode);
    if (settings.removeDeadCode) deobfuscatedCode = removeDeadCode(deobfuscatedCode);
    if (settings.renameVariables) deobfuscatedCode = renameVariables(deobfuscatedCode);
    deobfuscatedCode = indentCode(deobfuscatedCode);
    return deobfuscatedCode;
}

function shrinkSpaces(code) {
    const codeLines = code.split("\n");
    for (let i = 0; i < codeLines.length; i++) {
        codeLines[i] = codeLines[i].trim();
    }
    code = codeLines.join("\n");

    //code = code.replace(/\t/g, ' ');
    //code = code.replace(/  +/g, ' ');
    return code;
}

function indentCode(code) {
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

function renameVariables(code) {

    return code;
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
        if (functionRegex.test(line)) {
            const groups = line.match(functionRegex).groups;
            stack.push(groups.functionName);
        }
    }
    return resultCode;
}