const fileSelector = document.getElementById('file-selector');
const fakeFileSelector = document.getElementById('fake-file-selector');
const sourceCodeDiv = document.getElementById('tab2');
const analysisDiv = document.getElementById('tab1');
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
                sourceCodeDiv.innerText = "";
                for (const macroSourceCode of macroSourceCodes) {
                    sourceCodeDiv.innerText += macroSourceCode + "\n\n========================================\n\n";
                }
                analyzeCode();
            });

        // only read first file for now
        break;
    }
});

fakeFileSelector.addEventListener("click", () => fileSelector.click());

for (const tabSelector of document.getElementsByClassName("tab-selector")) {
    tabSelector.addEventListener("click", () => showTab(tabSelector.dataset.tab));
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

function analyzeCode() {
    analysisDiv.innerText = "";
    analysisDiv.innerText = "I don't know";
}