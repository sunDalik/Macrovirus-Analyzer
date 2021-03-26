export const STORAGE_SETTINGS = "macrovirus_settings";

export const SETTINGS = Object.freeze({
    renameVariables: {key: "renameVariables", name: "Rename variables", defaultValue: true},
    removeDeadCode: {key: "removeDeadCode", name: "Remove dead code", defaultValue: true},
    removeComments: {key: "removeComments", name: "Remove comments", defaultValue: false},

    compareCode: {key: "compareCode", name: "--", defaultValue: false},
    compareWithDecompiledCode: {key: "compareWithDecompiledCode", name: "--", defaultValue: false}
});

export const DEOBFUSCATION_SETTINGS = [SETTINGS.renameVariables,
    SETTINGS.removeDeadCode,
    SETTINGS.removeComments];

export function setupLocalStorage(reset = false) {
    if (!window.localStorage[STORAGE_SETTINGS] || reset) {
        const settingsObj = {};
        for (const setting of Object.values(SETTINGS)) {
            settingsObj[setting.key] = setting.defaultValue;
        }
        window.localStorage[STORAGE_SETTINGS] = JSON.stringify(settingsObj);
    } else {
        const settingsObj = JSON.parse(window.localStorage[STORAGE_SETTINGS]);
        for (const setting of Object.values(SETTINGS)) {
            if (settingsObj[setting.key] === undefined) {
                settingsObj[setting.key] = setting.defaultValue;
            }
        }
        window.localStorage[STORAGE_SETTINGS] = JSON.stringify(settingsObj);
    }
}

export function writeSetting(setting, value) {
    const settingsObj = JSON.parse(window.localStorage[STORAGE_SETTINGS]);
    settingsObj[setting.key] = value;
    window.localStorage[STORAGE_SETTINGS] = JSON.stringify(settingsObj);
}

export function readSetting(setting) {
    const settingsObj = JSON.parse(window.localStorage[STORAGE_SETTINGS]);
    return settingsObj[setting.key];
}