import {byteArrayToStr, readInt, skipStructure} from "./macros_extraction";

let is64bit = true; //?

// Algorithms taken from this repository
// https://github.com/bontchev/pcodedmp

export function disassemblePCode(moduleData, vbaProjectData) {
    const identifiers = getIdentifiers(vbaProjectData);
    /*
    let vbaVer = 3;
    let version = getWord(vbaProjectData, 2);
    let dwLength, declarationTable, tableStart, indirectTable, dwLength2, objectTable, offset, offs;
    if (version >= 0x6B) {
        if (version >= 0x97) {
            vbaVer = 7;
        } else {
            vbaVer = 6;
        }
        if (is64bit) {
            dwLength = getDWord(moduleData, 0x0043);
            declarationTable = moduleData.slice(0x0047, 0x0047 + dwLength);
            dwLength = getDWord(moduleData, 0x0011);
            tableStart = dwLength + 12;
        } else {
            dwLength = getDWord(moduleData, 0x003F);
            declarationTable = moduleData.slice(0x0043, 0x0043 + dwLength);
            dwLength = getDWord(moduleData, 0x0011);
            tableStart = dwLength + 10;
        }
        dwLength = getDWord(moduleData, tableStart);
        tableStart += 4;
        indirectTable = moduleData.slice(tableStart, tableStart + dwLength);
        dwLength = getDWord(moduleData, 0x0005);
        dwLength2 = dwLength + 0x8A;
        dwLength = getDWord(moduleData, dwLength2);
        dwLength2 += 4;
        objectTable = moduleData.slice(dwLength2, dwLength2 + dwLength);
        offset = 0x0019;
    } else {
        vbaVer = 5;
        offset = 11;
        dwLength = getDWord(moduleData, offset);
        offs = offset + 4;
        declarationTable = moduleData.slice(offs, offs + dwLength);
        offset = skipStructure(moduleData, offset, True, 1, False);
        offset += 64;
        offset = skipStructure(moduleData, offset, False, 16, False);
        offset = skipStructure(moduleData, offset, True, 1, False);
        offset += 6;
        offset = skipStructure(moduleData, offset, True, 1, False);
        offs = offset + 8;
        dwLength = getDWord(moduleData, offs);
        tableStart = dwLength + 14;
        offs = dwLength + 10;
        dwLength = getDWord(moduleData, offs);
        indirectTable = moduleData.slice(tableStart, tableStart + dwLength);
        dwLength = getDWord(moduleData, offset);
        offs = dwLength + 0x008A;
        dwLength = getDWord(moduleData, offs);
        offs += 4;
        objectTable = moduleData.slice(offs, offs + dwLength);
        offset += 77;
    }
    dwLength = getDWord(moduleData, offset);
    offset = dwLength + 0x003C;
    let magic = getVar(moduleData, offset, False);
    offset += 2;
    let numLines = getVar(moduleData, offset, False);
    const pcodeStart = offset + numLines * 12 + 10;
    const pcode = [];
    for (let line = 0; line < numLines; line++) {
        offset += 4;
        const lineLength = getVar(moduleData, offset, False);
        offset += 2;
        const lineOffset = getVar(moduleData, offset, True);
        pcode.push(dumpLine(moduleData, pcodeStart + lineOffset, lineLength, vbaVer, identifiers, objectTable, indirectTable, declarationTable, line));
    }
    return pcode;

     */
}

function dumpLine(moduleData, lineStart, lineLength, vbaVer, identifiers, objectTable, indirectTable, declarationTable, line) {

}

function getIdentifiers(vbaProjectData) {
    let identifiers = [];
    let offset = {value: 2};
    let version = readInt(vbaProjectData, offset, 2);
    let unicodeRef = (version >= 0x5B) && (![0x60, 0x62, 0x63].includes(version)) || (version === 0x4E);
    let unicodeName = (version >= 0x59) && (![0x60, 0x62, 0x63].includes(version)) || (version === 0x4E);
    let nonUnicodeName = ((version <= 0x59) && (version !== 0x4E)) || (0x5F > version > 0x6B);
    if (readInt(vbaProjectData, {value: 5}, 2) === 0x000E) {
        console.log("Big-endian identifiers?");
    }
    offset.value = 0x1E;
    let numRefs = readInt(vbaProjectData, offset, 2);
    offset.value += 2;
    for (let i = 0; i < numRefs; i++) {
        let refLength = readInt(vbaProjectData, offset, 2);
        if (refLength === 0) {
            offset.value += 6;
        } else {
            if ((unicodeRef && (refLength < 5)) || ((!unicodeRef) && (refLength < 3))) {
                offset.value += refLength;
            } else {
                let c;
                if (unicodeRef) {
                    c = vbaProjectData[offset.value + 4];
                } else {
                    c = vbaProjectData[offset.value + 2];
                }
                offset.value += refLength;
                if (c === 67 || c === 68) {
                    skipStructure(vbaProjectData, offset, 2);
                }
            }
        }
        offset.value += 10;
        let word = readInt(vbaProjectData, offset, 2);
        if (word) {
            skipStructure(vbaProjectData, offset, 2);
            let wLength = readInt(vbaProjectData, offset, 2);
            if (wLength) {
                offset.value += 2;
            }
            offset.value += wLength + 30;
        }
    }
    // Number of entries in the class/user forms table
    skipStructure(vbaProjectData, offset, 2, 2);
    // Number of compile-time identifier-value pairs
    skipStructure(vbaProjectData, offset, 2, 4);
    offset.value += 2;
    // Typeinfo typeID
    skipStructure(vbaProjectData, offset, 2);
    //Project description
    skipStructure(vbaProjectData, offset, 2);
    // Project help file name
    skipStructure(vbaProjectData, offset, 2);
    offset.value += 0x64;
    // Skip the module descriptors
    let numProjects = readInt(vbaProjectData, offset, 2);
    for (let i = 0; i < numProjects; i++) {
        let wLength = readInt(vbaProjectData, offset, 2);
        // Code module name
        if (unicodeName) {
            offset.value += wLength;
        }
        if (nonUnicodeName) {
            if (wLength) {
                wLength = readInt(vbaProjectData, offset, 2);
            }
            offset.value += wLength;
        }
        // Stream time
        skipStructure(vbaProjectData, offset, 2);
        skipStructure(vbaProjectData, offset, 2);
        readInt(vbaProjectData, offset, 2);
        if (version >= 0x6B) {
            skipStructure(vbaProjectData, offset, 2);
        }
        skipStructure(vbaProjectData, offset, 2);
        offset.value += 2;
        if (version !== 0x51) {
            offset.value += 4;
        }
        skipStructure(vbaProjectData, offset, 2, 8);
        offset.value += 11;
    }
    offset.value += 6;
    skipStructure(vbaProjectData, offset, 4);
    offset.value += 6;
    let w0 = readInt(vbaProjectData, offset, 2);
    let numIDs = readInt(vbaProjectData, offset, 2);
    let w1 = readInt(vbaProjectData, offset, 2);
    offset.value += 4;
    let numJunkIDs = numIDs + w1 - w0;
    numIDs = w0 - w1;

    // Skip the junk IDs
    for (let i = 0; i < numJunkIDs; i++) {
        offset.value += 4;
        let idLength = readInt(vbaProjectData, offset, 1);
        let idType = readInt(vbaProjectData, offset, 1);
        if (idType > 0x7F) {
            offset.value += 6;
        }
        offset.value += idLength;
    }
    //Now offset points to the start of the variable names area
    for (let i = 0; i < numIDs; i++) {
        let isKwd = false;
        let ident = '';
        let idLength = readInt(vbaProjectData, offset, 1);
        let idType = readInt(vbaProjectData, offset, 1);
        if (idLength === 0 && idType === 0) {
            offset.value += 2;
            idLength = readInt(vbaProjectData, offset, 1);
            idType = readInt(vbaProjectData, offset, 1);
            isKwd = true;
        }
        if (idType & 0x80) {
            offset.value += 6;
        }
        if (idLength) {
            ident = byteArrayToStr(vbaProjectData.slice(offset.value, offset.value + idLength));
            identifiers.push(ident);
            offset.value += idLength;
        }
        if (!isKwd) {
            offset.value += 4;
        }
    }
    console.log(identifiers);
    return identifiers;
}