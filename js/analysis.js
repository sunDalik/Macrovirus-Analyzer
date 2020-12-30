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
    "Shell"
];

export function analyzeCode(code) {
    const foundWords = [];
    for (const word of suspiciousWords) {
        //if (code.includes(word)) foundWords.push(word);
        if (new RegExp(`\\b${word}\\b`, "i").test(code)) foundWords.push(word);
    }

    if (foundWords.length === 0) return "File is safe!\n";
    else {
        let output = "File contains suspicious commands:\n";
        for (const word of foundWords) {
            output += "\n<li>" + word + "</li>";
        }
        return output;
    }
}