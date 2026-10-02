import fs from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");
const configPath = path.join(dataDir, "config.json");
const statePath = path.join(dataDir, "state.json");

const defaultConfig = {
  checkIntervalMinutes: Number(process.env.CHECK_INTERVAL_MINUTES || 10),
  platforms: {
    steam: {
      enabled: true,
      channelId: "1555615088440770682", // 〔🎲〕・ꜱᴛᴇᴀᴍ
      roleId: null,
      logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Steam_icon_logo.svg/512px-Steam_icon_logo.svg.png",
      bannerUrl: null,
      color: 1744895
    },
    epic: {
      enabled: true,
      channelId: "1555616213944635402", // 〔🎲〕・ᴇᴘɪᴄ
      roleId: null,
      logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Epic_Games_logo.svg/512px-Epic_Games_logo.svg.png",
      bannerUrl: null,
      color: 30962
    }
  }
};

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function ensureFiles() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
  }
  if (!fs.existsSync(statePath)) {
    fs.writeFileSync(statePath, JSON.stringify({ announced: {} }, null, 2));
  }
}

function readJson(file, fallback) {
  ensureFiles();
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return clone(fallback);
  }
}

function writeJson(file, value) {
  ensureFiles();
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

export function getConfig() {
  const config = readJson(configPath, defaultConfig);
  config.platforms ??= {};
  for (const key of ["steam", "epic"]) {
    config.platforms[key] ??= clone(defaultConfig.platforms[key]);
  }
  config.checkIntervalMinutes ??= defaultConfig.checkIntervalMinutes;
  return config;
}

export function saveConfig(config) {
  writeJson(configPath, config);
}

export function getState() {
  const state = readJson(statePath, { announced: {} });
  state.announced ??= {};
  return state;
}

export function saveState(state) {
  writeJson(statePath, state);
}

export function markAnnounced(platform, giveawayId) {
  const state = getState();
  state.announced[`${platform}:${giveawayId}`] = Date.now();
  saveState(state);
}

export function wasAnnounced(platform, giveawayId) {
  return Boolean(getState().announced[`${platform}:${giveawayId}`]);
}

export function resetAnnounced() {
  const state = getState();
  state.announced = {};
  saveState(state);
}
