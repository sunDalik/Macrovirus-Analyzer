export function pcodeToSource(pcodeLines) {
    let sourceCode = "";
    let currentLine = "";
    let stack = [];
    for (const entry of pcodeLines) {
        for (let line of entry.split("\n")) {
            line = line.trim();
            line = line.replace(/\s{2,}/g, ' ');

            if (line.startsWith("FuncDefn")) {
                currentLine = line.match(new RegExp("^FuncDefn \\((?<fun>.+)\\)$")).groups.fun;
            } else if (line.startsWith("QuoteRem")) {
                currentLine = "'" + line.match(new RegExp("^QuoteRem 0x.+ 0x.+ \"(?<comment>.*)\"$")).groups.comment;
            } else if (line.startsWith("Dim")) {
                const matchResult = line.match(new RegExp("^Dim \\((?<mod>.+)\\)$"));
                if (matchResult) {
                    currentLine += matchResult.groups.mod;
                } else {
                    currentLine += "Dim";
                }
            } else if (line.startsWith("LitDI2")) {
                stack.push(parseInt(line.match(new RegExp("^LitDI2 (?<value>.+)$")).groups.value));
            } else if (line.startsWith("LitStr")) {
                stack.push(line.match(new RegExp("^LitStr 0x.+ (?<value>\".*\")$")).groups.value);
            } else if (line.startsWith("LitVarSpecial")) {
                stack.push(line.match(new RegExp("^LitVarSpecial \\((?<value>.+)\\)$")).groups.value);
            } else if (line.startsWith("VarDefn")) {
                currentLine += " " + line.match(new RegExp("^VarDefn (?<name>.+)$")).groups.name;
                if (stack.length > 0) {
                    currentLine += " = " + stack.pop();
                }
            } else if (line.startsWith("EndSub")) {
                currentLine += "End Sub";
            } else if (line.startsWith("ExitSub")) {
                currentLine += "Exit Sub";
            } else if (line.startsWith("EndIfBlock")) {
                currentLine += "End If";
            } else if (line.startsWith("ExitFunc")) {
                currentLine += "Exit Function";
            } else if (line.startsWith("EndFunc")) {
                currentLine += "End Function";
            } else if (line.startsWith("Next")) {
                currentLine += "Next";
            } else if (line.startsWith("ArgsLd")) {
                const funcName = line.match(new RegExp("^ArgsLd (?<fun>.+) 0x.+$")).groups.fun;
                const argNum = parseInt(line.match(new RegExp("^ArgsLd .+ (?<value>0x.+)$")).groups.value);
                const args = getReverseArgList(stack, argNum);

                let funcString = "";
                funcString += funcName + "(";
                for (let i = 0; i < argNum; i++) {
                    funcString += args[i];
                    if (i !== argNum - 1) {
                        funcString += ", ";
                    }
                }
                funcString += ")";
                stack.push(funcString);
            } else if (line.startsWith("ArgsMemLd")) {
                const funcName = stack.pop() + "." + line.match(new RegExp("^ArgsMemLd (?<fun>.+) 0x.+$")).groups.fun;
                const argNum = parseInt(line.match(new RegExp("^ArgsMemLd .+ (?<value>0x.+)$")).groups.value);
                const args = getReverseArgList(stack, argNum);

                let funcString = "";
                funcString += funcName + "(";
                for (let i = 0; i < argNum; i++) {
                    funcString += args[i];
                    if (i !== argNum - 1) {
                        funcString += ", ";
                    }
                }
                funcString += ")";
                stack.push(funcString);
            } else if (line.startsWith("SetStmt")) {
            } else if (line.startsWith("Set")) {
                currentLine += "Set " + line.match(new RegExp("^Set (?<name>.+)$")).groups.name;
                currentLine += " = " + stack.pop();
            } else if (line.startsWith("St ")) {
                currentLine += line.match(new RegExp("^St (?<name>.+)$")).groups.name;
                currentLine += " = " + stack.pop();
            } else if (line.startsWith("Ld")) {
                stack.push(line.match(new RegExp("^Ld (?<name>.+)$")).groups.name);
            } else if (line.startsWith("ArgsMemCall")) {
                currentLine += stack.pop() + "." + line.match(new RegExp("^ArgsMemCall (?<fun>.+) 0x.+$")).groups.fun;
                const argNum = parseInt(line.match(new RegExp("^ArgsMemCall .+ (?<value>0x.+)$")).groups.value);
                const args = getReverseArgList(stack, argNum);

                for (let i = 0; i < args.length; i++) {
                    currentLine += " " + args[i];
                    if (i !== argNum - 1) {
                        currentLine += ",";
                    }
                }
            } else if (line.startsWith("MemSt")) {
                currentLine += stack.pop() + "." + line.match(new RegExp("^MemSt (?<field>.+)$")).groups.field + " = " + stack.pop();
            } else if (line.startsWith("Concat")) {
                const second = stack.pop();
                stack.push(stack.pop() + " & " + second);
            } else if (line.startsWith("ArgsCall")) {
                currentLine += line.match(new RegExp("^ArgsCall (?<fun>.+) 0x.+$")).groups.fun + " ";
                const argNum = parseInt(line.match(new RegExp("^ArgsCall .+ (?<value>0x.+)$")).groups.value);
                const args = getReverseArgList(stack, argNum);

                for (let i = 0; i < args.length; i++) {
                    currentLine += args[i];
                    if (i !== argNum - 1) {
                        currentLine += ", ";
                    }
                }
            } else if (line.startsWith("ArgsSt")) {
                currentLine += line.match(new RegExp("^ArgsSt (?<fun>.+) 0x.+$")).groups.fun + " ";
                const argNum = parseInt(line.match(new RegExp("^ArgsSt .+ (?<value>0x.+)$")).groups.value);
                const args = getReverseArgList(stack, argNum);

                currentLine += "(";
                for (let i = 0; i < args.length; i++) {
                    currentLine += args[i];
                    if (i !== argNum - 1) {
                        currentLine += ", ";
                    }
                }
                currentLine += ") = " + stack.pop();

            } else if (line.startsWith("Paren")) {
                stack.push("(" + stack.pop() + ")");
            } else if (line.startsWith("MemLd ")) {
                stack.push(stack.pop() + "." + line.match(new RegExp("^MemLd (?<var>.+)$")).groups.var);
            } else if (line.startsWith("Eq")) {
                const second = stack.pop();
                stack.push(stack.pop() + " = " + second);
            } else if (line.startsWith("Add")) {
                const second = stack.pop();
                stack.push(stack.pop() + " + " + second);
            } else if (line.startsWith("IfBlock")) {
                currentLine += "If " + stack.pop() + " Then";
            } else if (line.startsWith("Debug")) {
                currentLine += "Debug";
            } else if (line.startsWith("PrintObj")) {
                currentLine += ".Print ";
            } else if (line.startsWith("PrintItemNL")) {
                currentLine += stack.pop();
            } else if (line.startsWith("New")) {
                currentLine += "New ?";
            } else if (line.startsWith("Not")) {
                stack.push("Not " + stack.pop());
            } else if (line.startsWith("And")) {
                const second = stack.pop();
                stack.push(stack.pop() + " And " + second);
            } else if (line.startsWith("Or")) {
                const second = stack.pop();
                stack.push(stack.pop() + " Or " + second);
            } else if (line.startsWith("Gt")) {
                const second = stack.pop();
                stack.push(stack.pop() + " > " + second);
            }else if (line.startsWith("Lt")) {
                const second = stack.pop();
                stack.push(stack.pop() + " < " + second);
            }


        }
        sourceCode += currentLine + "\n";
        currentLine = "";
        stack = [];
    }
    return sourceCode;
}

function getReverseArgList(stack, argNum) {
    const args = [];
    for (let i = 0; i < argNum; i++) {
        args.push(stack.pop());
    }
    args.reverse();
    return args;
}