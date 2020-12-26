// compressedArray is ArrayBuffer
export function decompressVBASourceCode(compressedArray) {
    const byteCompressedArray = new Uint8Array(compressedArray);
    const decompressedArray = [];
    let compressedCurrent = 0;

    const sigByte = byteCompressedArray[compressedCurrent];
    if (sigByte !== 0x01) {
        throw new Error("Invalid signature byte");
    }

    compressedCurrent++;

    while (compressedCurrent < compressedArray.byteLength) {
        let compressedChunkStart = compressedCurrent;

        // first 16 bits
        // the header is in LE and the rightmost bit is the 0th.. makes sense right?
        let compressedChunkHeader = get2ByteFromArrayBufferPositionLE(compressedArray, compressedChunkStart);

        // first 12 bits
        let chunkSize = (compressedChunkHeader & 0x0FFF) + 3;

        const chunkSignature = (compressedChunkHeader >> 12) & 0x07;
        if (chunkSignature !== 0b011) {
            return decompressedArray; //?????
            //throw new Error("Invalid CompressedChunkSignature in VBA compressed stream");
        }

        // 15th flag
        let chunkFlag = (compressedChunkHeader >> 15) & 0x01;
        const compressedEnd = Math.min(compressedArray.byteLength, compressedChunkStart + chunkSize);
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
                        const copyToken = get2ByteFromArrayBufferPositionLE(compressedArray, compressedCurrent);
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

    return decompressedArray;
}

function get2ByteFromArrayBufferPositionLE(arrayBuffer, position) {
    const slicedArray = arrayBuffer.slice(position, position + 2);
    return new DataView(slicedArray).getUint16(0, true);
}