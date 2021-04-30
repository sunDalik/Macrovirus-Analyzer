import JSZip from "jszip";
import {analyzeFile} from "./analysis";
import {OLEFile} from "./OLEFile";
import {readByteArray} from "./file_processor";
import {updateFileList} from "../background";

//global = window;

export function processFile(file) {
    const oReq = new XMLHttpRequest();
    oReq.responseType = "arraybuffer";
    oReq.addEventListener("load", (e) => {

        const handleFile = (file, contents) => {
            const oleFile = new OLEFile(contents);
            file.analysis = analyzeFile(oleFile);
            file.isMalicious = file.oleFile.isMalicious;
            updateFileList();
        };

        const contents = new Uint8Array(e.currentTarget.response);
        console.log(contents);

        if (isOleFile(contents)) {
            handleFile(file, contents);
            console.log("olefile");
        } else if (isZipFile(contents)) {
            const jsZip = new JSZip();
            jsZip.loadAsync(contents)
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
                })
                .then(content => {
                    handleFile(file, new Uint8Array(content));
                });
        }
    });
    oReq.open("GET", "file://" + file.filename);
    oReq.send();
    console.log("opened request");
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