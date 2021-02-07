import {detectVBAStomping} from "./vba_stomping_detection";

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