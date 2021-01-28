import JSZip from "jszip";
import {extractMacro} from "./macros_extraction";
import {analyzeCode} from "./analysis";
import {deobfuscateCode} from "./deobfuscation";
import {setupLocalStorage} from "./local_storage";

global = window;
setupLocalStorage();

const fileSelector = document.getElementById('file-selector');
const fakeFileSelector = document.getElementById('fake-file-selector');
const analysisTab = document.getElementById('tab1');
const sourceCodeTab = document.getElementById('tab2');
const deobfuscatedCodeTab = document.getElementById('tab3');
const fileNameSpan = document.getElementById('filename-display');
const mainTable = document.getElementsByClassName('main-table')[0];

fileSelector.addEventListener("input", e => {
    const fileList = e.target.files;

    for (const file of fileList) {
        if (file === null) continue;
        fileNameSpan.innerText = file.name;
        fakeFileSelector.style.marginTop = "50px";
        mainTable.classList.remove("hidden");
        /*
        const reader = new FileReader();
        let fileContents = "";
        reader.addEventListener('load', e => {
            fileContents = e.target.result;
            fileContentsDiv.innerText = fileContents;
        });
        reader.readAsText(file);
         */

        showTab("tab2");

        if (file.name.endsWith(".docm") || file.name.endsWith(".xlsm")) {
            const jsZip = new JSZip();
            jsZip.loadAsync(file)
                .then(zip => {
                    for (const zipFileName in zip.files) {
                        //todo vbaProject.bin can potentially be renamed so you need to check for this
                        if (zipFileName.endsWith("vbaProject.bin")) {
                            const currentFile = zip.files[zipFileName];
                            //const liFileName = document.createElement("li");
                            //liFileName.innerText = zipFileName;
                            //fileContentsDiv.appendChild(liFileName);
                            return currentFile.async("array");
                        }
                    }
                }, () => {
                    console.log("Not a valid zip file");
                })
                .then(content => {
                    displayResults(content);
                });
        } else if (file.name.endsWith(".doc") || file.name.endsWith(".xls")) {
            const reader = new FileReader();
            reader.addEventListener('load', e => {
                displayResults(new Uint8Array(e.target.result));
            });
            reader.readAsArrayBuffer(file);
        }
        // only read first file for now
        break;
    }
});

function displayResults(binaryArray) {
    let macroSourceCodes = extractMacro(binaryArray);
    tabTextElement(sourceCodeTab).innerHTML = "";
    tabTextElement(analysisTab).innerHTML = "";
    tabTextElement(deobfuscatedCodeTab).innerHTML = "";
    if (macroSourceCodes.length === 0) {
        tabTextElement(analysisTab).innerHTML = "File is safe!\n(No macro scripts detected)";
        tabTextElement(sourceCodeTab).innerHTML = "<i>No macro scripts detected</i>";
        tabTextElement(deobfuscatedCodeTab).innerHTML = "<i>No macro scripts detected</i>";
        return;
    }

    //macroSourceCodes = [ss_code];

    const deobfuscatedCodes = [];

    for (let i = 0; i < macroSourceCodes.length; i++) {
        let macroSourceCode = macroSourceCodes[i];
        const matchResult = macroSourceCode.match(new RegExp("^Attribute VB_Name = \"(?<moduleName>.+?)\"$", "m"));
        let moduleName = "";
        if (matchResult) {
            moduleName = matchResult.groups.moduleName;
        }

        //macroSourceCode = removeAttributes(macroSourceCode);
        if (macroSourceCode === "" || macroSourceCode === "\n") continue;

        const div = document.createElement("div");
        div.innerHTML = removeAttributes(macroSourceCode);
        div.classList.add("table-module");
        if (moduleName !== "") {
            const header = document.createElement("div");
            header.classList.add("module-header");
            header.classList.add("table-module");
            header.innerHTML = moduleName;
            tabTextElement(sourceCodeTab).appendChild(header);
        }
        tabTextElement(sourceCodeTab).appendChild(div);

        const div2 = document.createElement("div");
        div2.innerHTML = analyzeCode(macroSourceCode);
        div2.classList.add("table-module");
        tabTextElement(analysisTab).appendChild(div2);

        const div3 = document.createElement("div");
        div3.innerHTML = deobfuscateCode(removeAttributes(macroSourceCode));
        div3.classList.add("table-module");
        if (moduleName !== "") {
            const header = document.createElement("div");
            header.classList.add("module-header");
            header.classList.add("table-module");
            header.innerHTML = moduleName;
            tabTextElement(deobfuscatedCodeTab).appendChild(header);
        }
        tabTextElement(deobfuscatedCodeTab).appendChild(div3);
        deobfuscatedCodes.push(div3.innerHTML);

        if (i < macroSourceCodes.length - 1) {
            div.classList.add("module-separator");
            div2.classList.add("module-separator");
            div3.classList.add("module-separator");
        }
    }
}

fakeFileSelector.addEventListener("click", () => fileSelector.click());

for (const tabSelector of document.getElementsByClassName("tab-selector")) {
    tabSelector.addEventListener("click", () => showTab(tabSelector.dataset.tab));
}

for (const tab of document.getElementsByClassName("tab-contents")) {
    continue; //todo bad at its current state
    const copyButton = document.createElement("div");
    tab.insertBefore(copyButton, tab.firstChild);
    copyButton.innerText = "Copy to Clipboard";
    copyButton.classList.add("copy-button");
    copyButton.addEventListener("click", (e) => copyTabToClipboard(e));
}

function makeAllTabSelectorsInactive() {
    for (const tabSelector of document.getElementsByClassName("tab-selector")) {
        tabSelector.classList.add("inactive-tab");
    }
}

function hideAllTabs() {
    for (const tabSelector of document.getElementsByClassName("tab-contents")) {
        tabSelector.classList.add("hidden");
    }
}

function showTab(id) {
    makeAllTabSelectorsInactive();
    document.querySelector(".tab-selector[data-tab='" + id + "']").classList.remove("inactive-tab");
    hideAllTabs();
    document.getElementById(id).classList.remove("hidden");
}

function tabTextElement(tabElement) {
    return tabElement.querySelector(".tab-text");
}

function copyTabToClipboard(e) {
    const text = e.target.parentElement.querySelector(".tab-text").innerText;
    const dummyInput = document.createElement("textarea");
    document.body.appendChild(dummyInput);
    dummyInput.value = text;
    dummyInput.select();
    document.execCommand("copy");
    document.body.removeChild(dummyInput);
}

function removeAttributes(code) {
    const codeArray = code.split("\n");
    for (let i = 0; i < codeArray.length; i++) {
        if (codeArray[i].startsWith("Attribute VB_")) {
            codeArray[i] = "";
        } else {
            codeArray[i] += "\n";
        }
    }
    return codeArray.join("");
}