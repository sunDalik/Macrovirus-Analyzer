// vbaProject is an array of bytes
import {decompressVBASourceCode} from "./vba_source_code_decompression";
import {OLEFile} from "./ole_file";
import {DirEntryType} from "./enums";

export function extractMacro(vbaProject) {
    readOLEFile(new Uint8Array(vbaProject));

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

//should ole file reading be performed in olefile constructor?
function readOLEFile(byteArray) {
    // https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-cfb/53989ce4-7b05-4f8d-829b-d08d6148375b
    const oleFile = new OLEFile();
    const offset = {value: 0};
    const headerSignature = readInt(byteArray, offset, 8); // Must be 0xD0 0xCF 0x11 0xE0 0xA1 0xB1 0x1A 0xE1
    const headerCLSID = readByteArray(byteArray, offset, 16);
    const minorVersion = readInt(byteArray, offset, 2);
    const majorVersion = readInt(byteArray, offset, 2);
    const byteOrder = readInt(byteArray, offset, 2);
    const sectorShift = readInt(byteArray, offset, 2);
    const sectorSize = 2 ** sectorShift;
    const miniSectorShift = readInt(byteArray, offset, 2);
    const miniSectorSize = 2 ** miniSectorShift;
    const reserved = readByteArray(byteArray, offset, 6);
    const numberOfDirectorySectors = readInt(byteArray, offset, 4);
    const numberOfFATSectors = readInt(byteArray, offset, 4);
    const firstDirectorySector = readInt(byteArray, offset, 4);
    const transactionSignatureNumber = readInt(byteArray, offset, 4);
    const miniStreamCutoff = readInt(byteArray, offset, 4);
    const firstMiniFATSector = readInt(byteArray, offset, 4);
    const numberOfMiniFATSectors = readInt(byteArray, offset, 4);
    const firstDIFATSector = readInt(byteArray, offset, 4);
    const numberOfDIFATSectors = readInt(byteArray, offset, 4);
    const DIFAT = readByteArray(byteArray, offset, 436);

    //todo
    //readDIFAT(byteArray)
    const FAT = readFAT(byteArray, DIFAT, numberOfFATSectors);
    const fileTree = readFileTree(byteArray, FAT, firstDirectorySector);
}

/*
byteArray - Uint8Array with file contents
offset - object of type {value: x} where x is the actual offset value
offset will be incremented after read
bytesToRead - number of bytes to read from byteArray
 */
function readInt(byteArray, offset, bytesToRead) {
    const slicedArray = byteArray.slice(offset.value, offset.value + bytesToRead).buffer;
    let value;
    if (bytesToRead === 1) value = new DataView(slicedArray).getUint8(0);
    else if (bytesToRead === 2) value = new DataView(slicedArray).getUint16(0, true);
    else if (bytesToRead === 4) value = new DataView(slicedArray).getUint32(0, true);
    else if (bytesToRead > 4) value = new DataView(slicedArray).getBigUint64(0, true);
    offset.value += bytesToRead;
    return value;
}

function readByteArray(byteArray, offset, bytesToRead) {
    const slicedArray = byteArray.slice(offset.value, offset.value + bytesToRead);
    offset.value += bytesToRead;
    return slicedArray;
}

function readSector(byteArray, sectorNumber) {
    const sectorSize = 512;//todo make changeable;
    const offset = (sectorNumber + 1) * sectorSize;
    return byteArray.slice(offset, offset + sectorSize);
}

function readSectorChainFAT(byteArray, startSectorNumber, FAT) {
    const sectorSize = 512;//todo make changeable;
    const sectorIndexesArray = [startSectorNumber];
    let attempt = 0;
    while (attempt++ < 999999) {
        const nextSector = readInt(FAT, {value: sectorIndexesArray[sectorIndexesArray.length - 1] * 4}, 4);
        if (nextSector === 0xFFFFFFFE) break;
        sectorIndexesArray.push(nextSector);
    }

    const resultArray = new Uint8Array(sectorIndexesArray.length * sectorSize);
    for (let i = 0; i < sectorIndexesArray.length; i++) {
        const sectorNumber = sectorIndexesArray[i];
        const offset = (sectorNumber + 1) * sectorSize;
        for (let b = 0; b < sectorSize; b++) {
            resultArray[i * sectorSize + b] = byteArray[offset + b];
        }
    }
    return resultArray;
}

function readMiniSector() {
    const sectorSize = 64;//todo make changeable;
    //const offset = sectorNumber * sectorSize;
    //todo
    return;
}

function readFAT(byteArray, DIFAT, numberOfFATSectors) {
    const sectorSize = 512;//todo make changeable;
    const FAT = new Uint8Array(numberOfFATSectors * sectorSize);
    let offset = {value: 0};
    for (let i = 0; i < numberOfFATSectors; i++) {
        const sectorNumber = readInt(DIFAT, offset, 4);
        const sector = readSector(byteArray, sectorNumber);
        for (let b = 0; b < sector.length; b++) {
            FAT[i * sectorSize + b] = sector[b];
        }
    }
    return FAT;
}

function readFileTree(byteArray, FAT, firstDirectorySector) {
    const sectorSize = 512;//todo make changeable;
    const cutoff = 4096;//todo make changeable;
    const directoryEntrySize = 128;
    const directoriesData = readSectorChainFAT(byteArray, firstDirectorySector, FAT);

    const directoryEntries = [];
    for (let i = 0; i < directoriesData.length; i += directoryEntrySize) {
        const dirEntry = {
            id: i / directoryEntrySize,
            name: "",
            type: DirEntryType.UNKNOWN,
            children: [],
            startingSector: null,
            streamSize: null,

            //temporary fields needed to build a proper tree later
            leftSiblingId: null,
            rightSiblingId: null,
            childId: null
        };
        const offset = {value: i + 64};
        const nameFieldLength = readInt(directoriesData, offset, 2);
        const nameLength = Math.max(nameFieldLength / 2 - 1, 0);
        const nameArray = new Uint8Array(nameLength);
        for (let j = 0; j < nameLength; j++) {
            nameArray[j] = directoriesData[i + j * 2];
        }
        dirEntry.name = byteArrayToStr(nameArray);

        const objectType = readInt(directoriesData, offset, 1);
        if (objectType === 0) dirEntry.type = DirEntryType.UNKNOWN;
        else if (objectType === 1) dirEntry.type = DirEntryType.STORAGE;
        else if (objectType === 2) dirEntry.type = DirEntryType.STREAM;
        else if (objectType === 5) dirEntry.type = DirEntryType.ROOT;

        const colorFlag = readInt(directoriesData, offset, 1);
        dirEntry.leftSiblingId = readInt(directoriesData, offset, 4);
        dirEntry.rightSiblingId = readInt(directoriesData, offset, 4);
        dirEntry.childId = readInt(directoriesData, offset, 4);
        const CLSID = readByteArray(directoriesData, offset, 16);
        const stateBits = readByteArray(directoriesData, offset, 4);
        const creationTime = readInt(directoriesData, offset, 8);
        const modifiedTime = readInt(directoriesData, offset, 8);
        dirEntry.startingSector = readInt(directoriesData, offset, 4);
        dirEntry.streamSize = readInt(directoriesData, offset, 8);
        directoryEntries.push(dirEntry);
    }

    const findSiblings = (dir, entries) => {
        let siblings = [dir];
        if (dir.leftSiblingId !== null && dir.leftSiblingId !== 0xFFFFFFFF) {
            siblings = siblings.concat(findSiblings(entries.find(d => d.id === dir.leftSiblingId), entries));
        }
        if (dir.rightSiblingId !== null && dir.rightSiblingId !== 0xFFFFFFFF) {
            siblings = siblings.concat(findSiblings(entries.find(d => d.id === dir.rightSiblingId), entries));
        }
        return siblings;
    };

    const findChildren = (dir, entries) => {
        if (dir.childId !== null && dir.childId !== 0xFFFFFFFF) {
            dir.children = findSiblings(entries.find(d => d.id === dir.childId), entries);
        }

        for (const child of dir.children) {
            findChildren(child, entries);
        }
    };

    findChildren(directoryEntries[0], directoryEntries);
    const directoryTree = directoryEntries[0];
    return directoryTree;
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