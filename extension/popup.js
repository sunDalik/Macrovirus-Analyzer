let filesList = [];

chrome.storage.local.get("files", ({files}) => {
    filesList = files;
    console.log(filesList);
    if (!filesList) filesList = [];

    for (const file of filesList) {
        const div = document.createElement("div");
        div.innerHTML = "<b>" + file.filename + "</b><br>";
        div.innerHTML += file.analysis + "<br>";
        document.body.appendChild(div);
    }
});