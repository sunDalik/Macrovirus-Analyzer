const varName = "[A-Za-z][A-Za-z0-9_\-]*";
const functionRegex = new RegExp(`^[ \\t]*(Public|Private|)[ \\t]*(Sub|Function)[ \\t]+(?<functionName>${varName})[ \\t]*\(.*\)[ \\t]*$`);
const forRegex = new RegExp(`^[ \\t]*For[ \\t]+(?<iteratorVariable>${varName})[ \\t]*=\\s*$`);

const variableDeclarationRegex = new RegExp(`(^[ \\t]*(Set|Dim)[ \\t]+(?<variableName>${varName}).*?$)|(^[ \\t]*(?<variableName2>${varName})([ \\t]*\(.+?\))?[ \\t]*=.*?$)`);

const settings = {
    renameVariables: true,
    removeDeadCode: true
};

export function deobfuscateCode(code) {
    let deobfuscatedCode = code;
    if (settings.removeDeadCode) deobfuscatedCode = removeDeadCode(deobfuscatedCode);
    if (settings.renameVariables) deobfuscatedCode = renameVariables(deobfuscatedCode);
    return deobfuscatedCode;
}

function renameVariables(code) {

    return code;
}

function removeDeadCode(code) {
    code = removeUnusedVariables(code);
    return code;
}

function removeUnusedVariables(code) {
    /*
    Notes:
    You cannot assign a value to an array that was not declared with Dim
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