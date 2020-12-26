import JSZip from "jszip";
import {extractMacro} from "./macros_extraction";
import {analyzeCode} from "./analysis";

global = window;

const fileSelector = document.getElementById('file-selector');
const fakeFileSelector = document.getElementById('fake-file-selector');
const sourceCodeTab = document.getElementById('tab2');
const analysisTab = document.getElementById('tab1');
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

        const jsZip = new JSZip();
        jsZip.loadAsync(file)
            .then(zip => {
                for (const zipFileName in zip.files) {
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
                const macroSourceCodes = extractMacro(content);
                tabTextElement(sourceCodeTab).innerHTML = "";
                tabTextElement(analysisTab).innerHTML = "";
                const delimiter = "\n========================================\n\n";
                for (const macroSourceCode of macroSourceCodes) {
                    tabTextElement(sourceCodeTab).innerHTML += macroSourceCode + delimiter;
                    tabTextElement(analysisTab).innerHTML += analyzeCode(macroSourceCode) + delimiter;
                }
            });

        // only read first file for now
        break;
    }
});

fakeFileSelector.addEventListener("click", () => fileSelector.click());

for (const tabSelector of document.getElementsByClassName("tab-selector")) {
    tabSelector.addEventListener("click", () => showTab(tabSelector.dataset.tab));
}

for (const tab of document.getElementsByClassName("tab-contents")) {
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

