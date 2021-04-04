export function detectVBAStomping(oleFile) {
    const result = [];
    let fullSourceCode = "";
    for (const module of oleFile.macroModules) {
        fullSourceCode += module.sourceCode + " ";
    }
    for (const module of oleFile.macroModules) {
        const keywords = new Set();
        for (const command of module.pcode) {
            for (const line of command.split("\n")) {
                const i = line.indexOf(" ");
                const tokens = [line.slice(0, i), line.slice(i + 1)];
                const mnemonic = tokens[0];

                let args = '';
                if (tokens.length === 2) {
                    args = tokens[1];
                }

                if (['ArgsCall', 'ArgsLd', 'St', 'Ld', 'MemSt', 'Label'].includes(mnemonic)) {
                    if (args.startsWith("(Call) ")) {
                        args = args.slice(7);
                    }
                    const keyword = args.split(" ")[0];
                    if (!keyword.startsWith("id_")) {
                        keywords.add(keyword);
                    }
                }

                if (mnemonic === 'LitStr') {
                    const i = line.indexOf(" ");
                    let str = args.slice(i + 1);
                    if (str.length >= 2) {
                        str = str.slice(1, str.length - 1);
                        str = str.replaceAll('"', '""');
                        str = '"' + str + '"';
                    }
                    keywords.add(str);
                }
            }
        }

        for (const keyword of keywords.values()) {
            if (keyword === "undefined") continue;
            if (!fullSourceCode.toLowerCase().includes(keyword.toLowerCase())) {
                result.push({module: module, keyword: keyword});
            }
        }
    }
    return result;
}