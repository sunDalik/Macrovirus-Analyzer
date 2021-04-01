import {disassemblePCode} from "./pcode";
import {DirEntryType} from "./enums";
import {byteArrayToStr, readByteArray, readInt} from "./file_processor";
import {parseVBAFunctions} from "./analysis";

let FILE_ID = 0;

export class OLEFile {
    constructor(binContent) {
        this.id = FILE_ID++;
        this.sectorSize = 512;
        this.miniSectorSize = 64;
        this.miniStreamCutoff = 4096;
        this.DIFAT = new Uint8Array(0);
        this.FAT = new Uint8Array(0);
        this.miniFAT = new Uint8Array(0);
        this.miniStream = new Uint8Array(0);
        this.macroModules = []; //name, sourceCode, pcode
        this.fileTree = {};
        this.binContent = binContent;
        this.readError = false;
        try {
            this.readFile(this.binContent);
        } catch (e) {
            console.log("ERROR READING OLEFILE " + this.id);
            this.readError = true;
        }
        this.isMalicious = false;
        this.analysisResult = "";

        // Code analysis Data
        this.VBAFunctions = parseVBAFunctions(this); //function {id, name, dependencies(ids), body(array of lines), type (FuncType)}
    }

    readFile(binContent) {
        // https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-cfb/53989ce4-7b05-4f8d-829b-d08d6148375b
        const offset = {value: 0};
        const headerSignature = readInt(binContent, offset, 8); // Must be 0xD0 0xCF 0x11 0xE0 0xA1 0xB1 0x1A 0xE1
        const headerCLSID = readByteArray(binContent, offset, 16);
        const minorVersion = readInt(binContent, offset, 2);
        const majorVersion = readInt(binContent, offset, 2);
        const byteOrder = readInt(binContent, offset, 2);
        const sectorShift = readInt(binContent, offset, 2);
        this.sectorSize = 2 ** sectorShift;
        const miniSectorShift = readInt(binContent, offset, 2);
        this.miniSectorSize = 2 ** miniSectorShift;
        const reserved = readByteArray(binContent, offset, 6);
        const numberOfDirectorySectors = readInt(binContent, offset, 4);
        const numberOfFATSectors = readInt(binContent, offset, 4);
        const firstDirectorySector = readInt(binContent, offset, 4);
        const transactionSignatureNumber = readInt(binContent, offset, 4);
        this.miniStreamCutoff = readInt(binContent, offset, 4);
        const firstMiniFATSector = readInt(binContent, offset, 4);
        const numberOfMiniFATSectors = readInt(binContent, offset, 4);
        const firstDIFATSector = readInt(binContent, offset, 4);
        const numberOfDIFATSectors = readInt(binContent, offset, 4);

        this.DIFAT = this.readDIFAT(numberOfDIFATSectors, firstDIFATSector);
        this.FAT = this.readFAT(numberOfFATSectors);
        this.miniFAT = this.readSectorChainFAT(firstMiniFATSector);
        this.fileTree = this.readFileTree(firstDirectorySector);
        this.miniStream = this.readSectorChainFAT(this.fileTree.startingSector);

        const vbaFolder = this.findByPath(this.fileTree, "MACROS/VBA")
            || this.findByPath(this.fileTree, "VBA")
            || this.findByPath(this.fileTree, "_VBA_PROJECT_CUR/VBA");

        //const wb = this.findByPath(this.fileTree, "Workbook");
        //console.log(byteArrayToStr(this.readStream(wb.startingSector, wb.streamSize)));

        if (vbaFolder) {
            const modules = [];
            let dirStream = null;
            let vbaProjectStream = null;
            for (const child of vbaFolder.children) {
                if (!["_VBA_PROJECT", "DIR"].includes(child.name.toUpperCase()) && !child.name.toUpperCase().startsWith("__SRP_")) {
                    modules.push(child);
                }
                if (child.name.toUpperCase() === "DIR") {
                    dirStream = this.readStream(child.startingSector, child.streamSize);
                }
                if (child.name.toUpperCase() === "_VBA_PROJECT") {
                    vbaProjectStream = this.readStream(child.startingSector, child.streamSize);
                }
            }

            dirStream = this.decompressVBASourceCode(dirStream);
            const dirOffset = {value: 0};

            //read project information record
            dirOffset.value += 38;

            dirOffset.value += 2;
            const projectNameRecordSize = readInt(dirStream, dirOffset, 4);
            dirOffset.value += projectNameRecordSize;

            dirOffset.value += 2;
            const docStringSize = readInt(dirStream, dirOffset, 4);
            dirOffset.value += docStringSize;
            dirOffset.value += 2;
            const docStringUnicodeSize = readInt(dirStream, dirOffset, 4);
            dirOffset.value += docStringUnicodeSize;

            dirOffset.value += 2;
            const helpFileSize = readInt(dirStream, dirOffset, 4);
            dirOffset.value += helpFileSize;
            dirOffset.value += 2;
            const helpFileSize2 = readInt(dirStream, dirOffset, 4);
            dirOffset.value += helpFileSize2;

            dirOffset.value += 32;

            // Optional constants field
            const constantsId = readInt(dirStream, dirOffset, 2);
            if (constantsId === 0x000C) {
                const constantsSize = readInt(dirStream, dirOffset, 4);
                dirOffset.value += constantsSize;
                dirOffset.value += 2;
                const constantsSizeUnicode = readInt(dirStream, dirOffset, 4);
                dirOffset.value += constantsSizeUnicode;
            } else {
                dirOffset.value -= 2;
            }

            //read project references record
            let attempt = 0;
            while (attempt++ < 999999) {
                const nameReadResult = this.readNameReference(dirOffset, dirStream);
                if (nameReadResult === false) break;

                const referenceRecordId = readInt(dirStream, dirOffset, 2);
                if (referenceRecordId === 0x002F) {
                    this.readControlReference(dirOffset, dirStream);
                } else if (referenceRecordId === 0x0033) {
                    this.readOriginalReference(dirOffset, dirStream);
                } else if (referenceRecordId === 0x000D) {
                    this.readRegisteredReference(dirOffset, dirStream);
                } else if (referenceRecordId === 0x000E) {
                    this.readProjectReference(dirOffset, dirStream);
                }
            }

            // reading modules records
            // we've already read the id
            const countSize = readInt(dirStream, dirOffset, 4);
            const count = readInt(dirStream, dirOffset, countSize);
            dirOffset.value += 8;
            const moduleRecordsArray = [];
            for (let i = 0; i < count; i++) {
                //module name
                const moduleNameId = readInt(dirStream, dirOffset, 2);
                const moduleNameSize = readInt(dirStream, dirOffset, 4);
                dirOffset.value += moduleNameSize;

                //module name unicode OPTIONAL
                const moduleNameUnicodeId = readInt(dirStream, dirOffset, 2);
                if (moduleNameUnicodeId === 0x0047) {
                    const moduleNameUnicodeSize = readInt(dirStream, dirOffset, 4);
                    dirOffset.value += moduleNameUnicodeSize;
                } else {
                    dirOffset.value -= 2;
                }

                //module stream name
                dirOffset.value += 2;
                const streamNameSize = readInt(dirStream, dirOffset, 4);
                const streamName = readByteArray(dirStream, dirOffset, streamNameSize);
                dirOffset.value += 2;
                const streamNameUnicodeSize = readInt(dirStream, dirOffset, 4);
                const streamNameUnicode = readByteArray(dirStream, dirOffset, streamNameUnicodeSize);

                //doc string
                dirOffset.value += 2;
                const docStringSize = readInt(dirStream, dirOffset, 4);
                dirOffset.value += docStringSize;
                dirOffset.value += 2;
                const docStringUnicodeSize = readInt(dirStream, dirOffset, 4);
                dirOffset.value += docStringUnicodeSize;

                //module offset
                const sourceOffsetId = readInt(dirStream, dirOffset, 2);
                const sourceOffsetSize = readInt(dirStream, dirOffset, 4);
                if (sourceOffsetSize !== 4) console.log("SOURCE OFFSET SIZE != 4");
                const sourceOffset = readInt(dirStream, dirOffset, 4);

                dirOffset.value += 10; // help context
                dirOffset.value += 8; // module cookie

                dirOffset.value += 6; // module type

                // optional read only field
                const readOnlyId = readInt(dirStream, dirOffset, 2);
                if (readOnlyId === 0x0025) {
                    dirOffset.value += 4;
                } else {
                    dirOffset.value -= 2;
                }

                // optional module private field
                const privateId = readInt(dirStream, dirOffset, 2);
                if (privateId === 0x0028) {
                    dirOffset.value += 4;
                } else {
                    dirOffset.value -= 2;
                }

                dirOffset.value += 2; // terminator
                dirOffset.value += 4; // reserved

                //todo secondModule seems to be wrong? empty name and ridiculous offset
                moduleRecordsArray.push({
                    name: byteArrayToStr(streamName),
                    sourceOffset: sourceOffset,
                    nameUnicode: byteArrayToStr(streamNameUnicode)
                });
            }

            this.macroModules = [];

            for (const module of modules) {
                const macroModule = {};
                const dataArray = this.readStream(module.startingSector, module.streamSize);
                const moduleRecord = moduleRecordsArray.find(m => m.name.toUpperCase() === module.name.toUpperCase());
                if (!moduleRecord) continue;
                macroModule.name = moduleRecord.name;
                macroModule.sourceCode = byteArrayToStr(this.decompressVBASourceCode(dataArray.slice(moduleRecord.sourceOffset)));
                try {
                    macroModule.pcode = disassemblePCode(dataArray, vbaProjectStream);
                } catch (e) {
                    console.log("PCODE DISASSEMBLING ERROR");
                    macroModule.pcode = [];
                }
                this.macroModules.push(macroModule);
            }
        }
    }

    findByPath(tree, path) {
        const pathArray = path.split("/");
        let currentFile = tree;
        for (const segment of pathArray) {
            currentFile = currentFile.children.find(f => f.name.toUpperCase() === segment.toUpperCase());
            if (!currentFile) break;
        }
        return currentFile;
    }

    readNameReference(dirOffset, dirStream) {
        const id = readInt(dirStream, dirOffset, 2);
        if (id === 0x000F) return false; // value 0x000F indicates end of references array and start of module records
        const nameSize = readInt(dirStream, dirOffset, 4);
        dirOffset.value += nameSize;
        dirOffset.value += 2;
        const nameSizeUnicode = readInt(dirStream, dirOffset, 4);
        dirOffset.value += nameSizeUnicode;
        return true;
    }

    readControlReference(dirOffset, dirStream) {
        const sizeTwiddled = readInt(dirStream, dirOffset, 4);
        const sizeLibidTwiddled = readInt(dirStream, dirOffset, 4);
        dirOffset.value += sizeLibidTwiddled;
        dirOffset.value += 6;
        const reserved = readInt(dirStream, dirOffset, 2);
        // Optional Name Record
        if (reserved === 0x0016) {
            dirOffset.value -= 2;
            this.readNameReference(dirOffset, dirStream);
            dirOffset.value += 2;
        }
        const sizeExtended = readInt(dirStream, dirOffset, 4);
        const sizeLibidExtended = readInt(dirStream, dirOffset, 4);
        dirOffset.value += sizeLibidExtended;
        dirOffset.value += 26;
    }

    readOriginalReference(dirOffset, dirStream) {
        const sizeLibidOriginal = readInt(dirStream, dirOffset, 4);
        dirOffset.value += sizeLibidOriginal;

        // OriginalReference might be the beginning of a ControlReference
        const referenceRecordId = readInt(dirStream, dirOffset, 2);
        if (referenceRecordId === 0x2F) {
            this.readControlReference(dirOffset, dirStream);
        }
    }

    readRegisteredReference(dirOffset, dirStream) {
        const size = readInt(dirStream, dirOffset, 4);
        const sizeLibid = readInt(dirStream, dirOffset, 4);
        dirOffset.value += sizeLibid;
        dirOffset.value += 6;
    }

    readProjectReference(dirOffset, dirStream) {
        const size = readInt(dirStream, dirOffset, 4);
        const sizeLibidAbsolute = readInt(dirStream, dirOffset, 4);
        dirOffset.value += sizeLibidAbsolute;
        const sizeLibidRelative = readInt(dirStream, dirOffset, 4);
        dirOffset.value += sizeLibidRelative;
        dirOffset.value += 6;
    }

    readStream(sectorNumber, streamSize) {
        if (streamSize >= this.miniStreamCutoff) {
            return this.readSectorChainFAT(sectorNumber, streamSize);
        } else {
            return this.readMiniSectorChain(sectorNumber, streamSize);
        }
    }

    readSectorFAT(sectorNumber) {
        const offset = (sectorNumber + 1) * this.sectorSize;
        return this.binContent.slice(offset, offset + this.sectorSize);
    }

    readSectorChainFAT(startSectorNumber, streamSize = -1) {
        if (startSectorNumber === 0xFFFFFFFE || startSectorNumber === 0xFFFFFFFF) return new Uint8Array(0);
        const sectorIndexesArray = [startSectorNumber];
        let attempt = 0;
        while (attempt++ < 999999) {
            const nextSector = readInt(this.FAT, {value: sectorIndexesArray[sectorIndexesArray.length - 1] * 4}, 4);
            if (nextSector === 0xFFFFFFFE || nextSector === 0xFFFFFFFF) break;
            sectorIndexesArray.push(nextSector);
        }

        let resultArrayLength = streamSize === -1 ? sectorIndexesArray.length * this.sectorSize : streamSize;
        resultArrayLength = Number(resultArrayLength);
        const resultArray = new Uint8Array(resultArrayLength);
        let bytesRead = 0;
        for (let i = 0; i < sectorIndexesArray.length; i++) {
            const sectorNumber = sectorIndexesArray[i];
            const offset = (sectorNumber + 1) * this.sectorSize;
            for (let b = 0; b < this.sectorSize; b++) {
                resultArray[i * this.sectorSize + b] = this.binContent[offset + b];
                bytesRead++;
                if (bytesRead >= resultArrayLength) return resultArray;
            }
        }
        return resultArray;
    }

    readMiniSector(sectorNumber) {
        const offset = sectorNumber * this.miniSectorSize;
        return this.miniStream.slice(offset, offset + this.miniSectorSize);
    }

    readMiniSectorChain(startSectorNumber, streamSize = -1) {
        const sectorIndexesArray = [startSectorNumber];
        let attempt = 0;
        while (attempt++ < 9999999) {
            const nextSector = readInt(this.miniFAT, {value: sectorIndexesArray[sectorIndexesArray.length - 1] * 4}, 4);
            if (nextSector === 0xFFFFFFFE) break;
            sectorIndexesArray.push(nextSector);
        }

        let resultArrayLength = streamSize === -1 ? sectorIndexesArray.length * this.miniSectorSize : streamSize;
        resultArrayLength = Number(resultArrayLength);
        const resultArray = new Uint8Array(resultArrayLength);
        let bytesRead = 0;
        for (let i = 0; i < sectorIndexesArray.length; i++) {
            const sectorNumber = sectorIndexesArray[i];
            const offset = sectorNumber * this.miniSectorSize;
            for (let b = 0; b < this.miniSectorSize; b++) {
                resultArray[i * this.miniSectorSize + b] = this.miniStream[offset + b];
                bytesRead++;
                if (bytesRead >= resultArrayLength) return resultArray;
            }
        }
        return resultArray;
    }

    readDIFAT(numberOfDIFATSectors, firstDIFATSector) {
        const headerDIFATSize = 109 * 4;
        const DIFAT = new Uint8Array(headerDIFATSize + numberOfDIFATSectors * (this.sectorSize - 4));

        const headerDIFAT = readByteArray(this.binContent, {value: 76}, headerDIFATSize);
        for (let b = 0; b < headerDIFAT.length; b++) {
            DIFAT[b] = headerDIFAT[b];
        }

        let DIFATSector = firstDIFATSector;
        for (let i = 0; i < numberOfDIFATSectors; i++) {
            const sector = this.readSectorFAT(DIFATSector);
            for (let b = 0; b < sector.length - 4; b++) {
                DIFAT[headerDIFATSize + i * (this.sectorSize - 4) + b] = sector[b];
            }
            DIFATSector = readInt(sector, {value: this.sectorSize - 4}, 4);
        }

        return DIFAT;
    }

    readFAT(numberOfFATSectors) {
        const FAT = new Uint8Array(numberOfFATSectors * this.sectorSize);
        let offset = {value: 0};
        for (let i = 0; i < numberOfFATSectors; i++) {
            const sectorNumber = readInt(this.DIFAT, offset, 4);
            const sector = this.readSectorFAT(sectorNumber);
            for (let b = 0; b < sector.length; b++) {
                FAT[i * this.sectorSize + b] = sector[b];
            }
        }
        return FAT;
    }

    readFileTree(firstDirectorySector) {
        const directoryEntrySize = 128;
        const directoriesData = this.readSectorChainFAT(firstDirectorySector);

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
            if (dirEntry.type !== DirEntryType.UNKNOWN) {
                directoryEntries.push(dirEntry);
            }
        }

        const findSiblings = (dir, entries) => {
            if (dir === undefined) return [];
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
        return directoryEntries[0];
    }

    byteArrayToArrayBuffer(byteArray) {
        let length = byteArray.length;
        if (length % 2 === 1) length++;
        const arrayBuffer = new ArrayBuffer(length);
        const uint8Array = new Uint8Array(arrayBuffer);
        for (let i = 0; i < byteArray.length; i++) {
            uint8Array[i] = byteArray[i];
        }
        return arrayBuffer;
    }

    decompressVBASourceCode(byteCompressedArray) {
        const decompressedArray = [];
        let compressedCurrent = 0;

        const sigByte = byteCompressedArray[compressedCurrent];
        if (sigByte !== 0x01) {
            throw new Error("Invalid signature byte");
        }

        compressedCurrent++;

        while (compressedCurrent < byteCompressedArray.length) {
            let compressedChunkStart = compressedCurrent;

            // first 16 bits
            // the header is in LE and the rightmost bit is the 0th.. makes sense right?
            let compressedChunkHeader = readInt(byteCompressedArray, {value: compressedChunkStart}, 2);

            // first 12 bits
            let chunkSize = (compressedChunkHeader & 0x0FFF) + 3;

            const chunkSignature = (compressedChunkHeader >> 12) & 0x07;
            if (chunkSignature !== 0b011) {
                return decompressedArray; //?????
                //throw new Error("Invalid CompressedChunkSignature in VBA compressed stream");
            }

            // 15th flag
            let chunkFlag = (compressedChunkHeader >> 15) & 0x01;
            const compressedEnd = Math.min(byteCompressedArray.length, compressedChunkStart + chunkSize);
            compressedCurrent = compressedChunkStart + 2;
            const isCompressed = chunkFlag === 1;
            if (!isCompressed) {
                for (let i = 0; i < 4096; i++) {
                    decompressedArray.push(byteCompressedArray[compressedCurrent]);
                    compressedCurrent++;
                }
            } else {
                //???
                const decompressedChunkStart = decompressedArray.length;
                while (compressedCurrent < compressedEnd) {
                    const flagByte = byteCompressedArray[compressedCurrent];
                    compressedCurrent++;
                    for (let bitIndex = 0; bitIndex < 8; bitIndex++) {
                        if (compressedCurrent >= compressedEnd) break;
                        const flagBit = (flagByte >> bitIndex) & 1;
                        const isLiteral = flagBit === 0;
                        if (isLiteral) {
                            decompressedArray.push(byteCompressedArray[compressedCurrent]);
                            compressedCurrent++;
                        } else {
                            const copyToken = readInt(byteCompressedArray, {value: compressedCurrent}, 2);
                            const decompressedCurrent = decompressedArray.length;
                            const difference = decompressedCurrent - decompressedChunkStart;
                            const bitCount = Math.max(Math.ceil(Math.log2(difference)), 4);
                            const lengthMask = 0xFFFF >> bitCount;
                            const offsetMask = ~lengthMask;
                            const length = (copyToken & lengthMask) + 3;
                            const tmp1 = copyToken & offsetMask;
                            const tmp2 = 16 - bitCount;
                            const offset = (tmp1 >> tmp2) + 1;
                            const copySource = decompressedArray.length - offset;
                            for (let i = copySource; i < copySource + length; i++) {
                                decompressedArray.push(decompressedArray[i]);
                            }
                            compressedCurrent += 2;
                        }
                    }
                }
            }
        }

        return new Uint8Array(decompressedArray);
    }
}