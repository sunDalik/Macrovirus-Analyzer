import JSZip from "jszip";
import {analyzeCode} from "./analysis";
import {deobfuscateCode} from "./deobfuscation";
import {DEOBFUSCATION_SETTINGS, readSetting, SETTINGS, setupLocalStorage, writeSetting} from "./local_storage";
import {OLEFile} from "./OLEFile";
import {pcodeToSource} from "./pcode2";

global = window;
setupLocalStorage();

let activeFileId = 0;
const openedFiles = [];

const fileSelector = document.getElementById('file-selector');
const fakeFileSelector = document.getElementById('fake-file-selector');
const deobfuscationMenu = document.getElementById('deobfuscation-menu');
const logo = document.getElementById('logo');

//TODO you shouldnt access tabs by ID
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
        fakeFileSelector.style.boxShadow = "none";
        logo.style.marginTop = "-70px";
        logo.style.opacity = "0";
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
                    displayResults(new Uint8Array(content));
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
    const oleFile = new OLEFile(binaryArray);
    openedFiles.push(oleFile);
    activeFileId = oleFile.id;
    //TODO create NEW tabs for each file
    document.getElementsByClassName("tabs")[0].dataset.fileId = oleFile.id;
    tabTextElement(sourceCodeTab).innerHTML = "<div class=\"direct-child flex-child\"></div><div class=\"direct-child\"></div>";
    tabTextElement(analysisTab).innerHTML = "";
    tabTextElement(deobfuscatedCodeTab).innerHTML = "";
    if (oleFile.macroModules.length === 0) {

        let div = document.createElement("div");
        div.innerHTML = "Module is safe!\n(No macro scripts detected)";
        div.classList.add("table-module");
        tabTextElement(analysisTab).appendChild(div);

        div = document.createElement("div");
        div.innerHTML = "<i>No macro scripts detected</i>";
        div.classList.add("table-module");
        sourceCodeTab.querySelectorAll(".tab-text .direct-child")[0].appendChild(div);

        div = document.createElement("div");
        div.innerHTML = "<i>No macro scripts detected</i>";
        div.classList.add("table-module");
        tabTextElement(deobfuscatedCodeTab).appendChild(div);
        return;
    }

    //macroSourceCodes = [ss_code];

    for (let i = 0; i < oleFile.macroModules.length; i++) {
        const module = oleFile.macroModules[i];
        let macroSourceCode = module.sourceCode;

        //macroSourceCode = removeAttributes(macroSourceCode);

        const div = document.createElement("div");
        div.innerHTML = removeAttributes(macroSourceCode);
        //div.innerHTML = pcodeToSource(module.pcode); //PCODE2 DEBUG
        div.classList.add("table-module");
        div.classList.add("code");
        if (module.name !== "") {
            const header = document.createElement("div");
            header.classList.add("module-header");
            header.classList.add("table-module");
            header.innerHTML = module.name;
            sourceCodeTab.querySelectorAll(".tab-text .direct-child")[0].appendChild(header);
        }
        sourceCodeTab.querySelectorAll(".tab-text .direct-child")[0].appendChild(div);

        const div2 = document.createElement("div");
        div2.innerHTML = analyzeCode(macroSourceCode, module.pcode);
        //div2.innerHTML = module.pcode.join("\n"); //PCODE2 DEBUG
        div2.classList.add("table-module");
        tabTextElement(analysisTab).appendChild(div2);

        if (i < oleFile.macroModules.length - 1) {
            div.classList.add("module-separator");
            div2.classList.add("module-separator");
        }
    }

    deobfuscateModulesAndShow(oleFile.macroModules);
}

function deobfuscateModulesAndShow(macroModules) {
    tabTextElement(deobfuscatedCodeTab).innerHTML = "";
    for (let i = 0; i < macroModules.length; i++) {
        const module = macroModules[i];
        let macroSourceCode = module.sourceCode;

        const div = document.createElement("div");
        div.innerHTML = deobfuscateCode(removeAttributes(macroSourceCode));
        //div.innerHTML = removeAttributes(module.sourceCode); //PCODE2 DEBUG
        div.classList.add("table-module");
        div.classList.add("code");
        if (module.name !== "") {
            const header = document.createElement("div");
            header.classList.add("module-header");
            header.classList.add("table-module");
            header.innerHTML = module.name;
            tabTextElement(deobfuscatedCodeTab).appendChild(header);
        }
        tabTextElement(deobfuscatedCodeTab).appendChild(div);

        if (i < macroModules.length - 1) {
            div.classList.add("module-separator");
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

// Init deobfuscation menu
for (const setting of DEOBFUSCATION_SETTINGS) {
    const div = document.createElement("div");
    const checkbox = document.createElement("input");
    checkbox.setAttribute("type", "checkbox");
    checkbox.checked = readSetting(setting);
    checkbox.id = setting.key + "-checkbox";
    div.append(checkbox);

    const label = document.createElement("label");
    label.setAttribute("for", checkbox.id);
    div.append(label);

    label.innerText = setting.name;
    deobfuscationMenu.append(div);

    checkbox.addEventListener("change", e => {
        writeSetting(setting, e.target.checked);
        deobfuscateModulesAndShow(openedFiles.find(f => f.id === activeFileId).macroModules);
    });
}

document.getElementById("code-split-option").addEventListener("change", e => {
    writeSetting(SETTINGS.compareCode, e.target.checked);
    if (e.target.checked) {
        document.getElementById("pcode-radio-1").disabled = false;
        document.getElementById("pcode-radio-2").disabled = false;

        const file = openedFiles.find(f => f.id === activeFileId);
        if (!file) return;
        for (let i = 0; i < file.macroModules.length; i++) {
            const module = file.macroModules[i];

            const div = document.createElement("div");
            if (document.getElementById("pcode-radio-1").checked) {
                div.innerHTML = module.pcode.join("\n");
            } else {
                div.innerHTML = pcodeToSource(module.pcode);
            }

            div.classList.add("table-module");
            div.classList.add("code");
            if (module.name !== "") {
                const header = document.createElement("div");
                header.classList.add("module-header");
                header.classList.add("table-module");
                header.innerHTML = module.name;
                sourceCodeTab.querySelectorAll(".tab-text .direct-child")[1].appendChild(header);
            }
            sourceCodeTab.querySelectorAll(".tab-text .direct-child")[1].appendChild(div);
            sourceCodeTab.querySelectorAll(".tab-text .direct-child")[1].classList.add("border-left");
            sourceCodeTab.querySelectorAll(".tab-text .direct-child")[1].classList.add("flex-child");


            if (i < file.macroModules.length - 1) {
                div.classList.add("module-separator");
            }
        }

    } else {
        document.getElementById("pcode-radio-1").disabled = true;
        document.getElementById("pcode-radio-2").disabled = true;
        const elements = document.querySelectorAll("#tab2 .tab-text .direct-child");
        elements[1].innerHTML = "";
        sourceCodeTab.querySelectorAll(".tab-text .direct-child")[1].classList.remove("border-left");
        sourceCodeTab.querySelectorAll(".tab-text .direct-child")[1].classList.remove("flex-child");
    }
});

document.getElementById("pcode-radio-1").addEventListener("change", e => {
    if (e.target.checked) {
        writeSetting(SETTINGS.compareWithDecompiledCode, false);
        resplitCode();
    }
});
document.getElementById("pcode-radio-2").addEventListener("change", e => {
    if (e.target.checked) {
        writeSetting(SETTINGS.compareWithDecompiledCode, true);
        resplitCode();
    }
});

function resplitCode() {
    if (document.getElementById("code-split-option").checked) {
        document.getElementById("code-split-option").click();
        document.getElementById("code-split-option").click();
    }
}

// Init code comparison menu
if (readSetting(SETTINGS.compareCode)) {
    document.getElementById("code-split-option").click();
}

if (readSetting(SETTINGS.compareWithDecompiledCode)) {
    document.getElementById("pcode-radio-2").checked = true;
}