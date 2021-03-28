export function detectVBAStomping(oleFile) {
    for (const module of oleFile.macroModules) {
        const keywords = new Set();
        for (const line of module.pcode) {
            const tokens = line.split(" ");
            const mnemonic = tokens[0];

            let arg = '';
            if (tokens.length >= 2) {
                arg = tokens[1];
            }

            if (['ArgsCall', 'ArgsLd', 'St', 'Ld', 'MemSt', 'Label'].includes(mnemonic)) {
                let keyword = arg;
                keywords.add(keyword);
            }
        }

        for (const keyword of keywords.values()) {
            if (!module.sourceCode.includes(keyword)) {
                return true;
            }
        }
    }
    return false;
}