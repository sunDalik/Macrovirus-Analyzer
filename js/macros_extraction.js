// vbaProject is an array of bytes
function extractMacro(vbaProject) {
    const codeSequence = [0, 65, 116, 116, 114, 105, 98, 117, 116, 0, 101];
    const resultIndexes = [];

    let i = 0;

    while (i < (vbaProject.length - codeSequence.length)) {
        const subarray = vbaProject.slice(i, i + codeSequence.length);

        let match = true;
        for (let si = 0; si < subarray.length; si++) {
            if (subarray[si] !== codeSequence[si]) {
                match = false;
                break;
            }
        }
        if (match) resultIndexes.push(i - 3);
        i++;
    }

    const macroSourceCodes = [];

    for (const resI of resultIndexes) {
        const codeArrayBuffer = new ArrayBuffer(vbaProject.length - resI);
        const codeArrayBufferByteView = new Uint8Array(codeArrayBuffer);
        for (let i = 0; i < vbaProject.length - resI; i++) {
            codeArrayBufferByteView[i] = vbaProject[i + resI];
        }
        const codeBytes = decompressVBASourceCode(codeArrayBuffer);
        //const uint16CodeArray = new Uint16Array(byteArrayToArrayBuffer(codeBytes));
        macroSourceCodes.push(byteArrayToStr(codeBytes));
    }
    return macroSourceCodes;
}

function byteArrayToArrayBuffer(byteArray) {
    let length = byteArray.length;
    if (length % 2 === 1) length++;
    const arrayBuffer = new ArrayBuffer(length);
    const uint8Array = new Uint8Array(arrayBuffer);
    for (let i = 0; i < byteArray.length; i++) {
        uint8Array[i] = byteArray[i];
    }
    return arrayBuffer;
}

function byteArrayToStr(array) {
    // utf16
    let string = "";
    for (let i = 0; i < array.length; i++) {
        const code = array[i];
        if (code === 0) continue;
        string += String.fromCharCode(code);
    }
    return string;

    //utf8
    let out = "";
    for (let i = 0; i < array.length; i++) {
        let c = array[i++];
        let char2, char3;
        switch (c >> 4) {
            case 0:
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
            case 6:
            case 7:
                // 0xxxxxxx
                out += String.fromCharCode(c);
                break;
            case 12:
            case 13:
                // 110x xxxx   10xx xxxx
                char2 = array[i++];
                out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
                break;
            case 14:
                // 1110 xxxx  10xx xxxx  10xx xxxx
                char2 = array[i++];
                char3 = array[i++];
                out += String.fromCharCode(((c & 0x0F) << 12) |
                    ((char2 & 0x3F) << 6) |
                    ((char3 & 0x3F) << 0));
                break;
        }
    }

    return out;
}