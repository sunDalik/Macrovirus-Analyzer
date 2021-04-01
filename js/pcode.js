import {byteArrayToStr, readInt, skipStructure} from "./file_processor";

let is64bit = true; //?

// Algorithms taken from this repository
// https://github.com/bontchev/pcodedmp

export function disassemblePCode(moduleData, vbaProjectData) {
    const identifiers = getIdentifiers(vbaProjectData);
    let vbaVer = 3;
    let offset = {value: 2};
    let version = readInt(vbaProjectData, offset, 2);
    let dwLength, declarationTable, tableStart, indirectTable, dwLength2, objectTable;
    let offs = {value: 0};
    if (version >= 0x6B) {
        if (version >= 0x97) {
            vbaVer = 7;
        } else {
            vbaVer = 6;
        }
        if (is64bit) {
            dwLength = readInt(moduleData, {value: 0x0043}, 4);
            declarationTable = moduleData.slice(0x0047, 0x0047 + dwLength);
            dwLength = readInt(moduleData, {value: 0x0011}, 4);
            tableStart = dwLength + 12;
        } else {
            dwLength = readInt(moduleData, {value: 0x003F}, 4);
            declarationTable = moduleData.slice(0x0043, 0x0043 + dwLength);
            dwLength = readInt(moduleData, {value: 0x0011}, 4);
            tableStart = dwLength + 10;
        }
        dwLength = readInt(moduleData, {value: tableStart}, 4);
        tableStart += 4;
        indirectTable = moduleData.slice(tableStart, tableStart + dwLength);
        dwLength = readInt(moduleData, {value: 0x0005}, 4);
        dwLength2 = dwLength + 0x8A;
        dwLength = readInt(moduleData, {value: dwLength2}, 4);
        dwLength2 += 4;
        objectTable = moduleData.slice(dwLength2, dwLength2 + dwLength);
        offset.value = 0x0019;
    } else {
        vbaVer = 5;
        offset.value = 11;
        dwLength = readInt(moduleData, offset, 4);
        offs.value = offset.value + 4;
        declarationTable = moduleData.slice(offs.value, offs.value + dwLength);
        skipStructure(moduleData, offset, 4);
        offset.value += 64;
        skipStructure(moduleData, offset, 2, 16);
        skipStructure(moduleData, offset, 4);
        offset.value += 6;
        skipStructure(moduleData, offset, 4);
        offs.value = offset.value + 8;
        dwLength = readInt(moduleData, offs, 4);
        tableStart = dwLength + 14;
        offs.value = dwLength + 10;
        dwLength = readInt(moduleData, offs, 4);
        indirectTable = moduleData.slice(tableStart, tableStart + dwLength);
        dwLength = readInt(moduleData, offset, 4);
        offs.value = dwLength + 0x008A;
        dwLength = readInt(moduleData, offs, 4);
        offs.value += 4;
        objectTable = moduleData.slice(offs.value, offs.value + dwLength);
        offset.value += 77;
    }
    dwLength = readInt(moduleData, offset, 4);
    offset.value = dwLength + 0x003C;
    offset.value += 4;
    const numLines = readInt(moduleData, offset, 2);
    const pcodeStart = offset.value + numLines * 12 + 10;
    const pcode = [];
    for (let i = 0; i < numLines; i++) {
        offset.value += 4;
        const lineLength = readInt(moduleData, offset, 2);
        offset.value += 2;
        const lineOffset = readInt(moduleData, offset, 4);
        pcode.push(getPCodeLine(moduleData, pcodeStart + lineOffset, lineLength, vbaVer, identifiers, objectTable, indirectTable, declarationTable));
    }
    return pcode;
}

const opcodes = {
    0: {mnem: 'Imp', args: [], varg: false},
    1: {mnem: 'Eqv', args: [], varg: false},
    2: {mnem: 'Xor', args: [], varg: false},
    3: {mnem: 'Or', args: [], varg: false},
    4: {mnem: 'And', args: [], varg: false},
    5: {mnem: 'Eq', args: [], varg: false},
    6: {mnem: 'Ne', args: [], varg: false},
    7: {mnem: 'Le', args: [], varg: false},
    8: {mnem: 'Ge', args: [], varg: false},
    9: {mnem: 'Lt', args: [], varg: false},
    10: {mnem: 'Gt', args: [], varg: false},
    11: {mnem: 'Add', args: [], varg: false},
    12: {mnem: 'Sub', args: [], varg: false},
    13: {mnem: 'Mod', args: [], varg: false},
    14: {mnem: 'IDiv', args: [], varg: false},
    15: {mnem: 'Mul', args: [], varg: false},
    16: {mnem: 'Div', args: [], varg: false},
    17: {mnem: 'Concat', args: [], varg: false},
    18: {mnem: 'Like', args: [], varg: false},
    19: {mnem: 'Pwr', args: [], varg: false},
    20: {mnem: 'Is', args: [], varg: false},
    21: {mnem: 'Not', args: [], varg: false},
    22: {mnem: 'UMi', args: [], varg: false},
    23: {mnem: 'FnAbs', args: [], varg: false},
    24: {mnem: 'FnFix', args: [], varg: false},
    25: {mnem: 'FnInt', args: [], varg: false},
    26: {mnem: 'FnSgn', args: [], varg: false},
    27: {mnem: 'FnLen', args: [], varg: false},
    28: {mnem: 'FnLenB', args: [], varg: false},
    29: {mnem: 'Paren', args: [], varg: false},
    30: {mnem: 'Sharp', args: [], varg: false},
    31: {mnem: 'LdLHS', args: ['name'], varg: false},
    32: {mnem: 'Ld', args: ['name'], varg: false},
    33: {mnem: 'MemLd', args: ['name'], varg: false},
    34: {mnem: 'DictLd', args: ['name'], varg: false},
    35: {mnem: 'IndexLd', args: ['0x'], varg: false},
    36: {mnem: 'ArgsLd', args: ['name', '0x'], varg: false},
    37: {mnem: 'ArgsMemLd', args: ['name', '0x'], varg: false},
    38: {mnem: 'ArgsDictLd', args: ['name', '0x'], varg: false},
    39: {mnem: 'St', args: ['name'], varg: false},
    40: {mnem: 'MemSt', args: ['name'], varg: false},
    41: {mnem: 'DictSt', args: ['name'], varg: false},
    42: {mnem: 'IndexSt', args: ['0x'], varg: false},
    43: {mnem: 'ArgsSt', args: ['name', '0x'], varg: false},
    44: {mnem: 'ArgsMemSt', args: ['name', '0x'], varg: false},
    45: {mnem: 'ArgsDictSt', args: ['name', '0x'], varg: false},
    46: {mnem: 'Set', args: ['name'], varg: false},
    47: {mnem: 'Memset', args: ['name'], varg: false},
    48: {mnem: 'Dictset', args: ['name'], varg: false},
    49: {mnem: 'Indexset', args: ['0x'], varg: false},
    50: {mnem: 'ArgsSet', args: ['name', '0x'], varg: false},
    51: {mnem: 'ArgsMemSet', args: ['name', '0x'], varg: false},
    52: {mnem: 'ArgsDictSet', args: ['name', '0x'], varg: false},
    53: {mnem: 'MemLdWith', args: ['name'], varg: false},
    54: {mnem: 'DictLdWith', args: ['name'], varg: false},
    55: {mnem: 'ArgsMemLdWith', args: ['name', '0x'], varg: false},
    56: {mnem: 'ArgsDictLdWith', args: ['name', '0x'], varg: false},
    57: {mnem: 'MemStWith', args: ['name'], varg: false},
    58: {mnem: 'DictStWith', args: ['name'], varg: false},
    59: {mnem: 'ArgsMemStWith', args: ['name', '0x'], varg: false},
    60: {mnem: 'ArgsDictStWith', args: ['name', '0x'], varg: false},
    61: {mnem: 'MemSetWith', args: ['name'], varg: false},
    62: {mnem: 'DictSetWith', args: ['name'], varg: false},
    63: {mnem: 'ArgsMemSetWith', args: ['name', '0x'], varg: false},
    64: {mnem: 'ArgsDictSetWith', args: ['name', '0x'], varg: false},
    65: {mnem: 'ArgsCall', args: ['name', '0x'], varg: false},
    66: {mnem: 'ArgsMemCall', args: ['name', '0x'], varg: false},
    67: {mnem: 'ArgsMemCallWith', args: ['name', '0x'], varg: false},
    68: {mnem: 'ArgsArray', args: ['name', '0x'], varg: false},
    69: {mnem: 'Assert', args: [], varg: false},
    70: {mnem: 'BoS', args: ['0x'], varg: false},
    71: {mnem: 'BoSImplicit', args: [], varg: false},
    72: {mnem: 'BoL', args: [], varg: false},
    73: {mnem: 'LdAddressOf', args: ['name'], varg: false},
    74: {mnem: 'MemAddressOf', args: ['name'], varg: false},
    75: {mnem: 'Case', args: [], varg: false},
    76: {mnem: 'CaseTo', args: [], varg: false},
    77: {mnem: 'CaseGt', args: [], varg: false},
    78: {mnem: 'CaseLt', args: [], varg: false},
    79: {mnem: 'CaseGe', args: [], varg: false},
    80: {mnem: 'CaseLe', args: [], varg: false},
    81: {mnem: 'CaseNe', args: [], varg: false},
    82: {mnem: 'CaseEq', args: [], varg: false},
    83: {mnem: 'CaseElse', args: [], varg: false},
    84: {mnem: 'CaseDone', args: [], varg: false},
    85: {mnem: 'Circle', args: ['0x'], varg: false},
    86: {mnem: 'Close', args: ['0x'], varg: false},
    87: {mnem: 'CloseAll', args: [], varg: false},
    88: {mnem: 'Coerce', args: [], varg: false},
    89: {mnem: 'CoerceVar', args: [], varg: false},
    90: {mnem: 'Context', args: ['context_'], varg: false},
    91: {mnem: 'Debug', args: [], varg: false},
    92: {mnem: 'DefType', args: ['0x', '0x'], varg: false},
    93: {mnem: 'Dim', args: [], varg: false},
    94: {mnem: 'DimImplicit', args: [], varg: false},
    95: {mnem: 'Do', args: [], varg: false},
    96: {mnem: 'DoEvents', args: [], varg: false},
    97: {mnem: 'DoUnitil', args: [], varg: false},
    98: {mnem: 'DoWhile', args: [], varg: false},
    99: {mnem: 'Else', args: [], varg: false},
    100: {mnem: 'ElseBlock', args: [], varg: false},
    101: {mnem: 'ElseIfBlock', args: [], varg: false},
    102: {mnem: 'ElseIfTypeBlock', args: ['imp_'], varg: false},
    103: {mnem: 'End', args: [], varg: false},
    104: {mnem: 'EndContext', args: [], varg: false},
    105: {mnem: 'EndFunc', args: [], varg: false},
    106: {mnem: 'EndIf', args: [], varg: false},
    107: {mnem: 'EndIfBlock', args: [], varg: false},
    108: {mnem: 'EndImmediate', args: [], varg: false},
    109: {mnem: 'EndProp', args: [], varg: false},
    110: {mnem: 'EndSelect', args: [], varg: false},
    111: {mnem: 'EndSub', args: [], varg: false},
    112: {mnem: 'EndType', args: [], varg: false},
    113: {mnem: 'EndWith', args: [], varg: false},
    114: {mnem: 'Erase', args: ['0x'], varg: false},
    115: {mnem: 'Error', args: [], varg: false},
    116: {mnem: 'EventDecl', args: ['func_'], varg: false},
    117: {mnem: 'RaiseEvent', args: ['name', '0x'], varg: false},
    118: {mnem: 'ArgsMemRaiseEvent', args: ['name', '0x'], varg: false},
    119: {mnem: 'ArgsMemRaiseEventWith', args: ['name', '0x'], varg: false},
    120: {mnem: 'ExitDo', args: [], varg: false},
    121: {mnem: 'ExitFor', args: [], varg: false},
    122: {mnem: 'ExitFunc', args: [], varg: false},
    123: {mnem: 'ExitProp', args: [], varg: false},
    124: {mnem: 'ExitSub', args: [], varg: false},
    125: {mnem: 'FnCurDir', args: [], varg: false},
    126: {mnem: 'FnDir', args: [], varg: false},
    127: {mnem: 'Empty0', args: [], varg: false},
    128: {mnem: 'Empty1', args: [], varg: false},
    129: {mnem: 'FnError', args: [], varg: false},
    130: {mnem: 'FnFormat', args: [], varg: false},
    131: {mnem: 'FnFreeFile', args: [], varg: false},
    132: {mnem: 'FnInStr', args: [], varg: false},
    133: {mnem: 'FnInStr3', args: [], varg: false},
    134: {mnem: 'FnInStr4', args: [], varg: false},
    135: {mnem: 'FnInStrB', args: [], varg: false},
    136: {mnem: 'FnInStrB3', args: [], varg: false},
    137: {mnem: 'FnInStrB4', args: [], varg: false},
    138: {mnem: 'FnLBound', args: ['0x'], varg: false},
    139: {mnem: 'FnMid', args: [], varg: false},
    140: {mnem: 'FnMidB', args: [], varg: false},
    141: {mnem: 'FnStrComp', args: [], varg: false},
    142: {mnem: 'FnStrComp3', args: [], varg: false},
    143: {mnem: 'FnStringVar', args: [], varg: false},
    144: {mnem: 'FnStringStr', args: [], varg: false},
    145: {mnem: 'FnUBound', args: ['0x'], varg: false},
    146: {mnem: 'For', args: [], varg: false},
    147: {mnem: 'ForEach', args: [], varg: false},
    148: {mnem: 'ForEachAs', args: ['imp_'], varg: false},
    149: {mnem: 'ForStep', args: [], varg: false},
    150: {mnem: 'FuncDefn', args: ['func_'], varg: false},
    151: {mnem: 'FuncDefnSave', args: ['func_'], varg: false},
    152: {mnem: 'GetRec', args: [], varg: false},
    153: {mnem: 'GoSub', args: ['name'], varg: false},
    154: {mnem: 'GoTo', args: ['name'], varg: false},
    155: {mnem: 'If', args: [], varg: false},
    156: {mnem: 'IfBlock', args: [], varg: false},
    157: {mnem: 'TypeOf', args: ['imp_'], varg: false},
    158: {mnem: 'IfTypeBlock', args: ['imp_'], varg: false},
    159: {mnem: 'Implements', args: ['0x', '0x', '0x', '0x'], varg: false},
    160: {mnem: 'Input', args: [], varg: false},
    161: {mnem: 'InputDone', args: [], varg: false},
    162: {mnem: 'InputItem', args: [], varg: false},
    163: {mnem: 'Label', args: ['name'], varg: false},
    164: {mnem: 'Let', args: [], varg: false},
    165: {mnem: 'Line', args: ['0x'], varg: false},
    166: {mnem: 'LineCont', args: [], varg: true},
    167: {mnem: 'LineInput', args: [], varg: false},
    168: {mnem: 'LineNum', args: ['name'], varg: false},
    169: {mnem: 'LitCy', args: ['0x', '0x', '0x', '0x'], varg: false},
    170: {mnem: 'LitDate', args: ['0x', '0x', '0x', '0x'], varg: false},
    171: {mnem: 'LitDefault', args: [], varg: false},
    172: {mnem: 'LitDI2', args: ['0x'], varg: false},
    173: {mnem: 'LitDI4', args: ['0x', '0x'], varg: false},
    174: {mnem: 'LitDI8', args: ['0x', '0x', '0x', '0x'], varg: false},
    175: {mnem: 'LitHI2', args: ['0x'], varg: false},
    176: {mnem: 'LitHI4', args: ['0x', '0x'], varg: false},
    177: {mnem: 'LitHI8', args: ['0x', '0x', '0x', '0x'], varg: false},
    178: {mnem: 'LitNothing', args: [], varg: false},
    179: {mnem: 'LitOI2', args: ['0x'], varg: false},
    180: {mnem: 'LitOI4', args: ['0x', '0x'], varg: false},
    181: {mnem: 'LitOI8', args: ['0x', '0x', '0x', '0x'], varg: false},
    182: {mnem: 'LitR4', args: ['0x', '0x'], varg: false},
    183: {mnem: 'LitR8', args: ['0x', '0x', '0x', '0x'], varg: false},
    184: {mnem: 'LitSmallI2', args: [], varg: false},
    185: {mnem: 'LitStr', args: [], varg: true},
    186: {mnem: 'LitVarSpecial', args: [], varg: false},
    187: {mnem: 'Lock', args: [], varg: false},
    188: {mnem: 'Loop', args: [], varg: false},
    189: {mnem: 'LoopUntil', args: [], varg: false},
    190: {mnem: 'LoopWhile', args: [], varg: false},
    191: {mnem: 'LSet', args: [], varg: false},
    192: {mnem: 'Me', args: [], varg: false},
    193: {mnem: 'MeImplicit', args: [], varg: false},
    194: {mnem: 'MemRedim', args: ['name', '0x', 'type_'], varg: false},
    195: {mnem: 'MemRedimWith', args: ['name', '0x', 'type_'], varg: false},
    196: {mnem: 'MemRedimAs', args: ['name', '0x', 'type_'], varg: false},
    197: {mnem: 'MemRedimAsWith', args: ['name', '0x', 'type_'], varg: false},
    198: {mnem: 'Mid', args: [], varg: false},
    199: {mnem: 'MidB', args: [], varg: false},
    200: {mnem: 'Name', args: [], varg: false},
    201: {mnem: 'New', args: ['imp_'], varg: false},
    202: {mnem: 'Next', args: [], varg: false},
    203: {mnem: 'NextVar', args: [], varg: false},
    204: {mnem: 'OnError', args: ['name'], varg: false},
    205: {mnem: 'OnGosub', args: [], varg: true},
    206: {mnem: 'OnGoto', args: [], varg: true},
    207: {mnem: 'Open', args: ['0x'], varg: false},
    208: {mnem: 'Option', args: [], varg: false},
    209: {mnem: 'OptionBase', args: [], varg: false},
    210: {mnem: 'ParamByVal', args: [], varg: false},
    211: {mnem: 'ParamOmitted', args: [], varg: false},
    212: {mnem: 'ParamNamed', args: ['name'], varg: false},
    213: {mnem: 'PrintChan', args: [], varg: false},
    214: {mnem: 'PrintComma', args: [], varg: false},
    215: {mnem: 'PrintEoS', args: [], varg: false},
    216: {mnem: 'PrintItemComma', args: [], varg: false},
    217: {mnem: 'PrintItemNL', args: [], varg: false},
    218: {mnem: 'PrintItemSemi', args: [], varg: false},
    219: {mnem: 'PrintNL', args: [], varg: false},
    220: {mnem: 'PrintObj', args: [], varg: false},
    221: {mnem: 'PrintSemi', args: [], varg: false},
    222: {mnem: 'PrintSpc', args: [], varg: false},
    223: {mnem: 'PrintTab', args: [], varg: false},
    224: {mnem: 'PrintTabComma', args: [], varg: false},
    225: {mnem: 'PSet', args: ['0x'], varg: false},
    226: {mnem: 'PutRec', args: [], varg: false},
    227: {mnem: 'QuoteRem', args: ['0x'], varg: true},
    228: {mnem: 'Redim', args: ['name', '0x', 'type_'], varg: false},
    229: {mnem: 'RedimAs', args: ['name', '0x', 'type_'], varg: false},
    230: {mnem: 'Reparse', args: [], varg: true},
    231: {mnem: 'Rem', args: [], varg: true},
    232: {mnem: 'Resume', args: ['name'], varg: false},
    233: {mnem: 'Return', args: [], varg: false},
    234: {mnem: 'RSet', args: [], varg: false},
    235: {mnem: 'Scale', args: ['0x'], varg: false},
    236: {mnem: 'Seek', args: [], varg: false},
    237: {mnem: 'SelectCase', args: [], varg: false},
    238: {mnem: 'SelectIs', args: ['imp_'], varg: false},
    239: {mnem: 'SelectType', args: [], varg: false},
    240: {mnem: 'SetStmt', args: [], varg: false},
    241: {mnem: 'Stack', args: ['0x', '0x'], varg: false},
    242: {mnem: 'Stop', args: [], varg: false},
    243: {mnem: 'Type', args: ['rec_'], varg: false},
    244: {mnem: 'Unlock', args: [], varg: false},
    245: {mnem: 'VarDefn', args: ['var_'], varg: false},
    246: {mnem: 'Wend', args: [], varg: false},
    247: {mnem: 'While', args: [], varg: false},
    248: {mnem: 'With', args: [], varg: false},
    249: {mnem: 'WriteChan', args: [], varg: false},
    250: {mnem: 'ConstFuncExpr', args: [], varg: false},
    251: {mnem: 'LbConst', args: ['name'], varg: false},
    252: {mnem: 'LbIf', args: [], varg: false},
    253: {mnem: 'LbElse', args: [], varg: false},
    254: {mnem: 'LbElseIf', args: [], varg: false},
    255: {mnem: 'LbEndIf', args: [], varg: false},
    256: {mnem: 'LbMark', args: [], varg: false},
    257: {mnem: 'EndForVariable', args: [], varg: false},
    258: {mnem: 'StartForVariable', args: [], varg: false},
    259: {mnem: 'NewRedim', args: [], varg: false},
    260: {mnem: 'StartWithExpr', args: [], varg: false},
    261: {mnem: 'SetOrSt', args: ['name'], varg: false},
    262: {mnem: 'EndEnum', args: [], varg: false},
    263: {mnem: 'Illegal', args: [], varg: false}
};

function translateOpcode(opcode, vbaVer) {
    if (vbaVer === 3) {
        if (opcode <= 67) {
            return opcode;
        } else if (opcode <= 70) {
            return opcode + 2;
        } else if (opcode <= 111) {
            return opcode + 4;
        } else if (opcode <= 150) {
            return opcode + 8;
        } else if (opcode <= 164) {
            return opcode + 9;
        } else if (opcode <= 166) {
            return opcode + 10;
        } else if (opcode <= 169) {
            return opcode + 11;
        } else if (opcode <= 238) {
            return opcode + 12;
        } else {
            return opcode + 24;
        }
    } else if (vbaVer === 5) {
        if (opcode <= 68) {
            return opcode;
        } else if (opcode <= 71) {
            return opcode + 1;
        } else if (opcode <= 112) {
            return opcode + 3;
        } else if (opcode <= 151) {
            return opcode + 7;
        } else if (opcode <= 165) {
            return opcode + 8;
        } else if (opcode <= 167) {
            return opcode + 9;
        } else if (opcode <= 170) {
            return opcode + 10;
        } else {
            return opcode + 11;
        }
    } else if (!is64bit) {
        if (opcode <= 173) {
            return opcode;
        } else if (opcode <= 175) {
            return opcode + 1;
        } else if (opcode <= 178) {
            return opcode + 2;
        } else {
            return opcode + 3;
        }
    } else {
        return opcode;
    }
}

function getPCodeLine(moduleData, lineStart, lineLength, vbaVer, identifiers, objectTable, indirectTable, declarationTable) {
    let varTypesLong = ['Var', '?', 'Int', 'Lng', 'Sng', 'Dbl', 'Cur', 'Date', 'Str', 'Obj', 'Err', 'Bool', 'Var'];
    let specials = ['False', 'True', 'Null', 'Empty'];
    let options = ['Base 0', 'Base 1', 'Compare Text', 'Compare Binary', 'Explicit', 'Private Module'];

    if ((lineLength) <= 0) {
        return "";
    }
    let offset = {value: lineStart};
    let endOfLine = lineStart + lineLength;
    let line = "";
    while (offset.value < endOfLine) {
        let opcode = readInt(moduleData, offset, 2);
        let opType = (opcode & ~0x03FF) >> 10;
        opcode &= 0x03FF;
        let translatedOpcode = translateOpcode(opcode, vbaVer);
        if (!opcodes.hasOwnProperty(translatedOpcode)) {
            return `Unrecognized opcode ${hexNum(opcode)} at offset ${hexNum(offset.value, 8)}}`;
        }
        let instruction = opcodes[translatedOpcode];
        let mnemonic = instruction.mnem;
        line += mnemonic + " ";
        if (['Coerce', 'CoerceVar', 'DefType'].includes(mnemonic)) {
            if (opType < varTypesLong.length) {
                line += `(${varTypesLong[opType]})`;
            } else if (opType === 17) {
                line += "(Byte)";
            } else {
                line += `(${opType})`;
            }
        } else if (['Dim', 'DimImplicit', 'Type'].includes(mnemonic)) {
            let dimType = [];
            if (opType & 0x04) {
                dimType.push('Global');
            } else if (opType & 0x08) {
                dimType.push('Public');
            } else if (opType & 0x10) {
                dimType.push('Private');
            } else if (opType & 0x20) {
                dimType.push('Static');
            }
            if ((opType & 0x01) && (mnemonic !== 'Type')) {
                dimType.push('Const');
            }
            if (dimType.length) {
                line += `(${dimType.join(" ")})`;
            }
        } else if (mnemonic === 'LitVarSpecial') {
            line += `(${specials[opType]})`;
        } else if (['ArgsCall', 'ArgsMemCall', 'ArgsMemCallWith'].includes(mnemonic)) {
            if (opType < 16) {
                line += "(Call) ";
            } else {
                opType -= 16;
            }
        } else if (mnemonic === 'Option') {
            line += `(${options[opType]})`;
        } else if (['Redim', 'RedimAs'].includes(mnemonic)) {
            if (opType & 16) {
                line += "(Preserve)";
            }
        }
        for (const arg of instruction.args) {
            if (arg === 'name') {
                const word = readInt(moduleData, offset, 2);
                const theName = disasmName(word, identifiers, mnemonic, opType, vbaVer);
                line += theName;
            } else if (['0x', 'imp_'].includes(arg)) {
                const word = readInt(moduleData, offset, 2);
                const theImp = disasmImp(objectTable, identifiers, arg, word, mnemonic, vbaVer);
                line += theImp;
            } else if (['func_', 'var_', 'rec_', 'type_', 'context_'].includes(arg)) {
                let dword = readInt(moduleData, offset, 4);
                if ((arg === 'rec_') && (indirectTable.length >= dword + 20)) {
                    const theRec = disasmRec(indirectTable, identifiers, dword, vbaVer);
                    line += theRec;
                } else if ((arg === 'type_') && (indirectTable.length >= dword + 7)) {
                    const theType = disasmType(indirectTable, dword);
                    line += theType;
                } else if ((arg === 'var_') && (indirectTable.length >= dword + 16)) {
                    if (opType & 0x20) {
                        line += "(WithEvents)";
                    }
                    const theVar = disasmVar(indirectTable, objectTable, identifiers, dword, vbaVer);
                    line += theVar;
                    if (opType & 0x10) {
                        const word = readInt(moduleData, offset, 2);
                        line += hexNum(word);
                    }
                } else if ((arg === 'func_') && (indirectTable.length >= dword + 61)) {
                    const theFunc = disasmFunc(indirectTable, declarationTable, identifiers, dword, opType, vbaVer);
                    line += theFunc;
                } else {
                    line += arg + hexNum(dword, 8) + " ";
                }
                if (is64bit && (arg === 'context_')) {
                    dword = readInt(moduleData, offset, 4);
                    line += hexNum(dword, 8) + " ";
                }
            }
        }
        if (instruction.varg) {
            let wLength = readInt(moduleData, offset, 2);
            const theVarArg = disasmVarArg(moduleData, identifiers, offset.value, wLength, mnemonic, vbaVer);
            line += theVarArg;
            offset.value += wLength;
            if (wLength & 1) {
                offset.value += 1;
            }
        }
        line += "\n";
    }
    return line;
}

function disasmName(word, identifiers, mnemonic, opType, vbaVer) {
    const varTypes = ['', '?', '%', '&', '!', '#', '@', '?', '$', '?', '?', '?', '?', '?'];
    let varName = getID(word, identifiers, vbaVer);
    let strType;
    if (opType < varTypes.length) {
        strType = varTypes[opType];
    } else {
        strType = '';
        if (opType === 32) {
            varName = '[' + varName + ']';
        }
    }
    if (mnemonic === 'OnError') {
        strType = '';
        if (opType === 1) {
            varName = '(Resume Next)';
        } else if (opType === 2) {
            varName = '(GoTo 0)';
        }
    } else if (mnemonic === 'Resume') {
        strType = '';
        if (opType === 1) {
            varName = '(Next)';
        } else if (opType !== 0) {
            varName = '';
        }
    }
    return varName + strType + ' ';
}

function getID(idCode, identifiers, vbaVer) {
    const internalNames = [
        '<crash>', '0', 'Abs', 'Access', 'AddressOf', 'Alias', 'And', 'Any',
        'Append', 'Array', 'As', 'Assert', 'B', 'Base', 'BF', 'Binary',
        'Boolean', 'ByRef', 'Byte', 'ByVal', 'Call', 'Case', 'CBool', 'CByte',
        'CCur', 'CDate', 'CDec', 'CDbl', 'CDecl', 'ChDir', 'CInt', 'Circle',
        'CLng', 'Close', 'Compare', 'Const', 'CSng', 'CStr', 'CurDir', 'CurDir$',
        'CVar', 'CVDate', 'CVErr', 'Currency', 'Database', 'Date', 'Date$', 'Debug',
        'Decimal', 'Declare', 'DefBool', 'DefByte', 'DefCur', 'DefDate', 'DefDec', 'DefDbl',
        'DefInt', 'DefLng', 'DefObj', 'DefSng', 'DefStr', 'DefVar', 'Dim', 'Dir',
        'Dir$', 'Do', 'DoEvents', 'Double', 'Each', 'Else', 'ElseIf', 'Empty',
        'End', 'EndIf', 'Enum', 'Eqv', 'Erase', 'Error', 'Error$', 'Event',
        'WithEvents', 'Explicit', 'F', 'False', 'Fix', 'For', 'Format',
        'Format$', 'FreeFile', 'Friend', 'Function', 'Get', 'Global', 'Go', 'GoSub',
        'Goto', 'If', 'Imp', 'Implements', 'In', 'Input', 'Input$', 'InputB',
        'InputB', 'InStr', 'InputB$', 'Int', 'InStrB', 'Is', 'Integer', 'Left',
        'LBound', 'LenB', 'Len', 'Lib', 'Let', 'Line', 'Like', 'Load',
        'Local', 'Lock', 'Long', 'Loop', 'LSet', 'Me', 'Mid', 'Mid$',
        'MidB', 'MidB$', 'Mod', 'Module', 'Name', 'New', 'Next', 'Not',
        'Nothing', 'Null', 'Object', 'On', 'Open', 'Option', 'Optional', 'Or',
        'Output', 'ParamArray', 'Preserve', 'Print', 'Private', 'Property', 'PSet', 'Public',
        'Put', 'RaiseEvent', 'Random', 'Randomize', 'Read', 'ReDim', 'Rem', 'Resume',
        'Return', 'RGB', 'RSet', 'Scale', 'Seek', 'Select', 'Set', 'Sgn',
        'Shared', 'Single', 'Spc', 'Static', 'Step', 'Stop', 'StrComp', 'String',
        'String$', 'Sub', 'Tab', 'Text', 'Then', 'To', 'True', 'Type',
        'TypeOf', 'UBound', 'Unload', 'Unlock', 'Unknown', 'Until', 'Variant', 'WEnd',
        'While', 'Width', 'With', 'Write', 'Xor', '#Const', '#Else', '#ElseIf',
        '#End', '#If', 'Attribute', 'VB_Base', 'VB_Control', 'VB_Creatable', 'VB_Customizable', 'VB_Description',
        'VB_Exposed', 'VB_Ext_Key', 'VB_HelpID', 'VB_Invoke_Func', 'VB_Invoke_Property', 'VB_Invoke_PropertyPut', 'VB_Invoke_PropertyPutRef', 'VB_MemberFlags',
        'VB_Name', 'VB_PredecraredID', 'VB_ProcData', 'VB_TemplateDerived', 'VB_VarDescription', 'VB_VarHelpID', 'VB_VarMemberFlags', 'VB_VarProcData',
        'VB_UserMemID', 'VB_VarUserMemID', 'VB_GlobalNameSpace', ',', '.', '"', '_', '!',
        '#', '&', "'", '(', ')', '*', '+', '-',
        ' /', ':', ';', '<', '<=', '<>', '=', '=<',
        '=>', '>', '><', '>=', '?', '\\', '^', ':='
    ];

    let origCode = idCode;
    idCode >>= 1;
    try {
        if (idCode >= 0x100) {
            idCode -= 0x100;
            if (vbaVer >= 7) {
                idCode -= 4;
                if (is64bit) {
                    idCode -= 3;
                }
                if (idCode > 0xBE) {
                    idCode -= 1;
                }
            }
            return identifiers[idCode];
        } else {
            if (vbaVer >= 7) {
                if (idCode >= 0xC3) {
                    idCode -= 1;
                }
            }
            return internalNames[idCode];
        }
    } catch (Exception) {
        return 'id_' + hexNum(origCode);
    }
}

function disasmImp(objectTable, identifiers, arg, word, mnemonic, vbaVer) {
    let impName = "";
    if (mnemonic !== 'Open') {
        if (arg === 'imp_' && (objectTable.length >= word + 8)) {
            impName = getName(objectTable, identifiers, word + 6, vbaVer);
        } else {
            impName = arg + word + " ";
        }
    } else {
        const accessMode = ['Read', 'Write', 'Read Write'];
        const lockMode = ['Read Write', 'Write', 'Read'];
        const mode = word & 0x00FF;
        const access = (word & 0x0F00) >> 8;
        const lock = (word & 0xF000) >> 12;
        impName = '(For ';
        if (mode & 0x01) {
            impName += 'Input';
        } else if (mode & 0x02) {
            impName += 'Output';
        } else if (mode & 0x04) {
            impName += 'Random';
        } else if (mode & 0x08) {
            impName += 'Append';
        } else if (mode === 0x20) {
            impName += 'Binary';
        }
        if (access && (access <= accessMode.length)) {
            impName += ' Access ' + accessMode[access - 1];
        }
        if (lock) {
            if (lock & 0x04) {
                impName += ' Shared';
            } else if (lock <= accessMode.length) {
                impName += ' Lock ' + lockMode[lock - 1];
            }
            impName += ')';
        }
    }
    return impName;
}

function getName(buffer, identifiers, offset, vbaVer) {
    const objectID = readInt(buffer, {value: offset}, 2);
    return getID(objectID, identifiers, vbaVer);
}

function disasmRec(indirectTable, identifiers, dword, vbaVer) {
    let objectName = getName(indirectTable, identifiers, dword + 2, vbaVer);
    const options = readInt(indirectTable, {value: dword + 18}, 2);
    if ((options & 1) === 0) {
        objectName = '(Private) ' + objectName;
    }
    return objectName;
}

function disasmType(indirectTable, dword) {
    const dimTypes = ['', 'Null', 'Integer', 'Long', 'Single', 'Double', 'Currency', 'Date', 'String', 'Object', 'Error', 'Boolean', 'Variant', '', 'Decimal', '', '', 'Byte'];
    const typeID = indirectTable[dword + 6];
    let typeName;
    if (typeID < dimTypes.length) {
        typeName = dimTypes[typeID];
    } else {
        typeName = 'type_' + hexNum(dword, 8);
    }
    return typeName;
}

function disasmVar(indirectTable, objectTable, identifiers, dword, vbaVer) {
    const bFlag1 = indirectTable[dword];
    const bFlag2 = indirectTable[dword + 1];
    const hasAs = (bFlag1 & 0x20) !== 0;
    const hasNew = (bFlag2 & 0x20) !== 0;
    let varName = getName(indirectTable, identifiers, dword + 2, vbaVer);
    if (hasNew || hasAs) {
        let varType = '';
        if (hasNew) {
            varType += 'New';
            if (hasAs) {
                varType += ' ';
            }
        }
        if (hasAs) {
            let offs;
            if (is64bit) {
                offs = 16;
            } else {
                offs = 12;
            }
            let word = readInt(indirectTable, {value: dword + offs + 2}, 2);
            let typeName;
            if (word === 0xFFFF) {
                let typeID = indirectTable[dword + offs];
                typeName = getTypeName(typeID);
            } else {
                typeName = disasmObject(indirectTable, objectTable, identifiers, dword + offs, vbaVer);
            }
            if (typeName.length > 0) {
                varType += 'As ' + typeName;
            }
        }
        if (varType.length > 0) {
            varName += ' (' + varType + ')';
        }
    }
    return varName;
}

function getTypeName(typeID) {
    const dimTypes = ['', 'Null', 'Integer', 'Long', 'Single', 'Double', 'Currency', 'Date', 'String', 'Object', 'Error', 'Boolean', 'Variant', '', 'Decimal', '', '', 'Byte'];
    const typeFlags = typeID & 0xE0;
    typeID &= ~0xE0;
    let typeName;
    if (typeID < dimTypes.length) {
        typeName = dimTypes[typeID];
    } else {
        typeName = '';
    }
    if (typeFlags & 0x80) {
        typeName += 'Ptr';
    }
    return typeName;
}

function disasmObject(indirectTable, objectTable, identifiers, offset, vbaVer) {
    if (is64bit) {
        return '';
    }
    const typeDesc = readInt(indirectTable, {value: offset}, 4);
    let flags = readInt(indirectTable, {value: typeDesc}, 2);
    let typeName;
    if (flags & 0x02) {
        typeName = disasmType(indirectTable, typeDesc);
    } else {
        let word = readInt(indirectTable, {value: typeDesc + 2}, 2);
        if (word === 0) {
            typeName = '';
        } else {
            let offs = (word >> 2) * 10;
            if (offs + 4 > objectTable.length) {
                return '';
            }
            let hlName = readInt(objectTable, {value: offs + 6}, 2);
            typeName = getID(hlName, identifiers, vbaVer, is64bit);
        }
    }
    return typeName;
}

function disasmFunc(indirectTable, declarationTable, identifiers, dword, opType, vbaVer) {
    let funcDecl = '(';
    let flags = readInt(indirectTable, {value: dword}, 2);
    let subName = getName(indirectTable, identifiers, dword + 2, vbaVer);
    let offs2;
    if (vbaVer > 5) {
        offs2 = 4;
    } else {
        offs2 = 0;
    }
    if (is64bit) {
        offs2 += 16;
    }
    let argOffset = readInt(indirectTable, {value: dword + offs2 + 36}, 4);
    let retType = readInt(indirectTable, {value: dword + offs2 + 40}, 4);
    let declOffset = readInt(indirectTable, {value: dword + offs2 + 44}, 2);
    let cOptions = indirectTable[dword + offs2 + 54];
    let newFlags = indirectTable[dword + offs2 + 57];
    let hasDeclare = false;
    if (vbaVer > 5) {
        if (((newFlags & 0x0002) === 0) && !is64bit) {
            funcDecl += 'Private ';
        }
        if (newFlags & 0x0004) {
            funcDecl += 'Friend ';
        }
    } else {
        if ((flags & 0x0008) === 0) {
            funcDecl += 'Private ';
        }
    }
    if (opType & 0x04) {
        funcDecl += 'Public ';
    }
    if (flags & 0x0080) {
        funcDecl += 'Static ';
    }
    if (((cOptions & 0x90) === 0) && (declOffset !== 0xFFFF) && !is64bit) {
        hasDeclare = true;
        funcDecl += 'Declare ';
    }
    if (vbaVer > 5) {
        if (newFlags & 0x20) {
            funcDecl += 'PtrSafe ';
        }
    }
    let hasAs = (flags & 0x0020) !== 0;
    if (flags & 0x1000) {
        if ([2, 6].includes(opType)) {
            funcDecl += 'Function ';
        } else {
            funcDecl += 'Sub ';
        }
    } else if (flags & 0x2000) {
        funcDecl += 'Property Get ';
    } else if (flags & 0x4000) {
        funcDecl += 'Property Let ';
    } else if (flags & 0x8000) {
        funcDecl += 'Property Set ';
    }
    funcDecl += subName;
    if (hasDeclare) {
        let libName = getName(declarationTable, identifiers, declOffset + 2, vbaVer);
        funcDecl += ' Lib "' + libName + '" ';
    }
    let argList = [];
    while ((argOffset !== 0xFFFFFFFF) && (argOffset !== 0) && (argOffset + 26 < indirectTable.length)) {
        let argName = disasmArg(indirectTable, identifiers, argOffset, vbaVer);
        argList.push(argName);
        argOffset = readInt(indirectTable, {value: argOffset + 20}, 4);
    }
    funcDecl += '(' + argList.join(", ") + ')';
    if (hasAs) {
        funcDecl += ' As ';
        let typeName = '';
        if ((retType & 0xFFFF0000) === 0xFFFF0000) {
            let typeID = retType & 0x000000FF;
            typeName = getTypeName(typeID);
        } else {
            typeName = getName(indirectTable, identifiers, retType + 6, vbaVer);
        }
        funcDecl += typeName;
    }
    funcDecl += ')';
    return funcDecl;
}

function disasmArg(indirectTable, identifiers, argOffset, vbaVer) {
    let flags = readInt(indirectTable, {value: argOffset}, 2);
    let offs;
    if (is64bit) {
        offs = 4;
    } else {
        offs = 0;
    }
    let argName = getName(indirectTable, identifiers, argOffset + 2, vbaVer);
    let argType = readInt(indirectTable, {value: argOffset + offs + 12}, 4);
    let argOpts = readInt(indirectTable, {value: argOffset + offs + 24}, 2);
    if (argOpts & 0x0004) {
        argName = 'ByVal ' + argName;
    }
    if (argOpts & 0x0002) {
        argName = 'ByRef ' + argName;
    }
    if (argOpts & 0x0200) {
        argName = 'Optional ' + argName;
    }
    if (flags & 0x0020) {
        argName += ' As ';
        let argTypeName = '';
        if (argType & 0xFFFF0000) {
            let argTypeID = argType & 0x000000FF;
            argTypeName = getTypeName(argTypeID);
        }
        argName += argTypeName;
    }
    return argName;
}

function disasmVarArg(moduleData, identifiers, offset, wLength, mnemonic, vbaVer) {
    let substring = moduleData.slice(offset, offset + wLength);
    let varArgName = hexNum(wLength) + " ";
    if (['LitStr', 'QuoteRem', 'Rem', 'Reparse'].includes(mnemonic)) {
        varArgName += '"' + byteArrayToStr(substring) + '"';
    } else if (['OnGosub', 'OnGoto'].includes(mnemonic)) {
        let offset1 = {value: offset};
        let vars = [];
        for (let i = 0; i < Math.floor(wLength / 2); i++) {
            let word = readInt(moduleData, offset1, 2);
            vars.push(getID(word, identifiers, vbaVer));
        }
        varArgName += vars.join(", ") + ' ';
    } else {
        let hexdump = substring.join(" ");
        varArgName += hexdump;
    }
    return varArgName;
}

export function hexNum(int, places = 4) {
    const numStr = Number(int).toString(16).toUpperCase();
    let result = "0x";
    for (let i = 0; i < places - numStr.length; i++) {
        result += "0";
    }
    result += numStr;
    return result;
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
    //console.log(identifiers);
    return identifiers;
}