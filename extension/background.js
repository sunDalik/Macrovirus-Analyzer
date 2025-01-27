import {processFile} from "./file_handling";

let filesList = [];

chrome.storage.local.get("files", ({files}) => {
    filesList = files;
    if (!filesList) filesList = [];
});

console.log("helloo bg");

/*
 When downloading a file you receive two events:
 1. {
        id: 313,
        filename: {current: "C:\\Folder\\Whatever.doc", previous: ""}
    }

 2. {
        id: 313,
        state: {current: "complete", previous: "in_progress"}
    }

 So you have to remember the pair of id and filename when the first event fires and then retrieve the filename once download completes
 */

// Contains objects of type {id: 0, filename: ""}
const downloadsCache = [];

chrome.downloads.onChanged.addListener((e) => {
    console.log(e);
    if (e.filename) {
        console.log("Has filename!");
        const splitFilename = e.filename.current.split(".");
        const extension = splitFilename[splitFilename.length - 1];
        if (["doc", "docm", "xls", "xlsm"].includes(extension)) {
            console.log("Has correct extension!");
            downloadsCache.push({id: e.id, filename: e.filename.current});

            if (downloadsCache.length > 100) {
                downloadsCache.shift();
            }
        }
    } else if (e.state && e.state.current === "complete") {
        console.log("Has completed!");
        const cacheEntry = downloadsCache.find(cacheEntry => cacheEntry.id === e.id);
        if (cacheEntry === undefined) return;
        const file = {id: e.id, filename: cacheEntry.filename, analysis: "", isMalicious: false};
        filesList.push(file);
        processFile(file);

        if (filesList > 10) {
            filesList.shift();
        }
        updateFileList();
    }
});

export function updateFileList() {
    chrome.storage.local.set({files: filesList});
}
