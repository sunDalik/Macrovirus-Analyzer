const fileSelector = document.getElementById('file-selector');
const fileContentsDiv = document.getElementById('file-contents');

fileSelector.addEventListener("input", e => {
    const fileList = e.target.files;

    for (const file of fileList) {
        if (file === null) continue;

        /*
        const reader = new FileReader();
        let fileContents = "";
        reader.addEventListener('load', e => {
            fileContents = e.target.result;
            fileContentsDiv.innerText = fileContents;
        });
        reader.readAsText(file);
         */

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
                fileContentsDiv.innerText = "";
                for (const macroSourceCode of macroSourceCodes) {
                    fileContentsDiv.innerText += macroSourceCode + "\n\n========================================\n\n";
                }
            });

        // only read first file for now
        break;
    }


});