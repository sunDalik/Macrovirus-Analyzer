/*
byteArray - Uint8Array with file contents
offset - object of type {value: x} where x is the actual offset value
offset will be incremented after read
bytesToRead - number of bytes to read from byteArray
 */
export function readInt(byteArray, offset, bytesToRead) {
    const slicedArray = byteArray.slice(offset.value, offset.value + bytesToRead).buffer;
    let value;
    if (bytesToRead === 1) value = new DataView(slicedArray).getUint8(0);
    else if (bytesToRead === 2) value = new DataView(slicedArray).getUint16(0, true);
    else if (bytesToRead === 4) value = new DataView(slicedArray).getUint32(0, true);
    else if (bytesToRead > 4) value = new DataView(slicedArray).getBigUint64(0, true);
    offset.value += bytesToRead;
    return value;
}

export function readByteArray(byteArray, offset, bytesToRead) {
    const slicedArray = byteArray.slice(offset.value, offset.value + bytesToRead);
    offset.value += bytesToRead;
    return slicedArray;
}

export function skipStructure(buffer, offset, lengthBytes, elementSize = 1) {
    let length = readInt(buffer, offset, lengthBytes);
    let invalidLength = lengthBytes === 2 ? 0xFFFF : 0xFFFFFFFF;
    if (length !== invalidLength) {
        offset.value += length * elementSize;
    }
}

export function byteArrayToStr(array) {
    // utf16
    let string = "";
    for (let i = 0; i < array.length; i++) {
        const code = array[i];
        if (code === 0) continue;
        string += String.fromCharCode(code);
    }
    return string;
}

/*
export function byteArrayToStrTest(array) {
    let out, i, len, c;
    let char2, char3;

    out = "";
    len = array.length;
    i = 0;
    while (i < len) {
        c = array[i++];
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
 */