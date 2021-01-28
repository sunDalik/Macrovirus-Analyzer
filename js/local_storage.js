export const STORAGE_SETTINGS = "macrovirus_settings";

export const SETTINGS = Object.freeze({
    renameVariables: {key: "renameVariables", defaultValue: true},
    removeDeadCode: {key: "removeDeadCode", defaultValue: true}
});

export function setupLocalStorage(reset = false) {
    if (!window.localStorage[STORAGE_SETTINGS] || reset) {
        const settingsObj = {};
        for (const setting of Object.values(SETTINGS)) {
            console.log(setting);
            settingsObj[setting.key] = setting.defaultValue;
        }
        window.localStorage[STORAGE_SETTINGS] = JSON.stringify(settingsObj);
    }
}

export function writeSetting(setting, value) {
    const settingsObj = JSON.parse(window.localStorage[STORAGE_SETTINGS]);
    settingsObj[setting] = value;
    window.localStorage[STORAGE_SETTINGS][setting.key] = JSON.stringify(settingsObj);
}

export function readSetting(setting) {
    const settingsObj = JSON.parse(window.localStorage[STORAGE_SETTINGS]);
    return settingsObj[setting.key];
}