let filesList = [];

chrome.storage.sync.get("files", ({files}) => {
    filesList = files;
    console.log(filesList);
    if (!filesList) filesList = [];

    for (const file of filesList) {
        const div = document.createElement("div");
        div.innerText = file;
        document.body.appendChild(div);
    }
});

/*
chrome.runtime.onMessage.addListener((msg) => {

});
 */