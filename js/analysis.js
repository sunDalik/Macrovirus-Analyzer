const suspiciousWords = [
    "Kill",
    "Shell",
    "Microsoft.XMLHTTP",
    "CreateTextFile"
];

export function analyzeCode(code) {
    const foundWords = [];
    for (const word of suspiciousWords) {
        if (code.includes(word)) foundWords.push(word);
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