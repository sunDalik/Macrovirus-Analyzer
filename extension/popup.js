let filesList = [];

const fileScroller = document.getElementById('file-scroller');
const analysisTab = document.getElementById('analysis');
const fileName = document.getElementById('file-name');
const fileResultSafe = document.getElementById('file-result-safe');
const fileResultMalicious = document.getElementById('file-result-malicious');

chrome.storage.local.get("files", ({files}) => {
    filesList = files;
    console.log(filesList);
    if (!filesList) {
        filesList = [];
        return;
    }

    for (let i = filesList.length - 1; i >= 0; i--) {
        const file = filesList[i];
        const div = document.createElement("div");
        div.classList.add("file-scroller-entry");
        div.classList.add("file-scroller-file-button");
        div.classList.add("file-input-button");
        const fileNameDiv = document.createElement("div");
        fileNameDiv.innerText = getDisplayedFileName(file);
        fileNameDiv.classList.add("ellipsis-text");

        const icon = document.createElement("i");
        icon.classList.add("fas");
        icon.classList.add("fa-lg");
        if (file.isMalicious) {
            icon.classList.add("fa-skull");
        } else {
            icon.classList.add("fa-check");
        }

        div.dataset.fileId = file.id;

        div.addEventListener("click", () => {
            displayFile(file);
        });

        div.appendChild(fileNameDiv);
        div.appendChild(icon);

        fileScroller.appendChild(div);
    }

    displayFile(filesList[filesList.length - 1]);
});

function displayFile(file) {
    selectFileButton(file.id);
    analysisTab.innerHTML = file.analysis;
    fileName.innerText = getDisplayedFileName(file);

    fileResultMalicious.classList.add("hidden");
    fileResultSafe.classList.add("hidden");
    if (file.isMalicious) {
        fileResultMalicious.classList.remove("hidden");
    } else {
        fileResultSafe.classList.remove("hidden");
    }
}

function selectFileButton(id) {
    fileScroller.querySelectorAll(".file-scroller-file-button").forEach(f => f.classList.remove("button-selected"));
    const fileButton = fileScroller.querySelector(`.file-scroller-file-button[data-file-id="${id}"]`);
    if (fileButton) {
        fileButton.classList.add("button-selected");
    }
}

function getDisplayedFileName(file) {
    const splitPath = file.filename.split("\\");
    return splitPath[splitPath.length - 1];
}