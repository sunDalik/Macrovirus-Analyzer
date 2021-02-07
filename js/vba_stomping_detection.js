export function detectVBAStomping(pcode, sourceCode) {
    const keywords = new Set();
    for (const line of pcode) {
        const tokens = line.split(" ");
        const mnemonic = tokens[0];

        let arg = '';
        if (tokens.length >= 2) {
            arg = tokens[1];
        }

        console.log("mnem: " + mnemonic + ", arg: " + arg);
        if (['ArgsCall', 'ArgsLd', 'St', 'Ld', 'MemSt', 'Label'].includes(mnemonic)) {
            let keyword = arg;
            keywords.add(keyword);
        }
    }
    console.log(keywords);

    for (const keyword of keywords.values()) {
        if (!sourceCode.includes(keyword)) {
            return true;
        }
    }
    return false;
}