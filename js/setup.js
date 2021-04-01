import JSZip from "jszip";
import {analyzeFile} from "./analysis";
import {deobfuscateCode} from "./deobfuscation";
import {DEOBFUSCATION_SETTINGS, readSetting, SETTINGS, setupLocalStorage, writeSetting} from "./local_storage";
import {OLEFile} from "./OLEFile";
import {pcodeToSource} from "./pcode2";
import {readByteArray} from "./file_processor";

global = window;
setupLocalStorage();

let activeFileId = 0;
const openedFiles = [];

const fileSelector = document.getElementById('file-selector');
const fakeFileSelector = document.getElementById('fake-file-selector');
const uploadButton = document.getElementById('upload-button');
const deobfuscationMenu = document.getElementById('deobfuscation-menu');
const logo = document.getElementById('logo');

const analysisTab = document.getElementById('tab1');
const sourceCodeTab = document.getElementById('tab2');
const deobfuscatedCodeTab = document.getElementById('tab3');

const fileNameSpan = document.getElementById('filename-display');
const mainTable = document.getElementsByClassName('main-table')[0];

const fileScroller = document.getElementById('file-scroller');

fileSelector.addEventListener("input", e => {
    const fileList = e.target.files;
    if (fileList.length === 0) return;

    for (const el of fileScroller.querySelectorAll(".file-scroller-file-button")) {
        el.parentNode.removeChild(el);
    }

    let displayedAnyFile = false;

    const handleFile = (file, contents) => {
        file.oleFile = prepareFile(contents);
        if (!displayedAnyFile) {
            displayedAnyFile = true;
            displayFile(file);
        }
        setupFileScroller(fileList);
    };

    for (let file of fileList) {
        if (file === null) continue;
        fileNameSpan.innerText = file.name;
        fakeFileSelector.style.marginTop = "-20px";
        fakeFileSelector.style.boxShadow = "none";
        fakeFileSelector.style.opacity = "0";
        logo.style.marginTop = "-70px";
        logo.style.opacity = "0";
        mainTable.classList.remove("hidden");

        if (file.name.split(".")[1] === "zip") {
            //TODO Analyze all ole files inside the archive if file extension is .zip (or .rar or whatever?)
            //TODO Automatically try "infected" password if archive has password
        }

        showTab("tab2");
        const reader = new FileReader();
        reader.addEventListener('load', e => {
            const contents = new Uint8Array(e.target.result);
            if (isOleFile(contents)) {
                handleFile(file, contents);
            } else if (isZipFile(contents)) {
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
                        file.oleFile = null;
                        setupFileScroller(fileList);
                    })
                    .then(content => {
                        setupFileScroller(fileList);
                        handleFile(file, new Uint8Array(content));
                    });
            }
        });
        reader.readAsArrayBuffer(file);
    }
});

function setupFileScroller(fileList) {
    if (Array.from(fileList).some(f => f.oleFile === undefined)) return;
    fileScroller.classList.remove("hidden");
    for (let file of fileList) {
        if (file === null) continue;
        const div = document.createElement("div");
        div.classList.add("file-scroller-entry");
        div.classList.add("file-scroller-file-button");
        div.classList.add("file-input-button");
        //div.setAttribute("title", file.name);
        const fileNameDiv = document.createElement("div");
        fileNameDiv.innerText = file.name;
        fileNameDiv.classList.add("ellipsis-text");

        const icon = document.createElement("i");
        icon.classList.add("fas");
        icon.classList.add("fa-lg");
        if (file.oleFile) {
            if (file.oleFile.isMalicious) {
                icon.classList.add("fa-skull");
            } else {
                icon.classList.add("fa-check");
            }

            div.dataset.fileId = file.oleFile.id;

            div.addEventListener("click", () => {
                displayFile(file);
            });
        }

        div.appendChild(fileNameDiv);
        div.appendChild(icon);

        fileScroller.appendChild(div);
    }
    selectFileButton(activeFileId);
}

function isOleFile(binContent) {
    const magic = readByteArray(binContent, {value: 0}, 8);
    return magic[0] === 0xD0 && magic[1] === 0xCF && magic[2] === 0x11 && magic[3] === 0xE0
        && magic[4] === 0xA1 && magic[5] === 0xB1 && magic[6] === 0x1A && magic[7] === 0xE1;
}

function isZipFile(binContent) {
    const magic = readByteArray(binContent, {value: 0}, 4);
    return magic[0] === 0x50 && magic[1] === 0x4B && magic[2] === 0x03 && magic[3] === 0x04;
}

function prepareFile(binaryArray) {
    const oleFile = new OLEFile(binaryArray);
    openedFiles.push(oleFile);
    oleFile.analysisResult = analyzeFile(oleFile);
    return oleFile;
}

function setupFilePreview(file) {
    document.getElementById("file-preview").classList.remove("hidden");
    document.getElementById("file-name").innerText = file.name;
    document.getElementById("file-size").innerText = getReadableFileSizeString(file.size);
    setFilePreviewImage(file.name.split(".")[1]);
}

function selectFileButton(id) {
    const fileButton = fileScroller.querySelector(`.file-scroller-file-button[data-file-id="${id}"]`);
    if (fileButton) {
        fileButton.classList.add("button-selected");
    }
}

function displayFile(file) {
    const oleFile = file.oleFile;
    fileScroller.querySelectorAll(".file-scroller-file-button").forEach(f => f.classList.remove("button-selected"));
    selectFileButton(oleFile.id);
    activeFileId = oleFile.id;
    setupFilePreview(file);
    document.getElementsByClassName("tabs")[0].dataset.fileId = oleFile.id;
    sourceCodeTab.querySelectorAll(".tab-text .direct-child")[0].innerHTML = "";
    sourceCodeTab.querySelectorAll(".tab-text .direct-child")[1].innerHTML = "";
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
        setFileResult(false);
        return;
    }

    for (let i = 0; i < oleFile.macroModules.length; i++) {
        const module = oleFile.macroModules[i];
        let macroSourceCode = module.sourceCode;
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

        if (i < oleFile.macroModules.length - 1) {
            div.classList.add("module-separator");
        }
    }

    if (document.getElementById("show-pcode-checkbox").checked) {
        fillPCode();
    }
    if (!document.getElementById("show-source-code-checkbox").checked) {
        sourceCodeTab.querySelectorAll(".tab-text .direct-child")[0].classList.add("hidden");
    }

    const div = document.createElement("div");
    div.innerHTML = oleFile.analysisResult;
    div.classList.add("table-module");
    tabTextElement(analysisTab).appendChild(div);
    setFileResult(oleFile.isMalicious);

    deobfuscateModulesAndShow(oleFile.macroModules);

    return oleFile;
}

function deobfuscateModulesAndShow(macroModules) {
    tabTextElement(deobfuscatedCodeTab).innerHTML = "";
    for (let i = 0; i < macroModules.length; i++) {
        const module = macroModules[i];
        let macroSourceCode = module.sourceCode;

        const div = document.createElement("div");
        if (readSetting(SETTINGS.deobfuscateDecompiledPCode)) div.innerHTML = deobfuscateCode(pcodeToSource(module.pcode));
        else div.innerHTML = deobfuscateCode(removeAttributes(macroSourceCode));
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
uploadButton.addEventListener("click", () => fileSelector.click());

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

function setFileResult(isMalicious) {
    const fileResultElement = document.getElementById("file-result");
    fileResultElement.classList.remove("good-file-color");
    fileResultElement.classList.remove("bad-file-color");
    if (isMalicious) {
        fileResultElement.classList.add("bad-file-color");
        fileResultElement.innerText = "Malicious";
    } else {
        fileResultElement.classList.add("good-file-color");
        fileResultElement.innerText = "Safe";
    }
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
    //div.setAttribute("data-tooltip","tooltip");
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

document.getElementById("show-pcode-checkbox").addEventListener("change", e => {
    writeSetting(SETTINGS.showPCode, e.target.checked);
    if (!document.getElementById("show-source-code-checkbox").checked && !document.getElementById("show-pcode-checkbox").checked) {
        document.getElementById("show-source-code-checkbox").click();
    }

    // TODO Check if its already filled in????
    if (e.target.checked) {
        document.getElementById("pcode-radio-1").disabled = false;
        document.getElementById("pcode-radio-2").disabled = false;
        fillPCode();
    } else {
        document.getElementById("pcode-radio-1").disabled = true;
        document.getElementById("pcode-radio-2").disabled = true;
        sourceCodeTab.querySelectorAll(".tab-text .direct-child")[1].classList.add("hidden");
    }
});


document.getElementById("show-source-code-checkbox").addEventListener("change", e => {
    writeSetting(SETTINGS.showSourceCode, e.target.checked);
    if (!document.getElementById("show-source-code-checkbox").checked && !document.getElementById("show-pcode-checkbox").checked) {
        document.getElementById("show-pcode-checkbox").click();
    }

    if (e.target.checked) {
        const file = openedFiles.find(f => f.id === activeFileId);
        if (!file) return;
        sourceCodeTab.querySelectorAll(".tab-text .direct-child")[0].classList.remove("hidden");
    } else {
        sourceCodeTab.querySelectorAll(".tab-text .direct-child")[0].classList.add("hidden");
    }
});

document.getElementById("pcode-radio-1").addEventListener("change", e => {
    if (e.target.checked) {
        writeSetting(SETTINGS.useDecompiledPCode, false);
        if (document.getElementById("show-pcode-checkbox").checked) {
            fillPCode();
        }
    }
});
document.getElementById("pcode-radio-2").addEventListener("change", e => {
    if (e.target.checked) {
        writeSetting(SETTINGS.useDecompiledPCode, true);
        if (document.getElementById("show-pcode-checkbox").checked) {
            fillPCode();
        }
    }
});

function fillPCode() {
    const file = openedFiles.find(f => f.id === activeFileId);
    if (!file) return;
    sourceCodeTab.querySelectorAll(".tab-text .direct-child")[1].innerHTML = "";
    sourceCodeTab.querySelectorAll(".tab-text .direct-child")[1].classList.remove("hidden");
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

        if (i < file.macroModules.length - 1) {
            div.classList.add("module-separator");
        }
    }
}

// Init code comparison menu
if (readSetting(SETTINGS.showSourceCode)) {
    document.getElementById("show-source-code-checkbox").click();
}

if (readSetting(SETTINGS.showPCode)) {
    document.getElementById("show-pcode-checkbox").click();
}

if (readSetting(SETTINGS.useDecompiledPCode)) {
    document.getElementById("pcode-radio-2").checked = true;
}

function getReadableFileSizeString(fileSizeInBytes) {
    const byteUnits = [' KB', ' MB', ' GB', ' TB'];
    let i = -1;
    while (fileSizeInBytes > 1000) {
        fileSizeInBytes = fileSizeInBytes / 1000;
        i++;
    }

    return Math.max(fileSizeInBytes, 0.1).toFixed(1) + " " + byteUnits[i];
}

function setFilePreviewImage(fileformat) {
    const icon = document.getElementById("file-icon");
    if (fileformat === "doc") icon.src = "images/doc.png";
    else if (fileformat === "docm") icon.src = "images/docm.png";
    else if (fileformat === "xls") icon.src = "images/xls.png";
    else if (fileformat === "xlsm") icon.src = "images/xlsm.png";
}