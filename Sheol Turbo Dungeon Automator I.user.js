// ==UserScript==
// @name         Sheol Turbo Dungeon Automator I
// @namespace    sheol-guild-dungeon-turbo
// @version      6.0.1
// @description  TURBO build: parallel attacks & looting, neon cyber UI, live stats, card-style settings
// @author       Arky, Sheol & Wander
// @icon         data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2064%2064%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%221%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22%2300e5ff%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23ff2e63%22%2F%3E%3C%2FlinearGradient%3E%3CradialGradient%20id%3D%22f%22%20cx%3D%2250%25%22%20cy%3D%2260%25%22%20r%3D%2260%25%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22%230b3a55%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23070b14%22%2F%3E%3C%2FradialGradient%3E%3C%2Fdefs%3E%3Cpath%20d%3D%22M32%203%2057%2017V42C57%2052%2045%2059%2032%2062%2019%2059%207%2052%207%2042V17Z%22%20fill%3D%22url%28%23f%29%22%20stroke%3D%22url%28%23g%29%22%20stroke-width%3D%223%22%2F%3E%3Cg%20stroke%3D%22%23f3e8ff%22%20stroke-width%3D%223%22%20stroke-linecap%3D%22round%22%3E%3Cpath%20d%3D%22M18%2015%2046%2043M46%2015%2018%2043%22%2F%3E%3C%2Fg%3E%3Cg%20stroke%3D%22%23ffc857%22%20stroke-width%3D%223%22%20stroke-linecap%3D%22round%22%3E%3Cpath%20d%3D%22M14%2040%2022%2032M50%2040%2042%2032%22%2F%3E%3C%2Fg%3E%3Cpath%20d%3D%22M32%2044C24%2039%2027%2031%2032%2024%2034%2030%2041%2033%2038%2040%2037%2042%2035%2044%2032%2044Z%22%20fill%3D%22url%28%23g%29%22%2F%3E%3Cpath%20d%3D%22M32%2041C29%2038%2030%2034%2032%2031%2033%2034%2036%2035%2035%2038%2034%2040%2033%2041%2032%2041Z%22%20fill%3D%22%23ffd28a%22%2F%3E%3C%2Fsvg%3E
// @match        https://demonicscans.org/guild_dash.php*
// @match        https://demonicscans.org/guild_dungeon.php*
// @match        https://demonicscans.org/guild_dungeon_location.php*
// @match        https://demonicscans.org/guild_dungeon_instance.php*
// @match        https://demonicscans.org/battle.php*
// @match        https://demonicscans.org/active_wave.php*
// @match        https://demonicscans.org/pvp.php*
// @grant        GM_info
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        unsafeWindow
// @updateURL    https://raw.githubusercontent.com/b07Aarav/DSScripts/refs/heads/main/Sheol%20Turbo%20Dungeon%20Automator%20I.user.js
// @downloadURL  https://raw.githubusercontent.com/b07Aarav/DSScripts/refs/heads/main/Sheol%20Turbo%20Dungeon%20Automator%20I.user.js
// ==/UserScript==

(async () => {
    'use strict';

    // Wave pages run the merged Overlord Farmer (own UI + wave/boss farming).
    // None of the dungeon code below runs there.
    if (location.pathname.endsWith('/active_wave.php')) { overlordWaveFarmer(); return; }
    // PvP page runs the Auto PvP Matchmaking script (pasted below exactly as-is).
    if (location.pathname.endsWith('/pvp.php')) { autoPvpMatchmaking(); return; }

    const CLASS_SKILLS_KEY = "ds_class_skills";
    let CLASS_SKILLS = {}
    const MAX_LOGS = 1000;
    const AUTO_FARM_LOCKED = "auto_farm_locked";
    const WAVE_URLS = ["https://demonicscans.org/active_wave.php?gate=3&wave=8", "https://demonicscans.org/active_wave.php?gate=5&wave=9"
                       , "https://demonicscans.org/active_wave.php?gate=5&wave=10", "https://demonicscans.org/active_wave.php?gate=5&wave=11"]

    if (!sessionStorage.getItem("tabId")) {
        sessionStorage.setItem("tabId", crypto.randomUUID());
    }
    const TAB_ID = sessionStorage.getItem("tabId");
    const LOCK_HEARTBEAT_KEY = "auto_farm_lock_ts";
    const LOCK_EXPIRY_MS = 60000; // 1 minute
    const SCRIPT_KEY = `auto_guild_dungeon_${TAB_ID}`;
    const STORAGE_KEY_AUTO_FARM_RUNNING = 'auto_farm_running'
    const STORAGE_KEY_AUTO_FARM_SETTINGS = 'auto_farm_settings'
    const LOG_HISTORY_KEY = 'ds_gd_log_history';
    const MONSTER_CACHE_KEY = "monster_data_cache"
    const SCRIPT_VERSION_KEY = "dungeon_script_version";
    const CURRENT_VERSION = GM_info.script.version; // pulled from @version header
    let logHistory = [];
    startHeartbeat();
    updateClassSkills();
    loadLogs();
    runMigrations();

    if (window.location.href.includes('battle.php')) {
        return;
    }
    await restoreAutofarmState();

    // --- DEBUG TOGGLE ---
    const ENABLE_CALLS = true; // Set to false to simulate API calls without actually hitting the server

    // -- URLS --
    const BASE_URL = 'https://demonicscans.org';
    const DUNGEONS_URL = 'https://demonicscans.org/guild_dungeon.php';
    const LOC_URL = 'https://demonicscans.org/guild_dungeon_location.php';
    const USE_ITEM_URL = 'https://demonicscans.org/use_item.php';
    const HP_POT_URL = 'https://demonicscans.org/user_heal_potion.php';
    const JOIN_BATTLE_URL = 'https://demonicscans.org/dungeon_join_battle.php';
    const DAMAGE_URL = 'https://demonicscans.org/damage.php';
    const LOOT_MONSTER_URL = 'https://demonicscans.org/dungeon_loot.php';
    const PLAYER_STATS_URL = 'https://demonicscans.org/active_wave.php?gate=3&wave=3';
    const INVENTORY_URL = 'https://demonicscans.org/inventory.php';

    // -- FIXED BOSS LIST & STATS --
    const BOSS_LIST = [
        "Prince Grixkar The Hybrid",
        "The Goblin Royal Vizier",
        "Vorrak the Bloodbound Berserker",
        "Grimgrowl the Chimera",
        "Drazhul The Broken Crown",
        "khaal The Abomination Prince",
        "The Polyhedral Apex"
    ];

    const BOSS_STATS = {
        "prince grixkar the hybrid": { expRatio: 0.01, dmgLimit: 3000000000, lvl: 3000 },
        "the goblin royal vizier": { expRatio: 0.011250, dmgLimit: 4800000000, lvl: 8000 },
        "vorrak the bloodbound berserker": { expRatio: 0.011250, dmgLimit: 4800000000, lvl: 8000 },
        "grimgrowl the chimera": { expRatio: 0.011250, dmgLimit: 4800000000, lvl: 8000 },
        "drazhul the broken crown": { expRatio: 0.011250, dmgLimit: 4800000000, lvl: 8000 },
        "khaal the abomination prince": { expRatio: 0.011000, dmgLimit: 6000000000, lvl: 8000 },
        "the polyhedral apex": { expRatio: 0.011500, dmgLimit: 9600000000, lvl: 18000 }
    };

    const staminaUsedPerDungeon = loadStaminaUsedPerDungeon();
    const staminaUsedPerBoss = loadStaminaUsedPerBoss();

    const LOOT_DELAY_MS = 0;

    /* =====================================================
        SETTINGS MANAGER
    ====================================================== */
    const KEY_SETTINGS = 'verya_auto_dungeon';
    const LOOP_KEY = "ds_gd_auto_loop";
    const GRIBBLE_OVERDAMAGE_LIMIT = 3_000_000;
    const GRIBBLE_REWARD_REQ = 1_000_000;



    function addGribbleId(id) {
        let list = JSON.parse(localStorage.getItem('gribble_ids') || '[]');
        if (!list.includes(id)) {
            list.push(id);
            if (list.length > 20) {
                list = list.slice(-20);
            }
            localStorage.setItem('gribble_ids', JSON.stringify(list));
        }
    }
    function isGribbleHit(id) {
        const list = JSON.parse(localStorage.getItem('gribble_ids') || '[]');
        return list.includes(id);
    }

    let loopController = sessionStorage.getItem(LOOP_KEY) === 'true' ? new AbortController() : null;

    let playerStats = {
        currentStamina: 0,
        maxStamina: 0,
        level: 0,
        currentXP: 0,
        maxXP: 0
    }
    const monsterCache = loadMonsterCache();
    let updatedPlayerStats = await updatePlayerStats();
    while (!(updatedPlayerStats)) {
        console.warn('Failed to fetch player stats, retrying in 3 seconds...');
        await new Promise(res => setTimeout(res, 1000));
        updatedPlayerStats = await updatePlayerStats();
    }
    function buildDefaultSettings() {
        const defBossCaps = {};
        const defBossLS = {};
        const defBossAtk = {};
        const defBossSkill = {};
        BOSS_LIST.forEach(b => {
            defBossCaps[b.toLowerCase()] = '0';
            defBossLS[b.toLowerCase()] = '30';
            defBossAtk[b.toLowerCase()] = false;
            defBossSkill[b.toLowerCase()] = 'LEGENDARY_SLASH';
        });

        return {
            gribbleUseCap: false,       // true = Gribble uses your monster damage cap instead of the 1M safe mode
            gribbleSetEnabled: false,   // swap gear when Gribble Junk-Magus is found
            gribbleSetName: '',         // exact quick-set name, e.g. 'Maguses'
            mainSetEnabled: false,      // switch back after attacking
            mainSetName: '',            // exact quick-set name of your normal set
            useLargeStamina: false,
            useFullStamina: false,
            fullStaminaPotionId: 1,
            largeStaminaPotionId: 2,
            hpPotionId: 3,
            expThreshold: 0.7,
            hpThreshold: 50,
            staminaThreshold: 10,
            lootBatchSize: 15,
            monsterAttackEnabled: {},  // { nameKey: true/false }
            monsterAttackLS: {},  // { nameKey: '5' }
            monsterAttackSkill: {},  // { nameKey: 'POWER_SLASH' }
            monsterAttackCap: {
                "creator's chosen executor": '110,000,000',
                'warform of the creator': '81,000,000',
                'zenith lancer': '39,000,000',
                'crown resonator': '36,000,000',
                'null choir adept': '18,000,000',
                'bastion iterant': '23,000,000',
                'calibration warden': '17,000,000',
                'prismblade reaver': '10,000,000',
                'mireglass stalker': '12,000,000',
                'siege-root howler': '10,000,000',
            },
            monsterAttackMax: {},   // { nameKey: '2' }  0 = hit all
            bossCaps: defBossCaps,
            bossAttackLS: defBossLS,     // { bossNameLower: '30' }
            bossAttackSkill: defBossSkill,  // { bossNameLower: 'LEGENDARY_SLASH' }
            bossAttackEnabled: defBossAtk,    // { bossNameLower: true/false }
            knownMonsters: [
                // Shadowbridge monsters
                'Gribble Junk-Magus', 'Orc Stone-Rend', 'Vorga Ash-Shaman', 'Krak One-Horn',
                'Skrit Gear', 'Brog Skull', 'Droknar Night-Blade', 'Gorvash the Stone-Ram',
                'Hruk Forge-Eater', 'Makra the Mireborn', 'Nib Wickfingers', 'Pip Tanglefoot',
                'Rukka The Wolf Raider', 'Shagra Bone-Singer', 'Talla Flint-Stem',
                'Tharka Blood-Howl', 'Urzul Iron-Tusks', 'Zorgra Frost-Vein',
                // Polyhedral Crucible monsters — Gate Prism
                'Prismblade Reaver', 'Mireglass Stalker', 'Siege-Root Howler',
                // Ash Lane
                'Null Choir Adept', 'Calibration Warden', 'Bastion Iterant', 'Polyhedral Devourer',
                // Crown Lens
                'Crown Resonator', 'Zenith Lancer', 'Warform of the Creator', "Creator's Chosen Executor"
            ],
            monsterStatus: {},  // { monsterNameLower: 'alive' | 'dead' | '' }
            attackLaunchMonsters: true,   // remembered state of Monsters checkbox in Start Attack
            attackLaunchBosses: false,  // remembered state of Bosses checkbox in Start Attack
            showOnlyLootableBosses: false,
            showActionLog: true,        // tick box: show / hide the action log
            turbo: 8                    // how many monsters / bosses / loots run at the same time
        };
    }

    async function updatePlayerStats() {
        const baseUrl = new URL("https://demonicscans.org/game_dash.php");
        try {
            const res = await safeFetch(baseUrl.toString(), { credentials: "include" });
            const html = await res.text();

            const doc = new DOMParser().parseFromString(html, "text/html");


            playerStats.currentStamina = parseInt(
                doc.querySelector('#stamina_span').textContent.replace(/,/g, '')
            );

            playerStats.maxStamina = parseInt(
                doc.querySelector('#stamina_span').parentElement.textContent
                .split('/')[1]
                .trim()
                .replace(/,/g, '')
            );
            playerStats.level = parseInt(
                doc.querySelector('.gtb-level').textContent.replace(/\D/g, '')
            );

            [playerStats.currentXP, playerStats.maxXP] = doc
                .querySelector('.gtb-exp-top span:last-child')
                .textContent
                .replace(/,/g, '')
                .split('/')
                .map(s => parseInt(s.trim(), 10));
            return true;
        } catch (err) {
            console.error(`Failed to fetch page ${baseUrl}`, err);
            return false;
        }


    }

    function loadAllSettings() {
        const defaults = buildDefaultSettings();
        const stored = localStorage.getItem(KEY_SETTINGS);
        if (!stored) return defaults;
        try {
            const parsed = JSON.parse(stored);
            const merged = { ...defaults, ...parsed };

            // --- MIGRATION: monsterStrategies + targetMonsters → monsterAttack* ---
            if (parsed.monsterStrategies && !parsed.monsterAttackEnabled) {
                const enabled = {}, ls = {}, skill = {}, cap = {};
                const selected = parsed.targetMonsters || [];
                const isAll = selected.includes('all');

                // Parse old strategy string into new fields
                const parseOldStrat = (raw) => {
                    const aliases = { S: 'SLASH', PS: 'POWER_SLASH', HS: 'HEROIC_SLASH', US: 'ULTIMATE_SLASH', LS: 'LEGENDARY_SLASH', WBS: 'WORLD_BREAKER_SLASH' };
                    let count = 5, sk = 'POWER_SLASH', cp = '0';
                    if (typeof raw === 'string') {
                        raw.split(',').forEach(part => {
                            const [k, v] = part.trim().split(':');
                            const key = (aliases[k?.trim().toUpperCase()] || k?.trim().toUpperCase() || '').replace(/ /g, '_');
                            if (!v) return;
                            if (key === 'DMG_CAP') { cp = v.trim(); }
                            else if (['SLASH', 'POWER_SLASH', 'HEROIC_SLASH', 'ULTIMATE_SLASH', 'LEGENDARY_SLASH', 'WORLD_BREAKER_SLASH'].includes(key)) {
                                sk = key; count = parseInt(v.trim()) || 5;
                            }
                        });
                    }
                    return { count, skill: sk, cap: cp };
                };

                const defaultStrat = parseOldStrat(parsed.monsterStrategies['default'] || 'POWER_SLASH:5');

                // Apply to all known monsters
                const allNames = defaults.knownMonsters || [];
                allNames.forEach(name => {
                    const key = name.toLowerCase();
                    const rawStrat = parsed.monsterStrategies[key];
                    const s = rawStrat ? parseOldStrat(rawStrat) : defaultStrat;
                    enabled[key] = isAll || selected.includes(key) || false;
                    ls[key] = String(s.count);
                    skill[key] = s.skill;
                    cap[key] = s.cap;
                });

                merged.monsterAttackEnabled = enabled;
                merged.monsterAttackLS = ls;
                merged.monsterAttackSkill = skill;
                merged.monsterAttackCap = cap;
                delete merged.monsterStrategies;
                delete merged.targetMonsters;
            }

            return merged;
        } catch (e) {
            return defaults;
        }
    }

    function persistAllSettings() {
        localStorage.setItem(KEY_SETTINGS, JSON.stringify(settings));
    }

    const settings = loadAllSettings();
    // (normalizeSavedCaps() is called once, right after the helpers are defined)

    // ===== TURBO helpers =====
    function getTurbo() { return Math.min(20, Math.max(1, parseIntStrict(settings.turbo, 8))); }
    async function runPool(items, limit, worker) {
        let idx = 0, firstErr = null;
        const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
            while (running && idx < items.length && !firstErr) {
                const item = items[idx++];
                try { await worker(item); } catch (e) { firstErr = firstErr || e; }
            }
        });
        await Promise.all(lanes);
        if (firstErr) throw firstErr;
    }

    // -- STORAGE & STATE --
    const AUTO_RUNNING_KEY = 'ds_gd_running';
    const UI_STATE_KEY = 'ds_gd_ui_minimized';
    const SESSION_STATS_KEY = 'ds_gd_session_stats';

    let running = sessionStorage.getItem(AUTO_RUNNING_KEY) === 'true';
    let currentStatus = running ? 'RUNNING' : 'STOPPED';
    let minimized = sessionStorage.getItem(UI_STATE_KEY) !== 'false'; // default: tucked into the launcher button

    let largePotionsDepleted = false;
    let manaPotionsDepleted = false;
    let staminaRefillsUsed = 0;

    let currentStamina = 0;
    let lastKnownHp = 0;
    let lastKnownExp = '-';
    let currentExpRatio = 0;
    let currentExpRaw = 0;
    let maxExpRaw = 0;

    // -- STATS TRACKING --
    let bossesLooted = 0;
    let monstersLooted = 0;
    let totalExpLooted = 0;
    let totalGoldLooted = 0;
    let lootTracker = {};
    let lootableMobCacheByInstance = {};
    let sessionStart = Date.now();
    hydrateSessionStats();
    function toNonNegativeInt(value) {
        const num = Number(value);
        if (!Number.isFinite(num)) return null;
        return Math.max(0, Math.floor(num));
    }

    function parseIntStrict(rawValue, fallback = 0) {
        if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
            return Math.floor(rawValue);
        }
        const text = String(rawValue ?? '').trim();
        if (!text) return fallback;
        const normalized = text.replace(/[,_\s]/g, '');
        if (!/^[-+]?\d+$/.test(normalized)) return fallback;
        const parsed = Number.parseInt(normalized, 10);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function parseFloatStrict(rawValue, fallback = 0) {
        if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
            return rawValue;
        }
        const text = String(rawValue ?? '').trim();
        if (!text) return fallback;
        const normalized = text.replace(/[,_\s]/g, '');
        if (!/^[-+]?\d+(?:\.\d+)?$/.test(normalized)) return fallback;
        const parsed = Number.parseFloat(normalized);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function formatSkillName(name) {
        return name.split('_').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join(' ');
    }

    function getMaxRefillsLimit() {
        return Infinity; // refill limit removed
    }

    function formatRefillCounter() {
        return `${staminaRefillsUsed}`;
    }

    function bindTap(element, handler) {
        if (!element || typeof handler !== 'function') return;
        let touchTriggered = false;

        element.addEventListener('touchend', (event) => {
            touchTriggered = true;
            event.preventDefault();
            handler(event);
        }, { passive: false });

        element.addEventListener('click', (event) => {
            if (touchTriggered) {
                touchTriggered = false;
                return;
            }
            handler(event);
        });
    }

    function hydrateSessionStats() {
        try {
            const raw = localStorage.getItem(SESSION_STATS_KEY);
            if (!raw) return;

            const saved = JSON.parse(raw);
            if (!saved || typeof saved !== 'object') return;

            const savedRefills = toNonNegativeInt(saved.staminaRefillsUsed);
            if (savedRefills !== null) staminaRefillsUsed = savedRefills;

            const savedBosses = toNonNegativeInt(saved.bossesLooted);
            const savedLooted = toNonNegativeInt(saved.monstersLooted);
            const savedExp = toNonNegativeInt(saved.totalExpLooted);
            const savedGold = toNonNegativeInt(saved.totalGoldLooted);

            if (savedBosses !== null) bossesLooted = savedBosses;
            if (savedLooted !== null) monstersLooted = savedLooted;
            if (savedExp !== null) totalExpLooted = savedExp;
            if (savedGold !== null) totalGoldLooted = savedGold;

            const savedStart = Number(saved.sessionStart);
            if (Number.isFinite(savedStart) && savedStart > 0) sessionStart = savedStart;

            if (saved.lootTracker && typeof saved.lootTracker === 'object' && !Array.isArray(saved.lootTracker)) {
                lootTracker = saved.lootTracker;
            }
        } catch (err) {
            console.error('Failed to hydrate dungeon session stats', err);
        }
    }

    function persistSessionStats() {
        const payload = {
            staminaRefillsUsed,
            bossesLooted,
            monstersLooted,
            totalExpLooted,
            totalGoldLooted,
            lootTracker,
            sessionStart
        };
        localStorage.setItem(SESSION_STATS_KEY, JSON.stringify(payload));
        try { updateStatsModal(); } catch (e) { /* HUD not ready yet */ }
    }

    const TIER_STYLES = {
        'COMMON': { border: '#777', glow: 'none' },
        'RARE': { border: '#2196f3', glow: 'none' },
        'EPIC': { border: '#9c27b0', glow: 'none' },
        'LEGENDARY': { border: '#ff9800', glow: '0 0 8px #ff9800' }
    };

    // Locations Mapping
    const SHADOWBRIDGE_LOCS = [1, 2, 3, 4];
    const CASTLE_MOB_LOCS = [6, 7, 8, 9];    // Regular mob locations in Castle
    const CASTLE_BOSS_LOCS = [6, 7, 8, 9, 10]; // All Castle locations incl. boss room
    const POLYHEDRAL_MOB_LOCS = [11, 12, 13];         // Gate Prism, Ash Lane, Crown Lens

    const LOCATION_NAMES = {
        1: "Brood Pits",
        2: "Plunder Warrens",
        3: "Shattered Stone Causeways",
        4: "Territory Center",
        5: "Boss Room",
        6: "The Vizier's Conspiracy Hall",
        7: "Hall of the Bloodbound",
        8: "Room of Beasts",
        9: "Room of the Dead Crown",
        10: "The True Heir Throne",
        11: "Gate Prism",
        12: "Ash Lane",
        13: "Crown Lens"
    };

    // Skills cost mapping
    const SKILLS = {
        SLASH: { id: 0, cost: 1 },
        POWER_SLASH: { id: -1, cost: 10 },
        HEROIC_SLASH: { id: -2, cost: 50 },
        ULTIMATE_SLASH: { id: -3, cost: 100 },
        LEGENDARY_SLASH: { id: -4, cost: 200 },
        WORLD_BREAKER_SLASH: { id: -5, cost: 1000 }
    };

    const STATUS_COLORS = {
        STOPPED: '#ff4d6d',
        RUNNING: '#3ddc97',
        FIGHTING: '#4cc9f0',
        LOOTING: '#ffc857'
    };

    const FORM_HEADERS = { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' };

    function now() {
        return new Date().toLocaleTimeString("en-GB", { hour12: false });
    }

    function getCookie(name) {
        return document.cookie
            .split('; ')
            .find(row => row.startsWith(name + '='))
            ?.split('=')[1] ?? null;
    }


    /* ======================
       SHEOL BRANDING, POPUPS & TOASTS
    ====================== */
    const CREATOR = 'Arky, Sheol & Wander';
    function shLogo(size = 28, u = 'a') {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64"><defs><linearGradient id="g${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#00e5ff"/><stop offset="1" stop-color="#ff2e63"/></linearGradient><radialGradient id="f${u}" cx="50%" cy="50%" r="65%"><stop offset="0" stop-color="#0d4a6a"/><stop offset="1" stop-color="#070b14"/></radialGradient><linearGradient id="b${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#b9a7d6"/></linearGradient></defs><polygon points="32,2 58,17 58,47 32,62 6,47 6,17" fill="url(#f${u})" stroke="url(#g${u})" stroke-width="3" stroke-linejoin="round"/><g stroke-linecap="round"><path d="M16 12 46 50M48 12 18 50" stroke="url(#b${u})" stroke-width="4"/><path d="M34.3 46.7 43.7 39.3M29.7 46.7 20.3 39.3" stroke="#ffc857" stroke-width="3"/></g><path d="M18 31Q32 16 46 31 32 46 18 31Z" fill="#070b14" stroke="url(#g${u})" stroke-width="2.5" stroke-linejoin="round"/><circle cx="32" cy="31" r="5.5" fill="#ffc857"/><ellipse cx="32" cy="31" rx="1.7" ry="5" fill="#070b14"/></svg>`;
    }

    function shEsc(t) {
        return String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    }

    const POPUP_ICONS = { error: '⛔', warn: '⚠️', info: 'ℹ️', success: '✅' };
    const popupQueue = [];
    let popupOpen = false;

    /**
     * Friendly popup.  showPopup({ type, title, message, todo, okText })
     *  type: 'error' | 'warn' | 'info' | 'success'
     *  message: what happened (short, plain words)
     *  todo:    what the player should do next
     */
    function showPopup(opts) {
        popupQueue.push(opts);
        if (!popupOpen) nextPopup();
    }
    function nextPopup() {
        const o = popupQueue.shift();
        if (!o) { popupOpen = false; return; }
        popupOpen = true;
        const type = o.type || 'info';
        const overlay = document.createElement('div');
        overlay.className = 'sh-overlay';
        overlay.innerHTML = `
            <div class="sh-pop sh-pop-${type}" role="dialog" aria-modal="true">
                <div class="sh-pop-brand">${shLogo(20, 'p' + Date.now())}<span>SHEOL AUTOMATOR</span></div>
                <div class="sh-pop-icon">${POPUP_ICONS[type] || 'ℹ️'}</div>
                <h3 class="sh-pop-title">${shEsc(o.title || 'Notice')}</h3>
                <p class="sh-pop-msg">${shEsc(o.message || '')}</p>
                ${o.todo ? `<div class="sh-pop-todo"><b>What to do:</b> ${shEsc(o.todo)}</div>` : ''}
                <button class="sh-pop-ok">${shEsc(o.okText || 'Got it')}</button>
            </div>`;
        const close = () => {
            document.removeEventListener('keydown', onKey, true);
            overlay.classList.add('sh-out');
            setTimeout(() => { overlay.remove(); nextPopup(); }, 180);
        };
        const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter') { e.stopPropagation(); close(); } };
        document.addEventListener('keydown', onKey, true);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        overlay.querySelector('.sh-pop-ok').addEventListener('click', close);
        document.body.appendChild(overlay);
        overlay.querySelector('.sh-pop-ok').focus();
    }

    let toastBox = null;
    function showToast(msg, type = 'info', ms = 5000) {
        if (!toastBox) {
            toastBox = document.createElement('div');
            toastBox.className = 'sh-toasts';
            document.body.appendChild(toastBox);
        }
        const t = document.createElement('div');
        t.className = `sh-toast sh-toast-${type}`;
        t.innerHTML = `<span class="sh-toast-ico">${POPUP_ICONS[type] || 'ℹ️'}</span><span>${shEsc(msg)}</span>`;
        t.addEventListener('click', () => t.remove());
        toastBox.appendChild(t);
        setTimeout(() => { t.classList.add('sh-out'); setTimeout(() => t.remove(), 250); }, ms);
    }

    /* ======================
       UI SETUP
    ====================== */

    const style = document.createElement('style');
    style.innerHTML = `
        .ds-modal-header { padding: 15px 20px; background:#222; border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center;}
        .ds-modal-body { padding: 20px; }
        .ds-modal-section { margin-bottom: 15px; border-bottom: 1px solid #333; padding-bottom: 10px; }
        .ds-modal-title { margin-top:0; font-size: 15px; color: #2196f3; margin-bottom: 10px; }
        .ds-input-group { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .ds-input-group label { font-size: 13px; color: #ccc; }
        .ds-input-group input[type="text"] { width: 120px; padding: 4px; border-radius: 4px; border: 1px solid #555; background: #222; color: white; text-align: right; font-family: monospace; }
        .ds-chk-label { display:flex; align-items:center; cursor:pointer; margin-bottom: 5px; color:#ccc; font-size:13px; }

        .ds-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 10px;}
        .ds-box { background: #151515; padding: 15px; border-radius: 6px; border: 1px solid #333; }
        .ds-box-title { margin: 0 0 12px 0; color: #4caf50; font-size: 13px; border-bottom: 1px solid #333; padding-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px; }

        .ds-tabs { display:flex; background:#111; border-bottom:1px solid #333; }
        .ds-tab-btn { flex:1; padding:12px; background:none; border:none; color:#777; cursor:pointer; font-weight:bold; border-bottom:2px solid transparent; transition:0.2s; }
        .ds-tab-btn:hover { background:#222; color:#ccc; }
        .ds-tab-btn.active { color:#2196f3; border-bottom:2px solid #2196f3; background:#1e1e1e; }
        .ds-tab-content { display:none; }
        .ds-tab-content.active { display:block; }

        .ds-list-area { width:100%; height:150px; background:#222; border:1px solid #444; color:#fff; font-family:monospace; padding:8px; box-sizing:border-box; resize:vertical; }
        .ds-strat-table { width:100%; border-collapse:collapse; font-size:12px; }
        .ds-strat-table th { text-align:left; color:#888; padding:5px; border-bottom:1px solid #444; }
        .ds-strat-table td { padding:5px; border-bottom:1px solid #333; }

        .ds-mon-table { width:100%; border-collapse:collapse; font-size:12px; }
        .ds-mon-table th { text-align:left; color:#888; padding:6px 5px; border-bottom:1px solid #444; background:#111; position:sticky; top:0; z-index:1; }
        .ds-mon-table td { padding:5px; border-bottom:1px solid #2a2a2a; vertical-align:middle; }
        .ds-mon-table tr:hover td { background:#1a1a1a; }
        .ds-mon-separator td { background:#1a1a2a !important; color:#6ea8fe; font-weight:bold; font-size:11px; padding:5px 8px; letter-spacing:0.5px; border-top:1px solid #2a3a5a; border-bottom:1px solid #2a2a2a; cursor:pointer; user-select:none; }
        .ds-mon-separator td:hover { background:#1e1e3a !important; }
        .ds-mon-input { background:#222; border:1px solid #444; color:#fff; padding:3px 5px; font-family:monospace; font-size:12px; width:100%; box-sizing:border-box; border-radius:3px; }
        .ds-mon-select { background:#222; border:1px solid #444; color:#fff; padding:3px 4px; font-size:11px; width:100%; border-radius:3px; }
        .ds-strat-input { width:95%; background:#222; border:1px solid #444; color:#fff; padding:4px; font-family:monospace; }
        .ds-btn-remove { color:#f44336; cursor:pointer; font-weight:bold; border:none; background:none; }

        .loot-table { width:100%; border-collapse:collapse; font-size:13px; color:#fff; margin-top:10px; }
        .loot-table th { background:#222; padding:8px; text-align:left; border-bottom:1px solid #444; }
        .loot-table td { padding:8px; border-bottom:1px solid #333; }
        .ds-btn-action { background:#4caf50; color:#fff; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-weight:bold; margin-right:5px; }
        .ds-btn-action:disabled { background:#555; color:#888; cursor:not-allowed; }
        .ds-btn-boss { background:#9c27b0; }

        /* Stats Specific Styles */
        .ds-stat-header { display:flex; justify-content:space-around; align-items:center; padding-bottom:15px; border-bottom:1px solid #444; text-align:center; }
        .ds-stat-box { flex:1; }
        .ds-stat-num { font-size: 28px; font-weight:bold; }
        .ds-stat-lbl { font-size: 12px; color:#aaa; text-transform:uppercase; letter-spacing:1px; }

        .ds-loot-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin-top: 15px; min-height: 250px; max-height: 500px; overflow-y: auto; overflow-x: hidden; padding: 5px; box-sizing: border-box; }
        .ds-item-card { position: relative; width: 100%; aspect-ratio: 1; background: #222; border-radius: 6px; border: 2px solid #444; cursor: help; transition: transform 0.1s; box-sizing: border-box; }
        .ds-item-card:hover { transform: scale(1.05); z-index: 10; }
        .ds-item-img { width: 100%; height: 100%; object-fit: cover; border-radius: 4px; display:block; }
        .ds-item-count { position: absolute; bottom: 2px; right: 2px; background: rgba(0,0,0,0.85); color: #fff; font-size: 10px; padding: 1px 4px; border-radius: 4px; pointer-events: none; font-weight:bold; }
        .ds-empty-loot { grid-column: 1 / -1; text-align:center; color:#666; font-style:italic; padding: 20px 0; }

        /* ===== SHEOL THEME ===== */
        :root { --sh-bg:#070b14; --sh-bg2:#0d1526; --sh-bg3:#111c33; --sh-line:rgba(0,229,255,.35); --sh-acc:#00e5ff; --sh-acc2:#ff2e63; --sh-gold:#ffc857; --sh-text:#e8f6ff; --sh-mute:#8aa0c4; }
        .sh-gui, .sh-modal, .sh-overlay, .sh-toasts { font-family: 'Segoe UI', system-ui, -apple-system, Roboto, sans-serif; color: var(--sh-text); box-sizing: border-box; }
        .sh-gui { position: fixed; bottom: 70px; right: 15px; z-index: 99990; padding: 14px; font-size: 13px;
            background: linear-gradient(160deg, rgba(13,21,38,.96), rgba(7,11,20,.96)); border: 1px solid var(--sh-line); border-radius: 18px;
            box-shadow: 0 10px 40px rgba(0,0,0,.7), 0 0 30px rgba(0,229,255,.18), inset 0 1px 0 rgba(255,255,255,.05); backdrop-filter: blur(8px); }
        .sh-gui::before { content:''; position:absolute; inset:0; border-radius:18px; padding:1px; pointer-events:none;
            background: linear-gradient(135deg, var(--sh-acc), transparent 40%, transparent 60%, var(--sh-acc2));
            -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; opacity:.7; }
        .sh-head { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:8px; flex-wrap:wrap; }
        .sh-brand { display:flex; align-items:center; gap:10px; }
        .sh-brand svg { filter: drop-shadow(0 0 8px rgba(0,229,255,.7)); }
        .sh-title { font-size:16px; font-weight:800; letter-spacing:2px; background: linear-gradient(90deg,#7df3ff,#ff5f8a); -webkit-background-clip:text; background-clip:text; color:transparent; }
        .sh-title span { font-weight:500; letter-spacing:.5px; color: var(--sh-text); -webkit-text-fill-color: var(--sh-text); font-size:12px; }
        .sh-sub { font-size:10px; color: var(--sh-mute); letter-spacing:.5px; }
        .sh-head-actions { display:flex; align-items:center; gap:10px; }
        .sh-link { cursor:pointer; font-size:11px; color: var(--sh-mute); text-decoration:none; padding:2px 6px; border-radius:6px; transition:.15s; }
        .sh-link:hover { color:#fff; background: rgba(255,255,255,.08); }
        .sh-icon-btn { cursor:pointer; width:28px; height:28px; display:flex; align-items:center; justify-content:center; border-radius:8px; background: rgba(255,255,255,.06); font-size:15px; transition:.15s; user-select:none; }
        .sh-icon-btn:hover { background: rgba(0,229,255,.3); transform: translateY(-1px); }
        .sh-status { display:flex; align-items:center; gap:8px; font-weight:800; letter-spacing:2px; font-size:12px; margin-bottom:10px; }
        .sh-dot { display:inline-block; width:10px; height:10px; border-radius:50%; animation: shPulse 1.6s infinite; }
        @keyframes shPulse { 50% { opacity:.45; transform: scale(.85); } }
        .sh-chips { display:grid; grid-template-columns: repeat(4, 1fr); gap:8px; margin-bottom:10px; }
        .sh-chip { position:relative; background: var(--sh-bg3); border:1px solid rgba(255,255,255,.06); border-radius:12px; padding:8px 6px; text-align:center; }
        .sh-chip i { font-style:normal; font-size:15px; display:block; }
        .sh-chip span { display:block; font-weight:800; font-size:15px; font-family: Consolas, monospace; }
        .sh-chip small { color: var(--sh-mute); font-size:10px; text-transform:uppercase; letter-spacing:1px; }
        .sh-btns { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px; }
        .sh-btn { flex:1 1 90px; padding:10px 8px; border:0; border-radius:12px; font-weight:800; font-size:12.5px; cursor:pointer; color:#fff; transition: transform .12s, box-shadow .12s, filter .12s; box-shadow: 0 4px 14px rgba(0,0,0,.4); }
        .sh-btn:hover { transform: translateY(-2px); filter: brightness(1.15); }
        .sh-btn:active { transform: translateY(0) scale(.97); }
        .sh-go   { background: linear-gradient(135deg,#00e5ff,#ff2e63); box-shadow: 0 4px 18px rgba(255,46,99,.45); flex:1.4 1 120px; }
        .sh-set  { background: linear-gradient(135deg,#26324f,#1b2540); }
        .sh-mon  { background: linear-gradient(135deg,#0f9d8a,#0a6b6b); }
        .sh-boss { background: linear-gradient(135deg,#4f6bff,#1f2f9c); }
        .sh-loot { background: linear-gradient(135deg,#ffc857,#e08a1e); color:#1a1200; }
        .sh-stop { background: linear-gradient(135deg,#ff2e63,#b3123a); font-size:14px; padding:12px; animation: shGlow 1.4s infinite; }
        @keyframes shGlow { 50% { box-shadow: 0 0 22px rgba(255,46,99,.7); } }
        .sh-log { padding:8px; background: rgba(0,0,0,.35); border:1px solid rgba(255,255,255,.06); border-radius:12px; height:240px; overflow-y:auto; font-size:11.5px; font-family: Consolas, monospace; color:#cfe6ff; }
        .sh-log-row { padding:3px 6px; border-left:3px solid transparent; border-bottom:1px solid rgba(255,255,255,.04); }
        .sh-log-row.good { border-left-color:#3ddc97; } .sh-log-row.warn { border-left-color:#ffc857; } .sh-log-row.bad { border-left-color:#ff4d6d; background: rgba(255,77,109,.06); }
        .sh-log::-webkit-scrollbar, .sh-modal::-webkit-scrollbar, .ds-loot-grid::-webkit-scrollbar { width:8px; }
        .sh-log::-webkit-scrollbar-thumb, .sh-modal::-webkit-scrollbar-thumb, .ds-loot-grid::-webkit-scrollbar-thumb { background: rgba(0,229,255,.5); border-radius:8px; }
        .sh-foot { text-align:center; margin-top:8px; font-size:10.5px; color: var(--sh-mute); letter-spacing:.5px; }
        .sh-foot b { color:#7df3ff; }
        .sh-mini { display:flex; align-items:center; gap:8px; cursor:pointer; font-weight:800; font-size:12px; }
        .sh-mini-txt { flex:1; } .sh-mini-plus { color:#7df3ff; font-size:16px; }

        /* modals */
        .sh-modal { background: linear-gradient(160deg, var(--sh-bg2), var(--sh-bg)) !important; border: 1px solid var(--sh-line) !important; border-radius: 18px !important;
            box-shadow: 0 20px 70px rgba(0,0,0,.85), 0 0 40px rgba(0,229,255,.2) !important; color: var(--sh-text) !important; }
        .sh-modal h3, .sh-modal h4 { color: #b5f7ff !important; }
        .sh-modal .ds-modal-header { background: linear-gradient(90deg, rgba(0,229,255,.18), rgba(255,46,99,.08)) !important; border-bottom: 1px solid var(--sh-line) !important; border-radius: 18px 18px 0 0; }
        .sh-modal .ds-box { background: var(--sh-bg3) !important; border: 1px solid rgba(255,255,255,.07) !important; border-radius: 12px !important; }
        .sh-modal .ds-box-title { color: #ff8fb0 !important; border-bottom: 1px solid rgba(255,255,255,.08) !important; }
        .sh-modal .ds-modal-title { color: #7df3ff !important; }
        .sh-modal .ds-modal-section, .sh-modal .ds-stat-header { border-color: rgba(255,255,255,.08) !important; }
        .sh-modal .ds-tabs { background: rgba(0,0,0,.3) !important; border-bottom: 1px solid var(--sh-line) !important; }
        .sh-modal .ds-tab-btn.active { color:#ff8fb0 !important; border-bottom-color: var(--sh-acc2) !important; background: rgba(255,46,99,.08) !important; }
        .sh-modal input[type=text], .sh-modal input[type=number], .sh-modal select, .sh-modal textarea, .sh-modal .ds-mon-input, .sh-modal .ds-mon-select, .sh-modal .ds-strat-input, .sh-modal .ds-list-area {
            background: rgba(0,0,0,.4) !important; border: 1px solid rgba(255,255,255,.14) !important; color: #fff !important; border-radius: 8px !important; outline:none; transition: border-color .15s, box-shadow .15s; }
        .sh-modal input:focus, .sh-modal select:focus, .sh-modal textarea:focus { border-color: var(--sh-acc) !important; box-shadow: 0 0 0 3px rgba(0,229,255,.25); }
        .sh-modal input[type=checkbox] { accent-color: #00e5ff; }
        .sh-modal button { border-radius: 10px; cursor:pointer; transition: transform .12s, filter .12s; }
        .sh-modal button:hover:not(:disabled) { filter: brightness(1.15); transform: translateY(-1px); }
        .sh-modal .ds-btn-action { background: linear-gradient(135deg,#00e5ff,#ff2e63) !important; border-radius: 10px !important; }
        .sh-modal .ds-btn-action:disabled { background:#26324f !important; }
        .sh-modal .ds-btn-boss { background: linear-gradient(135deg,#4f6bff,#1f2f9c) !important; }
        .sh-modal .ds-mon-table th, .sh-modal .loot-table th, .sh-modal .ds-strat-table th { background: #0a1120 !important; color: var(--sh-mute) !important; }
        .sh-modal .ds-mon-separator td { background: rgba(0,229,255,.14) !important; color:#7df3ff !important; }
        .sh-modal .ds-item-card { background: var(--sh-bg3) !important; border-radius: 10px; }

        /* popup */
        .sh-overlay { position: fixed; inset: 0; z-index: 2147483000; display:flex; align-items:center; justify-content:center; padding:16px; background: rgba(3,6,12,.72); backdrop-filter: blur(4px); animation: shFade .18s ease; }
        .sh-overlay.sh-out { opacity:0; transition: opacity .18s; }
        @keyframes shFade { from { opacity:0; } }
        @keyframes shPop { from { transform: translateY(14px) scale(.94); opacity:0; } }
        .sh-pop { width: 420px; max-width: 100%; text-align:center; padding: 22px 24px 22px; border-radius: 20px; background: linear-gradient(160deg,#0e1830,#070b14); border:1px solid var(--sh-line);
            box-shadow: 0 25px 80px rgba(0,0,0,.9), 0 0 50px rgba(0,229,255,.25); animation: shPop .22s cubic-bezier(.2,.9,.3,1.2); }
        .sh-pop-error { border-color: rgba(255,77,109,.6); box-shadow: 0 25px 80px rgba(0,0,0,.9), 0 0 50px rgba(255,46,99,.3); }
        .sh-pop-warn { border-color: rgba(255,200,87,.55); } .sh-pop-success { border-color: rgba(61,220,151,.55); }
        .sh-pop-brand { display:flex; align-items:center; justify-content:center; gap:6px; font-size:10px; letter-spacing:2.5px; color: var(--sh-mute); margin-bottom:10px; font-weight:700; }
        .sh-pop-icon { font-size:40px; line-height:1; margin-bottom:6px; }
        .sh-pop-title { margin:0 0 8px; font-size:19px; color:#fff !important; }
        .sh-pop-msg { margin:0 0 12px; font-size:14px; line-height:1.5; color:#cfe6ff; }
        .sh-pop-todo { text-align:left; font-size:13px; line-height:1.45; background: rgba(0,229,255,.12); border:1px solid rgba(0,229,255,.3); border-radius:12px; padding:10px 12px; margin-bottom:16px; color:#e8f6ff; }
        .sh-pop-todo b { color:#ffc857; }
        .sh-pop-ok { width:100%; padding:12px; border:0; border-radius:12px; font-weight:800; font-size:14px; color:#fff; cursor:pointer; background: linear-gradient(135deg,#00e5ff,#ff2e63); box-shadow: 0 6px 20px rgba(255,46,99,.4); transition: transform .12s; }
        .sh-pop-ok:hover { transform: translateY(-2px); }

        /* toasts */
        .sh-toasts { position: fixed; top: 16px; left: 50%; transform: translateX(-50%); z-index: 2147482000; display:flex; flex-direction:column; gap:8px; width: min(440px, calc(100vw - 24px)); pointer-events:none; }
        .sh-toast { pointer-events:auto; cursor:pointer; display:flex; gap:10px; align-items:center; padding:11px 14px; border-radius:14px; font-size:13px; line-height:1.35; background: rgba(13,21,38,.96); border:1px solid var(--sh-line); color:#fff; box-shadow: 0 10px 30px rgba(0,0,0,.6); animation: shPop .25s ease; }
        .sh-toast.sh-out { opacity:0; transform: translateY(-8px); transition: .25s; }
        .sh-toast-error { border-color: rgba(255,77,109,.7); } .sh-toast-warn { border-color: rgba(255,200,87,.7); } .sh-toast-success { border-color: rgba(61,220,151,.7); }
        .sh-toast-ico { font-size:18px; }
        @media (max-width: 640px) { .sh-chips { grid-template-columns: repeat(2, 1fr); } .ds-grid-2 { grid-template-columns: 1fr !important; } .ds-loot-grid { grid-template-columns: repeat(3, minmax(0,1fr)) !important; } }

        /* ===== v5.1 — NEW UI: cards, switches, live stats HUD, log tick ===== */
        .sh-tick { display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-size:11px; color:var(--sh-mute); padding:3px 8px; border-radius:8px; user-select:none; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08); transition:.15s; }
        .sh-tick:hover { color:#fff; background:rgba(255,255,255,.09); }
        .sh-tick input { display:none; }
        .sh-tick-box { width:15px; height:15px; border-radius:5px; border:1.5px solid rgba(255,255,255,.35); display:inline-flex; align-items:center; justify-content:center; font-size:11px; color:#fff; transition:.15s; }
        .sh-tick input:checked + .sh-tick-box { background:linear-gradient(135deg,#00e5ff,#ff2e63); border-color:transparent; }
        .sh-tick input:checked + .sh-tick-box::before { content:'✓'; }

        .sh-mhead-title { display:flex; align-items:center; gap:12px; }
        .sh-mhead-title .ico { width:40px; height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:21px; background:linear-gradient(135deg,#0f9d8a,#0a6b6b); box-shadow:0 0 18px rgba(15,157,138,.5); }
        .sh-mhead-title.boss .ico { background:linear-gradient(135deg,#4f6bff,#ff2e63); box-shadow:0 0 18px rgba(0,229,255,.55); }
        .sh-mhead-title h3 { margin:0; font-size:17px; letter-spacing:.5px; }
        .sh-mhead-title small { display:block; color:var(--sh-mute); font-size:11px; margin-top:2px; }
        .sh-x { cursor:pointer; width:30px; height:30px; border-radius:9px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,.07); color:#cfc3ea; font-size:14px; transition:.15s; margin-left:auto; flex-shrink:0; }
        .sh-x:hover { background:rgba(255,46,99,.4); color:#fff; }

        .sh-mwrap { display:flex; flex-direction:column; gap:10px; }
        .sh-toolbar { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
        .sh-search { flex:1 1 160px; position:relative; }
        .sh-search::before { content:'🔍'; position:absolute; left:11px; top:50%; transform:translateY(-50%); font-size:12px; opacity:.7; pointer-events:none; }
        .sh-search input { width:100%; padding:9px 12px 9px 32px; font-size:13px; }
        .sh-tbtn { padding:8px 12px; border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.06); color:#e8f6ff; font-size:12px; font-weight:700; }
        .sh-pill { padding:6px 12px; border-radius:999px; font-size:11.5px; font-weight:700; border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.05); color:#cfc3ea; cursor:pointer; transition:.15s; user-select:none; }
        .sh-pill b { margin-left:4px; opacity:.8; }
        .sh-pill:hover { background:rgba(0,229,255,.2); }
        .sh-pill.active { background:linear-gradient(135deg,#00e5ff,#ff2e63); border-color:transparent; color:#fff; box-shadow:0 4px 14px rgba(255,46,99,.35); }
        .sh-legend { display:flex; gap:10px; font-size:11px; color:var(--sh-mute); margin-left:auto; align-items:center; }
        .sh-sdot { display:inline-block; width:9px; height:9px; border-radius:50%; background:#4a4560; flex-shrink:0; vertical-align:middle; }
        .sh-sdot.alive { background:#3ddc97; box-shadow:0 0 8px #3ddc97; }
        .sh-sdot.dead { background:#ff4d6d; box-shadow:0 0 8px #ff4d6d; }

        .sh-bulk { border:1px dashed rgba(255,255,255,.18); border-radius:12px; padding:9px 12px; background:rgba(255,255,255,.03); }
        .sh-bulk summary { cursor:pointer; font-weight:800; font-size:12px; color:#ffc857; list-style:none; }
        .sh-bulk summary::-webkit-details-marker { display:none; }
        .sh-bulk-row { display:flex; flex-wrap:wrap; gap:8px; align-items:flex-end; margin-top:10px; }
        .sh-primary { background:linear-gradient(135deg,#00e5ff,#ff2e63); color:#fff; border:0; padding:9px 16px; font-weight:800; font-size:12.5px; box-shadow:0 4px 14px rgba(255,46,99,.35); }
        .sh-ghost { background:rgba(255,255,255,.07); color:#e8f6ff; border:1px solid rgba(255,255,255,.12); padding:9px 16px; font-weight:700; font-size:12.5px; }

        .sh-mlist { display:flex; flex-direction:column; gap:12px; padding-right:4px; }
        .sh-mlist::-webkit-scrollbar, .sh-blist::-webkit-scrollbar, .sh-hud::-webkit-scrollbar { width:8px; }
        .sh-mlist::-webkit-scrollbar-thumb, .sh-blist::-webkit-scrollbar-thumb, .sh-hud::-webkit-scrollbar-thumb { background:rgba(0,229,255,.5); border-radius:8px; }
        .sh-mgroup { border:1px solid rgba(255,255,255,.07); border-radius:14px; background:rgba(0,0,0,.18); overflow:hidden; }
        .sh-mghead { display:flex; align-items:center; gap:8px; padding:10px 12px; cursor:pointer; user-select:none; border-left:4px solid var(--gc,#00e5ff); background:rgba(255,255,255,.04); font-weight:800; font-size:12.5px; }
        .sh-mghead:hover { background:rgba(255,255,255,.08); }
        .sh-arrow { display:inline-block; transition:transform .2s; }
        .sh-mgroup.closed .sh-arrow { transform:rotate(-90deg); }
        .sh-mgcount { margin-left:auto; font-size:10.5px; font-weight:700; color:var(--sh-mute); background:rgba(255,255,255,.07); padding:2px 9px; border-radius:999px; }
        .sh-mgroup.closed .sh-mgbody { display:none; }
        .sh-mgbody { display:flex; flex-direction:column; gap:8px; padding:10px; }
        .sh-msub { font-size:10px; text-transform:uppercase; letter-spacing:1.5px; color:var(--sh-mute); padding:4px 2px 0; }
        .sh-mcard { display:grid; grid-template-columns:auto 1fr; gap:10px 12px; align-items:center; padding:10px 12px; border-radius:12px; background:var(--sh-bg3); border:1px solid rgba(255,255,255,.06); opacity:.6; transition:.15s; }
        .sh-mcard:hover { opacity:.9; }
        .sh-mcard.on { opacity:1; border-color:rgba(0,229,255,.55); box-shadow:0 0 0 1px rgba(0,229,255,.15), 0 6px 18px rgba(0,0,0,.35); background:linear-gradient(135deg,rgba(0,229,255,.15),var(--sh-bg3)); }
        .sh-mname { display:flex; align-items:center; gap:8px; min-width:0; }
        .sh-mname b { font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .sh-mname small { margin-left:auto; font-size:10px; color:var(--sh-mute); text-transform:uppercase; letter-spacing:1px; white-space:nowrap; }
        .sh-mctl { grid-column:1 / -1; display:flex; flex-wrap:wrap; gap:8px; align-items:flex-end; }
        .sh-field { display:flex; flex-direction:column; gap:3px; min-width:0; }
        .sh-field > label { font-size:9.5px; text-transform:uppercase; letter-spacing:1px; color:var(--sh-mute); font-weight:700; }
        .sh-f-skill { flex:1 1 150px; } .sh-f-cap { flex:1 1 100px; }
        .sh-field input[type=text], .sh-field select { width:100%; padding:6px 8px; font-size:12px; font-family:Consolas,monospace; box-sizing:border-box; }
        .sh-stepper { display:flex; align-items:center; gap:4px; }
        .sh-stepper input[type=text] { width:46px; text-align:center; }
        .sh-step { width:26px; height:28px; padding:0; border:1px solid rgba(255,255,255,.14); background:rgba(255,255,255,.07); color:#fff; font-size:15px; font-weight:800; line-height:1; }
        .sh-sw { position:relative; display:inline-block; width:42px; height:24px; flex-shrink:0; cursor:pointer; }
        .sh-sw input { opacity:0; width:0; height:0; position:absolute; }
        .sh-sw span { position:absolute; inset:0; border-radius:999px; background:#26324f; transition:.2s; box-shadow:inset 0 0 0 1px rgba(255,255,255,.1); }
        .sh-sw span::before { content:''; position:absolute; left:3px; top:3px; width:18px; height:18px; border-radius:50%; background:#fff; transition:.2s; box-shadow:0 2px 6px rgba(0,0,0,.4); }
        .sh-sw input:checked + span { background:linear-gradient(135deg,#00e5ff,#ff2e63); box-shadow:0 0 14px rgba(255,46,99,.5); }
        .sh-sw input:checked + span::before { transform:translateX(18px); }
        .sh-smart input { display:none; }
        .sh-smart span { display:inline-block; padding:6px 10px; border-radius:8px; border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.05); font-size:11.5px; font-weight:700; color:#bdb0d8; cursor:pointer; transition:.15s; user-select:none; }
        .sh-smart input:checked + span { background:rgba(61,220,151,.16); border-color:rgba(61,220,151,.6); color:#8dffc9; }
        .sh-mfoot { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px 20px; border-top:1px solid var(--sh-line); background:rgba(0,0,0,.25); border-radius:0 0 18px 18px; }
        .sh-saved { font-size:11.5px; color:#3ddc97; opacity:0; transition:opacity .25s; }
        .sh-saved.show { opacity:1; }
        .sh-empty { text-align:center; color:var(--sh-mute); padding:26px; font-style:italic; }
        .sh-loading { text-align:center; padding:40px 20px; color:var(--sh-mute); }
        .sh-spin { width:38px; height:38px; margin:0 auto 12px; border-radius:50%; border:3px solid rgba(0,229,255,.25); border-top-color:#ff2e63; animation:shSpin .8s linear infinite; }
        @keyframes shSpin { to { transform:rotate(360deg); } }

        .sh-seg { display:flex; gap:6px; padding:4px; border-radius:14px; background:rgba(0,0,0,.35); margin-bottom:14px; }
        .sh-seg button { flex:1; padding:9px; border:0; border-radius:10px; background:transparent; color:var(--sh-mute); font-weight:800; font-size:12.5px; }
        .sh-seg button.active { background:linear-gradient(135deg,#4f6bff,#ff2e63); color:#fff; box-shadow:0 4px 14px rgba(79,107,255,.45); }
        .sh-panel { display:none; } .sh-panel.active { display:block; }
        .sh-summary { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:12px; }
        .sh-summary div { text-align:center; padding:10px; border-radius:12px; background:var(--sh-bg3); border:1px solid rgba(255,255,255,.06); }
        .sh-summary b { display:block; font-size:19px; font-family:Consolas,monospace; color:#fff; }
        .sh-summary span { font-size:10px; text-transform:uppercase; letter-spacing:1.2px; color:var(--sh-mute); }
        .sh-blist { display:flex; flex-direction:column; gap:8px; padding-right:4px; }
        .sh-bosscard { display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:14px; background:var(--sh-bg3); border:1px solid rgba(255,255,255,.06); }
        .sh-bimg { width:52px; height:52px; border-radius:12px; object-fit:cover; border:2px solid rgba(0,229,255,.5); box-shadow:0 0 14px rgba(0,229,255,.3); flex-shrink:0; }
        .sh-binfo { flex:1; min-width:0; }
        .sh-bname { font-weight:800; font-size:13.5px; color:#fff; }
        .sh-bname.link { color:#7df3ff; cursor:pointer; text-decoration:underline dotted; }
        .sh-binfo small { display:block; color:var(--sh-mute); font-size:10.5px; margin:1px 0 5px; }
        .sh-bstats { display:flex; flex-wrap:wrap; gap:6px; }
        .sh-bs { font-size:11px; font-family:Consolas,monospace; padding:2px 8px; border-radius:8px; background:rgba(255,255,255,.06); }
        .sh-bs.hp { color:#ff8fa3; } .sh-bs.dmg { color:#ffd369; } .sh-bs.stam { color:#7fdcff; }
        .sh-spill { font-size:10.5px; font-weight:800; padding:4px 10px; border-radius:999px; white-space:nowrap; }
        .sh-spill.joined { background:rgba(61,220,151,.15); color:#6df0b4; border:1px solid rgba(61,220,151,.5); }
        .sh-spill.locked { background:rgba(255,77,109,.15); color:#ff8fa3; border:1px solid rgba(255,77,109,.5); }
        .sh-spill.idle { background:rgba(255,255,255,.06); color:var(--sh-mute); border:1px solid rgba(255,255,255,.12); }
        .sh-bmeta { font-size:10.5px; color:var(--sh-mute); margin-left:auto; white-space:nowrap; }

        /* live stats HUD (floats over the game, draggable, never blocks clicks outside itself) */
        .sh-hud { display:none; position:fixed; top:70px; left:15px; width:min(340px, calc(100vw - 20px)); max-height:82vh; overflow-y:auto; z-index:99989; font-family:'Segoe UI', system-ui, sans-serif; color:var(--sh-text); box-sizing:border-box; border-radius:18px;
            background:linear-gradient(160deg, rgba(14,22,44,.95), rgba(6,9,18,.95)); border:1px solid var(--sh-line); box-shadow:0 14px 50px rgba(0,0,0,.7), 0 0 34px rgba(0,229,255,.22); backdrop-filter:blur(10px); }
        .sh-hud-head { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:10px 12px; cursor:grab; touch-action:none; user-select:none; background:linear-gradient(90deg, rgba(0,229,255,.3), rgba(255,46,99,.14)); border-bottom:1px solid var(--sh-line); border-radius:18px 18px 0 0; position:sticky; top:0; z-index:2; }
        .sh-hud-head:active { cursor:grabbing; }
        .sh-hud-title { display:flex; align-items:center; gap:8px; font-size:12px; letter-spacing:2px; }
        .sh-live { display:inline-flex; align-items:center; gap:4px; font-size:9px; font-weight:800; letter-spacing:1px; color:#3ddc97; padding:2px 7px; border-radius:999px; background:rgba(61,220,151,.12); border:1px solid rgba(61,220,151,.4); }
        .sh-live i { width:6px; height:6px; border-radius:50%; background:#3ddc97; animation:shPulse 1.2s infinite; }
        .sh-hud-actions { display:flex; align-items:center; gap:6px; }
        .sh-hud-timer { font-family:Consolas,monospace; font-weight:800; font-size:12px; color:#ffc857; background:rgba(0,0,0,.35); padding:3px 8px; border-radius:8px; }
        .sh-hud-actions button { width:24px; height:24px; border:0; border-radius:7px; background:rgba(255,255,255,.08); color:#e8f6ff; cursor:pointer; font-size:12px; padding:0; }
        .sh-hud-actions button:hover { background:rgba(255,46,99,.4); }
        .sh-hud-body { padding:12px; }
        .sh-hud.folded .sh-hud-body { display:none; }
        .sh-hud-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
        .sh-scard { position:relative; overflow:hidden; padding:10px 12px; border-radius:14px; background:var(--sh-bg3); border:1px solid rgba(255,255,255,.06); }
        .sh-scard::before { content:''; position:absolute; left:0; top:0; bottom:0; width:3px; background:var(--ac); box-shadow:0 0 12px var(--ac); }
        .sh-scard::after { content:''; position:absolute; right:-18px; top:-18px; width:60px; height:60px; border-radius:50%; background:var(--ac); opacity:.13; filter:blur(6px); }
        .sh-scard .ico { font-size:15px; }
        .sh-scard .num { font-size:22px; font-weight:800; font-family:Consolas,monospace; color:var(--ac); line-height:1.1; margin-top:2px; }
        .sh-scard .lbl { font-size:9.5px; text-transform:uppercase; letter-spacing:1.2px; color:var(--sh-mute); }
        .sh-scard .rate { font-size:10px; color:#cbbfe6; margin-top:3px; font-family:Consolas,monospace; opacity:.85; }
        .sh-hud-mini { display:flex; gap:8px; margin-top:8px; }
        .sh-hud-mini div { flex:1; text-align:center; padding:7px; border-radius:12px; background:rgba(255,255,255,.04); font-size:10.5px; color:var(--sh-mute); text-transform:uppercase; letter-spacing:1px; }
        .sh-hud-mini b { display:block; font-size:15px; color:#fff; font-family:Consolas,monospace; letter-spacing:0; }
        .sh-hud-sec { margin:12px 0 6px; font-size:10.5px; text-transform:uppercase; letter-spacing:2px; color:#7df3ff; font-weight:800; }
        .sh-hud .ds-loot-grid { grid-template-columns:repeat(6, minmax(0,1fr)) !important; gap:6px; min-height:0; max-height:170px; margin-top:0; padding:3px; }
        .sh-hud-foot { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:10px; font-size:10px; color:var(--sh-mute); }
        .sh-hud-foot button { border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.06); color:#e8f6ff; padding:6px 10px; border-radius:9px; font-size:11px; font-weight:700; cursor:pointer; }
        .sh-hud-foot button:hover { background:rgba(255,46,99,.3); }
        @media (max-width: 640px) { .sh-bosscard { flex-wrap:wrap; } .sh-legend { display:none; } }


        /* ===== v5.3 — cooler UI for Loot Manager, Settings, Start Attack ===== */
        @keyframes shModalIn { from { opacity:0; } to { opacity:1; } }
        .sh-modal { animation: shModalIn .2s ease; }
        .sh-mhead-title.loot .ico { background:linear-gradient(135deg,#ffc857,#e08a1e); box-shadow:0 0 18px rgba(255,200,87,.5); }
        .sh-mhead-title.cfg .ico { background:linear-gradient(135deg,#3b82f6,#4f6bff); box-shadow:0 0 18px rgba(99,102,241,.55); }
        .sh-mhead-title.go .ico { background:linear-gradient(135deg,#00e5ff,#ff2e63); box-shadow:0 0 18px rgba(255,46,99,.55); }
        .sh-seg button b { margin-left:6px; padding:1px 8px; border-radius:999px; background:rgba(255,255,255,.12); font-size:11px; }
        .sh-summary.s4 { grid-template-columns:repeat(3,1fr); }
        .sh-summary b.gold { color:#ffd369; } .sh-summary b.pink { color:#ff8fb0; } .sh-summary b.vio { color:#7df3ff; }
        .sh-lcard { display:flex; align-items:center; gap:12px; padding:12px 14px; border-radius:14px; background:var(--sh-bg3); border:1px solid rgba(255,255,255,.06); border-left:4px solid var(--lc,#00e5ff); transition:.15s; }
        .sh-lcard:hover { border-color:rgba(0,229,255,.5); box-shadow:0 6px 20px rgba(0,0,0,.35); transform:translateY(-1px); }
        .sh-lcard.ready { background:linear-gradient(135deg,rgba(61,220,151,.10),var(--sh-bg3)); }
        .sh-lico { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:22px; background:rgba(255,255,255,.06); flex-shrink:0; }
        .sh-lact { display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end; margin-left:auto; }
        .sh-lbtn { padding:8px 14px; border:0; border-radius:10px; font-weight:800; font-size:12px; color:#fff; background:linear-gradient(135deg,#00e5ff,#ff2e63); box-shadow:0 4px 14px rgba(255,46,99,.3); }
        .sh-lbtn.alt { background:rgba(255,255,255,.08); box-shadow:none; border:1px solid rgba(255,255,255,.14); }
        .sh-lbtn.gold { background:linear-gradient(135deg,#ffc857,#e08a1e); color:#1a1200; box-shadow:0 4px 14px rgba(255,200,87,.3); }
        .sh-lbtn:disabled { background:#2f2a45 !important; color:#6f6690 !important; box-shadow:none; cursor:not-allowed; transform:none !important; }
        .sh-bs.exp { color:#7df3ff; } .sh-bs.cnt { color:#8dffc9; }
        .sh-spill.active { background:rgba(61,220,151,.15); color:#6df0b4; border:1px solid rgba(61,220,151,.5); }
        .sh-spill.ended { background:rgba(255,77,109,.12); color:#ff8fa3; border:1px solid rgba(255,77,109,.4); }
        .sh-spill.looted { background:rgba(255,255,255,.06); color:var(--sh-mute); border:1px solid rgba(255,255,255,.12); }
        .sh-toggle-row { display:flex; align-items:center; gap:10px; margin-bottom:10px; font-size:12px; color:var(--sh-mute); }
        .sh-toggle-row span { flex:1; }
        .sh-scard2 { padding:14px; border-radius:16px; background:var(--sh-bg3); border:1px solid rgba(255,255,255,.07); margin-bottom:12px; }
        .sh-scard2 h4 { margin:0 0 12px; font-size:12px; letter-spacing:1.5px; text-transform:uppercase; display:flex; align-items:center; gap:8px; color:#ff8fb0 !important; }
        .sh-scard2 h4 i { font-style:normal; font-size:16px; }
        .sh-set-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .sh-row { display:flex; align-items:center; gap:12px; padding:9px 0; border-bottom:1px solid rgba(255,255,255,.05); }
        .sh-row:last-child { border-bottom:0; padding-bottom:0; }
        .sh-row-txt { flex:1; min-width:0; }
        .sh-row-txt b { display:block; font-size:13px; color:#fff; }
        .sh-row-txt small { display:block; font-size:10.5px; color:var(--sh-mute); line-height:1.35; margin-top:2px; }
        .sh-num { width:96px !important; padding:7px 9px; font-size:13px; font-family:Consolas,monospace; text-align:right; box-sizing:border-box; }
        .sh-note { font-size:10.5px; color:var(--sh-mute); margin-top:8px; font-style:italic; line-height:1.4; }
        .sh-warn { color:#ffc857; font-size:11.5px; font-style:italic; }
        .sh-opt { display:flex; align-items:center; gap:14px; padding:14px; border-radius:16px; cursor:pointer; background:var(--sh-bg3); border:1px solid rgba(255,255,255,.08); margin-bottom:10px; transition:.15s; user-select:none; }
        .sh-opt:hover { border-color:rgba(0,229,255,.5); }
        .sh-opt.on { border-color:rgba(255,46,99,.65); background:linear-gradient(135deg,rgba(0,229,255,.18),rgba(255,46,99,.08)); box-shadow:0 6px 22px rgba(0,229,255,.2); }
        .sh-opt .oi { width:46px; height:46px; border-radius:13px; display:flex; align-items:center; justify-content:center; font-size:24px; background:rgba(255,255,255,.07); flex-shrink:0; }
        .sh-opt .ot { flex:1; min-width:0; } .sh-opt .ot b { display:block; font-size:14.5px; color:#fff; }
        .sh-opt .ot small { display:block; font-size:11px; color:var(--sh-mute); margin-top:3px; }
        .sh-startbtn { padding:12px 26px; border:0; border-radius:12px; font-weight:800; font-size:14px; color:#fff; background:linear-gradient(135deg,#00e5ff,#ff2e63); box-shadow:0 6px 22px rgba(255,46,99,.45); }
        @media (max-width: 640px) { .sh-set-grid { grid-template-columns:1fr; } .sh-lcard { flex-wrap:wrap; } .sh-lact { width:100%; justify-content:stretch; } .sh-lact .sh-lbtn { flex:1; } }

        /* v5.1.1 — scroll fix: the whole modal is the one scroll area (works with mouse wheel + touch) */
        .sh-modal { max-height:88vh !important; max-height:88dvh !important; overflow-y:auto !important; overflow-x:hidden !important; overscroll-behavior:contain; -webkit-overflow-scrolling:touch; touch-action:pan-y; }
        .sh-modal .ds-modal-header { position:sticky; top:0; z-index:5; background-color:#0d1526 !important; }
        .sh-modal .sh-mfoot { position:sticky; bottom:0; z-index:5; background-color:#0a1120 !important; }
        .sh-modal .sh-mlist, .sh-modal .sh-blist, .sh-modal .sh-mwrap { max-height:none !important; overflow:visible !important; }

        /* ===== v6 TURBO CYBER THEME ===== */
        .sh-gui::before { background:linear-gradient(120deg,#00e5ff,#4f6bff,#ff2e63,#00e5ff) !important; background-size:300% 300%; animation:shFlow 6s linear infinite; opacity:.95 !important; }
        @keyframes shFlow { to { background-position:300% 0; } }
        @keyframes shShine { to { background-position:200% 0; } }
        .sh-gui { box-shadow:0 12px 44px rgba(0,0,0,.75), 0 0 34px rgba(0,229,255,.22), inset 0 1px 0 rgba(255,255,255,.06) !important; }
        .sh-gui::after { content:''; position:absolute; inset:0; border-radius:18px; pointer-events:none; background:repeating-linear-gradient(0deg, rgba(255,255,255,.02) 0 1px, transparent 1px 3px); }
        .sh-title { background:linear-gradient(90deg,#7df3ff,#ff5f8a,#7df3ff) !important; background-size:200% 100% !important; -webkit-background-clip:text !important; background-clip:text !important; animation:shShine 5s linear infinite; text-shadow:0 0 18px rgba(0,229,255,.25); }
        .sh-turbo-badge { margin-left:auto; font-size:11px; letter-spacing:1px; padding:3px 10px; border-radius:999px; color:#001a20; font-weight:800; background:linear-gradient(135deg,#00e5ff,#7df3ff); box-shadow:0 0 14px rgba(0,229,255,.55); animation:shPulse 2s infinite; }
        .sh-chip { border-top:2px solid var(--cc,#00e5ff); background:linear-gradient(180deg,rgba(255,255,255,.04),transparent),var(--sh-bg3); }
        .sh-chip:nth-child(1) { --cc:#ff4d6d; } .sh-chip:nth-child(2) { --cc:#3ddc97; } .sh-chip:nth-child(3) { --cc:#c77dff; } .sh-chip:nth-child(4) { --cc:#ffc857; }
        .sh-chip span { text-shadow:0 0 12px var(--cc); }
        .sh-btn { position:relative; overflow:hidden; letter-spacing:.4px; border:1px solid rgba(255,255,255,.08); }
        .sh-btn::after { content:''; position:absolute; top:0; left:-60%; width:40%; height:100%; background:linear-gradient(100deg,transparent,rgba(255,255,255,.28),transparent); transform:skewX(-20deg); transition:left .5s; }
        .sh-btn:hover::after { left:130%; }
        .sh-go { background:linear-gradient(135deg,#00b8ff,#7c4dff 55%,#ff2e63) !important; box-shadow:0 4px 20px rgba(0,229,255,.4) !important; }
        .sh-icon-btn:hover, .sh-x:hover { box-shadow:0 0 12px rgba(0,229,255,.5); }
        .sh-modal { box-shadow:0 20px 70px rgba(0,0,0,.85), 0 0 46px rgba(0,229,255,.22), inset 0 1px 0 rgba(255,255,255,.05) !important; backdrop-filter:blur(10px); }
        .sh-modal .ds-modal-header { background-image:linear-gradient(90deg,rgba(0,229,255,.2),rgba(255,46,99,.1)) !important; }
        .sh-mcard.on, .sh-scard2, .sh-bosscard, .sh-scard { transition:transform .15s, box-shadow .15s, border-color .15s; }
        .sh-mcard.on { box-shadow:0 0 0 1px rgba(0,229,255,.25), 0 8px 24px rgba(0,229,255,.12) !important; }
        .sh-bosscard:hover, .sh-scard2:hover { transform:translateY(-2px); border-color:rgba(0,229,255,.45); box-shadow:0 8px 22px rgba(0,0,0,.4), 0 0 16px rgba(0,229,255,.15); }
        .sh-turbo-card { border-color:rgba(0,229,255,.5) !important; box-shadow:0 0 22px rgba(0,229,255,.15); }
        .sh-hud { box-shadow:0 14px 50px rgba(0,0,0,.7), 0 0 34px rgba(0,229,255,.25) !important; }
        .sh-scard .num { text-shadow:0 0 14px var(--ac); }
        .sh-pop { box-shadow:0 25px 80px rgba(0,0,0,.9), 0 0 50px rgba(0,229,255,.3) !important; }
        .sh-toast { box-shadow:0 10px 30px rgba(0,0,0,.6), 0 0 18px rgba(0,229,255,.18); }
        .sh-log-row.good { border-left-color:#00e5ff; }
    `;
    document.head.appendChild(style);


    // ================================================================
    // FULL GUI — shown on all matched pages
    // ================================================================

    const gui = document.createElement("div");
    gui.id = 'sh-gui';
    gui.className = 'sh-gui';
    document.body.appendChild(gui);

    // ---- Launcher button: sits beside the site's crossed-swords (Quick Sets) button ----
    const launcherStyle = document.createElement('style');
    launcherStyle.textContent = `
        #sh-launcher { position: fixed; bottom: 20px; right: 120px; width: 44px; height: 44px; z-index: 99991; padding: 0; margin: 0;
            display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 50%; box-sizing: border-box;
            background: linear-gradient(160deg, rgba(13,21,38,.96), rgba(7,11,20,.96)); border: 1px solid rgba(0,229,255,.55);
            box-shadow: 0 4px 14px rgba(0,0,0,.6), 0 0 14px rgba(0,229,255,.25); transition: transform .15s, box-shadow .15s; }
        #sh-launcher:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0,0,0,.7), 0 0 20px rgba(0,229,255,.45); }
        #sh-launcher.open { border-color: #ff2e63; }
        #sh-launcher svg { width: 62%; height: 62%; display: block; pointer-events: none; }
        #sh-launcher .sh-l-dot { position: absolute; top: 1px; right: 1px; width: 11px; height: 11px; border-radius: 50%; border: 2px solid #070b14; box-sizing: border-box; }
        #sh-launcher.run .sh-l-dot { animation: shLPulse 1.2s ease-in-out infinite; }
        @keyframes shLPulse { 50% { transform: scale(1.35); opacity: .7; } }
    `;
    document.head.appendChild(launcherStyle);

    const launcher = document.createElement('button');
    launcher.id = 'sh-launcher';
    launcher.type = 'button';
    launcher.title = 'Sheol Automator';
    launcher.innerHTML = `${shLogo(28, 'l')}<span class="sh-l-dot"></span>`;
    document.body.appendChild(launcher);

    launcher.addEventListener('click', () => {
        minimized = !minimized;
        sessionStorage.setItem(UI_STATE_KEY, String(minimized));
        renderGUI();
    });

    // Match size/position of the site's crossed-swords button and sit right next to it (on its left)
    function positionLauncher() {
        const ref = document.getElementById('openQuickSetDrawerBtn');
        if (!ref) return;
        const r = ref.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
        launcher.style.width = r.width + 'px';
        launcher.style.height = r.height + 'px';
        launcher.style.bottom = Math.max(0, vh - r.bottom) + 'px';
        launcher.style.right = Math.max(0, vw - r.left + 6) + 'px';
    }
    positionLauncher();
    window.addEventListener('resize', positionLauncher);
    window.addEventListener('load', positionLauncher);
    setInterval(positionLauncher, 1500);

    const logBox = document.createElement("div");
    logBox.className = 'sh-log';

    // Modals
    const modalBaseCSS = `display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 550px; max-width: 96vw; max-height: 90vh; overflow-y: auto; padding: 0; z-index: 99999;`;

    const attackModal = document.createElement("div");
    attackModal.style.cssText = modalBaseCSS;
    document.body.appendChild(attackModal);

    const lootModal = document.createElement("div");
    lootModal.style.cssText = modalBaseCSS + "width:650px;";
    lootModal.id = 'dsLootModal';
    document.body.appendChild(lootModal);

    const bossModal = document.createElement("div");
    bossModal.style.cssText = modalBaseCSS + "width:650px;";
    document.body.appendChild(bossModal);

    const statsModal = document.createElement("div");
    statsModal.className = 'sh-hud';
    document.body.appendChild(statsModal);

    const generalModal = document.createElement("div");
    generalModal.style.cssText = modalBaseCSS + "width:550px;";
    document.body.appendChild(generalModal);

    const attackConfigModal = document.createElement("div");
    attackConfigModal.style.cssText = modalBaseCSS + "width:550px;";
    document.body.appendChild(attackConfigModal);

    const launchModal = document.createElement("div");
    launchModal.style.cssText = modalBaseCSS + "width:380px;";
    document.body.appendChild(launchModal);
    [attackModal, lootModal, bossModal, generalModal, attackConfigModal, launchModal].forEach(m => {
        m.classList.add('sh-modal');
        ['wheel', 'touchmove'].forEach(ev => m.addEventListener(ev, e => e.stopPropagation(), { passive: true }));
    });

    /* ======================
       LOGIC & RENDERING
    ====================== */

    function addLog(msg, persist = true) {
        try {
            logHistory.push({
                message: msg,
                timestamp: new Date().toISOString()
            });

            if (logHistory.length > MAX_LOGS) {
                logHistory.splice(0, logHistory.length - MAX_LOGS);
            }

            if (persist) {
                persistLogs();
            }
            //if (logHistory.length > 80) logHistory.shift();
            renderLogs();
        } catch (e) {
            if (persist) {
                addLogToStorage(msg);
            }
        }
    }

    function clearLogs() {
        logHistory = [];
        persistLogs();
        renderLogs();
    }

    function persistLogs() {
        localStorage.setItem(LOG_HISTORY_KEY, JSON.stringify(logHistory));
    }
    function loadLogs() {
        const stored = localStorage.getItem(LOG_HISTORY_KEY);
        if (!stored) return;
        try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                logHistory = parsed;
            }
        } catch (e) {
            console.error("Error parsing stored logs:", e);
        }
    }
    function addLogToStorage(msg) {
        const stored = localStorage.getItem(LOG_HISTORY_KEY);
        if (!stored) return;
        try {
            const parsed = JSON.parse(stored);
            parsed.push(msg);
            localStorage.setItem(LOG_HISTORY_KEY, JSON.stringify(parsed));
        } catch (e) {
            console.error("Error parsing stored logs:", e);
        }
    }


    function applyLogVisibility() {
        const show = settings.showActionLog !== false;
        logBox.style.display = show ? '' : 'none';
        const clr = document.getElementById('clearLogsBtn');
        if (clr) clr.style.display = show ? '' : 'none';
        if (show) renderLogs();
    }

    function renderLogs() {
        if (!logBox) return;
        if (settings.showActionLog === false) return;
        logBox.innerHTML = "";
        logHistory.forEach(log => {
            const div = document.createElement("div");
            div.innerHTML = `${log.message}`;
            const m = String(log.message);
            div.className = 'sh-log-row ' + (/🚫|❌|⛔/.test(m) ? 'bad' : /⚠️|🔋|💊/.test(m) ? 'warn' : /✅|🗡️|💰|💀|🌟|⚡/.test(m) ? 'good' : '');
            logBox.appendChild(div);
        });
        logBox.scrollTop = logBox.scrollHeight;
    }

    function updateUiTextOnly() {
        const uiHp = document.getElementById('ui-hp');
        const uiStam = document.getElementById('ui-stamina');
        const uiExp = document.getElementById('ui-exp');
        const uiPots = document.getElementById('ui-pots');

        if (uiHp) uiHp.textContent = lastKnownHp;
        if (uiStam) uiStam.textContent = currentStamina;
        if (uiExp) uiExp.textContent = lastKnownExp;
        if (uiPots) uiPots.textContent = formatRefillCounter();
    }

    function formatExpPercent(ratio) {
        return (ratio * 100).toFixed(1) + "%";
    }

    function applyStatsSnapshot(stats, {
        syncHp = true,
        syncStamina = true,
        syncExp = true,
        refreshUi = true
    } = {}) {
        if (!stats) return false;

        if (syncHp && stats.hp !== null) lastKnownHp = stats.hp;
        if (syncStamina && stats.stamina !== null) currentStamina = stats.stamina;
        if (syncExp && stats.exp) {
            currentExpRaw = stats.exp.current;
            maxExpRaw = stats.exp.max;
            currentExpRatio = stats.exp.ratio;
            lastKnownExp = formatExpPercent(stats.exp.ratio);
        }

        if (refreshUi) updateUiTextOnly();
        return true;
    }

    async function applyExpGain(expGained, levelUpLogMessage = '') {
        if (!expGained || expGained <= 0) return;

        if (maxExpRaw <= 0) {
            const refreshed = await getPlayerStatsFromWave();
            applyStatsSnapshot(refreshed);
            return;
        }

        currentExpRaw += expGained;
        if (currentExpRaw >= maxExpRaw) {
            if (levelUpLogMessage) addLog(levelUpLogMessage);
            const refreshed = await getPlayerStatsFromWave();
            applyStatsSnapshot(refreshed);
            return;
        }

        currentExpRatio = currentExpRaw / maxExpRaw;
        lastKnownExp = formatExpPercent(currentExpRatio);
        updateUiTextOnly();
    }

    function buildFormBody(paramsObj) {
        return new URLSearchParams(paramsObj).toString();
    }

    function postForm(url, paramsObj) {
        return safeFetch(url, {
            method: 'POST',
            headers: FORM_HEADERS,
            body: buildFormBody(paramsObj),
            credentials: 'same-origin'
        });
    }

    function setStatus(newStatus) {
        currentStatus = newStatus;
        renderGUI();
    }

    function stopAutomation(reason = '', stopLoop = false) {
        running = false;
        restoreMainSet(); // no-op unless the Gribble set is currently equipped
        sessionStorage.setItem(AUTO_RUNNING_KEY, 'false');
        if (stopLoop || !settings.autoLoop) {
            stopRun();
            sessionStorage.setItem(LOOP_KEY, 'false');
            setStatus('STOPPED');
        }
        if (stopLoop && settings.autoLoop) {
            addLog("🚫 [STOPPED] Looping stopped.");
        }
        if (reason) {
            addLog(`🚫 [STOPPED] ${reason}`);
            if (!/Stopped by user/i.test(reason)) {
                const plain = reason.replace(/^[^\w]+/u, '').split('\n')[0].slice(0, 160);
                const ok = /complete|finished|no targets left|no lootable/i.test(reason);
                const bad = /error|fail|mismatch|exceeded|insufficient/i.test(reason);
                showToast(plain, ok ? 'success' : bad ? 'error' : 'warn', 6000);
            }
        }
    }

    function resetSession() {
        staminaRefillsUsed = 0;
        largePotionsDepleted = false;
        manaPotionsDepleted = false;
        bossesLooted = 0;
        monstersLooted = 0;
        totalExpLooted = 0;
        totalGoldLooted = 0;
        lootTracker = {};
        sessionStart = Date.now();
        persistSessionStats();
        updateStatsModal();
        updateUiTextOnly();
        addLog("🔄 Session stats reset.");
    }

    function renderGUI() {
        const statusColor = STATUS_COLORS[currentStatus] || '#fff';
        gui.style.width = "min(700px, calc(100vw - 24px))";
        gui.style.display = minimized ? 'none' : '';
        launcher.classList.toggle('open', !minimized);
        launcher.classList.toggle('run', !!running);
        const ld = launcher.querySelector('.sh-l-dot');
        if (ld) { ld.style.background = statusColor; ld.style.boxShadow = `0 0 8px ${statusColor}`; }

        gui.innerHTML = `
            <div class="sh-head">
                <div class="sh-brand">
                    ${shLogo(38, 'h')}
                    <div>
                        <div class="sh-title">SHEOL <span>Turbo Automator</span></div>
                        <div class="sh-sub">Created by ${CREATOR} · v${CURRENT_VERSION}</div>
                    </div>
                </div>
                <div class="sh-head-actions">
                    <label class="sh-tick" title="Show or hide the action log"><input type="checkbox" id="chkShowLog" ${settings.showActionLog !== false ? 'checked' : ''}><span class="sh-tick-box"></span><span>Action log</span></label>
                    <span id="resetSessionBtn" class="sh-link" title="Reset session numbers">Reset</span>
                    <span id="clearLogsBtn" class="sh-link" title="Clear the log">Clear log</span>
                    <div id="openStats" class="sh-icon-btn" title="Live session stats">📈</div>
                    <div id="minimize" class="sh-icon-btn" title="Minimize">–</div>
                </div>
            </div>

            <div class="sh-status">
                <span class="sh-dot" style="background:${statusColor}; box-shadow:0 0 10px ${statusColor};"></span>
                <span style="color:${statusColor};">${currentStatus}</span><span class="sh-turbo-badge" id="ui-turbo" title="Parallel lanes (change in Settings)">⚡ ×${getTurbo()}</span>
            </div>

            <div class="sh-chips">
                <div class="sh-chip" title="Health"><i>❤️‍🔥</i><span id="ui-hp">${lastKnownHp}</span><small>HP</small></div>
                <div class="sh-chip" title="Stamina"><i>💪</i><span id="ui-stamina">${currentStamina}</span><small>Stamina</small></div>
                <div class="sh-chip" title="Experience"><i>🔮</i><span id="ui-exp">${lastKnownExp}</span><small>EXP</small></div>
                <div class="sh-chip" title="Stamina potions used (no limit)"><i>⚗️</i><span id="ui-pots">${formatRefillCounter()}</span><small>Potions</small></div>
            </div>

            <div class="sh-btns">
                ${running ? `
                    <button id="btnStop" class="sh-btn sh-stop">🚫 STOP</button>
                ` : `
                    <button id="btnAttack" class="sh-btn sh-go">⚔️ Attack</button>
                    <button id="btnGeneralSettings" class="sh-btn sh-set">⚙️ Settings</button>
                    <button id="btnAttackConfig" class="sh-btn sh-mon">👹 Monsters</button>
                    <button id="btnBossManager" class="sh-btn sh-boss">👿 Bosses</button>
                    <button id="btnLootManager" class="sh-btn sh-loot">💰 Loot</button>
                `}
            </div>
        `;

        gui.appendChild(logBox);
        const foot = document.createElement('div');
        foot.className = 'sh-foot';
        foot.innerHTML = `Made with 🔥 by <b>${CREATOR}</b>`;
        gui.appendChild(foot);
        const chkLog = document.getElementById('chkShowLog');
        if (chkLog) chkLog.addEventListener('change', () => {
            settings.showActionLog = chkLog.checked;
            persistAllSettings();
            applyLogVisibility();
        });
        applyLogVisibility();

        if (running) {
            bindTap(document.getElementById("btnStop"), () => stopAutomation("Stopped by user.", true));
        } else {
            bindTap(document.getElementById("btnAttack"), () => renderLaunchModal());
            bindTap(document.getElementById("btnGeneralSettings"), () => renderGeneralSettingsModal());
            bindTap(document.getElementById("btnAttackConfig"), () => renderAttackConfigModal());
            bindTap(document.getElementById("btnBossManager"), () => openBossManager());
            bindTap(document.getElementById("btnLootManager"), () => openLootManager());
        }

        bindTap(document.getElementById("resetSessionBtn"), resetSession);
        bindTap(document.getElementById("clearLogsBtn"), clearLogs);
        bindTap(document.getElementById("openStats"), () => setStatsOpen(statsModal.style.display !== 'block'));
        bindTap(document.getElementById("minimize"), () => {
            minimized = true;
            sessionStorage.setItem(UI_STATE_KEY, 'true');
            renderGUI();
        });
        updateUiTextOnly();
    }

    /* ======================
       LIVE STATS HUD
       Floats over the game while you play: draggable, updates live,
       remembers its position and whether it was open.
    ====================== */

    const STATS_OPEN_KEY = 'ds_gd_stats_open';
    const STATS_POS_KEY = 'ds_gd_stats_pos';
    let statsTimerId = null;
    let resetArmedTimer = null;

    function fmtCompact(n) {
        n = Number(n) || 0;
        const abs = Math.abs(n);
        if (abs >= 1e12) return +(n / 1e12).toFixed(2) + 'T';
        if (abs >= 1e9) return +(n / 1e9).toFixed(2) + 'B';
        if (abs >= 1e6) return +(n / 1e6).toFixed(2) + 'M';
        if (abs >= 1e4) return +(n / 1e3).toFixed(1) + 'K';
        return n.toLocaleString();
    }

    function fmtDuration(ms) {
        const s = Math.floor(Math.max(0, ms) / 1000);
        const h = String(Math.floor(s / 3600)).padStart(2, '0');
        const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
        const sec = String(s % 60).padStart(2, '0');
        return `${h}:${m}:${sec}`;
    }

    statsModal.innerHTML = `
        <div class="sh-hud-head" id="sh_hud_drag" title="Drag to move">
            <div class="sh-hud-title">${shLogo(20, 'st')}<b>SESSION</b><span class="sh-live"><i></i>LIVE</span></div>
            <div class="sh-hud-actions">
                <span id="hud_timer" class="sh-hud-timer">00:00:00</span>
                <button id="hud_btn_fold" title="Collapse / expand">–</button>
                <button id="btn_close_stats" title="Close">✕</button>
            </div>
        </div>
        <div class="sh-hud-body">
            <div class="sh-hud-grid">
                <div class="sh-scard" style="--ac:#ff4d6d;"><div class="ico">👿</div><div class="num" id="stat_bosses">0</div><div class="lbl">Bosses looted</div><div class="rate" id="rate_bosses">—</div></div>
                <div class="sh-scard" style="--ac:#ffc857;"><div class="ico">👹</div><div class="num" id="stat_looted">0</div><div class="lbl">Monsters looted</div><div class="rate" id="rate_looted">—</div></div>
                <div class="sh-scard" style="--ac:#c77dff;"><div class="ico">🔮</div><div class="num" id="stat_exp">0</div><div class="lbl">EXP gained</div><div class="rate" id="rate_exp">—</div></div>
                <div class="sh-scard" style="--ac:#ffe066;"><div class="ico">🪙</div><div class="num" id="stat_gold">0</div><div class="lbl">Gold looted</div><div class="rate" id="rate_gold">—</div></div>
            </div>
            <div class="sh-hud-mini">
                <div><b id="stat_pots">0</b>Potions used</div>
                <div><b id="stat_items">0</b>Items dropped</div>
            </div>
            <div class="sh-hud-sec">Loot drops</div>
            <div id="stats_loot_container" class="ds-loot-grid"></div>
            <div class="sh-hud-foot">
                <button id="hud_btn_reset" title="Reset all session numbers">🔄 Reset session</button>
                <span>drag the top bar to move</span>
            </div>
        </div>
    `;

    function statsSet(id, text, title) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = text;
        if (title !== undefined) el.title = title;
    }

    function updateStatsTimer() {
        if (statsModal.style.display !== 'block') return;
        const ms = Math.max(0, Date.now() - sessionStart);
        const hrs = ms / 3600000;
        statsSet('hud_timer', fmtDuration(ms));
        const rate = (v) => hrs >= 1 / 60 ? `${fmtCompact(Math.round(v / hrs))} / hr` : '— / hr';
        statsSet('rate_bosses', rate(bossesLooted));
        statsSet('rate_looted', rate(monstersLooted));
        statsSet('rate_exp', rate(totalExpLooted));
        statsSet('rate_gold', rate(totalGoldLooted));
    }

    function updateStatsModal() {
        if (statsModal.style.display !== 'block') return;

        statsSet('stat_bosses', fmtCompact(bossesLooted), bossesLooted.toLocaleString());
        statsSet('stat_looted', fmtCompact(monstersLooted), monstersLooted.toLocaleString());
        statsSet('stat_exp', fmtCompact(totalExpLooted), totalExpLooted.toLocaleString());
        statsSet('stat_gold', fmtCompact(totalGoldLooted), totalGoldLooted.toLocaleString());
        statsSet('stat_pots', staminaRefillsUsed.toLocaleString());
        updateStatsTimer();

        const container = document.getElementById('stats_loot_container');
        if (!container) return;

        const items = Object.values(lootTracker || {});
        statsSet('stat_items', items.reduce((a, it) => a + (Number(it.count) || 0), 0).toLocaleString());

        if (items.length === 0) {
            container.innerHTML = '<div class="ds-empty-loot">No drops yet — start looting!</div>';
            return;
        }

        const rank = { LEGENDARY: 4, EPIC: 3, RARE: 2, COMMON: 1 };
        items.sort((a, b) =>
            (rank[String(b.tier).toUpperCase()] || 0) - (rank[String(a.tier).toUpperCase()] || 0) ||
            (b.count || 0) - (a.count || 0));

        container.innerHTML = items.map(item => {
            const tier = String(item.tier || 'COMMON').toUpperCase();
            const tierStyle = TIER_STYLES[tier] || TIER_STYLES.COMMON;
            const cleanImgPath = String(item.img || '').replace(/^\//, '');
            const fullImgUrl = BASE_URL + '/' + cleanImgPath;
            return `
                <div class="ds-item-card" title="${shEsc(item.name)} (${shEsc(tier)}) x${item.count}"
                     style="border-color:${tierStyle.border}; box-shadow:${tierStyle.glow};">
                    <img src="${shEsc(fullImgUrl)}" class="ds-item-img" alt="${shEsc(item.name)}" onerror="this.style.opacity='.25'">
                    <div class="ds-item-count">x${item.count}</div>
                </div>`;
        }).join('');
    }

    function setStatsOpen(open) {
        statsModal.style.display = open ? 'block' : 'none';
        try { localStorage.setItem(STATS_OPEN_KEY, open ? '1' : '0'); } catch (e) { }
        clearInterval(statsTimerId);
        statsTimerId = null;
        if (open) {
            updateStatsModal();
            statsTimerId = setInterval(updateStatsTimer, 1000);
        }
    }

    statsModal.querySelector('#btn_close_stats').onclick = () => setStatsOpen(false);
    statsModal.querySelector('#hud_btn_fold').onclick = () => {
        const folded = statsModal.classList.toggle('folded');
        statsModal.querySelector('#hud_btn_fold').textContent = folded ? '+' : '–';
    };
    statsModal.querySelector('#hud_btn_reset').onclick = (e) => {
        const btn = e.currentTarget;
        if (!resetArmedTimer) {
            btn.textContent = '⚠️ Tap again to confirm';
            resetArmedTimer = setTimeout(() => { resetArmedTimer = null; btn.textContent = '🔄 Reset session'; }, 3000);
            return;
        }
        clearTimeout(resetArmedTimer);
        resetArmedTimer = null;
        btn.textContent = '🔄 Reset session';
        resetSession();
    };

    // Drag by the header (mouse + touch), remember where it was left
    (function enableHudDrag() {
        const head = statsModal.querySelector('#sh_hud_drag');
        let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
        head.addEventListener('pointerdown', (e) => {
            if (e.target.closest('button')) return;
            dragging = true;
            const r = statsModal.getBoundingClientRect();
            ox = r.left; oy = r.top; sx = e.clientX; sy = e.clientY;
            try { head.setPointerCapture(e.pointerId); } catch (err) { }
            e.preventDefault();
        });
        head.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            const w = statsModal.offsetWidth;
            const x = Math.min(Math.max(0, ox + e.clientX - sx), Math.max(0, window.innerWidth - w));
            const y = Math.min(Math.max(0, oy + e.clientY - sy), Math.max(0, window.innerHeight - 44));
            statsModal.style.left = x + 'px';
            statsModal.style.top = y + 'px';
        });
        const end = () => {
            if (!dragging) return;
            dragging = false;
            try {
                localStorage.setItem(STATS_POS_KEY, JSON.stringify({ x: parseFloat(statsModal.style.left), y: parseFloat(statsModal.style.top) }));
            } catch (e) { }
        };
        head.addEventListener('pointerup', end);
        head.addEventListener('pointercancel', end);
    })();

    try {
        const pos = JSON.parse(localStorage.getItem(STATS_POS_KEY) || 'null');
        if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
            statsModal.style.left = Math.min(Math.max(0, pos.x), Math.max(0, window.innerWidth - 120)) + 'px';
            statsModal.style.top = Math.min(Math.max(0, pos.y), Math.max(0, window.innerHeight - 60)) + 'px';
        }
    } catch (e) { }
    if (localStorage.getItem(STATS_OPEN_KEY) === '1') setStatsOpen(true);

    function processLootItems(items) {
        if (!items || !Array.isArray(items)) return;
        items.forEach(item => {
            const id = item.ITEM_ID || item.id;
            if (!id) return;
            if (!lootTracker[id]) {
                lootTracker[id] = {
                    count: 0,
                    name: item.NAME || item.name || 'Unknown Item',
                    img: item.IMAGE_URL || item.image || '',
                    tier: item.TIER || item.tier || 'COMMON'
                };
            }
            lootTracker[id].count++;
        });
    }

    /* ======================
       ATTACK / SETTINGS MODAL
    ====================== */

    function saveAttackSettings() {
        settings.useLargeStamina = document.getElementById('chk_large_stam').checked;
        settings.useFullStamina = document.getElementById('chk_full_stam').checked;
        settings.expThreshold = parseFloatStrict(document.getElementById('in_exp_t').value, 0.7);
        settings.hpThreshold = parseIntStrict(document.getElementById('in_hp_t').value, 50);
        settings.staminaThreshold = parseIntStrict(document.getElementById('in_stam_t').value, 10);
        settings.fullStaminaPotionId = parseIntStrict(document.getElementById('in_fsp').value, 1);
        settings.largeStaminaPotionId = parseIntStrict(document.getElementById('in_lsp').value, 2);
        settings.hpPotionId = parseIntStrict(document.getElementById('in_hp_id').value, 3);

        persistAllSettings();
        addLog("✅ Attack Settings Saved!");
        updateUiTextOnly();
    }

    function renderAttackConfigModal() {

        // Monster groups definition
        const MONSTER_GROUPS = [
            {
                key: 'shadowbridge',
                label: '🏰 Shadowbridge Warrens — Easy dungeon',
                color: '#3ddc97',
                rows: [
                    {
                        names: ['Gribble Junk-Magus', 'Orc Stone-Rend', 'Vorga Ash-Shaman', 'Krak One-Horn',
                                'Skrit Gear', 'Brog Skull', 'Droknar Night-Blade', 'Gorvash the Stone-Ram',
                                'Hruk Forge-Eater', 'Makra the Mireborn', 'Nib Wickfingers', 'Pip Tanglefoot',
                                'Rukka The Wolf Raider', 'Shagra Bone-Singer', 'Talla Flint-Stem',
                                'Tharka Blood-Howl', 'Urzul Iron-Tusks', 'Zorgra Frost-Vein']
                    }
                ]
            },
            {
                key: 'polyhedral',
                label: '🔮 The Polyhedral Crucible — New dungeon',
                color: '#c77dff',
                rows: [
                    { sublabel: 'Gate Prism', names: ['Prismblade Reaver', 'Mireglass Stalker', 'Siege-Root Howler'] },
                    { sublabel: 'Ash Lane', names: ['Null Choir Adept', 'Calibration Warden', 'Bastion Iterant', 'Polyhedral Devourer'] },
                    { sublabel: 'Crown Lens', names: ['Crown Resonator', 'Zenith Lancer', 'Warform of the Creator', "Creator's Chosen Executor"] }
                ]
            }
        ];

        const ALL_MONSTERS = MONSTER_GROUPS.flatMap(g => g.rows.flatMap(r => r.names));
        const skillList = ['SLASH', 'POWER_SLASH', 'HEROIC_SLASH', 'ULTIMATE_SLASH', 'LEGENDARY_SLASH', 'WORLD_BREAKER_SLASH', ...Object.keys(CLASS_SKILLS)];

        let monFilter = 'all';
        let monQuery = '';

        function skillOptions(selected, withKeep = false) {
            return (withKeep ? '<option value="">— keep current —</option>' : '') +
                skillList.map(sv => `<option value="${sv}" ${selected === sv ? 'selected' : ''}>${sv.replace(/_/g, ' ')}</option>`).join('');
        }

        function monsterCardHTML(name, groupKey) {
            const key = name.toLowerCase();
            const enabled = settings.monsterAttackEnabled || {};
            const checked = enabled[key] ? 'checked' : '';
            const ls = settings.monsterAttackLS?.[key] ?? settings.monsterAttackLS?.['default'] ?? '5';
            const skill = settings.monsterAttackSkill?.[key] ?? settings.monsterAttackSkill?.['default'] ?? 'POWER_SLASH';
            const cap = settings.monsterAttackCap?.[key] ?? settings.monsterAttackCap?.['default'] ?? '0';
            const smart = settings.monsterAttackSmart?.[key] ? 'checked' : '';
            const maxMobs = settings.monsterAttackMax?.[key] ?? '0';
            const s = (settings.monsterStatus || {})[key] || '';
            const statusText = s === 'alive' ? 'Alive' : s === 'dead' ? 'Dead' : '';
            const dotTitle = s === 'alive' ? 'Alive' : s === 'dead' ? 'Dead' : 'Unknown';
            return `
                <div class="sh-mcard" data-group="${groupKey}" data-search="${shEsc(key)}" data-status="${s}">
                    <label class="sh-sw" title="Attack this monster"><input type="checkbox" class="ac-mon-chk" data-name="${shEsc(key)}" ${checked}><span></span></label>
                    <div class="sh-mname">
                        <i class="sh-sdot ${s}" title="${dotTitle}"></i>
                        <b title="${shEsc(name)}">${shEsc(name)}</b>
                        <small>${statusText}</small>
                    </div>
                    <div class="sh-mctl">
                        <div class="sh-field">
                            <label>Hits</label>
                            <div class="sh-stepper">
                                <button type="button" class="sh-step" data-d="-1">−</button>
                                <input type="text" class="ds-mon-input ac-mon-ls" data-name="${shEsc(key)}" value="${shEsc(ls)}" placeholder="5">
                                <button type="button" class="sh-step" data-d="1">+</button>
                            </div>
                        </div>
                        <div class="sh-field">
                            <label>Max mobs</label>
                            <div class="sh-stepper" title="How many of this monster to hit per run (0 = all)">
                                <button type="button" class="sh-step" data-d="-1">−</button>
                                <input type="text" class="ds-mon-input ac-mon-max" data-name="${shEsc(key)}" value="${shEsc(maxMobs)}" placeholder="0">
                                <button type="button" class="sh-step" data-d="1">+</button>
                            </div>
                        </div>
                        <div class="sh-field sh-f-skill">
                            <label>Skill</label>
                            <select class="ds-mon-select ac-mon-skill" data-name="${shEsc(key)}">${skillOptions(skill)}</select>
                        </div>
                        <div class="sh-field sh-f-cap">
                            <label>Damage cap</label>
                            <input type="text" class="ds-mon-input ac-mon-cap" data-name="${shEsc(key)}" value="${shEsc(fullCap(cap))}" placeholder="10,000,000">
                        </div>
                        <label class="sh-smart" title="Smart attack">
                            <input type="checkbox" class="ac-mon-smart" data-name="${shEsc(key)}" ${smart}><span>🧠 Smart</span>
                        </label>
                    </div>
                </div>`;
        }

        function buildList() {
            let html = '';
            MONSTER_GROUPS.forEach(group => {
                html += `
                    <div class="sh-mgroup" data-group="${group.key}" style="--gc:${group.color};">
                        <div class="sh-mghead"><span class="sh-arrow">▾</span><span>${group.label}</span><span class="sh-mgcount"></span></div>
                        <div class="sh-mgbody">`;
                group.rows.forEach(rowGroup => {
                    if (rowGroup.sublabel) html += `<div class="sh-msub">${rowGroup.sublabel}</div>`;
                    rowGroup.names.forEach(name => { html += monsterCardHTML(name, group.key); });
                });
                html += `</div></div>`;
            });

            // Extra monsters from scan not in any group
            const allGrouped = new Set(ALL_MONSTERS.map(n => n.toLowerCase()));
            const extras = (settings.knownMonsters || []).filter(n => !allGrouped.has(n.toLowerCase()));
            if (extras.length > 0) {
                html += `
                    <div class="sh-mgroup" data-group="extras" style="--gc:#ffc857;">
                        <div class="sh-mghead"><span class="sh-arrow">▾</span><span>🔍 Other (from scan)</span><span class="sh-mgcount"></span></div>
                        <div class="sh-mgbody">${extras.map(n => monsterCardHTML(n, 'extras')).join('')}</div>
                    </div>`;
            }
            html += `<div class="sh-empty" id="ac_empty" style="display:none;">No monsters match your search.</div>`;
            return html;
        }

        attackConfigModal.style.width = 'min(760px, 96vw)';
        attackConfigModal.innerHTML = `
            <div class="ds-modal-header">
                <div class="sh-mhead-title">
                    <div class="ico">👹</div>
                    <div><h3>Monster Control</h3><small>Flip a switch to attack it · set hits, skill and damage cap</small></div>
                </div>
                <span id="ac_btn_close" class="sh-x" title="Close">✕</span>
            </div>
            <div class="ds-modal-body">
                <div class="sh-mwrap">
                    <div class="sh-toolbar">
                        <div class="sh-search"><input type="text" id="ac_search" placeholder="Search monsters…" autocomplete="off"></div>
                        <button id="ac_btn_sel_all" class="sh-tbtn">Select all</button>
                        <button id="ac_btn_scan" class="sh-tbtn">🔄 Scan</button>
                    </div>
                    <div class="sh-toolbar">
                        <span class="sh-pill active" data-filter="all">All</span>
                        <span class="sh-pill" data-filter="on">Enabled<b id="ac_cnt_on">0</b></span>
                        <span class="sh-pill" data-filter="alive">Alive<b id="ac_cnt_alive">0</b></span>
                        <span class="sh-legend">
                            <span><i class="sh-sdot alive"></i> alive</span>
                            <span><i class="sh-sdot dead"></i> dead</span>
                            <span><i class="sh-sdot"></i> unknown</span>
                        </span>
                    </div>
                    <details class="sh-bulk">
                        <summary>⚡ Quick apply to all enabled monsters</summary>
                        <div class="sh-bulk-row">
                            <div class="sh-field sh-f-skill"><label>Skill</label><select id="ac_bulk_skill" class="ds-mon-select">${skillOptions('', true)}</select></div>
                            <div class="sh-field" style="width:70px;"><label>Hits</label><input type="text" id="ac_bulk_hits" class="ds-mon-input" placeholder="—"></div>
                            <div class="sh-field sh-f-cap"><label>Damage cap</label><input type="text" id="ac_bulk_cap" class="ds-mon-input" placeholder="—"></div>
                            <button id="ac_bulk_apply" class="sh-primary">Apply</button>
                        </div>
                    </details>
                    <div class="sh-mlist" id="ac_mon_tbody">${buildList()}</div>
                </div>
            </div>
            <div class="sh-mfoot">
                <span class="sh-saved" id="ac_saved">✓ Saved automatically</span>
                <button id="ac_btn_done" class="sh-primary">Done</button>
            </div>
        `;

        const listEl = attackConfigModal.querySelector('#ac_mon_tbody');
        const cardsAll = () => [...listEl.querySelectorAll('.sh-mcard')];
        let savedFlashTimer = null;

        function flashSaved() {
            const el = attackConfigModal.querySelector('#ac_saved');
            if (!el) return;
            el.classList.add('show');
            clearTimeout(savedFlashTimer);
            savedFlashTimer = setTimeout(() => el.classList.remove('show'), 1400);
        }

        // Re-apply on/off look, counters, search and filter
        function refreshMonUI() {
            const q = monQuery.trim().toLowerCase();
            const filtering = !!q || monFilter !== 'all';
            let onTotal = 0, aliveTotal = 0, anyShown = false;

            cardsAll().forEach(card => {
                const isOn = card.querySelector('.ac-mon-chk').checked;
                card.classList.toggle('on', isOn);
                if (isOn) onTotal++;
                if (card.dataset.status === 'alive') aliveTotal++;
                const okQ = !q || card.dataset.search.includes(q);
                const okF = monFilter === 'all' || (monFilter === 'on' && isOn) || (monFilter === 'alive' && card.dataset.status === 'alive');
                card.style.display = (okQ && okF) ? '' : 'none';
            });

            listEl.querySelectorAll('.sh-mgroup').forEach(g => {
                const cards = [...g.querySelectorAll('.sh-mcard')];
                const on = cards.filter(c => c.querySelector('.ac-mon-chk').checked).length;
                const shown = cards.some(c => c.style.display !== 'none');
                if (shown) anyShown = true;
                g.style.display = shown ? '' : 'none';
                g.querySelector('.sh-mgcount').textContent = `${on}/${cards.length} on`;
                g.querySelectorAll('.sh-msub').forEach(s => { s.style.display = filtering ? 'none' : ''; });
            });

            attackConfigModal.querySelector('#ac_cnt_on').textContent = onTotal;
            attackConfigModal.querySelector('#ac_cnt_alive').textContent = aliveTotal;
            attackConfigModal.querySelector('#ac_empty').style.display = anyShown ? 'none' : '';
        }

        // Auto-persist on any change
        function saveMonsterSettings() {
            const newEnabled = {}, newLS = {}, newSkill = {}, newCap = {}, newSmartAttack = {}, newMax = {};
            attackConfigModal.querySelectorAll('.ac-mon-chk').forEach(el => {
                const k = el.getAttribute('data-name'); if (k) newEnabled[k] = el.checked;
            });
            attackConfigModal.querySelectorAll('.ac-mon-ls').forEach(el => {
                const k = el.getAttribute('data-name'); if (k) newLS[k] = el.value.trim() || '5';
            });
            attackConfigModal.querySelectorAll('.ac-mon-skill').forEach(el => {
                const k = el.getAttribute('data-name'); if (k) newSkill[k] = el.value;
            });
            attackConfigModal.querySelectorAll('.ac-mon-cap').forEach(el => {
                const k = el.getAttribute('data-name'); if (k) newCap[k] = el.value.trim() || '0';
            });
            attackConfigModal.querySelectorAll('.ac-mon-smart').forEach(el => {
                const k = el.getAttribute('data-name'); if (k) newSmartAttack[k] = el.checked;
            });

            settings.monsterAttackEnabled = newEnabled;
            settings.monsterAttackLS = newLS;
            settings.monsterAttackSkill = newSkill;
            settings.monsterAttackCap = newCap;
            attackConfigModal.querySelectorAll('.ac-mon-max').forEach(el => {
                const k = el.getAttribute('data-name'); if (k) newMax[k] = String(Math.max(0, parseIntStrict(el.value, 0)));
            });
            settings.monsterAttackMax = newMax;
            settings.monsterAttackSmart = newSmartAttack;
            persistAllSettings();
            flashSaved();
        }

        // Close
        const closeModal = () => { attackConfigModal.style.display = 'none'; };
        attackConfigModal.querySelector('#ac_btn_close').onclick = closeModal;
        attackConfigModal.querySelector('#ac_btn_done').onclick = closeModal;

        // Collapse / expand groups + hit steppers
        listEl.addEventListener('click', (e) => {
            const head = e.target.closest('.sh-mghead');
            if (head) { head.parentElement.classList.toggle('closed'); return; }
            const step = e.target.closest('.sh-step');
            if (step) {
                const input = step.parentElement.querySelector('input');
                const isMax = input.classList.contains('ac-mon-max');
                const next = Math.max(isMax ? 0 : 1, parseIntStrict(input.value, isMax ? 0 : 5) + parseInt(step.dataset.d, 10));
                input.value = String(next);
                saveMonsterSettings();
            }
        });

        // Any control change → save + refresh look
        listEl.addEventListener('change', (e) => {
            if (e.target.matches('.ac-mon-chk, .ac-mon-smart, .ac-mon-skill, .ac-mon-ls, .ac-mon-cap, .ac-mon-max')) {
                saveMonsterSettings();
                refreshMonUI();
            }
        });

        // Search + filter chips
        attackConfigModal.querySelector('#ac_search').addEventListener('input', (e) => {
            monQuery = e.target.value;
            refreshMonUI();
        });
        attackConfigModal.querySelectorAll('.sh-pill').forEach(p => {
            p.onclick = () => {
                monFilter = p.dataset.filter;
                attackConfigModal.querySelectorAll('.sh-pill').forEach(x => x.classList.toggle('active', x === p));
                refreshMonUI();
            };
        });

        // Select all / unselect all (only cards you can currently see)
        attackConfigModal.querySelector('#ac_btn_sel_all').onclick = () => {
            const chks = cardsAll()
                .filter(c => c.offsetParent !== null)
                .map(c => c.querySelector('.ac-mon-chk'));
            const allChecked = chks.length > 0 && chks.every(c => c.checked);
            chks.forEach(c => { c.checked = !allChecked; });
            attackConfigModal.querySelector('#ac_btn_sel_all').textContent = allChecked ? 'Select all' : 'Unselect all';
            saveMonsterSettings();
            refreshMonUI();
        };

        // Quick apply
        attackConfigModal.querySelector('#ac_bulk_apply').onclick = () => {
            const sk = attackConfigModal.querySelector('#ac_bulk_skill').value;
            const hits = attackConfigModal.querySelector('#ac_bulk_hits').value.trim();
            const cap = attackConfigModal.querySelector('#ac_bulk_cap').value.trim();
            const targets = cardsAll().filter(c => c.querySelector('.ac-mon-chk').checked);
            if (!targets.length) { showToast('Turn on at least one monster first.', 'warn', 3500); return; }
            if (!sk && !hits && !cap) { showToast('Pick a skill, hits or damage cap to apply.', 'warn', 3500); return; }
            targets.forEach(c => {
                if (sk) c.querySelector('.ac-mon-skill').value = sk;
                if (hits) c.querySelector('.ac-mon-ls').value = hits;
                if (cap) c.querySelector('.ac-mon-cap').value = cap;
            });
            saveMonsterSettings();
            showToast(`Applied to ${targets.length} monster${targets.length > 1 ? 's' : ''}.`, 'success', 2500);
        };

        // Scan button
        attackConfigModal.querySelector('#ac_btn_scan').onclick = async () => {
            const btn = attackConfigModal.querySelector('#ac_btn_scan');
            btn.textContent = '⏳ Scanning…';
            btn.disabled = true;
            try {
                const newStatus = await scanMonsterStatus();
                const allNames = await scanAllMonsterNames();
                settings.monsterStatus = newStatus;
                settings.knownMonsters = allNames;
                persistAllSettings();
                renderAttackConfigModal();
            } catch (e) {
                addLog('⚠️ Monster scan failed: ' + e.stack);
                const b = document.getElementById('ac_btn_scan');
                if (b) { b.textContent = '🔄 Scan'; b.disabled = false; }
            }
        };

        refreshMonUI();
        attackConfigModal.style.display = 'block';
    }

    // Scan all active dungeons for unique monster names
    async function scanAllMonsterNames() {
        const res = await safeFetch(DUNGEONS_URL, { credentials: 'same-origin' });
        const html = await res.text();
        const ids = extractDungeonIds(html);

        const scanTargets = [];
        ids.active.easy.forEach(id => scanTargets.push({ id, locs: SHADOWBRIDGE_LOCS }));
        ids.active.hard.forEach(id => scanTargets.push({ id, locs: CASTLE_MOB_LOCS }));
        ids.active.poly.forEach(id => scanTargets.push({ id, locs: POLYHEDRAL_MOB_LOCS }));

        // Only keep names already in the known list (no new additions from scan)
        const knownLower = new Set((settings.knownMonsters || []).map(n => n.toLowerCase()));

        const allNames = new Set();
        for (const dungeon of scanTargets) {
            for (const loc of dungeon.locs) {
                const mons = await fetchMonstersFromLocation(dungeon.id, loc);
                mons.forEach(m => {
                    if (m.name && m.name !== 'Unknown' && knownLower.has(m.name.toLowerCase()))
                        allNames.add(m.name);
                });
            }
        }
        return [...allNames].sort();
    }

    // Scan all active instances and return status per monster name (lowercase):
    // 'alive' → at least one alive instance found
    // 'dead'  → found but all dead
    // ''      → not found in any instance
    async function scanMonsterStatus() {
        const res = await safeFetch(DUNGEONS_URL, { credentials: 'same-origin' });
        const html = await res.text();
        const ids = extractDungeonIds(html);

        const scanTargets = [];
        // Scan active + ended instances for full picture
        [...ids.active.easy, ...ids.ended.easy].forEach(id => scanTargets.push({ id, locs: SHADOWBRIDGE_LOCS }));
        [...ids.active.hard, ...ids.ended.hard].forEach(id => scanTargets.push({ id, locs: CASTLE_MOB_LOCS }));
        [...ids.active.poly, ...ids.ended.poly].forEach(id => scanTargets.push({ id, locs: POLYHEDRAL_MOB_LOCS }));

        // Only track names already in the known list
        const knownLower = new Set((settings.knownMonsters || []).map(n => n.toLowerCase()));

        // { nameKey: { alive: 0, dead: 0 } }
        const counts = {};

        for (const dungeon of scanTargets) {
            for (const loc of dungeon.locs) {
                const mons = await fetchMonstersFromLocation(dungeon.id, loc);
                mons.forEach(m => {
                    if (!m.name || m.name === 'Unknown') return;
                    const key = m.name.toLowerCase();
                    if (!knownLower.has(key)) return;
                    if (!counts[key]) counts[key] = { alive: 0, dead: 0 };
                    if (m.isDead) counts[key].dead++;
                    else counts[key].alive++;
                });
            }
        }

        // Build status map
        const statusMap = {};
        Object.entries(counts).forEach(([key, c]) => {
            statusMap[key] = c.alive > 0 ? 'alive' : c.dead > 0 ? 'dead' : '';
        });
        return statusMap;
    }

    function renderGeneralSettingsModal() {
        generalModal.innerHTML = `
            <div class="ds-modal-header">
                <div class="sh-mhead-title cfg"><div class="ico">⚙️</div><div><h3>Settings</h3><small>Potions, limits, looting and looping</small></div></div>
                <span id="gs_btn_x" class="sh-x" title="Close">✕</span>
            </div>
            <div class="ds-modal-body">
                <div class="sh-set-grid">
                    <div>
                        <div class="sh-scard2">
                            <h4><i>🧪</i>Potions</h4>
                            <div class="sh-row"><div class="sh-row-txt"><b>Large stamina potions</b><small>Refill with Large potions first</small></div><label class="sh-sw"><input type="checkbox" id="gs_chk_large_stam"><span></span></label></div>
                            <div class="sh-row"><div class="sh-row-txt"><b>Full stamina potions</b><small>Used when Large ones run out</small></div><label class="sh-sw"><input type="checkbox" id="gs_chk_full_stam"><span></span></label></div>
                        </div>
                        <div class="sh-scard2">
                            <h4><i>🎚️</i>Thresholds</h4>
                            <div class="sh-row"><div class="sh-row-txt"><b>Stop EXP at</b><small>0.7 = 70% of the level bar</small></div><input type="text" class="sh-num" id="gs_in_exp_t" value="${settings.expThreshold}"></div>
                            <div class="sh-row"><div class="sh-row-txt"><b>HP threshold</b><small>Heal when HP falls to this</small></div><input type="text" class="sh-num" id="gs_in_hp_t" value="${settings.hpThreshold}"></div>
                            <div class="sh-row"><div class="sh-row-txt"><b>Stamina threshold</b></div><input type="text" class="sh-num" id="gs_in_stam_t" value="${settings.staminaThreshold}"></div>
                        </div>
                    </div>
                    <div>
                        <div class="sh-scard2">
                            <h4><i>🎒</i>Inventory IDs</h4>
                            <div class="sh-row"><div class="sh-row-txt"><b>Large potion</b></div><input type="text" class="sh-num" id="gs_in_lsp" value="${settings.largeStaminaPotionId ?? ''}"></div>
                            <div class="sh-row"><div class="sh-row-txt"><b>Full potion</b></div><input type="text" class="sh-num" id="gs_in_fsp" value="${settings.fullStaminaPotionId ?? ''}"></div>
                            <div class="sh-row"><div class="sh-row-txt"><b>HP potion</b></div><input type="text" class="sh-num" id="gs_in_hp_id" value="${settings.hpPotionId ?? ''}"></div>
                            <div class="sh-row"><div class="sh-row-txt"><b>Mana potion</b></div><input type="text" class="sh-num" id="gs_in_mana_id" value="${settings.manaPotionId ?? ''}"></div>
                            <div class="sh-note">IDs usually update by themselves when you open your inventory on the main site.</div>
                        </div>
                        <div class="sh-scard2">
                            <h4><i>✨</i>Class skill</h4>
                            <div class="sh-row"><div class="sh-row-txt"><b>Buff skill</b></div>${Object.keys(CLASS_SKILLS).length === 0 ? '<span class="sh-warn">Join any battle first</span>' : `<select id="gs_skill_id" class="ds-mon-select" style="width:150px;">${Object.entries(CLASS_SKILLS).map(([name, skill]) => `<option value="${skill.id}" ${settings.skillId == skill.id ? 'selected' : ''}>${formatSkillName(name)}</option>`).join('')}</select>`}</div>
                            <div class="sh-row"><div class="sh-row-txt"><b>Use skill</b><small>Only used on a World Breaker Slash against a boss</small></div><label class="sh-sw"><input type="checkbox" id="gs_chk_use_skill"><span></span></label></div>
                        </div>
                    </div>
                </div>
                <div class="sh-scard2">
                    <h4><i>🛡️</i>Gribble Junk-Magus</h4>
                    <div class="sh-row"><div class="sh-row-txt"><b>Hit up to my damage cap</b><small>OFF (safe mode): each Gribble is hit once to the 1,000,000 reward minimum, then skipped, and the run stops above 3,000,000. ON: Gribble is attacked like any other monster, up to the cap set in Monsters — the old safety stops are disabled.</small></div><label class="sh-sw"><input type="checkbox" id="gs_chk_gribble_cap"><span></span></label></div>
                    <div class="sh-row"><div class="sh-row-txt"><b>Switch set for Gribble Junk-Magus</b><small>When the scan finds Gribble Junk-Magus in Shadowbridge Warrens, equip the set below before attacking.</small></div><label class="sh-sw"><input type="checkbox" id="gs_chk_gribble_set"><span></span></label></div>
                    <div class="sh-row"><div class="sh-row-txt"><b>Set name</b><small>Exact Quick Sets name, e.g. Maguses (“– Gear” is added for you)</small></div><input type="text" class="sh-num" style="width:150px;" id="gs_in_gribble_set" value="${shEsc(settings.gribbleSetName || '')}" placeholder="Maguses"></div>
                    <div class="sh-row"><div class="sh-row-txt"><b>Switch back to main set</b><small>Re-equips your normal set as soon as the monster attacks finish. Names are saved, so you only type them once.</small></div><label class="sh-sw"><input type="checkbox" id="gs_chk_main_set"><span></span></label></div>
                    <div class="sh-row"><div class="sh-row-txt"><b>Main set name</b><small>Exact Quick Sets name, e.g. Aegis Set</small></div><input type="text" class="sh-num" style="width:150px;" id="gs_in_main_set" value="${shEsc(settings.mainSetName || '')}" placeholder="Aegis Set"></div>
                </div>
                <div class="sh-scard2">
                    <h4><i>💰</i>Auto loot</h4>
                    <div class="sh-row"><div class="sh-row-txt"><b>Auto loot dungeons</b><small>Loots dungeons without wasting stamina. Works best with wave loot on, so no levels get skipped.</small></div><label class="sh-sw"><input type="checkbox" id="gs_chk_auto_loot_dungeons"><span></span></label></div>
                    <div class="sh-row"><div class="sh-row-txt"><b>Loot wave bosses</b><small>Loots wave bosses when you are close to levelling up</small></div><label class="sh-sw"><input type="checkbox" id="gs_chk_auto_loot_wave"><span></span></label></div>
                </div>
                <div class="sh-scard2 sh-turbo-card">
                    <h4><i>⚡</i>Turbo</h4>
                    <div class="sh-row"><div class="sh-row-txt"><b>Parallel lanes</b><small>How many monsters, bosses and loots run at the same time (1 = old speed, max 20). Lower it if the game starts throttling you.</small></div><input type="number" min="1" max="20" class="sh-num" id="gs_in_turbo" value="${getTurbo()}"></div>
                </div>
                <div class="sh-scard2">
                    <h4><i>🔁</i>Loop</h4>
                    <div class="sh-row"><div class="sh-row-txt"><b>Auto loop</b><small>Run again and again on a timer</small></div><label class="sh-sw"><input type="checkbox" id="gs_chk_auto_loop"><span></span></label></div>
                    <div class="sh-row"><div class="sh-row-txt"><b>Run every (minutes)</b></div><input type="number" class="sh-num" id="gs_in_loop_interval" value="${settings.loopInterval ?? 20}"></div>
                </div>
            </div>
            <div class="sh-mfoot">
                <span class="sh-saved" id="gs_saved">✓ Saved</span>
                <div style="display:flex; gap:8px;">
                    <button id="gs_btn_close" class="sh-ghost">Close</button>
                    <button id="gs_btn_save" class="sh-primary">💾 Save</button>
                </div>
            </div>
        `;

        document.getElementById('gs_chk_large_stam').checked = settings.useLargeStamina;
        document.getElementById('gs_chk_full_stam').checked = settings.useFullStamina;
        document.getElementById('gs_chk_use_skill').checked = settings.useSkill;
        document.getElementById('gs_chk_gribble_set').checked = !!settings.gribbleSetEnabled;
        document.getElementById('gs_chk_gribble_cap').checked = !!settings.gribbleUseCap;
        document.getElementById('gs_chk_main_set').checked = !!settings.mainSetEnabled;
        document.getElementById('gs_chk_auto_loot_dungeons').checked = settings.autoLootDungeons;
        document.getElementById('gs_chk_auto_loot_wave').checked = settings.autoLootWave;
        document.getElementById('gs_chk_auto_loop').checked = settings.autoLoop;
        bindTap(document.getElementById('gs_btn_close'), () => { generalModal.style.display = 'none'; });
        bindTap(document.getElementById('gs_btn_x'), () => { generalModal.style.display = 'none'; });

        bindTap(document.getElementById('gs_btn_save'), () => {
            settings.useLargeStamina = document.getElementById('gs_chk_large_stam').checked;
            settings.useFullStamina = document.getElementById('gs_chk_full_stam').checked;
            settings.useSkill = document.getElementById('gs_chk_use_skill').checked;
            settings.autoLootDungeons = document.getElementById('gs_chk_auto_loot_dungeons').checked;
            settings.autoLootWave = document.getElementById('gs_chk_auto_loot_wave').checked;
            settings.gribbleSetEnabled = document.getElementById('gs_chk_gribble_set').checked;
            settings.gribbleUseCap = document.getElementById('gs_chk_gribble_cap').checked;
            settings.gribbleSetName = document.getElementById('gs_in_gribble_set').value.trim();
            settings.mainSetEnabled = document.getElementById('gs_chk_main_set').checked;
            settings.mainSetName = document.getElementById('gs_in_main_set').value.trim();
            if (settings.gribbleSetEnabled && !settings.gribbleSetName) showToast('Gear switch is on but the Gribble set name is empty.', 'warn', 4000);
            if (settings.mainSetEnabled && !settings.mainSetName) showToast('Switch-back is on but the main set name is empty.', 'warn', 4000);
            settings.autoLoop = document.getElementById('gs_chk_auto_loop').checked;
            settings.expThreshold = parseFloatStrict(document.getElementById('gs_in_exp_t').value, 0.7);
            settings.hpThreshold = parseIntStrict(document.getElementById('gs_in_hp_t').value, 50);
            settings.staminaThreshold = parseIntStrict(document.getElementById('gs_in_stam_t').value, 10);
            settings.largeStaminaPotionId = parseIntStrict(document.getElementById('gs_in_lsp').value, 2);
            settings.fullStaminaPotionId = parseIntStrict(document.getElementById('gs_in_fsp').value, 1);
            settings.hpPotionId = parseIntStrict(document.getElementById('gs_in_hp_id').value, 3);
            settings.manaPotionId = parseIntStrict(document.getElementById('gs_in_mana_id').value, 4);
            settings.skillId = parseInt(document.getElementById('gs_skill_id')?.value, null);
            settings.loopInterval = parseIntStrict(document.getElementById('gs_in_loop_interval').value, 20);
            settings.turbo = Math.min(20, Math.max(1, parseIntStrict(document.getElementById('gs_in_turbo').value, 8)));
            const tb = document.getElementById('ui-turbo'); if (tb) tb.textContent = '⚡ ×' + getTurbo();
            persistAllSettings();
            addLog("✅ General Settings Saved!");
            showToast('Settings saved.', 'success', 2200);
            const sv = document.getElementById('gs_saved');
            if (sv) { sv.classList.add('show'); setTimeout(() => sv.classList.remove('show'), 1600); }
            updateUiTextOnly();
        });

        generalModal.style.display = 'block';
    }

    function renderLaunchModal() {
        launchModal.innerHTML = `
            <div class="ds-modal-header">
                <div class="sh-mhead-title go"><div class="ico">⚔️</div><div><h3>Start Attack</h3><small>Pick your targets, then go</small></div></div>
                <span id="lm_btn_x" class="sh-x" title="Close">✕</span>
            </div>
            <div class="ds-modal-body">
                <label class="sh-opt" id="lm_opt_mon">
                    <div class="oi">👹</div>
                    <div class="ot"><b>Monsters</b><small>Hit mobs with your Monster Control settings</small></div>
                    <span class="sh-sw"><input type="checkbox" id="lm_chk_monsters"><span></span></span>
                </label>
                <label class="sh-opt" id="lm_opt_boss">
                    <div class="oi">👿</div>
                    <div class="ot"><b>Bosses</b><small>Hit the bosses you switched on in Boss Command</small></div>
                    <span class="sh-sw"><input type="checkbox" id="lm_chk_bosses"><span></span></span>
                </label>
            </div>
            <div class="sh-mfoot">
                <button id="lm_btn_close" class="sh-ghost">Cancel</button>
                <button id="lm_btn_start" class="sh-startbtn">▶ Start Attack</button>
            </div>
        `;

        bindTap(document.getElementById('lm_btn_close'), () => { launchModal.style.display = 'none'; });
        bindTap(document.getElementById('lm_btn_x'), () => { launchModal.style.display = 'none'; });

        // Restore saved state
        document.getElementById('lm_chk_monsters').checked = settings.attackLaunchMonsters;
        document.getElementById('lm_chk_bosses').checked = settings.attackLaunchBosses;
        const syncOpts = () => {
            document.getElementById('lm_opt_mon').classList.toggle('on', document.getElementById('lm_chk_monsters').checked);
            document.getElementById('lm_opt_boss').classList.toggle('on', document.getElementById('lm_chk_bosses').checked);
        };
        document.getElementById('lm_chk_monsters').addEventListener('change', syncOpts);
        document.getElementById('lm_chk_bosses').addEventListener('change', syncOpts);
        syncOpts();

        // Persist on change
        document.getElementById('lm_chk_monsters').addEventListener('change', (e) => {
            settings.attackLaunchMonsters = e.target.checked;
            persistAllSettings();
        });
        document.getElementById('lm_chk_bosses').addEventListener('change', (e) => {
            settings.attackLaunchBosses = e.target.checked;
            persistAllSettings();
        });

        bindTap(document.getElementById('lm_btn_start'), async () => {
            await startRun();
        });

        launchModal.style.display = 'block';
    }






    async function startRun(refresh = false) {
        loopController?.abort();

        loopController = new AbortController();
        const { signal } = loopController;

        sessionStorage.setItem(LOOP_KEY, settings.autoLoop);

        try {
            while (!signal.aborted) {

                let doMonsters = document.getElementById('lm_chk_monsters')?.checked;
                let doBosses = document.getElementById('lm_chk_bosses')?.checked;
                if (refresh) {
                    doMonsters = settings.attackLaunchMonsters;
                    doBosses = settings.attackLaunchBosses;
                }

                if (!doMonsters && !doBosses) {
                    addLog("⚠️ Select at least one option (Monsters or Bosses).");
                    return;
                }

                launchModal.style.display = 'none';
                running = true;
                sessionStorage.setItem(AUTO_RUNNING_KEY, 'true');
                setStatus('RUNNING');
                await saveCurrentAutofarmState();

                if (doMonsters && doBosses) {
                    // Run monsters first, then bosses sequentially
                    addLog("⚔️ Attack mode: Monsters + Bosses");
                    await executeAttackRun(false);
                    if (running) await executeBossAttackRun();
                } else if (doMonsters) {
                    addLog("⚔️ Attack mode: Monsters only");
                    await executeAttackRun();
                } else {
                    addLog("⚔️ Attack mode: Bosses only");
                    await executeBossAttackRun();
                }
                if (!settings.autoLoop) {
                    break;
                }

                await restoreAutofarmState();
                addLog(
                    `⏳ Waiting ${settings.loopInterval} minutes before next run...`
                );

                await sleep(
                    settings.loopInterval * 60 * 1000,
                    signal
                );
            }
        } catch (e) {
            if (e.name !== 'AbortError') {
                throw e;
            }
        } finally {
            await restoreAutofarmState();
            if (loopController?.signal === signal) {
                loopController = null;
            }
        }
    }
    function stopRun() {
        loopController?.abort();
    }

    /* ======================
       INVENTORY FETCHER
    ====================== */

    async function fetchInventoryIds() {
        try {
            const response = await safeFetch(INVENTORY_URL, { credentials: 'same-origin' });
            if (!response.ok) return;
            const html = await response.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');

            // FIX v2.1: use .potion-card[data-inv-id] structure
            const cards = doc.querySelectorAll('.potion-card');
            let settingsUpdated = false;

            cards.forEach(card => {
                const nameNode = card.querySelector('.potion-name span');
                if (!nameNode) return;
                const rawName = nameNode.textContent.trim();
                const invId = parseInt(card.dataset.invId, 10);
                if (!invId || Number.isNaN(invId)) return;

                if (rawName === 'Full Stamina Potion' && settings.fullStaminaPotionId !== invId) {
                    settings.fullStaminaPotionId = invId; settingsUpdated = true;
                }
                if (rawName === 'Large Stamina Potion' && settings.largeStaminaPotionId !== invId) {
                    settings.largeStaminaPotionId = invId; settingsUpdated = true;
                }
                if (rawName === 'Full Hp Potion' && settings.hpPotionId !== invId) {
                    settings.hpPotionId = invId; settingsUpdated = true;
                }
                if (rawName === 'Mana Potion S' && settings.manaPotionId !== invId) {
                    settings.manaPotionId = invId; settingsUpdated = true;
                }
            });

            if (settingsUpdated) {
                persistAllSettings();
                addLog("🎒 Auto-updated Potion IDs from Inventory.");
            }
        } catch (e) {
            addLog("⚠️ Failed to auto-fetch inventory IDs.");
        }
    }

    /* ======================
       PLAYER STATS PARSING
       FIX v2.1:
         HP  → .playerhp .muted  (was .player-resources .res-row .res-meta)
         EXP → last span of .gtb-exp-top  (was span:nth-child(2))
         Stamina → #stamina_span  (unchanged)
    ====================== */

    function extractPlayerStatsFromDoc(doc) {
        // HP
        let hp = null;
        const hpEl = doc.querySelector('.playerhp .muted');
        if (hpEl) {
            const raw = hpEl.textContent.trim().split('/')[0];
            const val = parseIntStrict(raw, NaN);
            hp = Number.isNaN(val) ? null : val;
        }

        // Stamina (unchanged)
        let stamina = null;
        const stamEl = doc.getElementById('stamina_span');
        if (stamEl) {
            const val = parseIntStrict(stamEl.textContent, NaN);
            stamina = Number.isNaN(val) ? null : val;
        }

        // EXP — .gtb-exp-top has two spans: ["EXP", "19,875,316 / 76,956,856"]
        let exp = null;
        const expSpans = doc.querySelectorAll('.gtb-exp-top span');
        if (expSpans.length >= 2) {
            const parts = expSpans[expSpans.length - 1].textContent.trim().split('/');
            if (parts.length === 2) {
                const current = parseIntStrict(parts[0], NaN);
                const max = parseIntStrict(parts[1], NaN);
                if (!Number.isNaN(current) && !Number.isNaN(max) && max !== 0) {
                    exp = { current, max, ratio: current / max };
                }
            }
        }

        return { hp, stamina, exp };
    }

    async function getPlayerStatsFromWave() {
        try {
            const response = await safeFetch(PLAYER_STATS_URL, { credentials: 'same-origin' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const html = await response.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            return extractPlayerStatsFromDoc(doc);
        } catch (err) {
            console.error('Stats fetch failed', err);
            return null;
        }
    }

    /* ======================
       API & POTIONS
    ====================== */

    async function usePotion(invId, label, quantity = 1) {
        if (!ENABLE_CALLS) { addLog(`[SIMULATION] Used ${label} (${invId})`); return true; }
        try {
            const response = await postForm(USE_ITEM_URL, { inv_id: invId, qty: quantity });
            const text = await response.text();
            if (text.includes('Item not found or not usable')) return false;
            return true;
        } catch (err) {
            addLog(`⚠️ [ERROR] ${label} request failed`);
            return false;
        }
    }

    let staminaChain = Promise.resolve(), staminaWaiters = 0;
    async function handleStaminaLogic() {
        const waited = staminaWaiters > 0;
        staminaWaiters++;
        const prev = staminaChain;
        let release;
        staminaChain = new Promise(r => { release = r; });
        try {
            await prev;
            if (!running) return false;
            if (waited && currentStamina > 0) return true; // another lane already refilled
            return await handleStaminaLogicInner();
        } finally { staminaWaiters--; release(); }
    }
    async function handleStaminaLogicInner() {
        let levelUp = await handleLootForLevelUp();
        const freshStats = await getPlayerStatsFromWave();
        if (freshStats) {
            applyStatsSnapshot(freshStats);
        }
        if (levelUp) {
            addLog('🌟 Level Up achieved after loot! Skipping stamina refill to avoid overfilling.');
        }
        if (freshStats.stamina > 0) return true;
        if (currentExpRatio >= settings.expThreshold) {
            addLog(`🔋 EXP Threshold reached (${(currentExpRatio * 100).toFixed(1)}%). Stopping.`);
            return false;
        }
        if (!settings.useLargeStamina && !settings.useFullStamina) {
            addLog('🚫 Stamina Refills disabled in settings. Stopping.');
            return false;
        }

        let success = false;
        if (settings.useLargeStamina && !largePotionsDepleted) {
            addLog('🧪 Consuming Large Stamina Potion...');
            success = await usePotion(settings.largeStaminaPotionId, 'Large Stamina Potion');
            if (!success) { addLog('⚠️ You are out of Large Stamina Potions. Marking as depleted.'); largePotionsDepleted = true; }
        }
        if (!success && settings.useFullStamina) {
            addLog('🧪 Consuming Full Stamina Potion...');
            success = await usePotion(settings.fullStaminaPotionId, 'Full Stamina Potion');
        }

        if (success) {
            staminaRefillsUsed++;
            persistSessionStats();
            addLog(`⚡ Stamina Refilled! Total Used: ${formatRefillCounter()}`);
            const fetchedStats = await getPlayerStatsFromWave();
            applyStatsSnapshot(fetchedStats, { syncHp: false, syncExp: false });
            return true;
        } else {
            addLog('⚠️ No usable Stamina Potions found.');
            return false;
        }
    }

    let healInFlight = null, lastHealDone = 0;
    async function refillHp() {
        if (healInFlight) { await healInFlight; return; }
        if (Date.now() - lastHealDone < 1200) return;
        healInFlight = refillHpInner();
        try { await healInFlight; } finally { healInFlight = null; lastHealDone = Date.now(); }
    }
    async function refillHpInner() {
        if (!ENABLE_CALLS) { addLog('💊 [SIMULATION] Using HP potion'); return; }
        addLog('💊 Using HP potion...');
        try { await postForm(HP_POT_URL, { inv_id: settings.hpPotionId }); }
        catch (err) { addLog('⚠️ HP potion request failed'); }
    }

    async function joinBattle(instanceId, dgmid) {
        if (!ENABLE_CALLS) { addLog(`[SIMULATION] Joined battle for dgmid: ${dgmid}`); return { success: true }; }
        const userId = getCookie('demon');
        if (!userId) { addLog("⚠️ No User ID found in cookies."); return { success: false, message: 'No User ID found' }; }
        try {
            const response = await postForm(JOIN_BATTLE_URL, { instance_id: instanceId, dgmid, user_id: userId });
            const text = await response.text();
            if (text.includes("You have successfully joined this battle.")) return { success: true };
            if (/already\s+joined|already\s+in\s+(?:this\s+)?battle/i.test(text)) {
                return { success: true, alreadyJoined: true };
            }
            if (text.includes("Invalid monster") || text.includes("already dead")) return { success: false, message: 'Monster dead or invalid' };
            return { success: false, message: 'Could not join' };
        } catch (err) { return { success: false, message: err.message }; }
    }

    async function performAttack(instanceId, dgmid, skillConfig) {
        if (!ENABLE_CALLS) {
            return { status: 'success', totaldmgdealt: 0, stamina: Math.max(0, currentStamina - skillConfig.cost), hp: { value: 100000 }, retaliation: { user_hp_after: 200000 } };
        }
        try {
            const response = await postForm(DAMAGE_URL, { instance_id: instanceId, dgmid, skill_id: skillConfig.id, stamina_cost: skillConfig.cost });
            if (response.ok || response.status === 400) return await response.json();
            throw new Error(`HTTP ${response.status}`);
        } catch (err) { return null; }
    }

    async function lootMonster(instanceId, dgmid) {
        if (!ENABLE_CALLS) { addLog(`[SIMULATION] Looted ${dgmid} in instance ${instanceId}`); return { status: 'success', rewards: { exp: 50000, gold: 100000 } }; }
        const userId = getCookie('demon');
        if (!userId) return { status: 'error', message: 'No User ID found' };
        try {
            const response = await postForm(LOOT_MONSTER_URL, { instance_id: instanceId, dgmid, user_id: userId });
            if (!response.ok) throw new Error(`Loot failed (${response.status})`);
            return await response.json();
        } catch (err) { return { status: 'error', message: err.message }; }
    }

    /* ======================
       EXTRACTION LOGIC
    ====================== */

    function extractDungeonIds(htmlString) {
        const doc = new DOMParser().parseFromString(htmlString, "text/html");
        const result = { active: { easy: [], hard: [], poly: [] }, ended: { easy: [], hard: [], poly: [] } };
        function reduceToHighest(arr) {
            if (arr.length < 2) return arr;
            return [Math.max(...arr)];
        }

        function processCards(selector, targetObj) {
            doc.querySelectorAll(selector).forEach(card => {
                const link = card.querySelector('a[href*="guild_dungeon_enter.php?id="]');
                const titleEl = card.querySelector('.h');
                if (link && titleEl) {
                    const id = new URL(link.href, window.location.origin).searchParams.get('id');
                    const t = titleEl.textContent.trim().toLowerCase();
                    if (t.includes('shadowbridge')) targetObj.easy.push(id);
                    else if (t.includes('castle')) targetObj.hard.push(id);
                    else if (t.includes('polyhedral')) targetObj.poly.push(id);
                }
            });
            targetObj.easy = reduceToHighest(targetObj.easy)
            targetObj.hard = reduceToHighest(targetObj.hard)
            targetObj.poly = reduceToHighest(targetObj.poly)
        }
        processCards('.grid:not(.ended) .card', result.active);
        processCards('.grid.ended .card', result.ended);
        return result;
    }

    async function fetchBossBattleData(instanceId, dgmid) {
        while (true) {
            try {
                const res = await safeFetch(
                    `${BASE_URL}/battle.php?dgmid=${dgmid}&instance_id=${instanceId}`,
                    { credentials: 'same-origin' }
                );

                if (!res.ok) {
                    await new Promise(r => setTimeout(r, 100));
                    continue;
                }

                const html = await res.text();
                const doc = new DOMParser().parseFromString(html, 'text/html');
                const dmgEl = doc.getElementById('yourDamageValue');

                if (dmgEl) {
                    const value = parseIntStrict(dmgEl.textContent, 0);

                    // return only when valid
                    if (value >= 0) {
                        return value;
                    }
                }
            } catch (e) {
                // ignore and retry
            }

            // small delay to avoid hammering the server
            await new Promise(r => setTimeout(r, 100));
        }
    }
    /* ======================
       MONSTER FETCHING
       FIX v2.1: Completely rewritten to match new HTML structure.

       New .mon layout:
         children[0] → <img>
         children[1] → info div
           children[0] → name container
             text nodes  → monster name  ← extracted via childNodes
             .row div     → pills (joined/not joined/no loot...)
             .pill span   → "dead"
           .bar, .muted (HP), .statrow, .muted (View btn)

       Pills on card:
         ALIVE not joined → ["not joined"]
         ALIVE joined     → ["joined"]
         DEAD  not joined → ["not joined", "no loot (not joined)", "dead"]
         DEAD  joined     → ["joined", "dead"]               ← LOOTABLE
         DEAD  joined+loot→ ["joined", "looted", "dead"]     ← LOOTED

       Locked location: header contains an element with class .locked
    ====================== */

    async function fetchMonstersFromLocation(instanceId, locId) {
        try {
            const url = `${LOC_URL}?instance_id=${instanceId}&location_id=${locId}`;
            const res = await safeFetch(url, { credentials: 'same-origin' });
            if (!res.ok) return [];

            const html = await res.text();
            const doc = new DOMParser().parseFromString(html, "text/html");
            const monsters = [];

            // FIX v2.1: locked detection — look for .locked element in page
            const headerPills = Array.from(doc.querySelectorAll('.wrap .row .pill')).map(p => p.textContent.trim().toLowerCase());
            const isInstanceActive = !headerPills.includes('view-only (ended)');
            const isLocked = headerPills.includes('locked');

            doc.querySelectorAll('.mon').forEach(card => {
                const dgmidLink = card.querySelector('a[href*="dgmid="]');
                const dgmid = dgmidLink ? new URL(dgmidLink.href, window.location.origin).searchParams.get('dgmid') : null;
                const isDead = card.classList.contains('dead');
                const pills = Array.from(card.querySelectorAll('.pill')).map(p => p.textContent.trim().toLowerCase());

                // FIX v2.1: name is in a direct text node of children[1].children[0]
                let name = "Unknown";
                const nameContainer = card.children[1]?.children[0];
                if (nameContainer) {
                    const textNode = Array.from(nameContainer.childNodes)
                    .find(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim().length > 0);
                    if (textNode) name = textNode.textContent.trim();
                }

                const imgEl = card.querySelector('img');
                const img = imgEl ? imgEl.src : '';

                // HP from .muted containing "HP"
                let currentHp = 0, maxHp = 0;
                const hpDiv = Array.from(card.querySelectorAll('.muted')).find(d => d.textContent.includes('HP'));
                if (hpDiv) {
                    const match = hpDiv.textContent.replace(/,/g, '').match(/(\d+)\s*\/\s*(\d+)/);
                    if (match) {
                        currentHp = parseIntStrict(match[1], 0);
                        maxHp = parseIntStrict(match[2], 0);
                    }
                }

                // FIX v2.1: category classification with new pill values
                const isJoined = pills.some(p => p === 'joined' || p.startsWith('joined ') || p.includes('already joined') || p.includes('in battle'));
                let category = 'UNKNOWN';
                if (!isDead && !isJoined) category = 'ALIVE_UNJOINED';
                else if (!isDead && isJoined) category = 'ALIVE_JOINED';
                else if (isDead && !isJoined) category = 'DEAD_UNJOINED';
                else if (isDead && isJoined && !pills.includes('looted')) category = 'DEAD_LOOTABLE';
                else if (isDead && isJoined && pills.includes('looted')) category = 'DEAD_LOOTED';

                monsters.push({ dgmid, name, img, category, isLocked, isDead, isJoined, locId, instanceId, currentHp, maxHp, isInstanceActive });
            });
            return monsters;
        } catch (e) {
            addLog(`⚠️ Failed reading ${LOCATION_NAMES[locId]}: ${e.stack}`);
            return [];
        }
    }

    /* ======================
       STRATEGY PARSER
    ====================== */

    // Damage caps are shown/stored as full numbers (10,000,000), never 10M / 1.2B.
    function fullCap(raw) {
        const n = parseCountWithSuffix(String(raw ?? ''), NaN);
        return Number.isFinite(n) && n > 0 ? n.toLocaleString('en-US') : String(raw ?? '').trim();
    }
    function normalizeSavedCaps() {
        let changed = false;
        for (const bag of [settings.monsterAttackCap, settings.bossCaps]) {
            if (!bag) continue;
            for (const k of Object.keys(bag)) { const v = fullCap(bag[k]); if (v !== bag[k]) { bag[k] = v; changed = true; } }
        }
        if (changed) persistAllSettings();
    }
    normalizeSavedCaps();
    document.addEventListener('change', e => {   // typed 10M / 1.2B -> rewritten as 10,000,000 / 1,200,000,000
        const el = e.target;
        if (el && el.classList && (el.classList.contains('ac-mon-cap') || el.classList.contains('bc-cap'))) el.value = fullCap(el.value);
    }, true);
    function parseCountWithSuffix(rawValue, fallback = 1) {
        let text = String(rawValue ?? '').trim().toUpperCase().replace(/[_\s]/g, '');
        if (/^\d{1,3}(,\d{3})+$/.test(text)) text = text.replace(/,/g, ''); // 10,000,000 -> 10000000
        text = text.replace(/,/g, '.'); // 1,5M -> 1.5M
        if (!text) return fallback;
        const match = text.match(/^(\d+(?:\.\d+)?)\s*([KMB])?$/);
        if (!match) return fallback;
        const base = parseFloat(match[1]);
        if (!Number.isFinite(base)) return fallback;
        const multipliers = { K: 1e3, M: 1e6, B: 1e9 };
        const value = Math.round(base * (match[2] ? multipliers[match[2]] : 1));
        return Number.isFinite(value) ? value : fallback;
    }

    function parseStrategy(monsterName) {
        const key = monsterName.toLowerCase();
        const lsCount = parseIntStrict(settings.monsterAttackLS?.[key] || settings.monsterAttackLS?.['default'] || '5', 5);
        const skillKey = settings.monsterAttackSkill?.[key] || settings.monsterAttackSkill?.['default'] || 'POWER_SLASH';
        const capRaw = settings.monsterAttackCap?.[key] ?? settings.monsterAttackCap?.['default'] ?? '0';
        const cap = parseCountWithSuffix(String(capRaw), 0);
        const skillDef = SKILLS[skillKey] || CLASS_SKILLS[skillKey] || SKILLS.POWER_SLASH;
        const smartAttack = settings.monsterAttackSmart?.[key] ?? false;

        if (!skillDef) return { plan: [], cap: Infinity, error: `Unknown skill "${skillKey}" for "${monsterName}".` };

        const plan = [];
        for (let i = 0; i < lsCount; i++) plan.push(skillDef);
        if (!plan.length) return { plan: [], cap: Infinity, error: `Strategy for "${monsterName}" has no valid skills.` };
        return { plan, cap: cap > 0 ? cap : Infinity, error: null, smartAttack: smartAttack };
    }

    const SKILL_FALLBACK_ORDER = [
        'WORLD_BREAKER_SLASH',
        'LEGENDARY_SLASH',
        'ULTIMATE_SLASH',
        'HEROIC_SLASH',
        'POWER_SLASH',
        'SLASH'
    ];

    function buildFallbackSkillPlan(currentStaminaValue, preferredSkill) {
        const preferredCost = preferredSkill?.cost ?? 1;
        let remaining = parseIntStrict(currentStaminaValue, 0);
        if (remaining <= 0) return [];
        if (remaining >= preferredCost) return [preferredSkill];

        const plan = [];
        for (const skillKey of SKILL_FALLBACK_ORDER) {
            const skill = SKILLS[skillKey];
            if (!skill) continue;
            if (skill.cost > preferredCost) continue;
            while (remaining >= skill.cost) {
                plan.push(skill);
                remaining -= skill.cost;
            }
            if (remaining === 0) break;
        }
        return plan;
    }

    function summarizeSkillPlan(plan) {
        const counts = new Map();
        plan.forEach(skill => {
            const key = skill.cost;
            counts.set(key, (counts.get(key) || 0) + 1);
        });
        return [...counts.entries()]
            .sort((a, b) => b[0] - a[0])
            .map(([cost, count]) => `${count}x${cost}`)
            .join(', ');
    }

    async function executeAttackSkill(instanceId, dgmid, skill, totalBeforeHit = 0) {
        let attackResult = await performAttack(instanceId, dgmid, skill);

        if (!attackResult || attackResult.status !== 'success') {
            const errorMsg = String(attackResult?.message ?? 'Network Error');
            if (errorMsg.includes('Not enough stamina')) {
                return { ok: false, reason: 'stamina', message: errorMsg };
            }
            if (errorMsg.includes('You are dead')) {
                addLog('💊 HP Critical! Healing...');
                await refillHp();
                const retryResult = await performAttack(instanceId, dgmid, skill);
                if (!retryResult || retryResult.status !== 'success') {
                    return {
                        ok: false,
                        reason: 'error',
                        message: `Retry after heal failed: ${String(retryResult?.message ?? 'Network Error')}`
                    };
                }
                attackResult = retryResult;
            } else if (errorMsg.includes('Not enough mana')) {
                const replenished = await usePotion(settings.manaPotionId, 'Small Mana Potion', 2);
                addLog('🔋 Not enough mana. Using 2 small mana potions...');
                const retryResult = await performAttack(instanceId, dgmid, skill);
                if (!retryResult || retryResult.status !== 'success') {
                    return {
                        ok: false,
                        reason: 'error',
                        message: `Retry after mana replenish failed: ${String(retryResult?.message ?? 'Network Error')}`
                    };
                }
                attackResult = retryResult;

            } else {
                return { ok: false, reason: 'error', message: errorMsg };
            }
        }

        if (attackResult.stamina !== undefined) {
            currentStamina = parseIntStrict(attackResult.stamina, currentStamina);
        }

        const hpAfterHit = attackResult.retaliation?.user_hp_after;
        if (hpAfterHit !== undefined && hpAfterHit !== null) {
            lastKnownHp = parseIntStrict(hpAfterHit, lastKnownHp);
            if (lastKnownHp <= settings.hpThreshold) {
                addLog(`💊 HP Critical (${lastKnownHp})! Healing...`);
                await refillHp();
            }
        }

        updateUiTextOnly();

        const totaldmgdealt = parseIntStrict(attackResult.totaldmgdealt, 0);
        const safeTotalBeforeHit = Math.max(0, parseIntStrict(totalBeforeHit, 0));

        if (totaldmgdealt == 0 || totaldmgdealt <= safeTotalBeforeHit) {
            stopAutomation(`Total damage dealt is 0 or less than or equal to the damage before the hit.`, true);
            return;
        }

        return {
            ok: true,
            hitDmg: totaldmgdealt - safeTotalBeforeHit,
            totalDmg: totaldmgdealt,
            targetHp: parseIntStrict(attackResult.hp?.value, Number.MAX_SAFE_INTEGER)
        };
    }

    /* ======================
        ATTACK LOGIC (REGULAR MOBS)
    ====================== */

    async function executeAttackRun(stopWhenFinished = true) {
        setStatus('RUNNING');
        gribbleSetApplied = false;
        addLog("⚔️ Starting Attack Run...");
        const fetchedStats = await getPlayerStatsFromWave();
        if (fetchedStats) applyStatsSnapshot(fetchedStats);

        try {
            const res = await safeFetch(DUNGEONS_URL, { credentials: 'same-origin' });
            const html = await res.text();
            const ids = extractDungeonIds(html);

            const scanTargets = [];
            ids.active.easy.forEach(id => scanTargets.push({ id, type: 'shadowbridge', locs: SHADOWBRIDGE_LOCS }));
            ids.active.hard.forEach(id => scanTargets.push({ id, type: 'castle', locs: CASTLE_MOB_LOCS }));
            ids.active.poly.forEach(id => scanTargets.push({ id, type: 'polyhedral', locs: POLYHEDRAL_MOB_LOCS }));

            if (scanTargets.length === 0) { stopAutomation("No active dungeon found (Shadowbridge or Castle)."); return; }

            addLog(`🔍 Scanning ${scanTargets.length} dungeon(s)...`);
            const scanned = await Promise.all(scanTargets.map(async d => ({
                d, locData: await Promise.all(d.locs.map(l => fetchMonstersFromLocation(d.id, l)))
            })));
            const candidates = [];
            scanned.forEach(({ d, locData }) => locData.forEach(monsters => monsters.forEach(m => {
                if (!m.isDead && !m.isLocked && !!m.dgmid && settings.monsterAttackEnabled?.[m.name.toLowerCase()] === true)
                    candidates.push({ dungeonId: d.id, t: m });
            })));
            candidates.sort((x, y) => Number(y.t.isJoined) - Number(x.t.isJoined)); // already-started mobs first
            const picked = {}, limitLogged = new Set(), queue = [];
            for (const c of candidates) {
                const nameKey = c.t.name.toLowerCase();
                const maxMobs = parseIntStrict(settings.monsterAttackMax?.[nameKey], 0);
                if (maxMobs > 0 && (picked[nameKey] || 0) >= maxMobs) {
                    if (!limitLogged.has(nameKey)) { limitLogged.add(nameKey); addLog(`⏭️ ${c.t.name}: limit of ${maxMobs} reached, skipping the rest.`); }
                    continue;
                }
                const strat = parseStrategy(c.t.name);
                if (strat.error) { stopAutomation(`Strategy setup issue: ${strat.error}`); return; }
                picked[nameKey] = (picked[nameKey] || 0) + 1;
                queue.push({ ...c, strat });
            }
            if (settings.gribbleSetEnabled && !gribbleSetApplied && queue.some(q => q.t.name.toLowerCase().includes('gribble junk-magus'))) {
                addLog(`🛡️ Gribble Junk-Magus found — switching to set "${settings.gribbleSetName}"...`);
                const r = await applyQuickSet(settings.gribbleSetName);
                if (!r.ok) {
                    stopAutomation(`Gear switch failed: ${r.msg}`, true);
                    showPopup({ type: 'warn', title: 'Could not switch set', message: r.msg, todo: 'Automation was stopped so you do not attack with the wrong gear. Check the set name in Settings, then press Attack again.' });
                    return;
                }
                gribbleSetApplied = true;
                addLog(`🛡️ Set "${settings.gribbleSetName}" applied.`);
            }
            if (queue.length > 0) {
                addLog(`⚡ TURBO: ${queue.length} target(s), ${Math.min(getTurbo(), queue.length)} at once.`);
                setStatus('FIGHTING');
                await runPool(queue, getTurbo(), q => processAttackOnMonster(q.dungeonId, q.t, q.strat));
            }
            await restoreMainSet();
            if (running && stopWhenFinished) stopAutomation("Attack Run Complete. No targets left.");
            if (running && !stopWhenFinished) addLog("⚔️ Monster Attack Run Complete..");
        } catch (e) { await restoreMainSet(); stopAutomation(`Attack run error: ${e.stack}`); }
    }

    // ===== QUICK SET SWITCHER (calls the game's own quick_sets_apply.php) =====
    var gribbleSetApplied = false;
    const QUICK_SET_URL = 'https://demonicscans.org/quick_sets_apply.php';
    const cleanSetName = n => String(n || '').replace(/\s*[-–—]\s*gear\s*$/i, '').trim();

    // Finds the set number (1-6) from the Quick Sets drawer by its exact name
    async function findQuickSetNumber(rawName) {
        const wanted = cleanSetName(rawName).toLowerCase();
        if (!wanted) return null;
        const scan = root => [...root.querySelectorAll('.qs-set-btn[data-apply-type="equipments"]')]
            .find(b => (b.dataset.setName || '').trim().toLowerCase() === wanted)?.dataset.setNumber || null;
        let n = scan(document);
        if (n) return n;
        try { // drawer not on this page -> read it from the guild dashboard
            const html = await (await safeFetch(BASE_URL + '/guild_dash.php', { credentials: 'same-origin' })).text();
            return scan(new DOMParser().parseFromString(html, 'text/html'));
        } catch (e) { return null; }
    }

    async function applyQuickSet(rawName) {
        const name = cleanSetName(rawName);
        if (!name) return { ok: false, msg: 'No set name entered in Settings.' };
        const setNumber = await findQuickSetNumber(name);
        if (!setNumber) return { ok: false, msg: `Set "${name}" was not found in your Quick Sets. Check the spelling in Settings.` };
        if (!ENABLE_CALLS) { addLog(`🧪 [DEBUG] Would apply set #${setNumber} "${name}"`); return { ok: true }; }
        try {
            const res = await safeFetch(QUICK_SET_URL, {
                method: 'POST',
                headers: FORM_HEADERS,
                body: new URLSearchParams({ set_number: setNumber, target_set: 'attack', apply_type: 'equipments' }).toString(),
                credentials: 'same-origin'
            });
            const txt = (await res.text()).trim();
            if (!/^success/i.test(txt)) return { ok: false, msg: `The game refused the set switch: ${txt.slice(0, 120) || 'empty reply'}` };
            const items = /equipped_items=(\d+)/i.exec(txt)?.[1];
            addLog(`🛡️ Set "${name}" (#${setNumber}) equipped${items ? ` — ${items} items` : ''}.`, true);
            try { const st = await getPlayerStatsFromWave(); if (st) applyStatsSnapshot(st); } catch (e) { /* stats refresh is optional */ }
            return { ok: true };
        } catch (e) {
            return { ok: false, msg: `Network error while switching set: ${e.message || e}` };
        }
    }

    // Puts the main set back after the Gribble run
    async function restoreMainSet() {
        if (!gribbleSetApplied) return;
        gribbleSetApplied = false;
        if (!settings.mainSetEnabled) return;
        if (!cleanSetName(settings.mainSetName)) { addLog('⚠️ Main set switch-back is on but no main set name is saved.'); return; }
        addLog(`🛡️ Attacks finished — switching back to main set "${cleanSetName(settings.mainSetName)}"...`);
        const r = await applyQuickSet(settings.mainSetName);
        if (!r.ok) {
            addLog(`⚠️ Could not switch back to main set: ${r.msg}`);
            showToast('Could not switch back to your main set — please do it manually.', 'error', 8000);
        }
    }

    function getClosestSkill(cost) {
        return Object.values(SKILLS)
            .sort((a, b) => b.cost - a.cost) // highest → lowest
            .find(skill => skill.cost <= cost) || SKILLS.SLASH;
    }

    async function gribbleDmgCheck(dmg, instanceId, id) {
        const uiDmgDealt = await fetchBossBattleData(instanceId, id);
        if (uiDmgDealt != dmg) {
            stopAutomation(`⚠️ Gribble damage mismatch detected for dgmid ${id}. Server shows ${uiDmgDealt} while attack reported ${dmg}.`, true);
            showPopup({ type: 'error', title: "Damage doesn't match",
                message: `The game shows ${uiDmgDealt.toLocaleString()} damage on Gribble #${id}, but the attack reported ${dmg.toLocaleString()}.`,
                todo: 'Automation was stopped to protect your reward. Open that monster, check the damage, then press Attack again.' });
            return;
        }
        if (dmg > GRIBBLE_OVERDAMAGE_LIMIT) {
            stopAutomation(`⚠️ Gribble damage limit exceeded for dgmid ${id}. damage: ${dmg}`, true);
            showPopup({ type: 'warn', title: 'Too much damage on Gribble',
                message: `Gribble #${id} took ${dmg.toLocaleString()} damage, which is above the safe limit of ${GRIBBLE_OVERDAMAGE_LIMIT.toLocaleString()}.`,
                todo: 'Automation was stopped. Check this monster manually before continuing.' });
            return;
        }
    }
    async function processAttackOnMonster(instanceId, monster, preParsedStrat = null) {
        const strat = preParsedStrat || parseStrategy(monster.name);
        // Safe mode (default): old Gribble rules (hit once to the 1M reward minimum, 3M safety stop).
        // With 'gribbleUseCap' on, Gribble is treated like any other monster and uses your own damage cap.
        const isGribble = monster.name.toLowerCase().includes('gribble junk-magus') && !settings.gribbleUseCap;
        if (strat.error) { stopAutomation(`Strategy setup issue: ${strat.error}`); return; }

        // Join battle first (needed to fetch existing damage)
        // Join battle only if not already joined
        if (!monster.isJoined) {
            const joinRes = await joinBattle(instanceId, monster.dgmid);
            if (!joinRes.success) { addLog(`⏭️ Skipping ${monster.name} - ${joinRes.message}`); return; }
        }

        // Fetch existing damage to respect the cap from the start
        const existingDmg = await fetchBossBattleData(instanceId, monster.dgmid);
        let dmgDealt = existingDmg;
        if (isGribble && isGribbleHit(monster.dgmid)) {
            addLog(`⏭️ Skipping ${monster.name}: already hit once (${dmgDealt.toLocaleString()} dmg, safe-mode target ${GRIBBLE_REWARD_REQ.toLocaleString()}).`);
            if (dmgDealt < GRIBBLE_REWARD_REQ) {
                stopAutomation(`⚠️ Gribble damage insufficient for reward for dgmid ${monster.dgmid}. damage: ${dmgDealt}`, true);
                showPopup({ type: 'warn', title: 'Not enough damage for a reward',
                    message: `Gribble #${monster.dgmid} only has ${dmgDealt.toLocaleString()} damage. It needs at least ${GRIBBLE_REWARD_REQ.toLocaleString()} to give loot.`,
                    todo: 'Automation was stopped. Hit this monster manually, then press Attack again.' });
            }
            return;

        }
        if (isGribble && dmgDealt > GRIBBLE_OVERDAMAGE_LIMIT) {
            stopAutomation(`⚠️ Gribble damage limit exceeded for dgmid ${monster.dgmid}. damage: ${dmgDealt}`, true);
            return;
        }

        if (isGribble) {
            strat.cap = GRIBBLE_REWARD_REQ;
        }

        if (strat.cap !== Infinity && dmgDealt >= strat.cap) {
            if (isGribble) addGribbleId(monster.dgmid);
            addLog(`⏭️ Skipping ${monster.name}: cap already reached (${dmgDealt.toLocaleString()} / ${strat.cap.toLocaleString()}).`);
            return;
        }

        addLog(`🎯 Targeting: ${monster.name} | Hits: ${strat.plan.length} | Cap: ${strat.cap === Infinity ? 'None' : strat.cap.toLocaleString()}${existingDmg > 0 ? ` | Existing dmg: ${existingDmg.toLocaleString()}` : ''}`);
        let slashDmg = 0
        let staminaUsed = 0;
        while (true && strat.smartAttack) {
            const result = await executeAttackSkill(instanceId, monster.dgmid, SKILLS.SLASH, dmgDealt);
            if (!result.ok) {
                if (result.reason === 'stamina') {
                    addLog('🔋 Server: not enough stamina. Using potion...');
                    const replenished = await handleStaminaLogic();
                    if (!replenished) { stopAutomation('Server reported not enough stamina and refill failed.'); return; }
                    continue;
                }
                addLog(`🚫 Attack error: ${result.message}. Moving to next monster.`);
                break;
            }
            slashDmg = result.hitDmg;
            dmgDealt = result.totalDmg
            staminaUsedPerDungeon[instanceId] = (staminaUsedPerDungeon[instanceId] || 0) + 1;
            saveStaminaUsedPerDungeon();
            staminaUsed++;
            break;
        }
        let i = 0;
        while ((slashDmg > 0 && strat.smartAttack) || (!strat.smartAttack && i < strat.plan.length)) {
            if (!running) break;

            // Check cap BEFORE launching the attack
            if (strat.cap !== Infinity && dmgDealt >= strat.cap) {
                addLog(`🚫 Cap reached (${dmgDealt.toLocaleString()} / ${strat.cap.toLocaleString()}). Moving to next.`);
                if (isGribble) addGribbleId(monster.dgmid);
                break;
            }
            let skill = strat.plan[i];
            i++;
            if (strat.smartAttack) {
                const remainingDmg = strat.cap - dmgDealt;
                const skillCost = remainingDmg / slashDmg;
                skill = getClosestSkill(skillCost);
            }
            if (isGribble) {
                skill = SKILLS.SLASH;
            }

            // If selected skill is too expensive for the current remainder,
            // spend all remaining stamina using a descending fallback sequence.
            if (currentStamina < skill.cost) {
                const fallbackPlan = buildFallbackSkillPlan(currentStamina, skill);
                if (fallbackPlan.length > 0) {
                    addLog(`⚡ Auto-using remaining stamina (${currentStamina}) with fallback slashes: ${summarizeSkillPlan(fallbackPlan)}.`);

                    for (let j = 0; j < fallbackPlan.length; j++) {
                        if (!running) break;
                        if (strat.cap !== Infinity && dmgDealt >= strat.cap) {
                            if (isGribble) addGribbleId(monster.dgmid);
                            addLog(`🚫 Cap reached (${dmgDealt.toLocaleString()} / ${strat.cap.toLocaleString()}). Moving to next.`);
                            break;
                        }

                        const fallbackSkill = fallbackPlan[j];
                        const fallbackResult = await executeAttackSkill(instanceId, monster.dgmid, fallbackSkill, dmgDealt);
                        if (!fallbackResult.ok) {
                            if (fallbackResult.reason === 'stamina') {
                                addLog('🔋 Server rejected fallback hit due to stamina mismatch. Refreshing stamina...');
                                const refreshed = await getPlayerStatsFromWave();
                                if (refreshed) applyStatsSnapshot(refreshed, { syncHp: false, syncExp: false });
                                break;
                            }
                            addLog(`🚫 Attack error: ${fallbackResult.message}. Moving to next monster.`);
                            return;
                        }

                        dmgDealt = fallbackResult.totalDmg;
                        if (isGribble) {
                            await gribbleDmgCheck(dmgDealt, instanceId, monster.dgmid);
                        }
                        slashDmg = Math.max(slashDmg, fallbackResult.hitDmg / fallbackSkill.cost); // update slashDmg estimate based on fallback performance
                        staminaUsed += fallbackSkill.cost;
                        staminaUsedPerDungeon[instanceId] = (staminaUsedPerDungeon[instanceId] || 0) + fallbackSkill.cost;
                        saveStaminaUsedPerDungeon();

                        addLog(`🗡️ Fallback ${j + 1}/${fallbackPlan.length} OK. Hit for ${fallbackResult.hitDmg.toLocaleString()} dmg! (Total: ${dmgDealt.toLocaleString()})`);
                        if (fallbackResult.targetHp <= 0) {
                            addLog(`💀 ${monster.name} Defeated!`);
                            return;
                        }
                    }
                    continue;
                }

                addLog(`🔋 Not enough stamina for ${skill.cost}-cost skill (have ${currentStamina}). Using potion...`);
                const replenished = await handleStaminaLogic();
                if (!replenished) { stopAutomation("Out of stamina and no potion available."); return; }
                i--;
                continue;
            }

            const result = await executeAttackSkill(instanceId, monster.dgmid, skill, dmgDealt);
            if (!result.ok) {
                if (result.reason === 'stamina') {
                    addLog('🔋 Server: not enough stamina. Using potion...');
                    const replenished = await handleStaminaLogic();
                    if (!replenished) { stopAutomation('Server reported not enough stamina and refill failed.'); return; }
                    i--;
                    continue;
                }
                addLog(`🚫 Attack error: ${result.message}. Moving to next monster.`);
                break;
            }

            dmgDealt = result.totalDmg;
            if (isGribble) {
                await gribbleDmgCheck(dmgDealt, instanceId, monster.dgmid);
            }
            slashDmg = Math.max(slashDmg, result.hitDmg / skill.cost);
            staminaUsed += skill.cost;
            staminaUsedPerDungeon[instanceId] = (staminaUsedPerDungeon[instanceId] || 0) + skill.cost;
            saveStaminaUsedPerDungeon();
            if (strat.smartAttack) {
                addLog(`🗡️ Attack Used ${skill.cost} Stamina! Hit for ${result.hitDmg.toLocaleString()} dmg! (Total: ${dmgDealt.toLocaleString()} / ${strat.cap})`);
            } else {
                addLog(`🗡️ Attack ${i + 1}/${strat.plan.length} OK. Hit for ${result.hitDmg.toLocaleString()} dmg! (Total: ${dmgDealt.toLocaleString()})`);
            }
            if (result.targetHp <= 0) { addLog(`💀 ${monster.name} Defeated!`); break; }
        }
    }

    /* ======================
       BOSS MANAGER LOGIC
    ====================== */

    async function openBossManager() {
        bossModal.id = 'bossModal';
        bossModal.style.width = 'min(760px, 96vw)';
        bossModal.innerHTML = `
            <div class="ds-modal-header">
                <div class="sh-mhead-title boss"><div class="ico">👿</div><div><h3>Boss Command</h3><small>Scanning boss rooms…</small></div></div>
                <span class="sh-x" id="bm_close_load" title="Close">✕</span>
            </div>
            <div class="ds-modal-body sh-loading"><div class="sh-spin"></div><p>Fetching active dungeons and scanning boss rooms…</p></div>
        `;
        bossModal.style.display = 'block';
        bossModal.querySelector('#bm_close_load').onclick = () => { bossModal.style.display = 'none'; };
        try {
            const res = await safeFetch(DUNGEONS_URL, { credentials: 'same-origin' });
            const html = await res.text();
            const ids = extractDungeonIds(html);
            const bossTasks = [];
            ids.active.easy.forEach(id => bossTasks.push({ id, loc: 5 }));
            ids.active.hard.forEach(id => { CASTLE_BOSS_LOCS.forEach(loc => bossTasks.push({ id, loc })); });
            ids.active.poly.forEach(id => bossTasks.push({ id, loc: 14 }));
            const locResults = await Promise.all(bossTasks.map(t => fetchMonstersFromLocation(t.id, t.loc)));
            const aliveBosses = [], dmgTasks = [];
            locResults.forEach(mons => {
                mons.forEach(b => {
                    if (!b.isDead) {
                        aliveBosses.push(b);
                        if (b.isJoined && !b.isLocked && b.dgmid) {
                            dmgTasks.push(fetchBossBattleData(b.instanceId, b.dgmid).then(dmg => b.damageDealt = dmg));
                        } else { b.damageDealt = 0; }
                    }
                });
            });
            await Promise.all(dmgTasks);
            renderBossModal(aliveBosses);
        } catch (e) {
            bossModal.innerHTML = `
                <div class="ds-modal-header">
                    <div class="sh-mhead-title boss"><div class="ico">👿</div><div><h3>Boss Command</h3><small>Something went wrong</small></div></div>
                </div>
                <div class="ds-modal-body">⚠️ Error:<pre style="white-space:pre-wrap; font-size:11px; color:#ff8fa3;">${shEsc(e.stack)}</pre></div>
                <div class="sh-mfoot"><span></span><button id="bm_close_err" class="sh-ghost">Close</button></div>`;
            bossModal.querySelector('#bm_close_err').onclick = () => { bossModal.style.display = 'none'; };
        }
    }

    function renderBossModal(bosses) {
        let listCards = '';
        let joinedCount = 0, totalDmg = 0;
        bosses.forEach(b => {
            if (b.isJoined) joinedCount++;
            totalDmg += (b.isJoined ? (b.damageDealt || 0) : 0);
            const pill = b.isLocked ? '<span class="sh-spill locked">🔒 Locked</span>'
                : b.isJoined ? '<span class="sh-spill joined">✔ Joined</span>'
                : '<span class="sh-spill idle">Not joined</span>';
            const dmgText = b.isJoined ? (b.damageDealt || 0).toLocaleString() : '0';
            const hpText = (b.currentHp !== undefined) ? b.currentHp.toLocaleString() : '0';
            const nameHtml = b.isLocked
                ? `<span class="sh-bname">${shEsc(b.name)}</span>`
                : `<span class="sh-bname link" onclick="window.openUrl('https://demonicscans.org/battle.php?dgmid=${b.dgmid}&instance_id=${b.instanceId}', '_blank')">${shEsc(b.name)}</span>`;
            listCards += `
                <div class="sh-bosscard">
                    <img class="sh-bimg" src="${shEsc(b.img)}" alt="">
                    <div class="sh-binfo">
                        ${nameHtml}
                        <small>${shEsc(LOCATION_NAMES[b.locId])} · Inst #${b.instanceId}</small>
                        <div class="sh-bstats">
                            <span class="sh-bs hp" title="Boss HP">❤ ${hpText}</span>
                            <span class="sh-bs dmg" title="My damage">⚔ ${dmgText}</span>
                            <span class="sh-bs stam" title="Stamina used">💪 ${staminaUsedPerBoss[b.dgmid] || 0}</span>
                        </div>
                    </div>
                    ${pill}
                </div>`;
        });

        let capsCards = '';
        BOSS_LIST.forEach(bossName => {
            const cap = settings.bossCaps[bossName.toLowerCase()] ?? '0';
            capsCards += createBossCapRowHTML(bossName, cap);
        });

        bossModal.id = 'bossModal';
        bossModal.style.width = 'min(760px, 96vw)';
        bossModal.innerHTML = `
            <div class="ds-modal-header">
                <div class="sh-mhead-title boss">
                    <div class="ico">👿</div>
                    <div><h3>Boss Command</h3><small>See who's alive · choose who to attack</small></div>
                </div>
                <span class="sh-x" id="bm_close" title="Close">✕</span>
            </div>
            <div class="ds-modal-body">
                <div class="sh-seg">
                    <button class="active" data-tab="bm_list">📜 Alive bosses</button>
                    <button data-tab="bm_caps">⚙️ Attack settings</button>
                </div>

                <div id="bm_list" class="sh-panel active">
                    <div class="sh-summary">
                        <div><b>${bosses.length}</b><span>Alive</span></div>
                        <div><b>${joinedCount}</b><span>Joined</span></div>
                        <div><b>${fmtCompact(totalDmg)}</b><span>My damage</span></div>
                    </div>
                    <div class="sh-blist">${listCards || '<div class="sh-empty">No alive bosses found.</div>'}</div>
                </div>

                <div id="bm_caps" class="sh-panel">
                    <div class="sh-toolbar" style="margin-bottom:10px;">
                        <span style="color:var(--sh-mute); font-size:11.5px;">Flip a switch to attack a boss. Type the full number, e.g. <b style="color:#ffc857;">3,000,000,000</b> or <b style="color:#ffc857;">2100000</b>.</span>
                        <span style="margin-left:auto; display:flex; gap:6px;">
                            <button id="bm_all_on" class="sh-tbtn">All on</button>
                            <button id="bm_all_off" class="sh-tbtn">All off</button>
                        </span>
                    </div>
                    <div class="sh-blist" id="tbd_boss_caps">${capsCards}</div>
                </div>
            </div>
            <div class="sh-mfoot">
                <span class="sh-saved" id="bm_saved">✓ Saved automatically</span>
                <div style="display:flex; gap:8px;">
                    <button id="btn_sav_boss_caps" class="sh-primary">💾 Save</button>
                    <button id="bm_done" class="sh-ghost">Close</button>
                </div>
            </div>
        `;

        const closeModal = () => { bossModal.style.display = 'none'; };
        bossModal.querySelector('#bm_close').onclick = closeModal;
        bossModal.querySelector('#bm_done').onclick = closeModal;

        // Tabs
        bossModal.querySelectorAll('.sh-seg button').forEach(btn => {
            btn.onclick = () => {
                bossModal.querySelectorAll('.sh-seg button').forEach(b => b.classList.toggle('active', b === btn));
                bossModal.querySelectorAll('.sh-panel').forEach(p => p.classList.toggle('active', p.id === btn.dataset.tab));
            };
        });

        const capsEl = bossModal.querySelector('#tbd_boss_caps');
        const refreshLook = () => {
            capsEl.querySelectorAll('.sh-mcard').forEach(c => c.classList.toggle('on', c.querySelector('.bc-atk').checked));
        };
        refreshLook();

        let savedFlashTimer = null;
        function collectAndSave(announce) {
            const newCaps = {}, newEnabled = {}, newLS = {}, newSkill = {}, newSmartAttack = {};
            capsEl.querySelectorAll('.sh-mcard').forEach(card => {
                const name = (card.querySelector('.bc-name')?.getAttribute('data-realname') || '').toLowerCase();
                if (!name) return;
                newCaps[name] = card.querySelector('.bc-cap').value.trim() || '0';
                newLS[name] = card.querySelector('.bc-ls').value.trim() || '30';
                newSkill[name] = card.querySelector('.bc-skill').value || 'LEGENDARY_SLASH';
                newEnabled[name] = card.querySelector('.bc-atk')?.checked ?? false;
                newSmartAttack[name] = card.querySelector('.bc-smart')?.checked ?? false;
            });
            settings.bossCaps = newCaps;
            settings.bossAttackLS = newLS;
            settings.bossAttackSkill = newSkill;
            settings.bossAttackEnabled = newEnabled;
            settings.bossAttackSmart = newSmartAttack;
            persistAllSettings();
            if (announce) addLog("✅ Boss Attack Settings Saved!");
            const el = bossModal.querySelector('#bm_saved');
            if (el) {
                el.classList.add('show');
                clearTimeout(savedFlashTimer);
                savedFlashTimer = setTimeout(() => el.classList.remove('show'), 1400);
            }
        }

        capsEl.addEventListener('change', () => { refreshLook(); collectAndSave(false); });
        capsEl.addEventListener('click', (e) => {
            const step = e.target.closest('.sh-step');
            if (!step) return;
            const input = step.parentElement.querySelector('.bc-ls');
            input.value = String(Math.max(1, parseIntStrict(input.value, 30) + parseInt(step.dataset.d, 10)));
            collectAndSave(false);
        });
        bossModal.querySelector('#bm_all_on').onclick = () => {
            capsEl.querySelectorAll('.bc-atk').forEach(c => { c.checked = true; });
            refreshLook(); collectAndSave(false);
        };
        bossModal.querySelector('#bm_all_off').onclick = () => {
            capsEl.querySelectorAll('.bc-atk').forEach(c => { c.checked = false; });
            refreshLook(); collectAndSave(false);
        };
        bossModal.querySelector('#btn_sav_boss_caps').onclick = () => collectAndSave(true);
    }

    function createBossCapRowHTML(name, cap) {
        const key = name.toLowerCase();
        const checked = settings.bossAttackEnabled[key] ? 'checked' : '';
        const ls = settings.bossAttackLS[key] ?? '30';
        const skill = settings.bossAttackSkill[key] ?? 'LEGENDARY_SLASH';
        const smartAttack = settings.bossAttackSmart?.[key] ? 'checked' : '';
        const allSkillOpts = [
            ['LEGENDARY_SLASH', 'LS — Legendary Slash (200)'],
            ['ULTIMATE_SLASH', 'US — Ultimate Slash (100)'],
            ['WORLD_BREAKER_SLASH', 'WBS — World Breaker Slash (1000)'],
            ...Object.keys(CLASS_SKILLS).map(skill => [skill, skill])
        ];
        const availableSkills = key === 'prince grixkar the hybrid'
            ? allSkillOpts.filter(([val]) => val !== 'WORLD_BREAKER_SLASH')
            : allSkillOpts;
        const skillOpts = availableSkills.map(([val, label]) =>
            `<option value="${val}" ${skill === val ? 'selected' : ''}>${label}</option>`
        ).join('');
        const info = BOSS_STATS[key];
        const meta = info ? `Lv ${info.lvl.toLocaleString()} · limit ${fmtCompact(info.dmgLimit)}` : '';
        return `
            <div class="sh-mcard">
                <label class="sh-sw" title="Attack this boss"><input type="checkbox" class="bc-atk" data-bossname="${shEsc(key)}" ${checked}><span></span></label>
                <div class="sh-mname">
                    <b class="bc-name" data-realname="${shEsc(name)}">${shEsc(name)}</b>
                    <span class="sh-bmeta">${meta}</span>
                </div>
                <div class="sh-mctl">
                    <div class="sh-field">
                        <label>Hits</label>
                        <div class="sh-stepper">
                            <button type="button" class="sh-step" data-d="-1">−</button>
                            <input type="text" class="bc-ls" value="${shEsc(ls)}" placeholder="30">
                            <button type="button" class="sh-step" data-d="1">+</button>
                        </div>
                    </div>
                    <div class="sh-field sh-f-skill">
                        <label>Skill</label>
                        <select class="bc-skill">${skillOpts}</select>
                    </div>
                    <div class="sh-field sh-f-cap">
                        <label>Damage cap</label>
                        <input type="text" class="bc-cap" value="${shEsc(fullCap(cap))}" placeholder="10,000,000">
                    </div>
                    <label class="sh-smart" title="Smart attack">
                        <input type="checkbox" class="bc-smart" data-bossname="${shEsc(key)}" ${smartAttack}><span>🧠 Smart</span>
                    </label>
                </div>
            </div>`;
    }

    /* ======================
       BOSS ATTACK LOGIC
    ====================== */

    async function executeBossAttackRun() {
        setStatus('FIGHTING');
        addLog("👿 Starting Boss Attack Run...");

        const freshStats = await getPlayerStatsFromWave();
        if (freshStats) applyStatsSnapshot(freshStats);

        // Collect enabled bosses from settings
        const enabledBossNames = Object.entries(settings.bossAttackEnabled)
        .filter(([, enabled]) => enabled)
        .map(([name]) => name);

        if (enabledBossNames.length === 0) {
            stopAutomation("No bosses selected for attack. Check the boxes in Boss Manager → Damage Caps.");
            return;
        }

        addLog(`🎯 Bosses selected: ${enabledBossNames.map(n => n).join(', ')}`);

        try {
            // Scan all active dungeons for alive bosses matching the selection
            const res = await safeFetch(DUNGEONS_URL, { credentials: 'same-origin' });
            const html = await res.text();
            const ids = extractDungeonIds(html);

            const bossTasks = [];
            ids.active.easy.forEach(id => bossTasks.push({ id, loc: 5 }));
            ids.active.hard.forEach(id => { CASTLE_BOSS_LOCS.forEach(loc => bossTasks.push({ id, loc })); });
            ids.active.poly.forEach(id => bossTasks.push({ id, loc: 14 }));
            const locResults = await Promise.all(bossTasks.map(t => fetchMonstersFromLocation(t.id, t.loc)));

            // Filter alive bosses matching the selection (joined or not — we will join if needed)
            const targets = [];
            locResults.forEach(mons => {
                mons.forEach(b => {
                    if (b.isDead) return;
                    if (b.isLocked) return;
                    if (!enabledBossNames.includes(b.name.toLowerCase())) return;
                    targets.push(b);
                });
            });

            if (targets.length === 0) {
                stopAutomation("No matching alive bosses found.");
                return;
            }

            addLog(`👿 Found ${targets.length} boss(es) to attack.`);

            await runPool(targets, getTurbo(), async (boss) => {
                if (!running) return;

                const bossKey = boss.name.toLowerCase();
                const cap = parseCountWithSuffix(settings.bossCaps[bossKey] || '0', 0);
                const lsCount = parseIntStrict(settings.bossAttackLS?.[bossKey] || '30', 30);
                const skillKey = settings.bossAttackSkill?.[bossKey] || 'LEGENDARY_SLASH';
                const smartAttack = settings.bossAttackSmart?.[bossKey] ?? false;
                const skillDef = SKILLS[skillKey] || CLASS_SKILLS[skillKey] || SKILLS.LEGENDARY_SLASH;

                const stratStr = smartAttack ? 'Smart Attack' : cap > 0 ? `${skillKey}:${lsCount}, CAP:${cap}` : `${skillKey}:${lsCount}`;
                addLog(`👿 Attacking: ${boss.name} | Strategy: ${stratStr}`);

                // Join battle if not already joined
                if (!boss.isJoined) {
                    addLog(`🔗 Joining battle: ${boss.name}...`);
                    const joinRes = await joinBattle(boss.instanceId, boss.dgmid);
                    if (!joinRes.success) {
                        addLog(`⏭️ Could not join ${boss.name}: ${joinRes.message}. Skipping.`);
                        return;
                    }
                }

                const plan = [];
                for (let i = 0; i < lsCount; i++) plan.push(skillDef);
                const strat = { plan, cap: cap > 0 ? cap : Infinity, error: null, smartAttack };

                // Fetch existing damage dealt on this boss to respect the cap
                const existingDmg = await fetchBossBattleData(boss.instanceId, boss.dgmid);
                let dmgDealt = existingDmg;

                if (cap > 0 && dmgDealt >= cap) {
                    addLog(`⏭️ Skipping ${boss.name}: cap already reached (${dmgDealt.toLocaleString()} / ${cap.toLocaleString()}).`);
                    return;
                }

                if (existingDmg > 0) {
                    addLog(`📈 ${boss.name}: existing damage = ${existingDmg.toLocaleString()}${cap > 0 ? ` / ${cap.toLocaleString()}` : ''}.`);
                }

                let slashDmg = 0
                let staminaUsed = 0;

                while (true && strat.smartAttack) {
                    const result = await executeAttackSkill(boss.instanceId, boss.dgmid, SKILLS.SLASH, dmgDealt);
                    if (!result.ok) {
                        if (result.reason === 'stamina') {
                            addLog('🔋 Server: not enough stamina. Using potion...');
                            const replenished = await handleStaminaLogic();
                            if (!replenished) { stopAutomation('Server reported not enough stamina and refill failed.'); return; }
                            continue;
                        }
                        addLog(`🚫 Attack error: ${result.message}. Moving to next boss.`);
                        break;
                    }
                    slashDmg = result.hitDmg;
                    dmgDealt = result.totalDmg
                    staminaUsedPerBoss[boss.dgmid] = (staminaUsedPerBoss[boss.dgmid] || 0) + 1;
                    saveStaminaUsedPerBoss();
                    staminaUsed++;
                    break;
                }
                let i = 0;


                while ((slashDmg > 0 && strat.smartAttack) || (!strat.smartAttack && i < strat.plan.length)) {
                    if (!running) break;

                    // Check cap BEFORE launching the attack
                    if (strat.cap !== Infinity && dmgDealt >= strat.cap) {
                        addLog(`🚫 Cap reached (${dmgDealt.toLocaleString()} / ${strat.cap.toLocaleString()}). Moving to next boss.`);
                        break;
                    }

                    let skill = strat.plan[i];

                    i++;
                    if (strat.smartAttack) {
                        const remainingDmg = strat.cap - dmgDealt;
                        const skillCost = remainingDmg / slashDmg;
                        skill = getClosestSkill(skillCost);
                    }


                    if (currentStamina < skill.cost) {
                        const fallbackPlan = buildFallbackSkillPlan(currentStamina, skill);
                        if (fallbackPlan.length > 0) {
                            addLog(`⚡ Auto-using remaining stamina (${currentStamina}) with fallback slashes: ${summarizeSkillPlan(fallbackPlan)}.`);
                            for (let j = 0; j < fallbackPlan.length; j++) {
                                if (!running) break;
                                if (strat.cap !== Infinity && dmgDealt >= strat.cap) {
                                    addLog(`🚫 Cap reached (${dmgDealt.toLocaleString()} / ${strat.cap.toLocaleString()}). Moving to next boss.`);
                                    break;
                                }

                                const fallbackSkill = fallbackPlan[j];
                                const fallbackResult = await executeAttackSkill(boss.instanceId, boss.dgmid, fallbackSkill, dmgDealt);
                                if (!fallbackResult.ok) {
                                    if (fallbackResult.reason === 'stamina') {
                                        addLog('🔋 Server rejected fallback hit due to stamina mismatch. Refreshing stamina...');
                                        const refreshed = await getPlayerStatsFromWave();
                                        if (refreshed) applyStatsSnapshot(refreshed, { syncHp: false, syncExp: false });
                                        break;
                                    }
                                    addLog(`🚫 Attack error: ${fallbackResult.message}. Moving to next boss.`);
                                    i = strat.plan.length;
                                    break;
                                }

                                dmgDealt = fallbackResult.totalDmg;
                                slashDmg = Math.max(slashDmg, fallbackResult.hitDmg / fallbackSkill.cost);
                                staminaUsed += fallbackSkill.cost;
                                staminaUsedPerBoss[boss.dgmid] = (staminaUsedPerBoss[boss.dgmid] || 0) + fallbackSkill.cost;
                                saveStaminaUsedPerBoss();
                                addLog(`🗡️ Fallback ${j + 1}/${fallbackPlan.length} — Hit: ${fallbackResult.hitDmg.toLocaleString()} | Total: ${dmgDealt.toLocaleString()}`);
                                if (fallbackResult.targetHp <= 0) {
                                    addLog(`💀 ${boss.name} Defeated!`);
                                    i = strat.plan.length;
                                    break;
                                }
                            }
                            continue;
                        }

                        addLog(`🔋 Not enough stamina (${currentStamina}/${skill.cost}). Using potion...`);
                        const replenished = await handleStaminaLogic();
                        if (!replenished) { stopAutomation("Out of stamina and no potion available."); return; }
                        i--;
                        continue;
                    }


                    if (skill.cost == 1000 && settings.useSkill && settings.skillId) {
                        const skillEntry = Object.entries(CLASS_SKILLS).find(([_, s]) => s.id === settings.skillId);
                        const skillName = skillEntry ? formatSkillName(skillEntry[0]) : 'Unknown';
                        const manaSkill = skillEntry[1];
                        const result = await performAttack(boss.instanceId, boss.dgmid, manaSkill);
                        if (result.status !== 'success') {
                            const errorMsg = String(result?.message ?? 'Network Error');
                            if (errorMsg.includes('Not enough mana') && !manaPotionsDepleted) {
                                const replenished = await usePotion(settings.manaPotionId, 'Small Mana Potion', 2);
                                addLog('🔋 Not enough mana. Using 2 small mana potions...');
                                if (!replenished) {
                                    addLog('⚠️ You are out of Small Mana Potions. Marking as depleted.'); manaPotionsDepleted = true;
                                } else {
                                    i--;
                                    continue;
                                }
                            }
                        } else {
                            addLog(`🗡️ Used class skill ${skillName}.`);
                        }
                    }


                    const result = await executeAttackSkill(boss.instanceId, boss.dgmid, skill, dmgDealt);
                    if (!result.ok) {
                        if (result.reason === 'stamina') {
                            const replenished = await handleStaminaLogic();
                            if (!replenished) { stopAutomation('Server: not enough stamina, refill failed.'); return; }
                            i--;
                            continue;
                        }
                        addLog(`🚫 Attack error: ${result.message}. Moving to next boss.`);
                        break;
                    }

                    dmgDealt = result.totalDmg;
                    slashDmg = Math.max(slashDmg, result.hitDmg / skill.cost);
                    staminaUsed += skill.cost;
                    staminaUsedPerBoss[boss.dgmid] = (staminaUsedPerBoss[boss.dgmid] || 0) + skill.cost;
                    saveStaminaUsedPerBoss();
                    if (strat.smartAttack) {
                        addLog(`🗡️ Attack Used ${skill.cost} Stamina! Hit for ${result.hitDmg.toLocaleString()} dmg! (Total: ${dmgDealt.toLocaleString()} / ${strat.cap})`);
                    } else {
                        addLog(`🗡️ LS ${i + 1}/${lsCount} — Hit: ${result.hitDmg.toLocaleString()} | Total: ${dmgDealt.toLocaleString()}`);
                    }
                    if (result.targetHp <= 0) { addLog(`💀 ${boss.name} Defeated!`); break; }
                }
            });

            if (running) stopAutomation("Boss Attack Run Complete.");
        } catch (e) { stopAutomation(`Boss attack error: ${e.stack}`); }
    }

    /* ======================
       LOOT LOGIC
    ====================== */


    async function handleLootForLevelUp() {
        try {

            await updatePlayerStats();
            let currentLevel = playerStats.level;
            const xpPerStam = getXpPerStam(playerStats.level);
            const fspStaminaXp = xpPerStam * playerStats.maxStamina;
            const lspStaminaXp = xpPerStam * Math.max(playerStats.maxStamina / 2, 5000);
            let forceWaveLoot = false;
            let xpNeeded = playerStats.maxXP - playerStats.currentXP;
            if (settings.autoLootDungeons) {

                const res = await safeFetch(DUNGEONS_URL, { credentials: 'same-origin' });
                const html = await res.text();
                const ids = extractDungeonIds(html);
                const allShadowbridge = [...ids.active.easy, ...ids.ended.easy];
                const allCastle = [...ids.active.hard, ...ids.ended.hard];
                const allPolyhedral = [...ids.active.poly, ...ids.ended.poly];
                const mobTasks = [], bossTasks = [];
                allShadowbridge.forEach(id => { SHADOWBRIDGE_LOCS.forEach(loc => mobTasks.push({ id, loc })); bossTasks.push({ id, loc: 5 }); });
                allCastle.forEach(id => { CASTLE_BOSS_LOCS.forEach(loc => bossTasks.push({ id, loc })); });
                allPolyhedral.forEach(id => { POLYHEDRAL_MOB_LOCS.forEach(loc => mobTasks.push({ id, loc })); bossTasks.push({ id, loc: 14 }); });

                const [mobResults, bossResults] = await Promise.all([
                    Promise.all(mobTasks.map(t => fetchMonstersFromLocation(t.id, t.loc).then(mons => ({ id: t.id, mons })))),
                    Promise.all(bossTasks.map(t => fetchMonstersFromLocation(t.id, t.loc)))
                ]);

                const instanceDataMap = {}, seenLootableByInstance = {};
                lootableMobCacheByInstance = {};
                allShadowbridge.forEach(id => {
                    instanceDataMap[id] = { id, dungeonName: 'Shadowbridge Warrens', count: 0, isActive: ids.active.easy.includes(id) };
                    seenLootableByInstance[id] = new Set();
                    lootableMobCacheByInstance[id] = [];
                });
                allPolyhedral.forEach(id => {
                    instanceDataMap[id] = { id, dungeonName: 'The Polyhedral Crucible', count: 0, isActive: ids.active.poly.includes(id) };
                    seenLootableByInstance[id] = new Set();
                    lootableMobCacheByInstance[id] = [];
                });
                mobResults.forEach(res => {
                    res.mons.filter(m => m.category === 'DEAD_LOOTABLE').forEach(mob => {
                        if (!mob.dgmid || seenLootableByInstance[res.id].has(mob.dgmid)) return;
                        seenLootableByInstance[res.id].add(mob.dgmid);
                        lootableMobCacheByInstance[res.id].push({ dgmid: mob.dgmid, name: mob.name, locId: mob.locId });
                    });
                    instanceDataMap[res.id].count = lootableMobCacheByInstance[res.id].length;
                });
                const instanceData = Object.values(instanceDataMap);

                const deadBosses = [], dmgTasks = [];
                bossResults.forEach(mons => {
                    mons.forEach(b => {
                        if (b.category.startsWith('DEAD_')) {
                            deadBosses.push(b);
                            if (b.isJoined && !b.isLocked && b.dgmid) {
                                dmgTasks.push(fetchBossBattleData(b.instanceId, b.dgmid).then(dmg => {
                                    b.damageDealt = dmg;
                                    const bStats = BOSS_STATS[b.name.toLowerCase()] || { expRatio: 0.01, dmgLimit: Infinity };
                                    const ratio = bStats.lvl > playerStats.level ? bStats.expRatio : 0;
                                    b.expectedExp = Math.floor(Math.min(dmg, bStats.dmgLimit) * bStats.expRatio);
                                }));
                            } else { b.damageDealt = 0; b.expectedExp = 0; }
                        }
                    });
                });
                await Promise.all(dmgTasks);

                deadBosses.sort((a, b) => (b.expectedExp || 0) - (a.expectedExp || 0));
                const lootableDeadBosses = deadBosses.filter(b => b.category === 'DEAD_LOOTABLE');
                let i = 0;
                const lootableLocations = instanceData.filter(inst => inst.count > 0);
                for (let inst of lootableLocations) {
                    xpNeeded -= await unsafeWindow.dsLootAction(inst.id, true);
                    if (xpNeeded <= 0) {
                        break;
                    }
                }
                await updatePlayerStats();
                if (playerStats.level > currentLevel) {
                    addLog(`🌟 Leveled up from ${currentLevel} to ${playerStats.level} by looting dungeons!`);
                    return true;
                }
                xpNeeded = playerStats.maxXP - playerStats.currentXP;

                while (xpNeeded > 0 && i < lootableDeadBosses.length) {
                    if (lootableDeadBosses[i].expectedExp < xpNeeded) {
                        const res = await unsafeWindow.dsLootBoss(lootableDeadBosses[i].instanceId, lootableDeadBosses[i].dgmid, null, true);
                        xpNeeded -= res ?? 0;
                        i++;
                    } else {
                        const overflow = lootableDeadBosses[i].expectedExp - xpNeeded;
                        if (overflow + fspStaminaXp < playerStats.maxXP || playerStats.currentXP < 1.5 * fspStaminaXp) {
                            const res = await unsafeWindow.dsLootBoss(lootableDeadBosses[i].instanceId, lootableDeadBosses[i].dgmid, null, true);
                            xpNeeded -= res ?? 0;
                            i++;
                        } else {
                            if (settings.autoLootWave && xpNeeded < playerStats.maxXP * 0.1) {
                                forceWaveLoot = true;
                                break;
                            }
                            i++;
                        }
                    }
                }
                await updatePlayerStats();
                if (playerStats.level > currentLevel) {
                    addLog(`🌟 Leveled up from ${currentLevel} to ${playerStats.level} by looting dead bosses!`);
                    return true;
                }
                xpNeeded = playerStats.maxXP - playerStats.currentXP;
            }
            if (lspStaminaXp * 2 < xpNeeded && !forceWaveLoot) {
                return false;
            }

            let keepLooting = true;
            while (keepLooting && settings.autoLootWave) {
                const enoughLoot = await lootWaveBosses();
                await updatePlayerStats();
                keepLooting = enoughLoot && playerStats.level <= currentLevel;
            }
            if (playerStats.level > currentLevel) {
                addLog(`🌟 Leveled up from ${currentLevel} to ${playerStats.level} by looting wave bosses!`);
                return true;
            }
            addLog(`Failed to level up through looting level:${currentLevel} fullStats:${JSON.stringify(playerStats)}`)
            return false;


        } catch (e) { stopAutomation(`Boss Loot error: ${e.stack}`); throw e; }

    }

    async function lootWaveBosses() {

        setCookie("hide_dead_monsters", 0)
        setCookie("show_dead_bosses_only", 0);
        let result = {}
        result = await getMonstersForLevelUp();
        setCookie("hide_dead_monsters", 1)

        if (result.missingXp > 0) {
            return false;
        }
        const targetIds = result.ids;
        const lane = Math.max(2, getTurbo());
        for (let s = 0; s < targetIds.length; s += lane) {
            await Promise.all(targetIds.slice(s, s + lane).map(id => lootWaveMonster(id)));
        }
        return true;


    }
    async function lootWaveMonster(monsterId, instanceId = "0") {
        console.log("looting: ", monsterId);
        const results = {
            ok: true,
            items: [],
            rewards: { exp: 0, gold: 0, damage_dealt: 0 },
        };

        const userId = new URLSearchParams(
            document.querySelector('.side-head a[href*="player.php"]')?.href.split('?')[1]
        ).get('pid');
        if (!userId || !monsterId || !instanceId) {
            console.warn(
                `lootMonster: missing params! userId: ${userId}, monsterId: ${monsterId}, instanceId: ${instanceId}`
            );
            return;
        }
        const params = new URLSearchParams();
        params.set("user_id", String(userId));
        params.set("monster_id", String(monsterId));
        params.set("dgmid", String(monsterId));
        params.set("instance_id", String(instanceId));

        const lootUrl = instanceId === "0" ? "loot.php" : "dungeon_loot.php";
        const referrer =
              instanceId === "0"
        ? `https://demonicscans.org/battle.php?id=${monsterId}`
        : `https://demonicscans.org/battle.php?dgmid=${monsterId}`;

        const res = await safeFetch(lootUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            referrer,
            body: params.toString(),
        });

        const ct = res.headers.get("content-type") || "";
        const data = await res.json();

        if (data.status !== "success") {
            throw new Error("Loot Request Failed");
        }

        if (Array.isArray(data.items)) {
            results.items.push(...data.items);
        }

        if (data.rewards) {
            results.rewards = data.rewards;
        }

        return results;
    }

    async function getMonstersForLevelUpPerPage(cards, xpNeeded) {
        let candidates = []
        for (const card of cards) {
            const id = parseInt(card.dataset.monsterId, 10);
            const name = card.dataset.name;
            const dmg = parseInt(card.dataset.userdmg || "0", 10);
            let count = 1;
            const el = card.querySelector('.stack-badge');

            if (el) {
                const match = el.textContent.match(/\d+/);
                count = match ? parseInt(match[0], 10) : 1;
            }


            let max, rate, maxLevel;

            if (monsterCache.has(name)) {
                ({ max, rate, maxLevel } = monsterCache.get(name));
            } else {
                const link = card.querySelector('a[href*="battle.php"]');
                if (!link) continue;

                const url = "https://demonicscans.org/" + link.getAttribute("href");

                try {
                    const res = await safeFetch(url, { credentials: "include" });
                    const html = await res.text();

                    const doc = new DOMParser().parseFromString(html, "text/html");
                    const blocks = doc.querySelectorAll('.battle-card .stat-block');

                    let maxDmg = 0;
                    let xpRate = 0;
                    let maxLevel = 0;

                    blocks.forEach(b => {
                        const label = b.querySelector('.label')?.textContent.trim();

                        if (label === "EXP Cap") {
                            const txt = b.textContent;
                            maxDmg = parseInt(
                                txt.match(/~([\d,]+)/)[1].replace(/,/g, ""),
                                10
                            );
                        }

                        if (label === "EXP / DMG") {
                            xpRate = parseFloat(b.querySelector('strong')?.textContent);
                        }
                    });

                    max = maxDmg;
                    rate = xpRate;

                    maxLevel = parseInt(
                        [...doc.querySelectorAll('.label')]
                        .find(el => el?.textContent.trim().toLowerCase() === 'rewards up to')
                        .parentNode
                        ?.querySelector('strong')
                        ?.textContent
                        ?.replace(/[^\d]/g, ''),
                        10
                    );


                    monsterCache.set(name, { max, rate, maxLevel });
                    saveMonsterCache(monsterCache);

                } catch {
                    continue;
                }
            }

            const xp = playerStats.level > maxLevel ? 0 : Math.min(dmg, max) * rate * count;

            if (xp > 0) {
                candidates.push({ id, xp });
            }
        }

        // ✅ 3. Pick until enough
        let sum = 0;
        const selected = [];

        for (const m of candidates) {
            if (sum >= xpNeeded) break;

            sum += m.xp;
            selected.push(m.id);
        }

        return {
            ids: selected,
            missingXp: xpNeeded - sum
        };

    }
    async function getMonstersForLevelUp() {
        let xpNeeded = playerStats.maxXP - playerStats.currentXP;
        if (xpNeeded <= 0) return [];
        const selected = [];
        const cards = await getBossLootForAllWaves();
        const result = await getMonstersForLevelUpPerPage(cards, xpNeeded);
        selected.push(...result.ids);
        xpNeeded = result.missingXp;

        return {
            ids: selected,
            missingXp: xpNeeded
        };


    }
    async function getBossLootForAllWaves() {
        let allCards = [];
        for (const baseUrl of WAVE_URLS) {
            setCookie("hide_dead_monsters", 0)
            setCookie("show_dead_bosses_only", 1);
            const res = await safeFetch(baseUrl.toString(), { credentials: "include" });
            const html = await res.text();
            const doc = new DOMParser().parseFromString(html, "text/html");
            allCards.push(...doc.querySelectorAll('.monster-card[data-boss="1"][data-dead="1"]'));
        }
        setCookie("hide_dead_monsters", 1)
        setCookie("show_dead_bosses_only", 0);
        allCards = [...allCards].sort(
            (a, b) => Number(a.dataset.expire) - Number(b.dataset.expire)
        );
        return allCards;
    }

    function getXpPerStam() {
        return (0.2 * (Math.pow((playerStats.level + 1) * 2.5, 2) + 100)) / (5 * (playerStats.level - 1));
    }
    function setCookie(name, value, days = 7) {
        const date = new Date();
        date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);

        document.cookie =
            `${name}=${encodeURIComponent(value)}; expires=${date.toUTCString()}; path=/`;
    }



    async function openLootManager() {
        lootModal.innerHTML = `
            <div class="ds-modal-header">
                <div class="sh-mhead-title loot"><div class="ico">💰</div><div><h3>Loot Manager</h3><small>Scanning dungeons…</small></div></div>
                <span class="sh-x" onclick="window.dsCloseLootModal()" title="Close">✕</span>
            </div>
            <div class="ds-modal-body sh-loading"><div class="sh-spin"></div><p>Scanning all instances and bosses…</p></div>
        `;
        lootModal.style.display = 'block';
        try {
            const res = await safeFetch(DUNGEONS_URL, { credentials: 'same-origin' });
            const html = await res.text();
            const ids = extractDungeonIds(html);
            const allShadowbridge = [...ids.active.easy, ...ids.ended.easy];
            const allCastle = [...ids.active.hard, ...ids.ended.hard];
            const allPolyhedral = [...ids.active.poly, ...ids.ended.poly];
            const mobTasks = [], bossTasks = [];
            allShadowbridge.forEach(id => { SHADOWBRIDGE_LOCS.forEach(loc => mobTasks.push({ id, loc })); bossTasks.push({ id, loc: 5 }); });
            allCastle.forEach(id => { CASTLE_BOSS_LOCS.forEach(loc => bossTasks.push({ id, loc })); });
            allPolyhedral.forEach(id => { POLYHEDRAL_MOB_LOCS.forEach(loc => mobTasks.push({ id, loc })); bossTasks.push({ id, loc: 14 }); });

            const [mobResults, bossResults] = await Promise.all([
                Promise.all(mobTasks.map(t => fetchMonstersFromLocation(t.id, t.loc).then(mons => ({ id: t.id, mons })))),
                Promise.all(bossTasks.map(t => fetchMonstersFromLocation(t.id, t.loc)))
            ]);

            const instanceDataMap = {}, seenLootableByInstance = {};
            lootableMobCacheByInstance = {};
            allShadowbridge.forEach(id => {
                instanceDataMap[id] = { id, dungeonName: 'Shadowbridge Warrens', count: 0, isActive: ids.active.easy.includes(id) };
                seenLootableByInstance[id] = new Set();
                lootableMobCacheByInstance[id] = [];
            });
            allPolyhedral.forEach(id => {
                instanceDataMap[id] = { id, dungeonName: 'The Polyhedral Crucible', count: 0, isActive: ids.active.poly.includes(id) };
                seenLootableByInstance[id] = new Set();
                lootableMobCacheByInstance[id] = [];
            });
            mobResults.forEach(res => {
                res.mons.filter(m => m.category === 'DEAD_LOOTABLE').forEach(mob => {
                    if (!mob.dgmid || seenLootableByInstance[res.id].has(mob.dgmid)) return;
                    seenLootableByInstance[res.id].add(mob.dgmid);
                    lootableMobCacheByInstance[res.id].push({ dgmid: mob.dgmid, name: mob.name, locId: mob.locId });
                });
                instanceDataMap[res.id].count = lootableMobCacheByInstance[res.id].length;
            });
            const instanceData = Object.values(instanceDataMap);

            const deadBosses = [], dmgTasks = [];
            bossResults.forEach(mons => {
                mons.forEach(b => {
                    if (b.category.startsWith('DEAD_')) {
                        deadBosses.push(b);
                        if (b.isJoined && !b.isLocked && b.dgmid) {
                            dmgTasks.push(fetchBossBattleData(b.instanceId, b.dgmid).then(dmg => {
                                b.damageDealt = dmg;
                                const bStats = BOSS_STATS[b.name.toLowerCase()] || { expRatio: 0.01, dmgLimit: Infinity };
                                b.expectedExp = Math.floor(Math.min(dmg, bStats.dmgLimit) * bStats.expRatio);
                            }));
                        } else { b.damageDealt = 0; b.expectedExp = 0; }
                    }
                });
            });
            await Promise.all(dmgTasks);
            renderLootTable(instanceData, deadBosses);
        } catch (e) {
            lootModal.innerHTML = `
            <div class="ds-modal-header">
                <div class="sh-mhead-title loot"><div class="ico">💰</div><div><h3>Loot Manager</h3><small>Something went wrong</small></div></div>
                <span class="sh-x" onclick="window.dsCloseLootModal()" title="Close">✕</span>
            </div>
            <div class="ds-modal-body">⚠️ Error loading loot data:<pre style="white-space:pre-wrap; font-size:11px; color:#ff8fa3;">${shEsc(e.stack)}</pre></div>
            <div class="sh-mfoot"><span></span><button class="sh-ghost" onclick="window.dsCloseLootModal()">Close</button></div>`;
        }
    }


    unsafeWindow.dsCloseLootModal = function () { lootModal.style.display = 'none'; };

    unsafeWindow.dsSwitchLootTab = function (btn, targetId) {
        document.querySelectorAll('#dsLootModal .sh-seg button').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('#dsLootModal .sh-panel').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(targetId).classList.add('active');
    };

    unsafeWindow.dsToggleLootableBosses = function (isChecked) {
        settings.showOnlyLootableBosses = isChecked;
        persistAllSettings();
        const displayVal = isChecked ? 'none' : '';
        document.querySelectorAll('#dsLootModal .boss-not-lootable').forEach(row => { row.style.display = displayVal; });
    };

    function renderLootTable(data, deadBosses) {
        let totalMobs = 0;
        let rows = '';
        data.forEach(inst => {
            totalMobs += inst.count;
            const dis = inst.count === 0 ? 'disabled' : '';
            const isPoly = /polyhedral/i.test(inst.dungeonName || '');
            rows += `
                <div class="sh-lcard ${inst.count > 0 ? 'ready' : ''}" style="--lc:${isPoly ? '#c77dff' : '#3ddc97'};">
                    <div class="sh-lico">${isPoly ? '🔮' : '🏰'}</div>
                    <div class="sh-binfo">
                        <span class="sh-bname">${shEsc(inst.dungeonName || 'Unknown')}</span>
                        <small>Instance #${shEsc(inst.id)}</small>
                        <div class="sh-bstats">
                            <span class="sh-spill ${inst.isActive ? 'active' : 'ended'}">${inst.isActive ? 'Active' : 'Ended'}</span>
                            <span class="sh-bs stam" title="Stamina used">💪 ${staminaUsedPerDungeon[inst.id] || 0}</span>
                            <span class="sh-bs cnt" title="Lootable mobs">🎁 ${inst.count} lootable</span>
                        </div>
                    </div>
                    <div class="sh-lact">
                        <button class="sh-lbtn alt" onclick="window.openUrl('https://demonicscans.org/guild_dungeon_instance.php?id=${inst.id}', '_blank')">View</button>
                        <button class="sh-lbtn" ${dis} onclick="window.dsLootAction('${inst.id}')">Loot all</button>
                    </div>
                </div>`;
        });

        let bossRows = '';
        let lootableBosses = 0, totalExp = 0;
        deadBosses.forEach(b => {
            const isLootable = b.category === 'DEAD_LOOTABLE';
            if (isLootable) { lootableBosses++; totalExp += (b.expectedExp || 0); }
            const rowClass = isLootable ? 'boss-lootable' : 'boss-not-lootable';
            const displayStyle = (settings.showOnlyLootableBosses && !isLootable) ? 'display:none;' : '';
            const statusHtml = b.category === 'DEAD_LOOTED' ? '<span class="sh-spill looted">Looted</span>'
                : isLootable ? '<span class="sh-spill joined">Lootable</span>'
                : '<span class="sh-spill locked">Unjoined</span>';
            bossRows += `
                <div class="sh-bosscard sh-lcard ${rowClass}" style="${displayStyle} --lc:${isLootable ? '#3ddc97' : '#4a4560'};">
                    <img class="sh-bimg" src="${shEsc(b.img)}" alt="">
                    <div class="sh-binfo">
                        <span class="sh-bname link" onclick="window.openUrl('https://demonicscans.org/battle.php?dgmid=${b.dgmid}&instance_id=${b.instanceId}', '_blank')">${shEsc(b.name)}</span>
                        <small>Inst #${shEsc(b.instanceId)} · ${b.isInstanceActive ? 'Active' : 'Ended'}</small>
                        <div class="sh-bstats">
                            <span class="sh-bs stam" title="Stamina used">💪 ${staminaUsedPerBoss[b.dgmid] || 0}</span>
                            <span class="sh-bs exp" title="Expected EXP">🔮 ~${(b.expectedExp || 0).toLocaleString()}</span>
                        </div>
                    </div>
                    <span class="sh-lstatus">${statusHtml}</span>
                    <button class="sh-lbtn gold" ${isLootable ? '' : 'disabled'} onclick="window.dsLootBoss('${b.instanceId}', '${b.dgmid}', this)">Loot</button>
                </div>`;
        });

        const chkLootedState = settings.showOnlyLootableBosses ? 'checked' : '';
        lootModal.innerHTML = `
            <div class="ds-modal-header">
                <div class="sh-mhead-title loot"><div class="ico">💰</div><div><h3>Loot Manager</h3><small>Collect rewards from mobs and bosses</small></div></div>
                <span class="sh-x" onclick="window.dsCloseLootModal()" title="Close">✕</span>
            </div>
            <div class="ds-modal-body">
                <div class="sh-summary">
                    <div><b class="gold">${totalMobs}</b><span>Lootable mobs</span></div>
                    <div><b class="pink">${lootableBosses}</b><span>Lootable bosses</span></div>
                    <div><b class="vio">${fmtCompact(totalExp)}</b><span>Boss EXP</span></div>
                </div>
                <div class="sh-seg">
                    <button class="active" onclick="window.dsSwitchLootTab(this, 'lm_mobs')">🐗 Regular mobs<b>${data.length}</b></button>
                    <button onclick="window.dsSwitchLootTab(this, 'lm_boss')">💀 Dead bosses<b>${deadBosses.length}</b></button>
                </div>
                <div id="lm_mobs" class="sh-panel active">
                    <div class="sh-blist">${rows || '<div class="sh-empty">No instances found.</div>'}</div>
                </div>
                <div id="lm_boss" class="sh-panel">
                    <div class="sh-toggle-row">
                        <span>Show only lootable bosses</span>
                        <label class="sh-sw"><input type="checkbox" id="chk_hide_looted" ${chkLootedState} onchange="window.dsToggleLootableBosses(this.checked)"><span></span></label>
                    </div>
                    <div class="sh-blist">${bossRows || '<div class="sh-empty">No dead bosses found.</div>'}</div>
                </div>
            </div>
            <div class="sh-mfoot">
                <span class="sh-saved show" style="color:var(--sh-mute);">Tap a name to open its battle page</span>
                <button class="sh-ghost" onclick="window.dsCloseLootModal()">Close</button>
            </div>
        `;
    }

    unsafeWindow.openUrl = function (url) {
        window.location.href = url
    }
    unsafeWindow.dsLootBoss = async function (instanceId, dgmid, btnElement, backgroundTask = false) {
        let originalText;
        if (!backgroundTask) {
            btnElement.disabled = true;
            originalText = btnElement.textContent;
            btnElement.textContent = "⏳...";
        }
        addLog(`💰 Looting Boss [Instance ${instanceId}, DGMID ${dgmid}]...`);
        const res = await lootMonster(instanceId, dgmid);
        if (res && res.status === 'success') {
            addLog(`✅ Boss Looted successfully!`);
            bossesLooted++;
            if (res.rewards?.exp) totalExpLooted += res.rewards.exp;
            if (res.rewards?.gold) totalGoldLooted += res.rewards.gold;
            if (res.items?.length) processLootItems(res.items);
            persistSessionStats();
            updateStatsModal();
            if (res.rewards?.exp) await applyExpGain(res.rewards.exp, "Leveled up successfully from Boss Loot!");
            if (!backgroundTask) {
                btnElement.textContent = "Looted";
                const row = btnElement.closest('.sh-lcard');
                if (row) {
                    const statusCell = row.querySelector('.sh-lstatus');
                    if (statusCell) statusCell.innerHTML = '<span class="sh-spill looted">Looted</span>';
                    row.style.setProperty('--lc', '#4a4560');
                    row.classList.remove('boss-lootable');
                    row.classList.add('boss-not-lootable');
                    if (settings.showOnlyLootableBosses) row.style.display = 'none';
                }
            }
            return res.rewards?.exp ?? 0;
        } else {
            addLog(`⚠️ Boss Loot Failed: ${res.message || 'Unknown error'}`);
            if (!backgroundTask) {
                btnElement.disabled = false;
                btnElement.textContent = originalText;
            }
        }
    };

    unsafeWindow.dsLootAction = async function (instanceId, backgroundTask = false) {
        if (!backgroundTask) {
            lootModal.style.display = 'none';
            running = true;
            sessionStorage.setItem(AUTO_RUNNING_KEY, 'true');
            setStatus('LOOTING');
        }
        addLog(`💰 Started Looting Mobs [Instance ${instanceId}]`);

        const freshStats = await getPlayerStatsFromWave();
        if (freshStats && freshStats.exp) {
            applyStatsSnapshot(freshStats, { syncHp: false, syncStamina: false });
        } else {
            addLog("⚠️ Could not fetch base EXP before looting. Halting.");
            stopAutomation();
            return;
        }
        let xpNeeded = maxExpRaw - currentExpRaw;

        let allTargets = (lootableMobCacheByInstance[instanceId] || []).filter(m => m && m.dgmid);
        if (allTargets.length > 0) {
            addLog(`📦 Using cached loot targets from Loot Manager scan (${allTargets.length}).`);
        } else {
            addLog(`⚠️ Cache miss for instance ${instanceId}. Rescanning locations...`);
            allTargets = [];
            for (const loc of SHADOWBRIDGE_LOCS) {
                if (!running) break;
                const locMons = await fetchMonstersFromLocation(instanceId, loc);
                allTargets = allTargets.concat(locMons.filter(m => m.category === 'DEAD_LOOTABLE').map(m => ({ dgmid: m.dgmid, name: m.name, locId: m.locId })));
            }
            lootableMobCacheByInstance[instanceId] = allTargets.filter(m => m && m.dgmid);
        }

        if (allTargets.length === 0) {
            if (!backgroundTask) {
                stopAutomation("No lootable monsters found.");
            }
            return;
        }
        addLog(`💰 Looting ${allTargets.length} monsters...`);

        const results = new Array(allTargets.length);
        const LOOT_BATCH = Math.max(2, getTurbo());
        for (let s = 0; s < allTargets.length; s += LOOT_BATCH) {
            const slice = allTargets.slice(s, s + LOOT_BATCH);
            if (!running || xpNeeded <= 0) { slice.forEach((_, k) => { results[s + k] = { status: 'aborted' }; }); continue; }
            await Promise.all(slice.map(async (mob, k) => {
                try {
                    const res = await lootMonster(instanceId, mob.dgmid);
                    if (res.rewards?.exp) xpNeeded -= res.rewards.exp;
                    results[s + k] = res;
                } catch (err) { results[s + k] = { status: 'error' }; }
            }));
        }

        let expGained = 0;
        const remainingTargets = [];
        results.forEach((res, idx) => {
            if (res && res.status === 'success') {
                monstersLooted++;
                if (res.rewards?.exp) { expGained += res.rewards.exp; totalExpLooted += res.rewards.exp; }
                if (res.rewards?.gold) totalGoldLooted += res.rewards.gold;
                if (res.items?.length) processLootItems(res.items);
            } else { remainingTargets.push(allTargets[idx]); }
        });
        lootableMobCacheByInstance[instanceId] = remainingTargets.filter(m => m && m.dgmid);
        persistSessionStats();
        updateStatsModal();
        await applyExpGain(expGained);
        if (running && !backgroundTask) { addLog(`✅ Looting complete.`); stopAutomation("Stopping..."); }
        return expGained;
    };

    function saveStaminaUsedPerDungeon() {
        localStorage.setItem(
            'guild_dungeon_stamina_used',
            JSON.stringify(staminaUsedPerDungeon)
        );
    }

    function loadStaminaUsedPerDungeon() {
        const raw = localStorage.getItem('guild_dungeon_stamina_used');

        if (!raw) return {};

        try {
            return JSON.parse(raw);
        } catch (e) {
            console.error('Invalid JSON in guild_dungeon_stamina_used', e);
            return {};
        }
    }
    function saveStaminaUsedPerBoss() {
        localStorage.setItem(
            'guild_dungeon_boss_stamina_used',
            JSON.stringify(staminaUsedPerBoss)
        );
    }

    function loadStaminaUsedPerBoss() {
        const raw = localStorage.getItem('guild_dungeon_boss_stamina_used');

        if (!raw) return {};

        try {
            return JSON.parse(raw);
        } catch (e) {
            console.error('Invalid JSON in guild_dungeon_boss_stamina_used', e);
            return {};
        }
    }


    function buildClassSkillsFromDOM() {
        const result = {};

        const container = document.querySelector(".class-skill-bar");
        if (!container) return result;

        const buttons = container.querySelectorAll("button.skill-slot.attack-btn");

        buttons.forEach(btn => {
            const id = Number(btn.dataset.skillId);
            const name = btn.dataset.skillName;
            const cost = Number(btn.dataset.stamCost);

            if (!name || isNaN(id)) return;

            const key = name.trim().toUpperCase().replace(/\s+/g, "_");

            result[key] = { id, cost };
        });

        return result;
    }
    function saveClassSkills(skills) {
        localStorage.setItem(CLASS_SKILLS_KEY, JSON.stringify(skills));
    }
    function updateClassSkills() {
        const skills = buildClassSkillsFromDOM();
        if (Object.keys(skills).length > 0) {
            CLASS_SKILLS = skills;
            saveClassSkills(skills);
        } else {
            CLASS_SKILLS = loadClassSkillsFromStorage();
        }
    }
    function loadClassSkillsFromStorage() {
        const raw = localStorage.getItem(CLASS_SKILLS_KEY);
        if (!raw) return {};

        try {
            return JSON.parse(raw);
        } catch (e) {
            return {};
        }
    }

    function saveMonsterCache(monsterCache) {
        localStorage.setItem(
            MONSTER_CACHE_KEY,
            JSON.stringify([...monsterCache])
        );
    }
    function loadMonsterCache() {
        const raw = localStorage.getItem(MONSTER_CACHE_KEY);
        if (!raw) return new Map();

        try {
            return new Map(JSON.parse(raw));
        } catch (e) {
            return new Map();
        }
    }

    async function safeFetch(url, options = {}, backoff = 100) {
        while (true) {
            const controller = new AbortController();

            const timeout = setTimeout(() => {
                controller.abort();
            }, 60000); // 1 minute

            try {
                const r = await fetch(url, {
                    ...options,
                    signal: controller.signal
                });

                clearTimeout(timeout);

                if (r.status < 500) {
                    return r;
                }

            } catch (e) {
                clearTimeout(timeout);
                if (e.name === 'AbortError') {
                    if (options?.method?.toUpperCase() === 'POST') {
                        addLog(`⚠️ Request timed out: ${url}. This may be due to a server issue or network problem. Reloading the page to reset the session.`);
                        location.reload();
                    }
                    addLog(`⚠️ Request timed out: ${url}. Retrying...`);
                }
            }

            await sleep(backoff);
        }
    }
    function sleep(ms, signal) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(resolve, ms);

            if (!signal) {
                return;
            }

            signal.addEventListener('abort', () => {
                clearTimeout(timer);
                reject(new DOMException('Aborted', 'AbortError'));
            }, { once: true });
        });
    }

    //=============================================================================================================================
    //======================auto farm lock mechanism to prevent multiple instances running at the same time========================
    //=============================================================================================================================

    async function saveCurrentAutofarmState() {
        await lockAutoFarm();
        addLog("Saving current auto farm state...");
        const r = await safeFetch("auto_farm_status.php?_=" + Date.now(), { cache: "no-store" });
        const j = await r.json();
        const enabled = j.settings.IS_ENABLED;
        if (enabled) {
            localStorage.setItem(STORAGE_KEY_AUTO_FARM_RUNNING, "true");
            await stopAutoFarm();
        }
        await sleep(800);
    }

    async function restoreAutofarmState() {
        if (!isLockOwned()) { return; }
        addLog("Restoring auto farm state...");
        const autoFarmState = JSON.parse(localStorage.getItem(STORAGE_KEY_AUTO_FARM_SETTINGS));
        if (autoFarmState) {
            const { monstersSettings, payload } = autoFarmState;
            await clearAutoFarmTargets();
            for (const monsterSettings of monstersSettings) {
                const { monsterId, minDmg, isEnabled } = monsterSettings;
                await addAutoFarmTarget(monsterId, minDmg, isEnabled, false);
            }
            await resetAutoFarmSettings();
            await saveAutoFarmSettings(payload);
            localStorage.removeItem(STORAGE_KEY_AUTO_FARM_SETTINGS);
        }
        const running = localStorage.getItem(STORAGE_KEY_AUTO_FARM_RUNNING) === 'true';
        if (running) {
            await startAutoFarm();
        }
        localStorage.removeItem(STORAGE_KEY_AUTO_FARM_RUNNING);
        unlockAutoFarm();
    }
    async function lockAutoFarm() {
        await waitForAutoFarmUnlock();
        localStorage.setItem(AUTO_FARM_LOCKED, SCRIPT_KEY);
        addLog("Auto farm locked.");
    }
    function unlockAutoFarm() {
        if (!isLockOwned()) {
            addLog("Cannot unlock auto farm, lock owned by another instance.");
            return;
        }
        localStorage.removeItem(AUTO_FARM_LOCKED);
        addLog("Auto farm unlocked.");
    }
    async function isAutoFarmLocked() {
        const lock = localStorage.getItem(AUTO_FARM_LOCKED);
        if (lock === null || lock === SCRIPT_KEY) return false;

        const ts = parseInt(localStorage.getItem(LOCK_HEARTBEAT_KEY) || "0");
        if (Date.now() - ts > LOCK_EXPIRY_MS) {
            localStorage.removeItem(AUTO_FARM_LOCKED);
            localStorage.removeItem(LOCK_HEARTBEAT_KEY);
            localStorage.setItem(AUTO_FARM_LOCKED, SCRIPT_KEY);
            addLog("Stale auto farm lock detected and cleared.Restoring lost auto farm state ...");
            await restoreAutofarmState();
            return false;
        }
        return true;
    }
    async function waitForAutoFarmUnlock() {
        if (!await isAutoFarmLocked()) {
            return;
        }
        addLog("Waiting for auto farm to be unlocked...");
        while (await isAutoFarmLocked()) {
            await sleep(1000);
        }
        addLog("Auto farm unlocked, resuming...");
    }
    function isLockOwned() {
        return localStorage.getItem(AUTO_FARM_LOCKED) === SCRIPT_KEY;
    }
    function startHeartbeat() {
        return setInterval(() => {
            if (isLockOwned()) {
                localStorage.setItem(LOCK_HEARTBEAT_KEY, Date.now());
            }
        }, 5000);
    }

    async function saveAutoFarmSettings(payload) {
        await afPost('save_settings', payload);
    }

    async function startAutoFarm() {
        const j = await afPost('toggle', { enabled: 1 });
    }
    async function stopAutoFarm() {
        const j = await afPost('toggle', { enabled: 0 });
    }
    async function resetAutoFarmSettings() {
        const j = await afPost('reset');
    }


    async function addAutoFarmTarget(id, minDmg, is_enabled = 1, auto_clear = true) {
        const payload = {
            MONSTER_ID: id,
            DAMAGE_OR_CAP: 1,
            MIN_DAMAGE: minDmg,
            IS_ENABLED: is_enabled
        };
        if (auto_clear) {
            await clearAutoFarmTargets();
        }
        const j = await afPost('add_target', payload);
    }

    async function clearAutoFarmTargets() {
        const j = await afPost('clear_targets');
    }
    async function afPost(action, payload = {}) {
        const params = new URLSearchParams({ action, ...payload });
        const res = await safeFetch('auto_farm_actions.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
            body: params.toString()
        });
        return res.json();
    }


    //===================================================================
    //======================end of lock mechanism========================
    //===================================================================

    function compareVersions(a, b) {
        const pa = a.split('.').map(Number);
        const pb = b.split('.').map(Number);
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
            const na = pa[i] || 0;
            const nb = pb[i] || 0;
            if (na !== nb) return na - nb;
        }
        return 0;
    }

    function runMigrations() {
        const lastVersion = localStorage.getItem(SCRIPT_VERSION_KEY) || "0.0.0";

        if (compareVersions(lastVersion, CURRENT_VERSION) >= 0) {
            return; // already on this version or newer, nothing to do
        }

        // Migration: 4.8.7 - clear monster cache once (stale EXP Cap/rate data)
        if (compareVersions(lastVersion, "4.8.7") < 0) {
            localStorage.removeItem(MONSTER_CACHE_KEY);
            addLog(`🔄 Migration to 4.8.7: monster cache cleared.`);
        }

        localStorage.setItem(SCRIPT_VERSION_KEY, CURRENT_VERSION);
    }


    /* ======================
       INSTANCE PAGE BAR
       Shown on guild_dungeon_instance.php — compact floating bar
       with Loot Mobs and Loot Bosses buttons.
    ====================== */

    /* --- INITIALIZE --- */
    getPlayerStatsFromWave().then(fetched => { if (fetched) applyStatsSnapshot(fetched); });
    fetchInventoryIds();
    renderGUI();
    addLog(`🔥 Sheol Dungeon Automator v${CURRENT_VERSION} ready — TURBO ×${getTurbo()}.`, false);
    if (loopController || running) {
        startRun(true);
    }



    /* =====================================================================
       OVERLORD FARMER v3.2.0 — merged in as the wave farmer (active_wave.php)
       Original by Overlord. Runs instead of the dungeon UI on wave pages.
    ====================================================================== */
    function overlordWaveFarmer() {
const BASE       = 'https://demonicscans.org';
const SKILL_ID   = -1;    // power (default 10-stam hit)
const SKILL_COST = 10;
const ATK_GAP    = 1100;  // ms between attacks — the STARTING/safe gap; the real cadence is
                          // adaptive (see _atkGap + attack()): it probes faster on clean hits
                          // and backs off on "Slow down", settling just above the server limit.
const ATK_GAP_MIN = 950;  // never probe below this (server damage.php limit is ~1s)
const ATK_GAP_MAX = 2200; // never back off slower than this
// 🏰 DUNGEON BOSS watch: while a "dungeon boss" target is armed, the main loop + the
// location page-read run at THIS cadence (instead of 12s cache / 60s idle nap) so the
// bot notices the boss room opening within ~3s and fires the instant it goes alive —
// no clock, no button, works AFK. Low enough vs the site rate-limit (retries "Slow down").
const DUNGEON_BOSS_POLL = 3000;
// Stamina potions the bot may drink, in PRIORITY order. RULE (user): NEVER touch FSP
// (item 35, Full Stamina Potion) — only ever spend LSP (251, Large, +5000), and only
// if needed. FSP is kept untouched, so it's deliberately NOT in this list.
const STAM_POTS = [
  { item: 251, name: 'LSP' },   // Large Stamina Potion (+5000) — the primary potion the bot drinks
];
// Full Stamina Potion (item 35). NOT in STAM_POTS on purpose — it's the precious stash.
// Used ONLY as a fallback when the user ticks "use FSP if LSP is out" (S.fspFallback) AND
// every LSP is gone. pickPotion() falls through to it; otherwise FSP is never touched.
const FSP_POT = { item: 35, name: 'FSP' };
// Small Stamina Potion (item 30, +20 stamina) — bought from the merchant (merch_id 1, 50g).
// A lifeline for LOW-LEVEL accounts only: +20 is meaningful for a tiny pool but useless for a
// big one. Above LV1000 it's not even worth drinking (one hit empties it → thrash), so
// pickPotion skips it there. Restocking is opt-in via S.buyStamPotions.
const SSP_POT = { item: 30, name: 'SSP', merchId: 1, refill: 20 };
// above this level, Small Stamina Potions (+20) are useless → never drunk (user: "leva le SSP sopra 1000")
const SSP_MAX_LEVEL = 1000;
// Small Mana Potion (item 162, +20 MP) — bought from the Apothecary of Epidaurus on Olympus
// (olympus_damon_buy.php offer=small_mana, 60k gold, UNLIMITED). Nothing in the farm engine
// CONSUMES mana (it plays Berserker = stamina), so this is a keep-the-bag-topped-up restock
// for mana-class alts: opt-in via S.buyManaPotions, buys a stack of 100 when stock runs low.
const MANA_POT = { item: 162, name: 'Small Mana Potion', offer: 'small_mana', keepStocked: 100, lowAt: 20 };
// Large Mana Potion (item 163, +200 MP) — preferred over the Small one when DRINKING mana to
// keep casting during a "Skill Warm Up" quest (use N class skills). Read into potInv so
// skillWarmup()/drinkMana() know the stock + inv_id. Drinking order: Large (163) then Small (162).
const MANA_POT_L = { item: 163, name: 'Large Mana Potion' };
const MANA_ITEMS = [163, 162];

// Attack tiers (skill_id → stamina). Damage is LINEAR in stamina (verified from
// the battle-page formula: dmg = K * stamina_cost, K constant per fight). So we
// can deliver an EXACT stamina amount by composing tiers, landing within 1
// stamina (=K dmg) of the target instead of overshooting by a whole 10-stam hit.
// Ordered largest→smallest so SKILLS.find(s => s.stam <= want) is greedy.
const SKILLS = [
  { id: -5, stam: 1000 },
  { id: -4, stam: 200  },
  { id: -3, stam: 100  },
  { id: -2, stam: 50   },
  { id: -1, stam: 10   },
  { id:  0, stam: 1    },
];

// ── WAVE / TARGET CONFIG ──────────────────────────────────────────────────────
// useLSP values:
//   false      — no potions
//   'once'     — 1 LSP at start of each mob attack (Pan, Orion)
//   'asNeeded' — LSP every time stamina runs out (G3W8 timed)

// ── DEFAULT CONFIG (serializable → editable from the Settings tab) ─────────────
// No closures here: match is expressed as include/exclude name lists so the whole
// thing can live in GM_setValue. makeMatch() rebuilds the predicate at runtime.
//   include: [] → matches ANY mob; else name must contain one of these
//   exclude: [] → matches everything not containing one of these
// Ships EMPTY on purpose: a fresh install starts with NO targets so nobody
// inherits someone else's farm setup. Add your own from the ⚙ Setup tab →
// open a wave / boss / guild-dungeon page → "🔍 Scan this page" → tick the
// monsters, set the stop-at damage and the mode (⏰ Timed / 🎯 Farm).
const DEFAULT_CONFIG = [];

function makeMatch(include = [], exclude = []) {
  const inc = include.map(s => String(s).toLowerCase().trim()).filter(Boolean);
  const exc = exclude.map(s => String(s).toLowerCase().trim()).filter(Boolean);
  return m => (inc.length === 0 || inc.some(n => m.name.includes(n)))
           && !exc.some(n => m.name.includes(n));
}

// Short human label for a page URL (wave / event / gate / guild dungeon).
function pageLabel(url) {
  try {
    const u = new URL(url, BASE), p = u.searchParams;
    if (u.pathname.includes('active_wave')) {
      if (p.get('gate') && p.get('wave')) return `G${p.get('gate')}W${p.get('wave')}`;
      if (p.get('event'))                 return `Ev${p.get('event')}W${p.get('wave') || '?'}`;
    }
    if (u.pathname.includes('battle.php') && p.get('dgmid')) return `🏰 Dungeon boss ${p.get('dgmid')}`;
    if (u.pathname.includes('guild_dungeon_instance.php')) return `🏰 Dungeon instance ${p.get('id') || ''}`.trim();
    if (u.pathname.includes('guild_dungeon_location.php')) return `🏰 Guild dungeon ${p.get('location_id') || ''}`.trim();
    if (u.pathname.includes('gate.php')) return `Gate ${p.get('id') || ''}`.trim();
    if (u.pathname.includes('wave.php')) return `Wave ${p.get('id') || ''}`.trim();
    return (u.pathname.replace(/^\//, '').replace(/\.php$/, '') + (p.get('id') ? ` ${p.get('id')}` : '')) || url;
  } catch { return url; }
}

// safe "&dead_page=N" append (works whether url already has a query or not)
function withDeadPage(url, p) { return url + (url.includes('?') ? '&' : '?') + 'dead_page=' + p; }

// source url for a config entry: explicit url, or derived from legacy gate/wave.
function srcUrl(w) {
  return w.url || (w.gate != null ? `${BASE}/active_wave.php?gate=${w.gate}&wave=${w.wave}` : '');
}

// Build the runtime WAVES (page sources with compiled match fns) from saved config.
// Disabled sources/targets are dropped so the main loop never sees them.
function buildWaves() {
  return (S.config || []).filter(w => w.enabled !== false && w.kind !== 'dungeon' && w.kind !== 'dungeonloc' && w.kind !== 'single').map(w => ({
    id:    w.id,
    label: w.label || pageLabel(srcUrl(w)) || w.id,
    url:   srcUrl(w),
    targets: (w.targets || []).filter(t => t.enabled !== false).map(t => ({
      ...t,
      match: makeMatch(t.include, t.exclude),
    })),
  })).filter(w => w.url);
}

let WAVES = [];   // populated after S.config is initialized (see STATE section)

// ── STATE ─────────────────────────────────────────────────────────────────────
const SK = 'veyra_mfarm_v1';
const defState = () => ({
  kills: {}, attacks: 0, timers: {}, lspInv: null, potInv: {}, started: Date.now(),
  expPer: {},               // exp-per-mob learned by diffing userExp across loots {name:{avg,n}} — drives the predictive harvest (wait+loot to LEVEL = free stamina, instead of a potion)
  timedKills: 0, timedBy: {}, lspUses: 0, hpHeals: 0, pos: null, config: null,
  fspOnly: false,          // v3.2: drink ONLY Full Stamina Potions (item 35) — LSP/SSP are never used
  bigHitMax: 100,          // v3.2: biggest tier (stamina) used when Exact damage is OFF: 100 | 200 | 1000
  exactDmg: true,          // v3.1: precise stepping on EVERY target (never a big overshoot); conservative K
  bgMode: true,            // v3.1: keep running in a background tab / other app (worker timers + keep-alive)
  debug: false,            // verbose scan/diagnostic log lines (off = clean, user-friendly log)
  farmSeen: {},            // name → last-seen ts: farm mobs we've encountered, so the
                           // 🎯 Farming tab lists what we farm even before the 1st kill
  // ── Leveling rate (replaces the old HP readout in the status grid) ─────────────
  // Baseline fractional level (level + exp/expMax) + its timestamp. The status panel
  // shows the live average lvl/hour = (currentFracLevel − base) / hoursElapsed. Reset
  // by the 🗑 stats button so the average restarts fresh; persists across reloads so
  // the figure is a true running average over the whole session.
  lvlBaseFrac: null, lvlBaseTs: null,
  _g5w11FarmMigrated: false, // one-time: add the g5w11 trash-farm target to existing saves
  paused: false,
  // dgmids of guild-dungeon (cube) instances we've already capped at their damage target.
  // SHARED bosses don't die from our hit, so without remembering this ACROSS page reloads
  // the bot re-engaged them every load and dealt +1 slash each time, creeping past the
  // guild cap. Persisted here; respawns get a NEW dgmid so old entries never block a fresh
  // mob. Bounded to the last 500 to keep GM storage small.
  dlLooted: [],
  minimized: false,        // panel collapsed state — persists across page reloads
  dockPos: null,           // {left,top} of the minimized dock once dragged — persists
  _timedKillsPurged: false, // one-time: drop timed-boss names that leaked into Farming
  // Hit style is now AUTOMATIC by target type (no manual toggle): targets with a damage
  // THRESHOLD/CAP — timed bosses, quests, guild-dungeon bosses — compose tiers EXACTLY
  // (overshoot ≤ 1 stam, no wasted stamina/potions). Farm trash overshoots freely (more
  // Orryphos procs). Hard cap: never use a tier above x100 (100 stam). See fightTarget.
  _farmLspMigrated: false, // one-time: farm targets drink LSP too (user request v1.18.0)
  // Pozioni stamina (LSP): i boss TIMED le usano SEMPRE (così non perdi una finestra di
  // spawn). Questo flag decide solo se ANCHE il FARM le usa:
  //   ON  (checked)   → timed + farm bevono pozioni
  //   OFF (unchecked) → solo i timed bevono; il farm gira con la sola stamina naturale
  // (prima era un kill-switch totale "tutto o niente" — l'etichetta diceva "solo timed"
  // ma in realtà beveva anche per il farm: incoerenza sistemata in v1.23.0.)
  lspEnabled: true,
  // Fallback: when every LSP is gone, drink a FULL Stamina Potion (item 35) instead of
  // waiting for natural regen. OFF by default so the FSP stash stays untouched (the old
  // hard rule); turn it ON in ⚙ Setup to let the bot dip into FSP once LSP runs out.
  fspFallback: false,
  // Low-level lifeline: when stamina potions run out, BUY Small Stamina Potions from the
  // merchant (merch_id 1, 50g) and keep farming. OFF by default (high-level accounts don't
  // need it). Turn ON for a low-level alt in ⚙ Setup. Spends gold.
  buyStamPotions: false,
  // Keep Small Mana Potions (item 162) stocked from the Apothecary of Epidaurus on Olympus
  // (unlimited). OFF by default — only mana-class alts need it. When on, tops the bag up to a
  // stack of 100 when it drops low. Note: the farm engine never DRINKS mana (Berserker); this
  // just supplies the account (manual/PvP use). See maybeRestockMana().
  buyManaPotions: false,
  // Autolevel (low-level alt): spend free stat points into stamina every cycle. Combined
  // with buyStamPotions + FSP fallback it keeps a low account farming & leveling non-stop.
  autolevel: false,
  // ── HP potions (auto-heal) ──────────────────────────────────────────────────
  // Soglia (%) sotto la quale il bot beve una pozione HP (user_heal_potion.php).
  // 0 = OFF: non cura MAI (aspetta la rigenerazione naturale, non spende pozioni).
  // >0 = cura quando HP% ≤ soglia (e comunque alla morte). Slider nel ⚙ Setup.
  // Default 10% = cura solo quando sei quasi morto (prima curava SEMPRE alla morte
  // e l'utente lo trovava troppo aggressivo → ora si sceglie con lo slider).
  hpHealPct: 5,   // FIXED at 5% (no slider any more)
  // ── Mana potions (per classi a mana: Mago/Hunter/ecc., NON il Berserker) ──────
  // Io (Overlord) gioco Berserker → uso Rage, niente mana. Ma le classi a mana spendono MP
  // per le skill: questo controllo dice se e quante pozioni di mana bere quando l'MP è
  // basso. DISABILITATO di default. Il CONSUMO vero si aggancia con l'AutoPvP adattivo
  // (rileva la classe) — vedi useMana(). Mana Potion L (item 163, +200) poi S (162, +20).
  manaEnabled: false,   // checkbox Setup (default OFF)
  manaPots: 500,        // quante pozioni di mana usare (budget) quando abilitato (slider 0–4000)
  manaUsed: 0,          // contatore sessione
  // ── Adventurer's Guild quests (auto accept → farm g3w5 → finish → next) ──
  // ON = il bot accetta una quest disponibile (fuori cooldown), farma il suo mob
  // su g3w5 fino al target del server, la consegna e prende la successiva.
  questEnabled: true,
  questTaken: 0, questDone: 0,   // contatori accettate / consegnate
  questActive: null,             // {id,title,monster,minDmg,have,need} cache per UI + farm
  // ── AUTO-PvP (solo ladder) ────────────────────────────────────────────────────
  // Modulo PvP: si attiva SOLO sulle pagine /pvp.php e /pvp_battle.php. Quando enabled
  // matchmaka da solo (finché ci sono token), gioca ogni turno scegliendo la skill a
  // danno massimo, e IMPARA da ogni match riempiendo pvp.db (per classe avversaria +
  // le mie skill, incl. l'effetto POTENZIATO a Rage piena). enabled=false → giochi a mano.
  pvp: {
    enabled: false,             // toggle ON/OFF (così puoi giocare a mano)
    cur: null,                  // match_id in corso (guida il loop)
    tokensUsed: 0, wins: 0, losses: 0,
    lastPick: '', lastClass: '', note: '',
    tokensAvail: null, tokensCheckedAt: 0, gems: null, refillCost: 500, freeChance: null,  // letti da pvp.php
    matches: [],                // {mid, enemyClass, winner}
    db: { classes: {}, my: {} },// il DB che cresce a ogni match
    // SCOUT: impara TUTTE le classi leggendo i log delle battaglie recenti di ALTRI giocatori
    // (pvp.php → Recent Solo Battles → pvp_battle_state.php?match_id=). Riempie db.classes
    // (skill/danno/effetti/profilo) senza dover combattere ogni classe di persona.
    scout: { enabled: true, seenMids: [], lastRun: 0, learned: 0, cursor: null },
    defSeen: [],                // match_id delle DIFESE già conteggiate nel record (il bot non le gioca)
    curMode: null,              // modalità di filler scelta per il match corrente ('aggressive'|'conserve')
    // ── MULTICLASSE + ALLOW-LIST SKILL (utente) ──────────────────────────────────
    myClass: '',                // la MIA classe, scelta a mano nel tab (guida la strategia). '' = auto (rileva dal match)
    myKit: [],                  // nomi delle skill del mio kit VISTE dal vivo (per le checkbox dell'allow-list)
    restrictSkills: false,      // ON = usa SOLO le skill spuntate (per farmare achievement tipo "usa 20× skill X")
    allowSkills: [],            // nomi delle skill consentite quando restrictSkills è ON (vuoto = nessun vincolo)
  },
});
// KIT per classe (nomi delle skill) — sorgente per le checkbox dell'allow-list quando scegli la
// classe a mano, prima ancora di aver giocato un match. Si fonde col kit visto dal vivo (S.pvp.myKit).
const PVP_CLASSES = ['Berserker', 'Assassin', 'Archer', 'Magic Knight', 'Grand Mage', 'Saint', 'Paladin', 'Inquisitor'];
const PVP_KITS = {
  Berserker:     ['Slash', 'Ironclad Strike', 'Warrior Aura', 'Power Slash', 'Rampage Howl', 'Skullsplitter', 'Ragnarok Cleave'],
  Assassin:      ['Slash', 'Evasion Instinct', 'Venom Rend', 'Death Mark', 'Power Slash', 'Final Wish'],
  Archer:        ['Slash', 'Deadeye Release', 'Poison Bloom', 'Black Sky Volley', 'Piercing Starshot', 'Power Slash'],
  'Magic Knight':['Slash', 'Runebound Slash', 'Spellbreaker Cut', 'Mirror Aegis', 'Eclipse Sever'],
  'Grand Mage':  ['Slash', 'Meteor Sigil', 'Elemental Dominion', 'Mana Collapse', 'Astral Cataclysm'],
  Saint:         ['Slash', 'Blessed Recovery', 'Divine Barrier', 'Miracle Thread', 'Heaven Mercy'],
  Paladin:       ['Slash', 'Radiant Guard', 'Judgment Bash', 'Aegis Intervention', 'Sanctified Verdict'],
  Inquisitor:    ['Slash', 'Brand of Guilt', 'Purifying Flame', 'Confession Breaker', 'Heal', 'Final Sentence'],
};
let S = (() => {
  try { return JSON.parse(GM_getValue(SK, 'null')) || defState(); }
  catch { return defState(); }
})();
// migrate older saved state so new fields always exist
for (const [k, v] of Object.entries(defState())) if (S[k] === undefined) S[k] = v;
// v1.67.0: ensure the PvP scout sub-state exists on saves from before scouting landed.
if (S.pvp && !S.pvp.scout) S.pvp.scout = { enabled: true, seenMids: [], lastRun: 0, learned: 0, cursor: null };
if (S.pvp && !Array.isArray(S.pvp.defSeen)) S.pvp.defSeen = [];
// multiclasse + allow-list skill: assicura i campi su salvataggi precedenti
if (S.pvp) {
  if (S.pvp.myClass == null) S.pvp.myClass = '';
  if (!Array.isArray(S.pvp.myKit)) S.pvp.myKit = [];
  if (S.pvp.restrictSkills == null) S.pvp.restrictSkills = false;
  if (!Array.isArray(S.pvp.allowSkills)) S.pvp.allowSkills = [];
}
// v1.66.0: the hit-style toggle (smallHits) was removed — precision is now automatic by
// target type (threshold/cap → exact, farm trash → free). Drop the dead field from old saves.
delete S.smallHits; delete S._exactMigrated;
// Quest die-timer sanity: values > 4h are stale leftovers from a previous bug that used
// data-expire (~48h) instead of the real fetchAutoDie timer (~22min for wave mobs).
if (S._questNextDie && S._questNextDie - Date.now() > 4 * 3600_000) S._questNextDie = 0;
// seed the editable wave config on first run (or if wiped)
if (!Array.isArray(S.config) || !S.config.length) {
  S.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}
// backfill url + label on legacy gate/wave sources so the URL-based UI works
for (const w of S.config) {
  if (!w.url)   w.url   = srcUrl(w);
  if (!w.label) w.label = pageLabel(w.url) || w.id;
}
const save = () => GM_setValue(SK, JSON.stringify(S));
S.hpHealPct = 5; save();   // Overlord Farmer: auto-heal is locked to 5% (overrides any old saved slider value)

// v1.18.0: l'utente vuole che ANCHE i mob in farming usino le pozioni (LSP), come i
// boss timed. Flippa una volta sola tutti i target farm (non-timed) salvati da
// useLSP:false → 'asNeeded' (FSP resta comunque intoccato — non è in STAM_POTS).
// Da qui in poi i nuovi target farm nascono già con 'asNeeded' (DEFAULT_CONFIG + mkTarget).
if (S._farmLspMigrated !== true) {
  for (const w of (S.config || [])) for (const t of (w.targets || []))
    if (!t.timer && t.useLSP === false) t.useLSP = 'asNeeded';
  S._farmLspMigrated = true; save();
}

// v1.25.0: g5w11 ora farma i trash come g5w10 (mancava il target farm: c'era solo il
// boss Orion timed). Inietta g5w11-farm negli install esistenti SENZA richiedere un
// Reset — 50M/mob, esclude i boss orion+artemis. One-time.
if (S._g5w11FarmMigrated !== true) {
  const w = (S.config || []).find(x => x.id === 'g5w11' || /[?&]gate=5&wave=11\b/.test(srcUrl(x) || ''));
  if (w && !(w.targets || []).some(t => !t.timer)) {
    (w.targets = w.targets || []).push({
      key:'g5w11-farm', label:'G5W11 Farm', include:[], exclude:['orion','artemis'],
      dmgTarget:50_000_000, killLimit:400, useLSP:'asNeeded', timer:false, enabled:true,
    });
  }
  S._g5w11FarmMigrated = true; save();
}

// compile the runtime waves from the saved config; call again after edits
function rebuildWaves() {
  WAVES = buildWaves();
  for (const k of Object.keys(_waveCache)) delete _waveCache[k];   // drop stale cache
}
WAVES = buildWaves();

// Does this mob name belong to a TIMED target anywhere? Timed ALWAYS wins over a
// farm target (especially a wildcard include:[] like g5w10-farm): a timed boss is
// never attacked nor counted by the farm pass, and never shows up in the 🎯 Farming
// list — it lives only under ⏰ Boss timers. (Fixes "general hrazz" leaking into farm.)
function isTimedName(name) {
  const m = { name: String(name || '').toLowerCase().trim() };
  for (const w of WAVES) for (const t of w.targets)
    if (t.timer && t.match(m)) return true;
  return false;
}

// v1.16.2: a farm wildcard used to also count timed bosses (general hrazz landed in
// Farming). Purge any kill entries that belong to a timed target so they leave the
// list; from now on isTimedName() keeps them out.
if (S._timedKillsPurged !== true) {
  for (const name of Object.keys(S.kills || {})) if (isTimedName(name)) delete S.kills[name];
  S._timedKillsPurged = true; save();
}

// ── CONTROL ───────────────────────────────────────────────────────────────────
// paused persists in S so a page navigation doesn't silently resume the bot.
let paused  = S.paused === true;
let running = true;
let status  = 'starting…';

// ── LOG ───────────────────────────────────────────────────────────────────────
const LOG_MAX = 300;                 // keep a deeper history for debugging
const logBuf  = [];
var _vfbCon = null, _vfbConSig = '';
function renderConsole() {
  if (!_vfbCon) return;
  const rows = logBuf.slice(-40);
  const sig = rows.length + '|' + (rows.length ? rows[rows.length - 1].ts + rows[rows.length - 1].msg : '');
  if (sig === _vfbConSig) return;
  _vfbConSig = sig;
  const stick = _vfbCon.scrollTop + _vfbCon.clientHeight >= _vfbCon.scrollHeight - 30;
  _vfbCon.innerHTML = rows.length
    ? rows.map(e => `<div style="color:${e.color === '#aaa' || e.color === '#556' ? '#3ddc97' : e.color}">[${e.ts}] ${e.msg}</div>`).join('')
    : '<div style="color:#5d6a9a">log console — waiting for the bot…</div>';
  if (stick) _vfbCon.scrollTop = _vfbCon.scrollHeight;
}
const fullLog = [];                  // unbounded-ish copyable trace (capped at 2000)

function log(msg, color = '#aaa') {
  const ts  = new Date().toTimeString().slice(0,8);
  logBuf.push({ ts, msg, color });
  if (logBuf.length > LOG_MAX) logBuf.shift();
  try { renderConsole(); } catch {}
  fullLog.push(`${ts} ${msg.replace(/<[^>]+>/g, '')}`);
  if (fullLog.length > 2000) fullLog.shift();
  // copy the whole trace from the console with: copy(window.__farmLog())
  try { window.__farmLog = () => fullLog.join('\n'); } catch {}
  console.log(`[FarmBot ${ts}] ${msg}`);
}

// debug-only log: noisy per-scan / diagnostic lines that a first-time user doesn't need.
// Hidden unless 🐞 Debug log is toggled on in Setup. Keeps the default log readable.
function dlog(msg, color = '#556') { if (S && S.debug) log(msg, color); }

// ── HTTP ──────────────────────────────────────────────────────────────────────
// ── BACKGROUND-SAFE TIMER (v3.1) ─────────────────────────────────────────────────
// Browsers throttle setTimeout in hidden tabs to >=1s and, after ~5 min hidden, to ONCE PER
// MINUTE — that is what made the bot crawl when you switched tab/app. Timers inside a Web
// Worker are NOT throttled, so sleep() is delegated to a tiny worker that posts back when the
// time is up. If the site's CSP blocks the worker we silently fall back to plain setTimeout.
const _bgTimer = (() => {
  let w = null, seq = 0; const pend = new Map();
  try {
    const src = 'self.onmessage=function(e){var d=e.data;setTimeout(function(){self.postMessage(d.id)},d.ms)}';
    w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    w.onmessage = e => { const f = pend.get(e.data); if (f) { pend.delete(e.data); f(); } };
    w.onerror   = () => { w = null; for (const f of pend.values()) f(); pend.clear(); };
  } catch { w = null; }
  return ms => new Promise(r => {
    if (!w) { setTimeout(r, ms); return; }
    const id = ++seq; pend.set(id, r); w.postMessage({ id, ms });
  });
})();
const sleep = ms => _bgTimer(ms);

// Keep-alive so Chrome/Edge don't FREEZE the hidden tab (Web Lock held) and don't treat it as
// idle (near-silent audio; needs one click/tap on the page to start — browser rule).
let _ac = null;
function bgKeepAlive() {
  try { navigator.locks && navigator.locks.request('overlord-bot-alive', () => new Promise(() => {})); } catch {}
  const startAudio = () => {
    try {
      if (!S.bgMode) { if (_ac && _ac.state === 'running') _ac.suspend(); return; }
      if (!_ac) {
        _ac = new (window.AudioContext || window.webkitAudioContext)();
        const o = _ac.createOscillator(), g = _ac.createGain();
        g.gain.value = 0.001; o.frequency.value = 20; o.connect(g); g.connect(_ac.destination); o.start();
      }
      if (_ac.state === 'suspended') _ac.resume();
    } catch {}
  };
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, startAudio, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', startAudio);
}

// fetch with a hard timeout — a stalled request used to hang the whole loop
// forever (no native timeout). On abort we resolve to an error so the loop
// retries on the next cycle instead of freezing on "fetch …".
function fetchT(url, opts = {}, ms = 15000) {
  const ctrl = new AbortController();
  let done = false;
  sleep(ms).then(() => { if (!done) ctrl.abort(); });   // worker timer → not throttled in background tabs
  return fetch(url, { credentials: 'include', ...opts, signal: ctrl.signal })
    .finally(() => { done = true; });
}

async function post(path, data) {
  try {
    const r = await fetchT(`${BASE}/${path}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams(data).toString(),
    }, 12000);
    return await r.json();
  } catch { return null; }
}

async function getHtml(url) {
  try {
    const r = await fetchT(url, {}, 15000);
    if (!r.ok) { log(`HTTP ${r.status} for ${url.slice(-20)}`, '#f66'); return ''; }
    return await r.text();
  } catch (e) {
    log(`fetch timeout/err: ${e.name === 'AbortError' ? 'timeout' : e.message}`, '#f66');
    return '';
  }
}

// ── STAMINA / HP ──────────────────────────────────────────────────────────────
let stam     = 0;
let userHp   = null;   // last known HP (retaliation.user_hp_after / page "X / Y HP")
let hpMaxSure = false;  // true only once max HP is CONFIRMED (heal response or the player's own page bar) — threshold heals need it
let userHpMax = null;  // last known MAX HP (page "X / Y HP" or full-heal response)
let hpEmpty  = false;  // true once HP potions run out (avoid spamming the endpoint)
// persistent counters live on S: S.hpHeals, S.lspUses, S.timedKills

function parseStam(html) {
  const m = html.match(/id="stamina_span"[^>]*>\s*([\d,]+)/)
         || html.match(/Stamina[^\d]{0,20}([\d,]+)/i);
  if (m) stam = parseInt(m[1].replace(/,/g, '')) || stam;
}

// read "12,345 / 67,890 HP" from a page → live HP + max (same source as veyra_colab).
// Lets the % auto-heal threshold work, and refreshes HP so the bot resumes after a
// natural regen when auto-heal is OFF.
function parseHp(html) {
  const m = html.match(/(\d[\d,]+)\s*\/\s*(\d[\d,]+)\s*HP/);
  if (!m) return;
  const cur = parseInt(m[1].replace(/,/g, '')), mx = parseInt(m[2].replace(/,/g, ''));
  // CRITICAL: the first "X / Y HP" on a BATTLE page is the BOSS's bar (e.g. 1.2B / 5.0B), NOT
  // the player. Trusting it set userHpMax = boss HP → hpPct = (real 1.49M)/(5.0B) ≈ 0% → the bot
  // drank an HP potion EVERY hit. Player HP/max come from the damage.php API (user_hp_after) and
  // the heal response instead. Only trust this page bar once we KNOW the player's max and the
  // parsed max is in range of it (rejects the boss bar). No trusted max yet → ignore (API seeds it).
  if (!(userHpMax > 0)) return;
  // the bar is the PLAYER's if it matches the HP the damage API just reported (boss bars never do)
  const matchesMe = userHp != null && Math.abs(cur - userHp) <= Math.max(5, mx * 0.02);
  if (!matchesMe && (mx < userHpMax * 0.5 || mx > userHpMax * 2)) return;   // out of range → it's the boss, skip
  if (Number.isFinite(cur)) userHp = cur;
  if (Number.isFinite(mx) && mx > 0) { userHpMax = mx; if (matchesMe || hpMaxSure) hpMaxSure = true; }
}

// current HP as a percentage of max (null if max unknown yet)
function hpPct() { return (userHpMax > 0 && userHp != null) ? (userHp / userHpMax * 100) : null; }

// ── LEVELING RATE ───────────────────────────────────────────────────────────────
// Read the top bar "LV 4125" + "EXP 84,731,522 / 106,399,325" from any fetched full
// page (battle/wave/dungeon pages all carry the global header). Turns level+exp into a
// single monotonic "fractional level" so we can show a live lvl/hour average — this is
// what replaced the HP readout in the status grid (user: "il conteggio degli hp non mi
// interessa, sostituiscilo con una media di livelli/ora").
let userLevel = null, userExp = null, userExpMax = null;
function parseLevel(html) {
  const lm = html.match(/\bLV\b[^\d]{0,20}?([\d][\d,]*)/i) || html.match(/\bLevel\b[^\d]{0,20}?([\d][\d,]*)/i);
  if (lm) { const v = parseInt(lm[1].replace(/,/g, '')); if (Number.isFinite(v)) userLevel = v; }
  // anchor to the EXP label so we never grab the "X / Y HP" pair by mistake
  const em = html.match(/\bEXP\b[\s\S]{0,200}?([\d][\d,]+)\s*\/\s*([\d][\d,]+)/i);
  if (em) {
    const cur = parseInt(em[1].replace(/,/g, '')), mx = parseInt(em[2].replace(/,/g, ''));
    if (Number.isFinite(cur)) userExp = cur;
    if (Number.isFinite(mx) && mx > 0) userExpMax = mx;
  }
  noteLevelProgress();
}
// level + progress to next level, as one always-increasing number (caps the fraction
// just under 1 so a full bar never reads as the next whole level before it ticks over)
function fracLevel() {
  if (userLevel == null) return null;
  const f = (userExpMax > 0 && userExp != null) ? Math.min(userExp / userExpMax, 0.999) : 0;
  return userLevel + f;
}
// set the baseline the first time we get a reading (after start / after a stats reset)
function noteLevelProgress() {
  const f = fracLevel();
  if (f == null) return;
  if (S.lvlBaseFrac == null || !S.lvlBaseTs) { S.lvlBaseFrac = f; S.lvlBaseTs = Date.now(); save(); }
}
// live average levels gained per hour since the baseline (null until enough time/data)
function lvlPerHour() {
  const f = fracLevel();
  if (f == null || S.lvlBaseFrac == null || !S.lvlBaseTs) return null;
  const hrs = (Date.now() - S.lvlBaseTs) / 3600000;
  if (hrs < 1 / 120) return null;   // <30s elapsed → too noisy to be meaningful yet
  return Math.max(0, (f - S.lvlBaseFrac) / hrs);
}

// Should we spend an HP potion right now? Threshold is user-chosen (S.hpHealPct, the
// slider in ⚙ Setup): 0 = OFF (never auto-heal). Otherwise heal when HP% ≤ threshold.
// If max HP isn't known yet, fall back to "only when actually dead".
function wantHeal() {
  const t = S.hpHealPct | 0;
  if (t <= 0) return false;
  const p = hpPct();
  if (p == null) return userHp != null && userHp <= 0;
  if (!hpMaxSure) return userHp != null && userHp <= 0;   // max HP not confirmed yet → never guess; only heal when actually dead
  return p <= t;
}

function readStamFromDOM() {
  // try to read stamina directly from the current page DOM (no fetch needed)
  const el = document.getElementById('stamina_span')
          || document.querySelector('[id*="stamina"]');
  if (el) {
    const n = parseInt(el.textContent.replace(/[^\d]/g, ''));
    if (!isNaN(n) && n > 0) { stam = n; log(`stamina from DOM: ${stam}`, '#0cf'); return; }
  }
  // fallback: regex on full page text
  const m = document.body?.innerText?.match(/Stamina[^\d]{0,20}([\d,]+)/i);
  if (m) { stam = parseInt(m[1].replace(/,/g, '')); log(`stamina from page: ${stam}`, '#0cf'); }
}

// ── USER ID ───────────────────────────────────────────────────────────────────
const uid = () =>
  document.cookie.split(';')
    .find(c => c.trim().startsWith('demon='))?.split('=')[1]?.trim() || '';

// ── LSP ───────────────────────────────────────────────────────────────────────
// resolve inv_id + qty for every stamina potion in STAM_POTS (parsed from the DOM,
// so it survives markup changes better than a flat regex)
async function refreshInv() {
  const html = await getHtml(`${BASE}/inventory.php`);
  if (!html) return;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  S.potInv = S.potInv || {};
  // Always read FSP stock too (item 35) so the fallback knows how many are left — it's still
  // only ever SPENT when S.fspFallback is on and LSP is out (see pickPotion).
  for (const p of [...STAM_POTS, FSP_POT, SSP_POT, MANA_POT, MANA_POT_L]) {
    const card = doc.querySelector(`[data-item-id="${p.item}"]`);
    if (card) {
      const inv = card.getAttribute('data-inv-id');
      // Quantity: read the count element if present. CRITICAL — when the count can't be read
      // (element missing / empty text) the qty is UNKNOWN, not zero. The old `|| '0'` turned an
      // unreadable LSP count into "0 left", so pickPotion skipped LSP and jumped straight to the
      // FSP fallback while LSP were still in the bag (user bug 2026-08-27). null = unknown →
      // pickPotion treats LSP as available (and self-corrects if a use actually fails), so the
      // precious FSP stash is only touched once LSP are TRULY out.
      const qtyEl  = card.querySelector('.potion-qty-left');
      const qtyRaw = qtyEl ? (qtyEl.textContent || '').replace(/[^\d]/g, '') : '';
      const qtyN   = qtyRaw === '' ? NaN : parseInt(qtyRaw, 10);
      S.potInv[p.item] = { inv, qty: Number.isFinite(qtyN) ? qtyN : null };
    } else {
      delete S.potInv[p.item];
    }
  }
  S.lspInv = S.potInv[251]?.inv || null;   // legacy field, kept in sync
  save();
  const shown = S.fspOnly ? [FSP_POT] : [...STAM_POTS, ...(S.fspFallback ? [FSP_POT] : [])];
  log(`potions: ${shown.map(p => `${p.name} x${S.potInv[p.item]?.qty ?? 0}`).join(' · ')}`, '#0cf');
}

// first potion in priority order that still has stock (LSP only — FSP is never touched)
function pickPotion() {
  // v3.2 FSP-ONLY MODE: skip LSP/SSP entirely, drink only Full Stamina Potions (item 35).
  if (S.fspOnly) {
    const e = S.potInv?.[FSP_POT.item];
    return (e && e.inv && (e.qty == null || e.qty > 0)) ? { ...FSP_POT, inv: e.inv } : null;
  }
  for (const p of STAM_POTS) {
    const e = S.potInv?.[p.item];
    if (e && e.inv && (e.qty == null || e.qty > 0)) return { ...p, inv: e.inv };
  }
  // LV200+: FSP (full refill) beats SSP (+500) — SSP is just a low-level lifeline.
  // Below LV200: SSP comes first (cheap, buyable, fits the stamina pool).
  const highLevel = (S.userLevel || 0) >= 200;
  if (highLevel && S.fspFallback) {
    const e = S.potInv?.[FSP_POT.item];
    if (e && e.inv && (e.qty == null || e.qty > 0)) return { ...FSP_POT, inv: e.inv };
  }
  // Small Stamina Potions (item 30) are a LOW-LEVEL lifeline: +20 stamina is a real top-up
  // for a tiny pool but useless for a big one. Above LV1000 a single hit empties the +20
  // instantly → the bot drinks another SSP, one attack per potion, churning a whole stash
  // (Ezra LV4359: 10k SSP, 3500+ use_item.php calls). So only sip SSP at/below LV1000;
  // higher accounts fall through to FSP (if opted in) or wait for LSP/regen. Usage is NOT
  // gated by S.buyStamPotions (that toggle only controls RESTOCKING); a low account drinks
  // owned SSP regardless.
  if ((S.userLevel || 0) <= SSP_MAX_LEVEL) {
    const e = S.potInv?.[SSP_POT.item];
    if (e && e.inv && (e.qty == null || e.qty > 0)) return { ...SSP_POT, inv: e.inv };
  }
  // Fallback: LSP out + not high-level. Only dip into FSP if opted in.
  if (!highLevel && S.fspFallback) {
    const e = S.potInv?.[FSP_POT.item];
    if (e && e.inv && (e.qty == null || e.qty > 0)) return { ...FSP_POT, inv: e.inv };
  }
  return null;
}

async function useLSP(timer = false) {
  // Timed bosses always drink (don't miss a spawn window). Farm mobs drink only when the
  // user enabled it (toggle ⚙). S.lspEnabled now means "farm uses potions too", NOT a
  // global on/off — timed potions are unconditional.
  if (!timer && !S.lspEnabled) return false;
  let pick = pickPotion();
  if (!pick) { await refreshInv(); pick = pickPotion(); }
  // Low-level lifeline: out of stamina potions but allowed to buy → restock Small Stamina
  // Potions from the merchant (best-effort, throttled), then retry. If the buy fails (no gold
  // / weekly cap), we just fall through and wait for natural regen.
  if (!pick && !S.fspOnly && S.buyStamPotions && (S.userLevel || 0) <= SSP_MAX_LEVEL && Date.now() - (S._stamRestockAt || 0) > 120_000) {
    S._stamRestockAt = Date.now();
    log('🛒 out of stamina potions — buying Small Stamina Potions from merchant…', '#9cf');
    const br = await post('merchant_buy.php', { merch_id: SSP_POT.merchId, qty: 20 });
    if (br?.message || br?.status) log(`🛒 merchant says: ${br.status || ''} ${br.message || ''}`.trim(), '#9cf');
    await refreshInv();
    pick = pickPotion();
    if (pick) log(`🛒 restocked SSP x${S.potInv?.[SSP_POT.item]?.qty ?? '?'}`, '#2f8');
  }
  if (!pick) { log(S.fspOnly ? 'no FSP left (FSP-only mode) — waiting for regen' : S.buyStamPotions ? 'no stamina potions and merchant buy failed (no gold / weekly cap) — waiting for regen' : S.fspFallback ? 'no stamina potions left (LSP + FSP both out)' : 'no LSP left (enable FSP fallback in ⚙ Setup to use FSP)', '#f66'); return false; }

  // Read the RAW response. use_item.php may not return clean JSON — when it didn't,
  // post() returned null, so `ok` was always false: the counter stayed at 0 and
  // stamina was never updated (which also caused a second potion to be wasted).
  let txt = '', data = null, httpStatus = 0;
  try {
    const r = await fetchT(`${BASE}/use_item.php`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({ inv_id: pick.inv, qty: 1 }).toString(),
    }, 12000);
    httpStatus = r.status;
    txt = await r.text();
    try { data = JSON.parse(txt); } catch {}
  } catch (e) { log(`${pick.name} request error: ${e.message}`, '#f66'); return false; }

  // success if JSON says so, OR the raw text mentions success/stamina/refill,
  // OR the text contains no explicit error.
  const ok = !!(data && (data.status === 'success' || data.success === true || data.stamina !== undefined))
          || /success|refill|stamina/i.test(txt)
          || (!!txt && !/error|fail|not enough|don'?t have|invalid/i.test(txt));

  if (ok) {
    S.lspUses++;
    // decrement the local stock so we don't keep picking an empty potion before the
    // next inventory refresh (and so the panel count is live).
    const e = S.potInv?.[pick.item];
    if (e && typeof e.qty === 'number') e.qty = Math.max(0, e.qty - 1);
    // FSP fully refills stamina; LSP gives +5000. Read the new value from the
    // response if present; otherwise assume a refill so the caller doesn't grab a
    // second potion. The next damage.php response carries the real stamina.
    const fromText = (txt.match(/stamina["':\s]+([\d,]+)/i)?.[1] || '').replace(/,/g, '');
    const parsed   = parseInt(data?.stamina ?? fromText);
    // if the response didn't carry the new stamina, assume this potion's nominal refill
    // (SSP +500, LSP/FSP +5000) so we don't over-assume and skip a needed second potion.
    const assumed  = pick.refill || 5000;
    stam = (Number.isFinite(parsed) && parsed > 0) ? parsed : Math.max(stam, assumed);
    save();
  } else if (/not enough|don'?t have|0|empty|invalid/i.test(txt)) {
    // this potion is actually empty — zero it and let the next call fall through to
    // the backup (LSP) on the following attempt.
    if (S.potInv?.[pick.item]) S.potInv[pick.item].qty = 0;
    save();
  }
  log(ok ? `🧪 ${pick.name} used (#${S.lspUses}) — stamina now ${stam} · left x${S.potInv?.[pick.item]?.qty ?? '?'}`
        : `${pick.name} failed — response: ${txt.slice(0, 80).replace(/\s+/g, ' ')}`,
      ok ? '#0cf' : '#f66');
  return ok;
}

// ── HP HEAL ─────────────────────────────────────────────────────────────────
// user_heal_potion.php {user_id} → restores full HP (item 108, no inv_id needed).
// Verified endpoint (same one veyra_colab uses). Returns {status, user_hp,
// potions_remaining}. Called the moment a retaliation kills us so the bot keeps
// fighting instead of sitting dead (which silently stalls ALL attacks).
async function healUp(dead = false) {
  const _hpBefore = hpPct() == null ? '?' : hpPct().toFixed(1);
  // 1) HP POTION (item 108) — instant, no cooldown. Skip once we've learned we have none.
  if (!hpEmpty) {
    const d = await post('user_heal_potion.php', { user_id: uid() });
    const ok = !!(d && (d.status === 'success' || /full hp/i.test(d.message || '')));
    if (ok) {
      userHp = parseInt(d.user_hp) || userHp;
      if (userHp) { userHpMax = Math.max(userHpMax || 0, userHp); hpMaxSure = true; }   // full heal ⇒ this is max HP
      S.hpHeals++; save();
      const left = d.potions_remaining ?? '?';
      if (left === 0 || left === '0') hpEmpty = true;
      log(`${dead ? '💀→❤️ died' : `🩹 HP was ${_hpBefore}% (≤${S.hpHealPct}%)`}: HP potion used (#${S.hpHeals}, left: ${left}) — HP now ${userHp}/${userHpMax}`, '#f44');
      return true;
    }
    // "You do not have a healing potion (ID 108)" → no potion in bag; fall through to free heal
    const msg = d?.message || '';
    if (/no.*potion|0 potion|do(n'?|\s+no)t have|out of|(ID 108)/i.test(msg)) hpEmpty = true;
    else log(`HP potion heal failed: ${msg || 'no resp'}`, '#f66');
  }
  // 1b) RESTOCK from the Apothecary of Epidaurus on Olympus (opt-in — spends gold).
  // olympus_damon_buy.php offer=hp_potion → item 108 (the very potion user_heal_potion.php
  // drinks), 30k gold each, UNLIMITED stock (weekly_limit 0). Buy a stack of 100 so one trip
  // lasts a long time, then RE-TRY the potion — the potion result decides whether it worked.
  // Short throttle (5 min) only to avoid hammering when the account is out of gold.
  if (hpEmpty && S.buyHpPotions && Date.now() - (S._restockAt || 0) > 300_000) {
    S._restockAt = Date.now();
    const hb = await post('olympus_damon_buy.php', { offer: 'hp_potion', qty: 100 });
    if (hb?.message || hb?.status) log(`🛒 Apothecary says: ${hb.status || ''} ${hb.message || ''}`.trim(), '#9cf');
    const d = await post('user_heal_potion.php', { user_id: uid() });
    if (d && (d.status === 'success' || /full hp/i.test(d.message || ''))) {
      hpEmpty = false;
      userHp = parseInt(d.user_hp) || userHp; if (userHp) userHpMax = Math.max(userHpMax || 0, userHp);
      S.hpHeals++; save();
      log(`🛒❤️ bought 100 HP potions from the Apothecary of Epidaurus (Olympus) — HP ${userHp}/${userHpMax}`, '#3f8');
      return true;
    }
    log(`🛒 HP restock gave no usable potion (no gold?)`, '#fa0');
  }
  // 2) FREE RESURRECT (user_heal.php) — "You rise again at full strength", but ~1h cooldown.
  // Use when actually DEAD, or when CRITICAL (≤5% HP with no potions — the account is one
  // retaliation from death anyway; slot-4 sat at 2 HP for a day because this was dead-only).
  // Normal threshold top-ups still never burn the hourly heal.
  const critical = userHpMax > 0 && userHp != null && userHp / userHpMax <= 0.05;
  if ((dead || critical) && Date.now() - (S._freeHealAt || 0) > 3600_000) {
    const d = await post('user_heal.php', { user_id: uid() });
    const ok = !!(d && (d.status === 'success' || /rise again|full strength|healed/i.test(d.message || '')));
    if (ok) {
      S._freeHealAt = Date.now(); S.hpHeals++; save();
      if (userHpMax) userHp = userHpMax;
      log(`💚 free resurrect (no HP potion) — ${d.message || 'ok'} · next in 1h`, '#3f8');
      return true;
    }
    S._freeHealAt = Date.now() - 3600_000 + 5 * 60_000;   // cooldown → back off ~5 min, don't hammer
    log(`💔 no HP potion & free heal on cooldown: ${d?.message || 'no resp'} — enable HP auto-buy (Apothecary of Epidaurus, Olympus)`, '#f66');
  }
  return false;
}

// ── WAVE PARSE ────────────────────────────────────────────────────────────────
// data-boss is ALWAYS 0 (verified) → boss detection is name-based via match fns.
// data-expire = unix timestamp (death/respawn). data-dead = 0 alive / 1 dead.
// _collectMobs / _collectAutoSummon work on ANY root (a parsed doc OR the live
// `document`) so scanning the current page needs no fetch (→ no cookie race).
function _collectMobs(root) {
  const out = {};
  for (const c of root.querySelectorAll('.monster-card')) {
    const id = c.dataset.monsterId;
    if (!id) continue;
    out[id] = {
      id,
      name:    (c.dataset.name || '').toLowerCase().trim(),
      dead:    c.dataset.dead === '1',
      userdmg: parseInt(c.dataset.userdmg || '0'),
      expire:  parseInt(c.dataset.expire || '0'),  // unix ts
    };
  }
  return out;
}
function parseMobs(html) {
  return _collectMobs(new DOMParser().parseFromString(html, 'text/html'));
}

// On a single-boss battle page (battle.php?id=…) the leaderboard widget shows OUR running
// cumulative damage on that boss in #yourDamageValue (e.g. "2,009,123,500"). That's the
// number a 'single' target stops at. Returns an int, or null when the element is absent.
function readYourDamage(root) {
  const el = root && root.querySelector('#yourDamageValue');
  if (!el) return null;
  const n = parseInt((el.textContent || '').replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

// Auto-summon cards carry the authoritative boss timers:
//   .auto-summon-name, data-alive (1/0), data-next-ts (unix respawn ts)
function _collectAutoSummon(root) {
  for (const c of root.querySelectorAll('.auto-summon-card')) {
    const nm = (c.querySelector('.auto-summon-name')?.textContent || '').toLowerCase().trim();
    if (!nm) continue;
    S.timers[nm] = {
      alive:  c.dataset.alive === '1',
      nextTs: parseInt(c.dataset.nextTs || '0'),  // seconds
    };
  }
  save();
}
function parseAutoSummon(html) {
  _collectAutoSummon(new DOMParser().parseFromString(html, 'text/html'));
}

// Guild-dungeon LOCATION page (guild_dungeon_location.php?instance_id=…&location_id=…)
// lists many `.mon` cards — each a SEPARATE boss instance with its own dgmid
// (View → battle.php?dgmid=…&instance_id=…). The monster name comes from the image
// filename (Prismblade_Reaver.webp → "prismblade reaver"); a `.mon.dead` class marks
// a killed/looted instance. Works on a parsed doc OR the live `document`.
// The STABLE monster name is a class-less <div> at the top of the card (verified live
// 2026-07-10: "Orc Stone-Rend"). The IMAGE filename is a per-instance random hash
// (monster_68e5….webp) that changes every daily instance, so reading the name from the
// image made yesterday's name checklist match NOTHING today → "il bot non riconosce il
// dungeon nuovo". Read the card TEXT instead; the pills / HP / stat rows all have a class.
function _monNameFromCard(c) {
  for (const el of c.querySelectorAll('div,span,b,strong,h1,h2,h3,h4,p')) {
    if (el.getAttribute('class')) continue;          // pills/muted/stat* have classes — skip them
    let own = ''; for (const n of el.childNodes) if (n.nodeType === 3) own += n.textContent;
    own = own.replace(/\s+/g, ' ').trim();
    if (own.length >= 2 && own.length <= 40) return own.toLowerCase();
  }
  return '';
}
function _collectDungeonMons(root) {
  const out = [];
  for (const c of root.querySelectorAll('.mon')) {
    const a    = c.querySelector('a[href*="battle.php"]');
    const href = a ? a.getAttribute('href') : '';
    const dgmid       = (href.match(/dgmid=(\d+)/)       || [])[1];
    const instance_id = (href.match(/instance_id=(\d+)/) || [])[1];
    if (!dgmid) continue;
    let name = _monNameFromCard(c);
    if (!name) {   // fallback: old image-filename behaviour (may be an unstable hash)
      const file = (c.querySelector('img')?.getAttribute('src') || '').split('?')[0].split('/').pop() || '';
      name = file.replace(/\.\w+$/, '').replace(/[_-]+/g, ' ').toLowerCase().trim();
    }
    out.push({ dgmid, instance_id, name, dead: /(^|\s)dead(\s|$)/.test(c.className) });
  }
  return out;
}
function parseDungeonMons(html) {
  return _collectDungeonMons(new DOMParser().parseFromString(html, 'text/html'));
}

// ── Guild-dungeon DAILY instance resolver ────────────────────────────────────
// The guild dungeon rotates every day: the same 3 STABLE dungeon TYPES
// (dungeon_info.php?id=1|2|3) get a FRESH instance_id each day. Entry chain (verified
// live 2026-07-10): guild_dungeon.php lists today's OPEN dungeons (button "Enter" →
// guild_dungeon_enter.php?id=N) + yesterday's ("View · ✅ Already looted"). enter id N ==
// instance_id → guild_dungeon_instance.php?id=N → 5× guild_dungeon_location.php?instance_id=N&location_id=1..5.
// A dungeonloc source pinned to yesterday's instance_id fetches a dead page → 0 mobs.
// So we anchor a source to its dungeonType and re-resolve TODAY's open instance_id here.
const _dunInstCache = { ts: 0, byType: {} };   // type(str) → { instanceId }
const DUN_INST_TTL = 5 * 60_000;
async function resolveDungeonInstances(force) {
  if (!force && Date.now() - _dunInstCache.ts < DUN_INST_TTL && Object.keys(_dunInstCache.byType).length)
    return _dunInstCache.byType;
  const html = await getHtml(`${BASE}/guild_dungeon.php`);
  if (!html) return _dunInstCache.byType;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const byType = {};
  for (const info of doc.querySelectorAll('a[href*="dungeon_info.php"]')) {
    const type = (info.getAttribute('href').match(/id=(\d+)/) || [])[1];
    if (!type) continue;
    // climb to the row that also holds this dungeon's Enter link
    let box = info.closest('div,li,article,section') || info.parentElement;
    for (let i = 0; i < 5 && box && !box.querySelector('a[href*="guild_dungeon_enter.php"]'); i++) box = box.parentElement;
    const enter = box?.querySelector('a[href*="guild_dungeon_enter.php"]');
    if (!enter) continue;
    const inst = (enter.getAttribute('href').match(/id=(\d+)/) || [])[1];
    if (!inst) continue;
    const isOpen = /enter/i.test(enter.textContent || '');   // "Enter" = open today; "View" = already looted
    if (isOpen && !byType[type]) byType[type] = { instanceId: inst };   // first OPEN instance per type
  }
  // The CUBE guild dungeon ("The Polyhedral Crucible") has no dungeon_info.php link — its hub
  // card is the `the_cube` banner. Its PvE lanes are ordinary guild_dungeon_location.php pages,
  // so we resolve it as the pseudo-type 'cube' and the rest of the dungeonloc path reuses it.
  for (const img of doc.querySelectorAll('img[src*="the_cube"], img[src*="cube"]')) {
    let box = img.closest('div,li,article,section') || img.parentElement;
    for (let i = 0; i < 5 && box && !box.querySelector('a[href*="guild_dungeon_enter.php"]'); i++) box = box.parentElement;
    const enter = box?.querySelector('a[href*="guild_dungeon_enter.php"]');
    if (!enter || !/enter/i.test(enter.textContent || '')) continue;   // "View" = already looted
    const inst = (enter.getAttribute('href').match(/id=(\d+)/) || [])[1];
    if (inst && !byType.cube) { byType.cube = { instanceId: inst }; break; }
  }
  if (Object.keys(byType).length) { _dunInstCache.ts = Date.now(); _dunInstCache.byType = byType; }
  return _dunInstCache.byType;
}
// Today's live location URL for a source: dungeonType-anchored sources re-resolve the
// daily instance_id; legacy sources fall back to their saved URL. null = today's dungeon
// of this type isn't open (or already looted) → the caller skips this pass.
async function dungeonLocUrl(src) {
  if (src.dungeonType != null && src.location_id != null) {
    const map = await resolveDungeonInstances();
    const inst = map[String(src.dungeonType)]?.instanceId;
    return inst ? `${BASE}/guild_dungeon_location.php?instance_id=${inst}&location_id=${src.location_id}` : null;
  }
  return srcUrl(src);
}

// per-target auto-die timestamp of the currently-alive boss instance (seconds).
// data-expire on the wave card === AUTO_DIE_CFG.nextDieMs on battle.php (verified):
// it's when the boss auto-dies and respawns with a fresh id + reset userdmg.
const liveBoss = {};

const _waveCache = {};
const CACHE_TTL  = 30_000;

// Guild-dungeon LOCATION caches: _dlCache throttles page reads per source; _dlLooted
// records the dgmids we've already dealt our target damage to. PERSISTED across page
// reloads (S.dlLooted = [[dgmid, ts], …]) so a capped cube mob isn't re-hit — and re-hit,
// and re-hit — on every navigation/scan (the bug: "ogni check aggiunge danno"). Entries
// EXPIRE after DL_TTL: the cube is a DAILY dungeon, so yesterday's "done" marks must drop
// or the bot would never farm it again when it re-opens.
const DL_TTL    = 18 * 3600_000;   // 18h — long enough to cover a farming session, short
                                   // enough that the next daily opening starts fresh
const _dlCache  = {};
const _dlLooted = new Map();        // dgmid → timestamp we FULLY claimed it (dead-loot, or genuine server-cap giveup)
const _dlCapTries = {};             // dgmid → consecutive UNDER-target 'cap' exits (give up after 3)
const _dlRetryAt  = {};             // dgmid → don't re-attack before this ts (unspawned boss / locked lane)
// dgmid → { dmg, ts }: for ALIVE shared cube/dungeon mobs, how much damage we dealt before
// stopping at OUR configured target. Unlike _dlLooted this is NOT a permanent "done" flag —
// if the user RAISES the target above `dmg`, the mob is re-attacked for the delta (dealing
// from `dmg` up to the new target). Same/lower target → still skipped (can't un-deal damage).
// (Was the bug: a mob capped at 200M went into _dlLooted and raising the cap never re-hit it.)
const _dlCapDmg = new Map();
for (const e of (S.dlLooted || [])) {   // load surviving (non-expired) marks
  if (Array.isArray(e) && Date.now() - e[1] < DL_TTL) _dlLooted.set(e[0], e[1]);
}
for (const e of (S.dlCapDmg || [])) {   // [dgmid, dmg, ts]
  if (Array.isArray(e) && Date.now() - e[2] < DL_TTL) _dlCapDmg.set(e[0], { dmg: e[1], ts: e[2] });
}
// True only if this dgmid was claimed AND the claim hasn't expired (auto-prunes stale ones
// so a 24/7 run without a reload still re-farms the dungeon when it re-opens next day).
function isLooted(dgmid) {
  const t = _dlLooted.get(dgmid);
  if (t == null) return false;
  if (Date.now() - t >= DL_TTL) { _dlLooted.delete(dgmid); return false; }
  return true;
}
// Mark a dgmid as claimed and persist it (bounded to the last 500 to keep storage small).
// Call save() afterwards (existing call sites already do).
function lootedAdd(dgmid) {
  _dlLooted.set(dgmid, Date.now());
  let arr = [..._dlLooted.entries()];
  if (arr.length > 500) { arr = arr.slice(-500); _dlLooted.clear(); for (const [d, t] of arr) _dlLooted.set(d, t); }
  S.dlLooted = arr;
}
// How much damage we've already dealt to this ALIVE mob (0 if never/expired). Auto-prunes stale.
function capDmgOf(dgmid) {
  const e = _dlCapDmg.get(dgmid);
  if (e == null) return 0;
  if (Date.now() - e.ts >= DL_TTL) { _dlCapDmg.delete(dgmid); return 0; }
  return e.dmg;
}
// A cube/dungeon ALIVE shared mob is DONE for this pass ONLY if we've already dealt >= THIS
// target. It is deliberately NOT gated on isLooted(): the permanent looted flag conflated
// "reached my cap" with "killed/loot-claimed" and — written by the pre-resume code — kept a
// mob blocked for 18h even after you RAISED the cap ("continua a non attaccare"). Raising the
// target makes it not-done again → fightTarget re-joins and self-corrects against the server's
// real totaldmgdealt, so a mob already at cap costs one probe hit (no overshoot) then re-settles.
function dungeonDone(dgmid, dmgTarget) {
  return capDmgOf(dgmid) >= dmgTarget;
}
// Record how far we damaged an alive shared mob (resumable if the target is later raised).
function capDmgAdd(dgmid, dmg) {
  _dlCapDmg.set(dgmid, { dmg, ts: Date.now() });
  let arr = [..._dlCapDmg.entries()].map(([d, v]) => [d, v.dmg, v.ts]);
  if (arr.length > 500) { arr = arr.slice(-500); _dlCapDmg.clear(); for (const [d, dm, t] of arr) _dlCapDmg.set(d, { dmg: dm, ts: t }); }
  S.dlCapDmg = arr;
}

const DEAD_PAGES = 6;   // max dead pages to scan per wave

// View cookies: hide_dead_monsters (1=alive view, 0=dead/unclaimed view) and
// show_dead_bosses_only (1=only dead bosses). These are the 3 wave tabs
// (Show Alive / Show all dead / Dead bosses only).
//
// CRITICAL: write them HOST-ONLY (no domain=), exactly like the page's own
// setCookie. The old code used `domain=demonicscans.org`, which created a SECOND,
// separate cookie that fought the page's host-only one — the server then read the
// wrong value and HID the alive mobs ("lo script nasconde i mob"). We also purge
// those bad domain duplicates once at startup.
function setCookieRaw(name, val) { document.cookie = `${name}=${val}; path=/; SameSite=Lax`; }
function getCookieRaw(name) {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? m[1] : null;
}
function setHideDead(on) { setCookieRaw('hide_dead_monsters', on ? 1 : 0); }

// snapshot/restore the tab the USER has selected, so the bot's reads never change
// what the user sees on the wave page.
function saveUserView() { return { h: getCookieRaw('hide_dead_monsters'), b: getCookieRaw('show_dead_bosses_only') }; }
function restoreUserView(v) {
  setCookieRaw('hide_dead_monsters', v.h != null ? v.h : 1);
  setCookieRaw('show_dead_bosses_only', v.b != null ? v.b : 0);
}
function purgeDomainCookies() {
  for (const n of ['hide_dead_monsters', 'show_dead_bosses_only']) {
    document.cookie = `${n}=; domain=demonicscans.org; path=/; Max-Age=0`;
    document.cookie = `${n}=; domain=.demonicscans.org; path=/; Max-Age=0`;
  }
}

// needDead: scan the dead pages so dead instances (farm trash AND timed bosses)
// can be looted. The cache records whether it included dead; a needDead request
// will NOT reuse an alive-only cache entry (that was the bug that left 100+ mobs
// unlooted — Phase 1 cached alive-only, Phase 2 reused it and never saw the dead).
async function fetchWave(url, needDead = false) {
  const now = Date.now();
  const hit = _waveCache[url];
  if (hit && now - hit.ts < CACHE_TTL && (!needDead || hit.hadDead)) return hit.mobs;

  const view = saveUserView();     // remember the tab the user is on
  setCookieRaw('show_dead_bosses_only', 0);

  // ── ALIVE mobs: hide_dead_monsters=1 ──
  setHideDead(true);
  const html = await getHtml(url);
  parseStam(html);
  parseHp(html);                   // live HP + max (for the % auto-heal threshold)
  parseLevel(html);                // LV + EXP → live lvl/hour figure in the status grid
  parseAutoSummon(html);           // boss timers
  const mobs = parseMobs(html);    // alive cards

  // ── DEAD mobs (for looting): hide_dead_monsters=0 + dead_page pagination ──
  if (needDead) {
    setHideDead(false);
    for (let p = 1; p <= DEAD_PAGES; p++) {
      status = '🔍 checking for loot…'; renderUI();
      const h2   = await getHtml(withDeadPage(url, p));
      const more = parseMobs(h2);
      let added  = 0;
      for (const [id, m] of Object.entries(more)) {
        if (m.dead && !mobs[id]) { mobs[id] = m; added++; }
      }
      if (!added) break;
    }
  }

  restoreUserView(view);   // put the user's selected tab back — never hide their mobs
  const result = Object.values(mobs);
  _waveCache[url] = { ts: Date.now(), mobs: result, hadDead: needDead };
  return result;
}

// ── TIMED WATCHDOG ────────────────────────────────────────────────────────────
// Light check (1 GET per timed-wave, no dead pagination) to see if any timed boss
// is alive and still needs damage. Throttled so it never spams the server.
let _lastTimedCheck = 0;
let _timedInterrupt = false;
// true se in QUESTO giro del mainLoop ho fatto qualcosa di reale (un colpo o un loot). Se a fine
// giro è ancora false e ho stamina, vuol dire "giro a vuoto" (target tutti al cap / niente da
// lootare) → mostro "in attesa" e dormo a lungo invece di scorrere le wave (fetch g5w11…) ogni 600ms.
let _didWork = false;
const TIMED_CHECK_INTERVAL = 25_000;

async function anyTimedReady() {
  if (await armedBossReady()) return true;   // 🎯 armed boss from the timers tab is alive
  const now = Date.now();
  if (now - _lastTimedCheck < TIMED_CHECK_INTERVAL) return false;
  _lastTimedCheck = now;
  for (const wave of WAVES) {
    const timed = wave.targets.filter(t => t.timer);
    if (!timed.length) continue;
    const view = saveUserView();
    setCookieRaw('show_dead_bosses_only', 0);
    setHideDead(true);
    const html = await getHtml(wave.url);   // alive mobs only (light, no dead pages)
    restoreUserView(view);                  // put the user's tab back
    parseStam(html);
    parseAutoSummon(html);
    const mobs = Object.values(parseMobs(html));
    for (const t of timed) {
      // A duel boss in its Duelist/Ascended phase is NOT PvE-attackable: its leaderboard
      // userdmg is frozen from phase 1, so userdmg < dmgTarget stays true forever and would
      // pre-empt farm on this wave indefinitely. Only count a duel target as ready in its
      // fresh phase-1 (plain god name — no "duelist"/"ascended"). processDuelBoss owns the rest.
      const ready = m => !m.dead && t.match(m) && m.userdmg < t.dmgTarget
                      && !(t.duel && /duelist|ascended/i.test(m.name));
      if (mobs.some(ready)) {
        const hit = mobs.find(ready);
        log(`⏰ ${hit.name} ready in ${wave.id} → back to bosses`, '#f90');
        delete _waveCache[wave.url];        // force fresh fetch in phase 1
        return true;
      }
    }
  }
  return false;
}

// The REAL auto-die countdown is NOT the wave card's data-expire (that's a far
// despawn ts). It lives on the boss's battle page as
//   window.AUTO_DIE_CFG = { nextDieMs, serverNowMs }
// (the "AUTO DIES AFTER hh:mm:ss" chip). We fetch it and adjust for client/server
// clock skew, returning a client-clock unix-seconds death time.
async function fetchAutoDie(mid) {
  const html = await getHtml(`${BASE}/battle.php?id=${mid}`);
  // Primary: timed bosses embed AUTO_DIE_CFG = { nextDieMs, serverNowMs } in the page JS.
  const nd = html.match(/nextDieMs\s*:\s*(\d+)/);
  if (nd) {
    const sn = html.match(/serverNowMs\s*:\s*(\d+)/);
    const remainMs = parseInt(nd[1]) - (sn ? parseInt(sn[1]) : Date.now());
    return Math.floor((Date.now() + remainMs) / 1000);
  }
  // Fallback: wave mobs show "Auto die in HH:MM:SS" as plain text without the JS config.
  const tm = html.match(/Auto\s+die\s+in\s+(\d{1,2}):(\d{2}):(\d{2})/i);
  if (tm) {
    const remainMs = (parseInt(tm[1]) * 3600 + parseInt(tm[2]) * 60 + parseInt(tm[3])) * 1000;
    return Math.floor((Date.now() + remainMs) / 1000);
  }
  return null;
}

// Keep the panel's boss death/respawn countdowns fresh even during a long fight
// (the main loop is blocked inside fightTarget for minutes on a big boss). Throttled
// to ~15s. Updates liveBoss (real auto-die, from each alive boss's battle page) +
// S.timers (respawn) without disturbing the user's selected view tab.
let _lastTimerRefresh = 0;
async function refreshTimers() {
  const now = Date.now();
  if (now - _lastTimerRefresh < 15_000) return;
  _lastTimerRefresh = now;
  const seen = new Set();
  for (const wave of WAVES) {
    const timed = wave.targets.filter(t => t.timer);
    if (!timed.length || seen.has(wave.url)) continue;
    seen.add(wave.url);
    const view = saveUserView();
    setCookieRaw('show_dead_bosses_only', 0);
    setHideDead(true);
    const html = await getHtml(wave.url);
    restoreUserView(view);
    if (!html) continue;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    _collectAutoSummon(doc);                         // S.timers (respawn ts)
    const mobs = Object.values(_collectMobs(doc));
    for (const t of timed) {
      const a = mobs.find(m => !m.dead && t.match(m));   // alive matching boss
      if (a) {
        const die = await fetchAutoDie(a.id); if (die) liveBoss[t.key] = die;
      }
      else delete liveBoss[t.key];                        // dead → respawn branch (S.timers)
    }
  }
}

// ── DUEL PHASE ENGINE (multi-phase Olympus bosses: Ares/Artemis/Hermes/Poseidon/…) ──
// These gods insert a solo PvP "Duel Phase" between PvE phase 1 and phase 3. The bot
// now PLAYS THE DUEL HEADLESS (ported from the Multibox engine, protocol captured live
// 2026-08-22) instead of only signalling the user. Cycle, matched by the GOD NAME which
// every phase carries (e.g. "ares"):
//   phase 1  "Ares, Sovereign of the Red Bastion"  → PvE to t.dmgTarget      (leaderboard userdmg)
//   duel     "Ares, Duelist of the Blood Oath"      → play the solo PvP duel  (pvp_style_battle)
//   phase 3  "Ares, Ascended God of Unending War"   → PvE to t.phase3Dmg      (combined userdmg)
// CAVEAT: winning depends on the account's gear (attacker atk vs boss def). On a loss the
// bot sets a 10-minute retry cooldown so it doesn't burn turns on an unwinnable duel.

// --- protocol helpers (pvp_style_battle) ---
async function duelState(activeId, sinceLogId = 0) {
  const txt = await getHtml(`${BASE}/pvp_style_state.php?source=monster_phase&since_log_id=${sinceLogId}&active_id=${activeId}`);
  try { return JSON.parse(txt); } catch { return null; }
}
function duelAction(activeId, action, extra = {}) {
  return post('pvp_style_action.php', { source: 'monster_phase', active_id: activeId, action, ...extra });
}
// phase descriptor for a boss instance id, parsed from its battle.php page:
//   { duel(bool — "Enter Phase Duel" shown), phaseDmg(phase-3 accumulator | null) }
async function readBossPhase(activeId) {
  const html = await getHtml(`${BASE}/battle.php?id=${activeId}`);
  const doc  = new DOMParser().parseFromString(html, 'text/html');
  const duel = !!doc.querySelector('a[href*="pvp_style_battle.php"]')
            || /Enter Phase Duel|entered a\s*(?:<strong>\s*)?solo PvP phase/i.test(html);
  let phaseDmg = null;
  for (const m of html.matchAll(/Phase DMG:\s*([\d,]+)/gi)) {
    const v = parseInt(m[1].replace(/,/g, '')); if (!isNaN(v)) phaseDmg = Math.max(phaseDmg ?? 0, v);
  }
  return { duel, phaseDmg };
}

// greedy skill pick: highest raw damage we can afford in tokens (cost is a good damage
// proxy — Power Slash cost 9 hits ×12; Slash cost 0 is the free filler). Prefer pure-damage
// skills (effect_id 0), else the priciest affordable attack, else the free Slash. `avoid` =
// skill ids that failed this match (advanced nukes needing "full Arcane Charge", a resource
// beyond tokens) — skip them so we don't waste turns on an uncastable skill.
function pickDuelSkill(me, avoid) {
  const bad = avoid || new Set();
  const atk = (me.skills || []).filter(s => s.type === 'attack' && s.target !== 'self' && !bad.has(String(s.id)));
  if (!atk.length) return null;
  const tokens = me.tokens || 0;
  const afford = atk.filter(s => (s.cost || 0) <= tokens);
  const pool   = afford.length ? afford : atk.filter(s => (s.cost || 0) === 0);
  if (!pool.length) return null;
  const pure = pool.filter(s => (s.effect_id || 0) === 0);
  return (pure.length ? pure : pool).slice().sort((a, b) => (b.cost || 0) - (a.cost || 0))[0];
}

// play a duel to completion. Returns true if won (winner_side === 'ally').
async function runDuel(activeId, t) {
  let sinceLog = 0, guard = 0, idle = 0;
  const badSkills = new Set();   // skills that failed this match (need a charge/resource we lack)
  while (running && !paused && guard++ < 400) {
    const st = await duelState(activeId, sinceLog);
    if (!st || !st.ok) { await sleep(2000); if (++idle > 5) return false; continue; }
    idle = 0;
    if (typeof st.last_log_id === 'number') sinceLog = st.last_log_id;
    if (st.match && st.match.ended) return st.match.winner_side === 'ally';
    const me = st.me || {};
    if (!me.in_match) { await duelAction(activeId, 'join_room'); await sleep(800); continue; }
    if (!me.alive) {
      if (me.has_revive_skill) {   // try a revive skill; otherwise the match ends as a loss
        const rev  = (me.skills || []).find(s => s.type === 'revive');
        const meKey = st.teams?.ally?.players_by_num && Object.values(st.teams.ally.players_by_num)[0]?.key;
        if (rev && meKey) { await duelAction(activeId, 'use_skill', { skill_id: rev.id, target_key: meKey }); await sleep(800); continue; }
      }
      await sleep(1500); continue;
    }
    const turn = st.turn || {};
    if (turn.side !== 'ally') { await sleep(Math.min(1500, ((turn.seconds_left || 2) * 1000) / 2 + 400)); continue; }
    // my turn — heal if low & able, else attack the living enemy for max damage
    const enemy = Object.values(st.teams?.enemy?.players_by_num || {}).find(p => p.alive);
    const meP   = Object.values(st.teams?.ally?.players_by_num || {})[0];
    if (!enemy) { await sleep(1000); continue; }
    if (me.has_heal_skill && meP && meP.hp_max && meP.hp / meP.hp_max <= 0.30) {
      const heal = (me.skills || []).find(s => s.type === 'heal' || (s.target === 'self' && /heal/i.test(s.name)));
      if (heal && (heal.cost || 0) <= (me.tokens || 0)) { await duelAction(activeId, 'use_skill', { skill_id: heal.id, target_key: meP.key }); await sleep(700); continue; }
    }
    const skill = pickDuelSkill(me, badSkills);
    if (!skill) { await sleep(1200); continue; }
    const r = await duelAction(activeId, 'use_skill', { skill_id: skill.id, target_key: enemy.key });
    const rmsg = r ? (r.message || '') : '';
    // skill couldn't be cast (advanced nuke needs "full Arcane Charge", cooldown, etc.) →
    // blacklist it for this match and immediately retry with the next-best skill.
    const failed = (r && r.ok === false) || /requires|charge|cooldown|not enough|cannot|need\s|locked|full arcane/i.test(rmsg);
    if (failed && !/dealt|damage/i.test(rmsg)) {
      if (String(skill.id) !== '0') { badSkills.add(String(skill.id)); continue; }  // never blacklist free Slash
      await sleep(600); continue;
    }
    status = `🤺 duel ${shortName(t.label)} · ${fmtDmg(enemy.hp_max - enemy.hp)}/${fmtDmg(enemy.hp_max)}`;
    if (guard % 4 === 0) renderUI();
    await sleep(600);
  }
  const fin = await duelState(activeId, sinceLog);   // final read for the true result
  return !!(fin && fin.match && fin.match.ended && fin.match.winner_side === 'ally');
}

// one tick for a multi-phase (duel) Olympus boss. The boss card is ALWAYS present on the
// wave (id stable across the cycle) but RENAMES per phase — matched by the god name.
async function processDuelBoss(wave, t) {
  const store = (S.duel = S.duel || {});
  const st = store[t.key] || (store[t.key] = { activeId: null, dueled: false, retryAt: 0 });
  delete _waveCache[wave.url];                       // fresh read (phase transitions matter)
  const mobs = await fetchWave(wave.url, false);
  const boss = mobs.find(m => !m.dead && t.match(m));
  if (!boss) return false;                            // boss down / respawning → wait
  if (st.activeId !== boss.id) { st.activeId = boss.id; st.dueled = false; st.retryAt = 0; save(); }  // new cycle

  // "duelist" = duel window; "ascended" = phase-3 title on gods that flip the card name
  // (Ares/Poseidon). Both mean we're past phase 1. Some gods (Artemis) keep the "duelist"
  // name through phase 3, so confirm against battle.php whether the duel is still enterable.
  if (/duelist|ascended/i.test(boss.name)) {
    const phase = await readBossPhase(boss.id);
    if (phase.duel) {
      if (Date.now() < (st.retryAt || 0)) { status = `🤺 ${shortName(t.label)} duel cooldown`; return false; }
      status = `🤺 ${shortName(t.label)} — DUEL`; renderUI();
      log(`🤺 ${t.label} — Duel Phase, playing the duel…`, '#ff5');
      const won = await runDuel(boss.id, t);
      if (won) { st.dueled = true; st.retryAt = 0; save(); log(`🏆 ${t.label} — duel WON, phase 3 unlocked`, '#2f8'); }
      else     { st.retryAt = Date.now() + 10 * 60_000; save(); log(`🤺 ${t.label} — duel not won (tokens/gear?); retry in 10m`, '#fa0'); }
      _didWork = true;
      return true;
    }
    // duel link gone → duel resolved (won here or played by hand) → phase 3 is live
    if (!st.dueled) { st.dueled = true; st.retryAt = 0; save(); log(`🏆 ${t.label} — duel resolved; phase 3 unlocked`, '#2f8'); }
  }

  // ATTACKABLE phase — before the duel = phase 1, after = phase 3
  const target = st.dueled ? (t.phase3Dmg || t.dmgTarget) : t.dmgTarget;
  const tag    = st.dueled ? ' (P3)' : '';
  if (boss.userdmg >= target) {
    status = `${st.dueled ? '✅' : '⚔️'} ${shortName(t.label)} ${st.dueled ? 'P3' : 'P1'} done · ${fmtDmg(boss.userdmg)}`;
    return false;
  }
  status = `⚔️ ${shortName(t.label)} ${st.dueled ? 'P3' : 'P1'}`;
  const { dmg } = await fightTarget({ monster_id: boss.id }, t.label + tag, boss.userdmg, target,
                                    t.useLSP || 'asNeeded', false, null, true, null, true, false);
  if (dmg >= target) {
    log(`✓ ${t.label} ${st.dueled ? 'phase 3' : 'phase 1'} — ${fmtDmg(dmg)}`, '#2f8');
    if (st.dueled) { S.timedKills++; S.timedBy[t.key] = (S.timedBy[t.key] || 0) + 1; save(); }
  }
  return true;
}

// ── COMBAT ────────────────────────────────────────────────────────────────────
// idp = identity params: {monster_id} for waves, {dgmid, instance_id} for guild
// dungeons. The attack tiers/skills and damage.php response are identical; only
// the join/loot endpoints and the mob id differ (verified live).
let _lat = 0;
// ADAPTIVE attack cadence (AIMD). Starts at ATK_GAP and self-tunes per session: every clean
// hit shaves a little off (probe faster), every "Slow down" multiplies it back up (congestion
// backoff). It converges just above the server's real damage.php limit, so the bot runs as fast
// as the server allows without me hardcoding a magic number — and re-adapts if the limit shifts.
let _atkGap = ATK_GAP;

const isDungeon = idp => idp && idp.dgmid != null;

async function join(idp) {
  if (isDungeon(idp))
    await post('dungeon_join_battle.php', { dgmid: idp.dgmid, instance_id: idp.instance_id, user_id: uid() });
  else
    await post('user_join_battle.php', { monster_id: idp.monster_id, user_id: uid() });
}

async function attack(idp, skillId = SKILL_ID, cost = SKILL_COST) {
  const w = _atkGap - (Date.now() - _lat);
  if (w > 0) await sleep(w);
  const d = await post('damage.php', { ...idp, skill_id: skillId, stamina_cost: cost });
  _lat = Date.now();
  if (!d) return null;
  const msg = d.message || '';
  if (msg.includes('Slow down')) {
    // congestion → back off fast (multiplicative) and wait out the new gap, then retry
    const prev = _atkGap;
    _atkGap = Math.min(ATK_GAP_MAX, Math.round(_atkGap * 1.3) + 40);
    if (S.debug && _atkGap !== prev) dlog(`⏱ rate-limited → attack gap ${prev}→${_atkGap}ms`, '#fa0');
    await sleep(_atkGap);
    // A "Slow down" is a TRANSIENT server throttle (we just backed off + slept), NOT a failed
    // attack. Signal it distinctly so fightTarget doesn't count it toward the 5-null ABORT —
    // under IP contention (multibox: 5 workers, 1 IP) throttles cluster and were aborting whole
    // fights at 0 damage. Callers ride through 'throttled' and retry.
    return 'throttled';
  }
  // clean hit (no rate-limit) → probe a little faster next time, down to the floor
  if (_atkGap > ATK_GAP_MIN) _atkGap = Math.max(ATK_GAP_MIN, _atkGap - 60);
  if (/rejoin|removed due/i.test(msg))    { await join(idp);   return null; }
  // death: server refuses the hit while we're dead. Heal+rejoin ONLY if auto-heal is on
  // (S.hpHealPct>0); if it's OFF the user chose not to spend potions → stay dead (the
  // fight loop / processWave skip out and wait for natural HP regen).
  if (/you are dead|you have died|you'?re dead/i.test(msg)) {
    userHp = 0;
    if (S.hpHealPct > 0 && await healUp(true)) { await join(idp); return null; }  // revived (potion/free-heal) → retry the hit
    // dead and NO heal available (out of HP potions, can't buy, free-resurrect on cooldown):
    // don't spin-attack a mob we can't hit (5×abort→retry burns requests + adds to the shared-IP
    // rate-limit that starves the other accounts). Signal the caller to bail and wait for HP.
    return 'dead';
  }
  if (msg.includes('Not enough stamina')) return null;
  if (d.stamina !== undefined) stam = parseInt(d.stamina);
  // track our HP from the boss retaliation; heal when it drops at/below the chosen %
  const ret = d.retaliation || {};
  if (ret.user_hp_after !== undefined) {
    userHp = Math.max(0, parseInt(ret.user_hp_after) || 0);
    // learn the player's true MAX from the player's OWN HP (you start fights at/near full) — never
    // the boss bar. This seeds userHpMax so the % threshold is correct; the heal response refines it.
    if (userHp > (userHpMax || 0)) userHpMax = userHp;
    if (wantHeal()) { if (await healUp()) await join(idp); }
  }
  return d;
}

async function lootMob(idp) {
  const d = isDungeon(idp)
    ? await post('dungeon_loot.php', { dgmid: idp.dgmid, instance_id: idp.instance_id, user_id: uid() })
    : await post('loot.php', { monster_id: idp.monster_id, user_id: uid() });
  if (d?.status === 'success') { _didWork = true; return d.rewards ?? {}; }   // un loot = lavoro reale
  return null;
}

// ── EXACT-DAMAGE FIGHT (shared by waves + dungeons) ────────────────────────────
// Reaches dmgTarget with minimal overshoot: pick the LARGEST tier whose expected
// damage (tier.stam*K) does NOT overshoot the remaining gap; only the final 1-stam
// hit crosses the line → overshoot ≤ one 1-stamina hit. K = dmg per stamina, learned
// from the first reliable hit. knownStart=true when startDmg is the real prior total
// (wave card userdmg); false for dungeons (we don't know it → learn K on hit #2).
// Returns { dmg, reason: 'done'|'dead'|'cap'|'nostam'|'interrupt' }.
const SMALLEST = SKILLS[SKILLS.length - 1];   // 1-stamina Slash
const DMG_SAFETY = 1.03;                      // 3% headroom on the worst-case hit so a big tier never crosses the target
const CAP_SAFETY = 1.25;                      // Dungeon Boss: 25% headroom on the worst-case hit so we land UNDER the cap, never over
const K_WINDOW   = 6;                         // how many recent hits feed the worst-case K
const MAX_TIER_STAM = 100;                    // HARD CAP: never use a tier above x100 (100 stam) — never the 200/1000-stam skills (user rule)

async function fightTarget(idp, label, startDmg, dmgTarget, lsp, interruptible, knownStart, exact = false, harvest = null, timer = false, hardCap = false) {
  await join(idp);
  // K (damage/stamina) is ALWAYS learned from an in-fight `before` (the totaldmgdealt of our
  // previous hit), never from the passed-in startDmg. startDmg comes from the wave page's
  // userdmg and can be stale/misparsed — trusting it once produced garbage K like 504109/stam
  // (impossible for a low-level char) which then mis-sized every tier ("troppo/troppo poco
  // danno"). Cost: the first hit is a 1-stam probe (K unknown) and K lands on hit #2 — cheap.
  let dmg = startDmg, K = 0, stall = 0, nullStall = 0, throttleStall = 0, measured = false;
  const kHist = [];   // recent damage-per-stamina ratios; K = their MAX so a hit can't overshoot on a lucky proc/variance
  void knownStart;
  // seed K from what we learned on this mob before → no blind probe, no overshoot on the first hit
  if (S.mobK && S.mobK[label] > 0) { K = S.mobK[label]; kHist.push(K); }
  status = `→ ${shortName(label)}`;

  while (dmg < dmgTarget && !paused && running) {
    // dead with auto-heal OFF → don't burn an HP potion: bail out quietly and let the
    // bot wait for natural HP regen (the next wave read refreshes userHp).
    if (S.hpHealPct <= 0 && userHp != null && userHp <= 0) return { dmg, reason: 'dead' };
    await refreshTimers();   // keep boss death/respawn countdowns fresh during long fights
    if (interruptible && await anyTimedReady()) { _timedInterrupt = true; return { dmg, reason: 'interrupt' }; }

    const remaining = dmgTarget - dmg;
    // 🎯 THRESHOLD (dungeon miniboss / any target with an explicit damage): dmgTarget is a
    // FLOOR to CROSS — you must EXCEED it or you get NO drops (guild miniboss rule). We're
    // ALLOWED to exceed the guild cap, just not by much, so: approach from below with the
    // biggest non-overshooting tier (precise stepping below), and the FINAL hit falls back to
    // the 1-stam Slash → we cross the target by AT MOST one smallest hit. (Old hardCap STOPPED
    // UNDER the target = 1.9B instead of 2B = no drops; and SKIPPED when K was unknown = joined
    // but 0 damage. Both gone: we probe with the 1-stam Slash, learn K on hit #2, then step
    // precisely and cross. User: "possiamo sforare il cap di gilda, non di tantissimo".)
    // potion ONLY when truly out of stamina — never just to afford a bigger tier
    // (that was the "pozione senza motivo"). With some stamina left we use the
    // biggest tier we can already afford.
    if (stam < 1) {
      // CAP GUARD: se l'ultimo colpo non ha fatto danno (stall>0) il boss è al suo
      // tetto per-giocatore. NON prendere una pozione per inseguire un target
      // irraggiungibile: la sprecheresti (la stamina finirebbe poi sulla wave).
      // Esci subito: i 5000 della pozione restano per il farm, non per colpi a vuoto.
      if (stall > 0) {
        log(`⛔ ${label}: cap reached at ${fmtDmg(dmg)} and out of stamina → leaving WITHOUT a potion`, '#fa0');
        return { dmg, reason: 'cap' };
      }
      // VARIANT B: for farm fights, first try to HARVEST exp (loot dead + briefly wait
      // for near-expiring mobs to die) so a level-up refills stamina → potion saved.
      // Falls back to the potion only if that didn't recover any stamina.
      let recovered = false;
      if (harvest) recovered = await harvest();
      // harvesting (loot dead + brief wait) can refill stamina via a level-up OR a bit
      // of natural regen. RULE: always spend whatever stamina we have before a potion —
      // only drink if it's STILL below a single 1-stam hit. (Was: drank whenever harvest
      // didn't reach the +500 level-up threshold, even if stamina had come back usable →
      // "prendeva la pozione pur avendo stamina residua".)
      if (!recovered && stam < 1 && (lsp === 'asNeeded' || lsp === 'once')) await useLSP(timer);
      if (stam < 1) { log(`out of stamina on ${label} (${stam})`, '#fa0'); return { dmg, reason: 'nostam' }; }
    }
    // pick the attack tier (cap x100 = MAX_TIER_STAM in ALL cases, never 200/1000):
    //  • probe (K unknown) → 1 stam
    //  • PRECISE (threshold target — timed boss, quest, guild-dungeon miniboss: exact||timer||
    //    hardCap) → biggest tier that fits the stamina AND won't overshoot the remaining gap,
    //    stepping 100→…→1 toward the target; the final 1-stam fallback CROSSES it, so we land
    //    just above the target (overshoot ≤ one 1-stam Slash). No wasted stamina where it matters.
    //  • FARM TRASH (no threshold) → biggest affordable tier ≤ x100; overshoot accepted (more
    //    Orryphos free-hit procs). Precision doesn't matter when you're just killing trash for loot.
    // v3.2: the Setup toggle is the master switch. OFF → LARGE HITS on every target (biggest
    // affordable tier, no 1-stam probe, no stepping down) = far fewer requests = much faster.
    // ON → precise stepping as before (threshold/timed/hard-cap targets are always precise).
    // 🏰 HARD CAP (Dungeon Boss): NEVER exceed the target. If even the smallest 1-stam hit could
    // cross the remaining gap (with worst-case variance headroom), stop right here, under the cap.
    if (hardCap && K && SMALLEST.stam * K * CAP_SAFETY > remaining) {
      log(`🛑 ${label}: stopped at ${fmtDmg(dmg)} — next hit would go over ${fmtDmg(dmgTarget)}`, '#9cf');
      return { dmg, reason: 'done' };
    }
    const bigHits = S.exactDmg === false && !(exact || timer || hardCap);   // boss / dungeon-boss / timed targets ALWAYS step precisely (no overdamage)
    const precise = !bigHits && (exact || timer || hardCap || S.exactDmg !== false);
    const bigMax  = Math.max(MAX_TIER_STAM, parseInt(S.bigHitMax) || MAX_TIER_STAM);
    // 🧠 SMART HITTER: with "Exact damage" OFF the biggest tier you picked (x100 / x200 / x1000) is used on EVERY
    // target incl. Dungeon Boss — big hits while far from the stop-at value, then it steps DOWN
    // (1000 → 200 → 100 → … → 1) so the last hits land right on the number. Exact ON = classic max x100.
    const tierCap = S.exactDmg === false ? bigMax : MAX_TIER_STAM;
    let tier;
    // K unknown → ALWAYS the 1-stam probe (a blind 200/1000-stam hit is how you blow past the target).
    // Known K → biggest tier whose worst-case damage still fits inside the remaining gap.
    if (!K)            tier = SMALLEST;
    else if (bigHits)  tier = SKILLS.find(s => s.stam <= bigMax && s.stam <= stam && s.stam * K * DMG_SAFETY <= remaining) || SMALLEST;
    else if (precise)  tier = SKILLS.find(s => s.stam <= tierCap && s.stam <= stam && s.stam * K * (hardCap ? CAP_SAFETY : DMG_SAFETY) <= remaining) || SMALLEST;
    else               tier = SKILLS.find(s => s.stam <= MAX_TIER_STAM && s.stam <= stam) || SMALLEST;

    const before = dmg;
    const res = await attack(idp, tier.id, tier.stam);
    // TRANSIENT rate-limit ("Slow down"): attack() already backed off + slept. Do NOT count it as
    // a failed attack — that was aborting whole fights at 0 damage whenever throttles clustered
    // (multibox IP contention). Keep retrying patiently; only give up after a long stretch so a
    // permanently-throttled IP still eventually frees the worker for another mob.
    if (res === 'throttled') {
      if (++throttleStall >= 60) { log(`⏳ ${label}: rate-limited too long (${fmtDmg(dmg)}/${fmtDmg(dmgTarget)}) → moving on`, '#fa0'); return { dmg, reason: 'err' }; }
      continue;
    }
    // DEAD with no heal available (no HP potion, can't buy, free-resurrect on cooldown): bail
    // instead of spin-attacking a mob we can't damage — the outer loop moves on and retries
    // healing later. Stops the endless 5×-abort loop that also loaded the shared IP.
    if (res === 'dead') { log(`💀 ${label}: dead & can't heal → skipping until HP recovers`, '#fa0'); return { dmg, reason: 'dead' }; }
    throttleStall = 0;
    if (!res) {
      nullStall++;
      if (nullStall >= 5) { log(`⛔ ${label}: 5 failed attacks in a row — aborting`, '#f66'); return { dmg, reason: 'err' }; }
      continue;
    }
    nullStall = 0;
    S.attacks++;
    _didWork = true;                                // ho davvero attaccato → non è un giro a vuoto
    const msg = res.message || '';
    if (msg.includes('Monster is already dead')) { log(`${label} already dead`, '#fa0'); return { dmg, reason: 'dead' }; }
    const nd = parseInt(res.totaldmgdealt || '0');
    if (nd > before) {
      if (measured) {                              // learn K from a hit with a real "before"
        kHist.push((nd - before) / tier.stam);
        if (kHist.length > K_WINDOW) kHist.shift();
        const firstK = !K;
        K = Math.max(...kHist);                    // worst-case (highest) recent per-stamina damage
        if (firstK) {
        // persist per-mob + global max per-stam damage so future HARD-CAP fights gate BEFORE
        // probing → never overshoot the guild cap again on a known mob.
        if (K > 0 && label) { S.mobK = S.mobK || {}; S.mobK[label] = K; S.knownK = Math.max(S.knownK || 0, K); }
        const est = Math.max(1, Math.ceil((dmgTarget - nd) / K));
        log(`${label}: ${fmtDmg(Math.round(K))}/stam → ~${est} stam to target`, '#9cf');
        }
      }
      measured = true;                             // after the first hit, "before" is real
      dmg = nd;
      stall = 0;
    } else {
      stall++;
    }
    const hitDmg = nd - before;
    log(`  ⚔ ${tier.stam}⚡ sk${tier.id} · 💥 +${fmtDmg(hitDmg)} → ${fmtDmg(nd)} / ${fmtDmg(dmgTarget)} · K≈${fmtDmg(Math.round(K))}/st · 🔋${stam}${stall ? ` · ⚠ stall ${stall}` : ''}`, hitDmg > 0 ? '#9be7ff' : '#fa0');
    if (stall >= 3) {
      log(`⛔ ${label}: damage stuck at ${fmtDmg(dmg)}/${fmtDmg(dmgTarget)} (cap or undamageable) → moving on`, '#fa0');
      return { dmg, reason: 'cap' };
    }
    // numbers FIRST so the long monster name (truncated) can't push them out of view
    status = `${fmtDmg(dmg)}/${fmtDmg(dmgTarget)} ${stam}⚡ · ${shortName(label)}`;
    renderUI();
  }
  return { dmg, reason: 'done' };
}

// ── VARIANT B: harvest EXP before spending a stamina potion (farm only) ─────────
// When a FARM target runs out of stamina we'd normally drink an LSP. Instead we first
// LOOT every dead matching mob (free EXP, no stamina). PREDICTIVE: the bot knows how
// much EXP it is from a level-up (userExpMax - userExp) and how much EXP each mob gives
// (learned by diffing userExp across loots → S.expPer). So it computes whether looting
// the mobs that are ABOUT TO AUTO-DIE will cross the level threshold → a level-up refills
// stamina to full = potion saved. It WAITS only when the exp math says a level is actually
// reachable within the time budget; otherwise it returns false at once and the caller
// drinks. No more "drink, take 2 hits, then a mob dies and levels me up anyway" — the
// level-up that was one dying mob away is now anticipated. Strictly bounded by HARVEST_WAIT_CAP.
const HARVEST_WAIT_CAP  = 120_000;  // max total wait per harvest (ms)
const HARVEST_MIN_STAM  = 500;      // stamina jump that counts as "leveled up / recovered"

// learn exp-per-mob by diffing userExp; per-name average, global average as fallback
function recordExpGain(name, gained) {
  if (!name || !(gained > 0)) return;
  const e = S.expPer[name] || { avg: 0, n: 0 };
  e.avg = (e.avg * e.n + gained) / (e.n + 1); e.n++;
  S.expPer[name] = e;
}
function expPerMob(name) {
  const e = S.expPer[name];
  if (e && e.n > 0) return e.avg;
  const all = Object.values(S.expPer).filter(x => x.n > 0);   // fallback: mean of what we've learned
  return all.length ? all.reduce((s, x) => s + x.avg, 0) / all.length : 0;
}
const gapToLevel = () => (userExpMax > 0 && userExp != null) ? Math.max(0, userExpMax - userExp) : Infinity;

async function harvestWaveExp(wave, targets) {
  const farm = (targets || []).filter(t => !t.timer);
  if (!farm.length) return false;
  const stamStart = stam;
  const deadline  = Date.now() + HARVEST_WAIT_CAP;
  const looted    = new Set();
  let   expPrev   = null;       // userExp at the previous fetch (for diff-learning)
  let   pending   = [];         // mob names looted last round, awaiting exp attribution

  while (Date.now() < deadline && !paused && running) {
    delete _waveCache[wave.url];                 // force a fresh read (stamina + EXP + dead mobs)
    const mobs = await fetchWave(wave.url, true);

    // LEARN: attribute the EXP gained since the previous fetch to the batch looted then.
    // Only when the bar went UP (a level-up RESETS it → skip) and the batch was homogeneous
    // (single mob name → a clean per-name signal).
    if (expPrev != null && userExp != null && userExp > expPrev && pending.length) {
      const uniq = [...new Set(pending)];
      if (uniq.length === 1) recordExpGain(uniq[0], (userExp - expPrev) / pending.length);
    }
    if (userExp != null) expPrev = userExp;

    // loot every dead matching farm mob not yet looted this harvest
    const roundNames = [];
    for (const m of mobs.filter(x => x.dead)) {
      if (looted.has(m.id)) continue;
      const t = farm.find(ft => ft.match(m) && !isTimedName(m.name));
      if (!t) continue;
      const r = await lootMob({ monster_id: m.id });
      looted.add(m.id); roundNames.push(m.name);
      if (r !== null && !t.timer && !t.dungeonBoss) {
        S.kills[m.name] = (S.kills[m.name] || 0) + 1;
        log(`loot ✓ ${m.name} — kill #${S.kills[m.name]}${lootSfx(r)}`, '#2f8');
      }
    }
    pending = roundNames;
    save();

    // leveled up? stamina jumped → potion saved
    if (stam >= stamStart + HARVEST_MIN_STAM && stam >= SKILL_COST) {
      log(`🌟 looted/leveled → stamina ${stam} (potion saved)`, '#2f8');
      return true;
    }

    // PREDICTIVE DECISION — will looting the soon-dying matching mobs reach the next level?
    const now   = Math.floor(Date.now() / 1000);
    const dying = mobs
      .filter(m => !m.dead && m.expire > now && !looted.has(m.id)
                   && farm.some(t => t.match(m) && !isTimedName(m.name)))
      .sort((a, b) => a.expire - b.expire);
    if (!dying.length) break;                    // nothing left to wait for → drink

    const gap = gapToLevel();
    let cum = 0, crossAt = -1;                    // accumulate expected exp in death order
    for (let i = 0; i < dying.length; i++) {
      cum += expPerMob(dying[i].name);
      if (cum >= gap) { crossAt = i; break; }
    }
    if (crossAt < 0) {                            // even looting ALL of them won't level up → don't wait
      log(`harvest: dying mobs ≈${fmtDmg(Math.round(cum))} exp < ${fmtDmg(Math.round(gap))} to level → no free stamina, drinking`, '#fa0');
      break;
    }
    const crossExpire = dying[crossAt].expire;    // must wait until THIS mob has died
    if ((crossExpire - now) * 1000 > deadline - Date.now()) {
      log(`harvest: level-up mob dies in ${crossExpire - now}s > wait budget → drinking`, '#fa0');
      break;
    }
    const waitMs = Math.min((dying[0].expire - now) * 1000 + 1500, deadline - Date.now(), 30_000);
    if (waitMs <= 0) break;
    status = `⏳ ${Math.max(1, crossExpire - now)}s → loot ${crossAt + 1} mob(s) to LEVEL UP (save potion)`;
    renderUI();
    await sleep(waitMs);
  }
  return stam >= SKILL_COST && stam >= stamStart + HARVEST_MIN_STAM;
}

// ── PROCESS WAVE ──────────────────────────────────────────────────────────────
// targets: subset of wave.targets to process in this pass (timed OR farm).
// Defaults to all targets (backwards-compatible).
async function processWave(wave, targets = null, interruptible = false) {
  targets = targets || wave.targets;
  // QUIET = nessuna stamina per attaccare: questo giro serve solo a lootare i morti
  // (gratis). Niente "fetch g5… → Polydevourer…" e niente log grigi di scan: lascia
  // lo stato "in attesa" impostato dal mainLoop. I morti vengono comunque lootati
  // (e mostrano cosa si è preso). Vedi richiesta utente: "in attesa → solo waiting".
  const quiet = stam < 1;
  // niente più "fetch g5w11…" sullo status (scorreva tutte le wave a vuoto): lo status mostra
  // solo attività reale (→ mob / danno) o "in attesa". Lo scan resta nel log debug se serve.
  // every target loots its dead instances — farm trash AND timed bosses (a killed
  // boss sits dead until looted). Cache makes this ~1 dead-scan per wave / 30s.
  const needDead = true;
  const mobs = await fetchWave(wave.url, needDead);

  const aliveN = mobs.filter(x => !x.dead).length;
  const deadN  = mobs.filter(x => x.dead).length;
  if (!quiet) dlog(`${wave.id}: ${mobs.length} mobs (${aliveN} alive, ${deadN} dead) [${targets.map(t=>t.key).join('+')}]`, '#555');

  // per-target match trace — debug-only (was flooding the default log every ~3s)
  for (const t of targets) {
    const matched = mobs.filter(m => t.match(m));
    const aliveM  = matched.filter(m => !m.dead);
    if (!quiet && matched.length) {
      dlog(`  [${t.key}] ${matched.length} match, ${aliveM.length} alive: ${aliveM.slice(0,6).map(m=>`${m.name}(${fmtDmg(m.userdmg)})`).join(', ')}${aliveM.length>6?'…':''}`, '#888');
    } else if (!quiet) {
      dlog(`  [${t.key}] no match`, '#444');
    }
    // the alive boss's REAL death countdown comes from its battle page (auto-die),
    // not data-expire — refreshTimers() fetches it. Here we just clear it when dead.
    if (t.timer && !aliveM.length) delete liveBoss[t.key];
    // remember farm mob names we've encountered so the 🎯 Farming tab lists what we're
    // farming even before the first kill lands (user: "il tab farming si deve
    // aggiornare con i mostri che farmo").
    if (!t.timer && !t.dungeonBoss && !t.quest) {
      for (const m of matched) if (!isTimedName(m.name)) S.farmSeen[m.name] = Date.now();
    }
  }

  // loot dead mobs matching this pass's targets (timers come from auto-summon cards)
  for (const m of mobs.filter(x => x.dead)) {
    for (const t of targets) {
      if (!t.match(m)) continue;
      if (!t.timer && isTimedName(m.name)) continue;   // farm never claims a timed boss
      const r = await lootMob({ monster_id: m.id });
      if (r !== null) {
        if (!t.timer && !t.dungeonBoss) {
          S.kills[m.name] = (S.kills[m.name] || 0) + 1;
          log(`loot ✓ ${m.name} — kill #${S.kills[m.name]}${lootSfx(r)}`, '#2f8');
        } else {
          log(`loot ✓ ${m.name}${lootSfx(r)}`, '#2f8');
        }
      }
    }
  }
  save();

  // attack alive targets
  for (const t of targets) {
    if (paused || !running) break;

    // QUEST RE-SYNC: `engaged` is recomputed from the LIVE wave every pass — server
    // credits (have) + mobs VISIBLE on the page already damaged past the quest floor.
    // It used to be a grow-only counter: an engaged mob that vanished without our loot
    // (respawn rotation, someone else's kill) stayed counted forever → "engaged 10/10,
    // have 7/10" and the bot waited for mobs that would never die instead of engaging
    // replacements ("rimane lì in attesa di mob che non muoiono mai").
    if (t.quest && S.questActive) {
      const thr = S.questActive.minDmg || t.dmgTarget;
      const engagedM = mobs.filter(m => t.match(m) && !isTimedName(m.name) && m.userdmg >= thr);
      S.questActive.engaged = Math.min(S.questActive.need || 10, (S.questActive.have || 0) + engagedM.length);
      // data-expire on the wave card is the CARD TTL (~48h for regular wave mobs), NOT
      // the mob's real death time.  The real "Auto die in hh:mm:ss" is AUTO_DIE_CFG on
      // each mob's battle.php page — same source as timed boss timers (fetchAutoDie).
      // Fetch once per newly-engaged mob; cache in _questMobDieTimes.
      for (const m of engagedM.filter(x => !x.dead && !_questMobDieTimes[x.id])) {
        const die = await fetchAutoDie(m.id);
        if (die) _questMobDieTimes[m.id] = die;
      }
      // drop entries for mobs that are no longer alive+engaged
      const _qEngagedIds = new Set(engagedM.filter(m => !m.dead).map(m => String(m.id)));
      for (const k of Object.keys(_questMobDieTimes)) if (!_qEngagedIds.has(k)) delete _questMobDieTimes[k];
      const _qDieTimes = Object.values(_questMobDieTimes);
      S._questNextDie = _qDieTimes.length ? Math.min(..._qDieTimes) * 1000 : 0;
    }

    const alive = mobs.filter(m =>
      !m.dead &&
      t.match(m) &&
      (t.timer || !isTimedName(m.name)) &&        // farm never attacks a timed boss
      m.userdmg < t.dmgTarget &&
      (t.killLimit === null || (S.kills[m.name] || 0) < t.killLimit)
    );

    // dead + auto-heal OFF: nothing to do until HP regenerates (one log, not per-mob spam)
    if (S.hpHealPct <= 0 && userHp != null && userHp <= 0) {
      log(`💀 dead & auto-heal OFF — waiting for HP regen (stop ${t.key})`, '#fa0'); break;
    }

    // `forcePot` = drink potions unconditionally (like a timed boss), ignoring the farm
    // toggle. Timed + dungeon bosses always do. Quest mobs USED to force it too, but that
    // drained potions on quest mobs even when the user had "Stamina potions while farming"
    // OFF (bug: quest mobs that coincide with farm mobs → potions spent). Now quests only
    // force potions when that toggle is ON; otherwise they farm on natural stamina +
    // level-up refills (harvest), same as any farm target. Boss timers are unaffected.
    const forcePot = !!(t.timer || t.dungeonBoss || (t.quest && S.lspEnabled));

    for (const mob of alive) {
      if (paused || !running) break;
      // QUEST CAP: stop ENGAGING new mobs once we've damaged `need` distinct ones — the
      // kill is credited at loot, so engaging more would over-kill (the reported bug:
      // 7 alive → 7 engaged, respawn → 7 more = 14 for a 10-quest). We still loot the
      // dead ones above; we just don't start additional mobs.
      if (t.quest && S.questActive) {
        const need = S.questActive.need || 10;
        if ((S.questActive.engaged || 0) >= need) {
          log(`📜 quest: engaged ${S.questActive.engaged}/${need} mobs — waiting for kills to credit (have ${S.questActive.have || 0})`, '#9cf');
          break;
        }
      }
      // before starting a farm mob, give timed bosses a chance
      if (interruptible && await anyTimedReady()) { _timedInterrupt = true; return; }

      // RULE: never drink with stamina left. The old `useLSP==='once'` here drank a
      // potion at the START of every mob even on a full bar — removed. Potions are
      // taken ONLY below, when stamina is actually exhausted (stam < 1).
      if (stam < 1) {
        // VARIANT B: farm targets first try to harvest exp (loot + wait for expiring
        // mobs → level-up refills stamina) before drinking; timed bosses just drink.
        if (!t.timer) await harvestWaveExp(wave, targets);
        if (stam < 1 && (t.useLSP === 'asNeeded' || t.useLSP === 'once')) await useLSP(forcePot);
        // niente stamina e niente pozione utilizzabile: tutti i mob restanti di
        // questo target richiedono stamina → inutile provarli a uno a uno (era lo
        // spam "no stam — skip" ×42/ciclo). Esci dal target.
        if (stam < 1) { log(`no stamina — stop ${t.key} (${alive.length} mobs waiting for stamina)`, '#fa0'); break; }
      }

      // 🔎 LIVE DAMAGE CHECK (v3.1): the wave list can be ~12s stale. Read YOUR real damage on this
      // mob from its battle page and skip it if it's already at/over the target — never add extra.
      let liveDmg = mob.userdmg;
      try {
        const bh = await getHtml(`${BASE}/battle.php?id=${mob.id}`);
        if (bh) { const v = readYourDamage(new DOMParser().parseFromString(bh, 'text/html')); if (v != null) liveDmg = v; }
      } catch {}
      if (liveDmg >= t.dmgTarget) { mob.userdmg = liveDmg; dlog(`🔎 ${mob.name}: already ${fmtDmg(liveDmg)} ≥ ${fmtDmg(t.dmgTarget)} — skipped`, '#8a8'); continue; }
      log(`→ ${mob.name} (${fmtDmg(liveDmg)} / ${fmtDmg(t.dmgTarget)}) stam:${stam}`, '#7df');
      const { dmg, reason } = await fightTarget(
        { monster_id: mob.id }, mob.name, liveDmg, t.dmgTarget, t.useLSP, interruptible, true, !!t.exact,
        (t.timer || t.dungeonBoss) ? null : (() => harvestWaveExp(wave, targets)), forcePot, !!t.dungeonBoss);
      if (reason === 'interrupt') return;             // a timed boss respawned → bail to phase 1
      if (dmg >= t.dmgTarget) {
        // quest: this mob is now engaged (≥ minDmg) → count it against `need` so we
        // don't start more than required. Credit still arrives via loot.
        if (t.quest && S.questActive) S.questActive.engaged = (S.questActive.engaged || 0) + 1;
        const over = dmg - t.dmgTarget;   // residuo oltre il target (≤ 1 colpo da 1 stam)
        if (t.timer) {
          S.timedKills++;
          S.timedBy[t.key] = (S.timedBy[t.key] || 0) + 1;
          log(`✓ TIMED #${S.timedKills} — ${mob.name} ${fmtDmg(dmg)} (+${fmtDmg(over)} over ${fmtDmg(t.dmgTarget)})`, '#2f8');
        } else {
          log(`✓ ${mob.name} — ${fmtDmg(dmg)} (+${fmtDmg(over)} over)`, '#2f8');
        }
      }
      save();
    }
  }
}

// ── PROCESS DUNGEON (guild dungeon boss on battle.php?dgmid=…&instance_id=…) ────
// One boss per source: join → exact-damage to the configured dmgTarget → loot.
async function processDungeon(src) {
  const t = (src.targets || [])[0];
  if (!t || t.enabled === false) return;
  if (stam < 1) {
    if (t.useLSP) await useLSP(t.timer || t.dungeonBoss);
    if (stam < 1) { log(`no stamina — skip dungeon ${src.label}`, '#fa0'); return; }
  }
  const idp = { dgmid: src.dgmid, instance_id: src.instance_id };
  // MEMORY: this boss' damage total is cumulative on the server. Without remembering it, every
  // cycle restarted from 0 and kept hitting (2.0B → 3.2B → 3.7B…). Skip once the target is reached.
  const capKey = `${src.dgmid}:${src.instance_id}`;
  const already = Math.max(capDmgOf(capKey), typeof src.lastTotal === 'number' ? src.lastTotal : 0);
  if (already >= t.dmgTarget) { status = `✓ ${shortName(src.label)} at target ${fmtDmg(t.dmgTarget)}`; return; }
  if (stam < 1) {
    if (t.useLSP) await useLSP(t.timer || t.dungeonBoss);
    if (stam < 1) { log(`no stamina — skip dungeon ${src.label}`, '#fa0'); return; }
  }
  log(`→ 🏰 dungeon ${src.label} (${already ? fmtDmg(already) + ' → ' : ''}target ${fmtDmg(t.dmgTarget)}) stam:${stam}`, '#7df');
  // startDmg 0 + knownStart=false → fightTarget learns K on hit #2 (we don't know
  // our prior cumulative damage on this boss; totaldmgdealt gives the real total).
  // dungeonBoss → drink unconditionally (timer-like) + hard cap (stay under guild limit).
  // exact=true ALWAYS: a dungeon source has just a damage target → step precisely (never 200/1000-stam big hits).
  const { dmg, reason } = await fightTarget(idp, src.label, already, t.dmgTarget, t.useLSP, false, false, true, null, t.timer || t.dungeonBoss, !!t.dungeonBoss);
  capDmgAdd(capKey, dmg); src.lastTotal = dmg;
  if (reason === 'done' || dmg >= t.dmgTarget || reason === 'dead' || reason === 'cap') {
    const r = await lootMob(idp);
    log(`${reason === 'dead' ? '☠️' : '✓'} dungeon ${src.label} — ${fmtDmg(dmg)}${r ? ' · loot ✓' : ''}`, '#2f8');
  }
  save();
}

// ── PROCESS SINGLE BOSS (world/timed boss on battle.php?id=…) ──────────────────
// One boss per source, added by scanning its own battle page. monster_id = the URL id.
// Reads OUR current cumulative damage on the boss (#yourDamageValue) and attacks until it
// reaches the configured value, then stops. Drinks potions like a timed boss, then loots.
async function processSingle(src) {
  const t = (src.targets || [])[0];
  if (!t || t.enabled === false) return;
  const idp = { monster_id: src.monster_id };
  // Current cumulative damage on this boss, used ONLY to skip when already at target (so we
  // don't keep poking it). Prefer the live page value, else the last total the fight recorded,
  // else fetch once. The FIGHT itself tracks the server's authoritative totaldmgdealt, so a
  // stale/absent seed here can't cause overshoot — worst case is one 1-stam probe hit.
  let cur = null;
  if (currentPageUrl() === srcUrl(src)) cur = readYourDamage(document);
  // FIX: the on-page value is NOT live (it only updates on reload), so it can be far lower
  // than what we already dealt → bot re-attacked past the target forever. Always take the
  // HIGHEST of page value and the last total the fight recorded.
  if (typeof src.lastTotal === 'number') cur = Math.max(cur ?? 0, src.lastTotal);
  if (cur == null) {
    const html = await getHtml(srcUrl(src));
    if (html) cur = readYourDamage(new DOMParser().parseFromString(html, 'text/html'));
  }
  cur = cur ?? 0;
  if (cur >= t.dmgTarget) { status = `✓ ${shortName(src.label)} at target ${fmtDmg(t.dmgTarget)}`; return; }
  if (stam < 1) {
    if (t.useLSP) await useLSP(true);
    if (stam < 1) { log(`no stamina — skip boss ${src.label}`, '#fa0'); return; }
  }
  log(`→ 🎯 ${src.label} (you: ${fmtDmg(cur)} → target ${fmtDmg(t.dmgTarget)}) stam:${stam}`, '#7df');
  // knownStart=false: cur is only a seed for the initial gate. The fight reads the server's
  // totaldmgdealt as the running total (self-correcting) and learns K cleanly on hit #2, so an
  // inaccurate seed can't corrupt precision. exact=true → ≤1-stam overshoot. timer=true → drink.
  const { dmg, reason } = await fightTarget(idp, src.label, cur, t.dmgTarget, t.useLSP, false, false, true, null, true, false);
  src.lastTotal = dmg;   // remember the real total so we skip once it's at/over target
  if (reason === 'done' || dmg >= t.dmgTarget || reason === 'dead') {
    const r = await lootMob(idp);
    log(`${reason === 'dead' ? '☠️' : '✓'} boss ${src.label} — ${fmtDmg(dmg)} / ${fmtDmg(t.dmgTarget)}${r ? ' · loot ✓' : ''}`, '#2f8');
  }
  save();
}

// ── PROCESS GUILD DUNGEON LOCATION (many .mon instances on one location page) ──
// Instances respawn with NEW dgmids, so we can't hardcode them: each pass we re-read
// the location page, loot the dead matching instances, then fight each alive matching
// instance (its CURRENT dgmid) to the target's dmgTarget. Matches by monster NAME
// (include/exclude) exactly like a wave — one source can target several monster types.
async function processDungeonLocation(src) {
  const targets = (src.targets || []).filter(t => t.enabled !== false);
  if (!targets.length) return;

  // throttle the page read: when everything is dead this would otherwise re-fetch
  // ~twice a second (the main loop only sleeps 600ms while stamina is left) and hammer
  // the server. While cached we just skip the pass.
  //   • normal targets        → 12s (gentle, the room isn't time-critical)
  //   • 🏰 dungeon boss armed  → DUNGEON_BOSS_POLL (~3s) so we SEE the room open fast,
  //     but ONLY while the last read had something alive: an empty room / unspawned boss
  //     backs off to 15s (before: 9 location pages hammered every 3s for hours).
  const hasBoss   = targets.some(t => t.dungeonBoss);
  const now = Date.now();
  const hit = _dlCache[src.id];
  const prevAlive = !hit || hit.mons.some(m => !m.dead);
  const readEvery = hasBoss ? (prevAlive ? DUNGEON_BOSS_POLL : 15_000) : 12_000;
  let mons;
  if (hit && now - hit.ts < readEvery) {
    mons = hit.mons;
  } else {
    status = `fetch 🏰 ${src.label}…`; renderUI();
    const locUrl = await dungeonLocUrl(src);
    if (!locUrl) {   // today's dungeon of this type isn't open (or already looted) → nothing to farm
      if (S.debug) log(`🏰 ${src.label}: today's instance not open/looted — skip`, '#558');
      return;
    }
    const html = await getHtml(locUrl);
    if (!html) return;
    parseStam(html);
    mons = parseDungeonMons(html);
    _dlCache[src.id] = { ts: Date.now(), mons };
    const aliveN = mons.filter(m => !m.dead).length;
    log(`🏰 ${src.label}: ${mons.length} instances (${aliveN} alive) [${targets.map(t => t.key).join('+')}]`, '#558');
  }
  const matched = targets.map(t => ({ t, fn: makeMatch(t.include, t.exclude) }));

  // loot dead matching instances — ONCE per dgmid (a looted instance keeps showing
  // until it respawns with a NEW dgmid, so the set never blocks a fresh kill).
  for (const m of mons.filter(x => x.dead)) {
    if (isLooted(m.dgmid)) continue;
    for (const { t, fn } of matched) {
      if (!fn(m)) continue;
      const r = await lootMob({ dgmid: m.dgmid, instance_id: m.instance_id });
      lootedAdd(m.dgmid);
      if (r !== null) {
        if (t.killLimit !== null) S.kills[m.name] = (S.kills[m.name] || 0) + 1;
        const kc   = t.killLimit !== null ? ` · kill #${S.kills[m.name]}` : '';
        const loot = fmtLoot(r);
        log(`💰 loot 🏰 ${m.name}${kc}${loot ? ` → ${loot}` : ' (empty)'}`, '#ffd54a');
      }
      break;   // one target claims it
    }
  }
  save();

  // fight alive matching instances
  for (const { t, fn } of matched) {
    if (paused || !running) break;
    // SKIP mobs we already reached the target on (added to _dlLooted below). Cube mobs
    // are SHARED damage targets that don't die from our hit, so loot fails and they stay
    // "alive" — without this skip the same mob got re-fought every pass and kept dealing
    // damage FAR past the configured target ("continua a fare danno sopra i 200M").
    const alive = mons.filter(m => !m.dead && fn(m) && !dungeonDone(m.dgmid, t.dmgTarget) &&
      (!_dlRetryAt[m.dgmid] || Date.now() >= _dlRetryAt[m.dgmid]) &&
      (t.killLimit === null || (S.kills[m.name] || 0) < t.killLimit));
    for (const m of alive) {
      if (paused || !running) break;
      if (stam < 1) {
        if (t.useLSP) await useLSP(t.timer || t.dungeonBoss);
        if (stam < 1) { log(`no stamina — stop 🏰 ${t.key}`, '#fa0'); return; }
      }
      // resume from the damage we've already dealt (so RAISING the cap only adds the delta,
      // never re-does the whole target). 0 for a fresh mob.
      const already = capDmgOf(m.dgmid);
      log(`⚔️ attacking 🏰 ${m.name} → target ${fmtDmg(t.dmgTarget)}${already ? ` (from ${fmtDmg(already)})` : ''} · 🔋${stam}`, '#7df');
      const idp = { dgmid: m.dgmid, instance_id: m.instance_id };
      // dungeonBoss → exact tiers + drink unconditionally + HARD CAP (never cross the guild limit).
      const { dmg, reason } = await fightTarget(idp, m.name, already, t.dmgTarget, t.useLSP, false, false, !!t.exact || !!t.dungeonBoss, null, t.timer || t.dungeonBoss, !!t.dungeonBoss);
      // DROP RULE: a threshold mob must CROSS the target to drop. If we exited UNDER it
      // (out of stamina, interrupted, or a genuine 0-dmg stall), do NOT claim it — retry
      // next cycle so the next hit's cumulative totaldmgdealt crosses the line ("2B + spiccioli").
      // Only give up (claim without a drop) after 3 consecutive GENUINE per-player-cap stalls,
      // so a truly undamageable mob can't loop forever burning stamina.
      const reached = dmg >= t.dmgTarget || reason === 'dead' || (t.dungeonBoss && reason === 'done');   // dungeon boss stops just UNDER the cap by design
      let giveUp = false;
      if (!reached && reason === 'cap') { _dlCapTries[m.dgmid] = (_dlCapTries[m.dgmid] || 0) + 1; giveUp = _dlCapTries[m.dgmid] >= 3; }
      delete _dlCache[src.id];   // state changed → re-read the page next pass
      // ZERO-DAMAGE stall = the mob isn't attackable AT ALL yet (boss not spawned, lane
      // still locked) — NOT a per-player cap. Marking it "done at target" here poisoned
      // the REAL boss for 18h once it spawned ("vuole attaccare il boss che non è ancora
      // uscito, poi non lo fa più"). Instead: back off 5 min and retry, nothing recorded.
      if (giveUp && dmg <= already) {
        delete _dlCapTries[m.dgmid];
        _dlRetryAt[m.dgmid] = Date.now() + 5 * 60_000;
        log(`⏳ 🏰 ${m.name}: not attackable yet (unspawned/locked) — retry in 5m`, '#fa0');
      } else if (reached || giveUp) {
        delete _dlCapTries[m.dgmid];
        const r = await lootMob(idp);
        // Record HOW FAR we got so we don't re-fight it — but resumably, keyed on the target:
        //  • real kill        → permanent looted flag (dead-loot dedup)
        //  • genuine server cap (can't damage more, still under target) → mark as done AT the
        //    current target (skipped now; RAISING the cap re-probes it, self-limiting via giveUp)
        //  • reached our target → remember the real dmg (RAISING the cap re-attacks only the delta)
        if (reason === 'dead') lootedAdd(m.dgmid);
        else if (giveUp)       capDmgAdd(m.dgmid, t.dmgTarget);
        else                   capDmgAdd(m.dgmid, dmg);
        if (r !== null && t.killLimit !== null) S.kills[m.name] = (S.kills[m.name] || 0) + 1;
        const loot = r !== null ? fmtLoot(r) : null;
        const tag  = reason === 'dead' ? '☠️' : (!reached ? '🛑' : '✅');
        const col  = !reached ? '#fa0' : '#2f8';
        log(`${tag} 🏰 ${m.name} — ${fmtDmg(dmg)} / target ${fmtDmg(t.dmgTarget)}${!reached ? ' (capped · no drop)' : ''}${loot ? ` · 💰 ${loot}` : ''}`, col);
      } else {
        log(`↻ 🏰 ${m.name} at ${fmtDmg(dmg)}/${fmtDmg(t.dmgTarget)} (${reason}) — finishing next cycle`, '#fa0');
      }
      save();
    }
  }
}

// ── CUBE AUTO (multibox) ──────────────────────────────────────────────────────
// A scanned cube source is pinned to the lanes + mob roster of the cube that was
// SCANNED — the next Polyhedral Crucible has different linked_location_ids and
// different mobs, so every new cube silently stopped being farmed until a manual
// re-scan + re-tick ("nuovo cubo non rilevato"). AUTO mode stores NO lane info:
// each pass it resolves TODAY's instance (fresh "Enter" link via
// resolveDungeonInstances → byType.cube), reads the node state embedded in
// guild_dungeon_cube.php, and farms every open pve/boss lane through the normal
// dungeonloc path. The src TARGETS ride along unchanged — the seed builds one
// per-mob target with its OWN hard cap (name-matched, lane-agnostic), plus an
// optional wildcard fallback; a single shared cap violated per-mob guild rules.
// Lanes the vices open mid-run are picked up on the next node read.
const CUBE_NODES_TTL = 60_000;
const _cubeNodes = { ts: 0, inst: null, lanes: [] };
async function cubeOpenLanes() {
  const map = await resolveDungeonInstances();
  const inst = map.cube?.instanceId;
  if (!inst) return { inst: null, lanes: [] };
  if (_cubeNodes.inst === inst && Date.now() - _cubeNodes.ts < CUBE_NODES_TTL) return _cubeNodes;
  const html = await getHtml(`${BASE}/guild_dungeon_cube.php?instance_id=${inst}`);
  if (!html) return _cubeNodes.inst === inst ? _cubeNodes : { inst, lanes: [] };
  const nm = html.match(/"nodes":(\[\{"id":\d[\s\S]*?\}\]),"selected_node_id"/);
  let nodes = [];
  try { nodes = JSON.parse(nm[1]); } catch { nodes = []; }
  // pve lanes + the apex boss gate are all ordinary guild_dungeon_location.php pages
  const lanes = [...new Set(nodes
    .filter(n => (n.type === 'pve' || n.type === 'boss') && n.status === 'available' &&
                 n.linked_location_id && n.monsters_left > 0)
    .map(n => String(n.linked_location_id)))];   // dedupe: nodes can share a linked location
  Object.assign(_cubeNodes, { ts: Date.now(), inst, lanes });
  return _cubeNodes;
}
async function processCubeAuto(src) {
  const { inst, lanes } = await cubeOpenLanes();
  if (!inst) { if (S.debug) log('🧊 cube: no open instance today — skip', '#558'); return; }
  if (!lanes.length) { if (S.debug) log('🧊 cube: no open lanes with monsters left — skip', '#558'); return; }
  for (const loc of lanes) {
    if (paused || !running) break;
    // synthesized per-lane dungeonloc source: same wildcard target + hard cap; the
    // per-lane id keeps _dlCache throttling separate; dungeonLocUrl re-resolves the instance.
    await processDungeonLocation({ ...src, cubeAuto: false, id: `dl-cubeauto-${loc}`,
      location_id: loc, label: `🧊 Cube·L${loc}` });
  }
}

// ── ADVENTURER'S GUILD QUESTS ──────────────────────────────────────────────────
// Quest mobs live on g3w5 (Grakthar W2 — lizardman/goblin/troll). Kill quests: "Kill 10
// <monster> · min 5m dmg". Gather quests: "Gather Nx <item>" → the item DROPS from the
// mob into the inventory and must be DONATED (adventurers_donate_gather.php) to credit.
// Endpoints (verified live from the page's own JS, all POST x-www-form-urlencoded):
//   accept : POST /adventurers_accept_quest.php {quest_id} → {status:'ok'}
//   finish : POST /adventurers_finish_quest.php {quest_id} → ok only if objective met
//   giveup : POST /adventurers_giveup_quest.php {quest_id}
//   donate : POST /adventurers_donate_gather.php {quest_id,item_id} (id = 2nd arg of the
//            row's donateGatherItem(qid,item_id,this) button — the authoritative catalog id)
// Rules: ONE active quest at a time; a finished quest goes on a 2-day rotation
// cooldown (its row then loses the accept button → we just pick another available
// one). Flow per cycle: finish if complete → accept next available → farm its mob
// on g3w5 to ≥minDmg each (server counts the kill when the mob dies with our hit).
const GUILD_URL  = `${BASE}/adventurers_guild.php`;
const QUEST_WAVE = `${BASE}/active_wave.php?gate=3&wave=5`;   // Grakthar W2 — the wave that actually holds the Adventurer's Guild quest mobs (lizardman/goblin/troll). Was g5w9 (Olympus) which held NONE of them → gather items never dropped → gather quests froze at 0/N forever.
const QUEST_DMG  = 5_000_000;            // default min damage per mob (quests ask ≥3–5m)
const QUEST_INTERVAL = 20_000;           // how often we re-read the guild page
let _lastQuest = 0;
let _questCooldowns = [];                 // [{title, ts}] cooldown quests tracked for the UI
let _questMobDieTimes = {};              // monster_id → client-clock death ts (s) from battle.php

// ── BATTLE PASS HUNT CHECK ─────────────────────────────────────────────────────
// Reads battle_pass.php once per hour and checks "Lizards / Sea Beasts / Olympian
// Monsters Hunt" progress. When have >= need the bpAuto source is skipped in the
// farm loop (wave.id === 'bp-hunt'). S._bpDone persists so a completed hunt stays
// skipped across restarts without re-fetching immediately.
const BP_URL           = `${BASE}/battle_pass.php`;
const BP_CHECK_INTERVAL = 3_600_000;   // re-check every hour
let _lastBpCheck = 0;

async function checkBpHunt() {
  if (!S.config || !S.config.some(s => s.id === 'bp-hunt')) return; // bpAuto not injected
  if (Date.now() - _lastBpCheck < BP_CHECK_INTERVAL && S._bpNeed != null) return;
  _lastBpCheck = Date.now();
  const html = await getHtml(BP_URL);
  if (!html) return;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const row of doc.querySelectorAll('.quest')) {
    const title = (row.querySelector('strong')?.textContent || '').toUpperCase();
    if (!/LIZARD|SEA BEAST|OLYMPIAN/i.test(title)) continue;
    const m = (row.querySelector('.muted:last-child, .muted:last-of-type')?.textContent || '').match(/(\d[\d,]*)\s*\/\s*(\d[\d,]*)/);
    if (!m) break;
    const have = parseInt(m[1].replace(/,/g, ''));
    const need = parseInt(m[2].replace(/,/g, ''));
    const done = have >= need;
    if (S._bpHave !== have || S._bpNeed !== need) {
      S._bpHave = have; S._bpNeed = need; S._bpDone = done; save();
      log(`🎫 BP hunt: ${have}/${need}${done ? ' ✅ completato — salto lizardman' : ` (${need - have} mancanti)`}`, done ? '#2f8' : '#9cf');
    }
    break;
  }
}

const _qid = el => parseInt((el.getAttribute('onclick') || '').match(/\((\d+)/)?.[1] || '0');

// the monster a quest targets: req-text "Monster: X" → desc "Kill N X while …" →
// "from (a/the/defeated) X" → title keyword fallback.
function questMonster(row) {
  const req = row.querySelector('.quest-req-text')?.textContent || '';
  let m = req.match(/Monster:\s*([^·\n]+?)\s*(?:·|$)/i);
  if (m) return m[1].trim().toLowerCase();
  const desc = row.querySelector('.quest-main-desc')?.textContent || '';
  // objective verb varies (Kill/Slay/Defeat/Hunt/Destroy…); the monster name runs until a
  // boundary word (while/before/that…) or punctuation — was "Kill … while dealing" only,
  // which missed "Slay 5 Troll Ravagers before …" → quest couldn't locate the mob.
  m = desc.match(/(?:Kill|Slay|Defeat|Hunt|Destroy|Slaughter|Eliminate|Vanquish|Cull|Purge)\s+[\d,]+\s+(.+?)(?:\s+(?:while|before|that|so|and|near|in|along|to|for|who)\b|[.,!]|$)/i);
  if (m) return m[1].trim().toLowerCase();
  // gather quests: "from (a/an/the/defeated) X" — capture the 1–2 Capitalised words of the
  // creature name (NOT anchored to end-of-line, which greedily grabbed "Lizardmen so the
  // Guild's artisans…"). "Collect 10 Lizardman Scales from defeated Lizardmen" → "lizardmen".
  m = desc.match(/\bfrom\s+(?:(?:a|an|the|defeated)\s+)*([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?)/);
  if (m) return m[1].trim().toLowerCase();
  // fallback: infer from quest title keywords (for gather quests with unusual phrasing)
  const title = (row.querySelector('.quest-main-title')?.textContent || '').toLowerCase();
  if (/orc/i.test(title))    return 'orc';
  if (/goblin/i.test(title)) return 'goblin';
  if (/lizard/i.test(title)) return 'lizardman';
  if (/troll/i.test(title))  return 'troll';
  return null;
}
function questMinDmg(row) {
  // req-text format: "min 5m dmg" or "min 5,000,000 dmg" — handle both K/M/B suffixes and plain digits
  const m = (row.querySelector('.quest-req-text')?.textContent || '').match(/min\s*([\d,.]+)\s*([kmb])?\s*dmg/i);
  if (!m) return QUEST_DMG;
  const n = Math.round(parseFloat(m[1].replace(/,/g, '')) * ({'k':1e3,'m':1e6,'b':1e9}[(m[2]||'').toLowerCase()] || 1));
  return n > 0 ? n : QUEST_DMG;
}
// Item-gather quest: description uses "Gather/Collect/Bring/Obtain/Deliver", OR (reliable
// fallback) no "min X dmg" requirement — kill quests always have one (format: "min 5m dmg").
// NOTE: "Bring down the monster" in quest lore text would wrongly trigger "Bring" → also
// check that the description is NOT a kill quest via "Kill N <monster>" to avoid false positives.
function questIsGather(row) {
  const desc = row.querySelector('.quest-main-desc')?.textContent || '';
  // Reliable kill-quest indicator: "Kill N <Monster>" appears in the description body.
  if (/\bKill\s+\d+\b/i.test(desc)) return false;
  if (/\b(?:Gather|Collect|Obtain|Deliver)\b/i.test(desc)) return true;
  // "Bring" alone is ambiguous ("Bring down the beast" vs "Bring 10 pelts") — only treat as
  // gather when it's followed by a quantity ("Bring 10", "Bring us X amount").
  if (/\bBring\s+\d+/i.test(desc)) return true;
  const req = row.querySelector('.quest-req-text')?.textContent || '';
  // req-text has "min Xm dmg" for kill quests; parse with suffix so "5m" matches correctly.
  return !/min\s*[\d,.]+\s*[kmb]?\s*dmg/i.test(req);
}
// GATHER quests deliver an ITEM, not a kill: the mob drops it into the inventory and you must
// DONATE it to the Guild (adventurers_donate_gather.php {quest_id,item_id}) to credit progress.
// The item name comes from the req-text ("Gather 2x item(s) · Item: Goblin Essence") → "Goblin
// Essence"; fallback: the description ("Collect N X from …"). Used to match the inventory card.
function questItem(row) {
  const req = row.querySelector('.quest-req-text')?.textContent || '';
  let m = req.match(/Item:\s*([^·\n]+?)\s*(?:·|$)/i);
  if (m) return m[1].trim();
  const desc = row.querySelector('.quest-main-desc')?.textContent || '';
  m = desc.match(/(?:Gather|Collect|Obtain|Bring)\s+\d+x?\s+(?:vials?\s+of\s+|pieces?\s+of\s+|samples?\s+of\s+)?([A-Za-z][A-Za-z' ]+?)(?:\s+from|[.,]|$)/i);
  return m ? m[1].trim() : null;
}
// how many items a GATHER quest needs ("Gather 2x item(s)" → 2). Falls back to the progress bar.
function questGatherNeed(row) {
  const req = row.querySelector('.quest-req-text')?.textContent || '';
  const m = req.match(/Gather\s+(\d+)\s*x/i);
  return m ? parseInt(m[1]) : null;
}
// SKILL WARM UP quest ("Use N skills against monsters"): no target mob — the counter credits
// class skills that cost MANA. Detected from the objective verb or the title.
function questIsSkill(row) {
  const desc  = row.querySelector('.quest-main-desc')?.textContent || '';
  const title = row.querySelector('.quest-main-title')?.textContent || '';
  return /use\s+\d+\s+skills?/i.test(desc) || /skill\s*warm.?up/i.test(title);
}

// the single active quest (row carrying give-up/finish controls), or null
function parseActiveQuest(doc) {
  for (const row of doc.querySelectorAll('.quest-row')) {
    const fin = row.querySelector('[onclick*="finishQuest"]');
    const giv = row.querySelector('[onclick*="giveUpQuest"]');
    if (!fin && !giv) continue;
    const pm   = (row.querySelector('.quest-progress')?.textContent || '').match(/([\d,]+)\s*\/\s*([\d,]+)/);
    const have = pm ? parseInt(pm[1].replace(/,/g, '')) : 0;
    const skill  = questIsSkill(row);
    const gather = !skill && questIsGather(row);
    const need = pm ? parseInt(pm[2].replace(/,/g, '')) : (skill ? 20 : gather ? (questGatherNeed(row) || 1) : 10);
    // AUTHORITATIVE gather item id: the active row's "Donate instead" button is
    // donateGatherItem(quest_id, item_id, this). The 2nd arg is the catalog item_id the
    // donate endpoint wants — read it straight from here instead of guessing from the
    // inventory (name-scan was fragile / could grab the wrong id → donation never credited).
    const don = row.querySelector('[onclick*="donateGatherItem"]');
    const donItem = don ? parseInt((don.getAttribute('onclick') || '').match(/donateGatherItem\(\s*\d+\s*,\s*(\d+)/)?.[1] || '0') : 0;
    return {
      id: _qid(fin || giv), have, need,
      finishable: !!fin || (need > 0 && have >= need),
      monster: skill ? '' : questMonster(row), minDmg: (skill || gather) ? 0 : questMinDmg(row), gather, skill,
      item: gather ? questItem(row) : null,
      donateItemId: donItem || null,
      title: (row.querySelector('.quest-main-title')?.textContent || '').trim(),
    };
  }
  return null;
}

// quests we can accept right now (accept button present, not on 2-day cooldown,
// charges remaining). Cooldown rows replace the button with a data-cooldown-ts
// countdown → they have no accept button, so they're skipped naturally.
function parseAvailableQuests(doc) {
  const out = [], now = Math.floor(Date.now() / 1000);
  for (const row of doc.querySelectorAll('.quest-row')) {
    const acc = row.querySelector('[onclick*="acceptQuest"]');
    if (!acc) continue;
    const cdEl = row.querySelector('[data-cooldown-ts]');
    if (cdEl && parseInt(cdEl.getAttribute('data-cooldown-ts') || '0') > now) continue;
    const lim = row.textContent.match(/(\d+)\s*\/\s*\d+\s*remaining/i);
    if (lim && parseInt(lim[1]) <= 0) continue;
    const skill  = questIsSkill(row);
    const gather = !skill && questIsGather(row);
    out.push({
      id: _qid(acc), monster: skill ? null : questMonster(row), minDmg: (skill || gather) ? 0 : questMinDmg(row), gather, skill,
      item: gather ? questItem(row) : null, need: skill ? 20 : gather ? (questGatherNeed(row) || 1) : 10,
      title: (row.querySelector('.quest-main-title')?.textContent || '').trim(),
    });
  }
  return out;
}

// quests currently on the 2-day cooldown rotation (no accept button, future
// data-cooldown-ts) → tracked so the UI can show when each frees up again.
function parseQuestCooldowns(doc) {
  const out = [], now = Math.floor(Date.now() / 1000);
  for (const row of doc.querySelectorAll('.quest-row')) {
    const cdEl = row.querySelector('[data-cooldown-ts]');
    if (!cdEl) continue;
    const ts = parseInt(cdEl.getAttribute('data-cooldown-ts') || '0');
    if (ts <= now) continue;   // already off cooldown → it'll be in "available"
    out.push({ title: (row.querySelector('.quest-main-title')?.textContent || 'quest').trim(), ts });
  }
  return out.sort((a, b) => a.ts - b.ts);
}

async function fetchGuild() {
  const html = await getHtml(GUILD_URL);
  return html ? new DOMParser().parseFromString(html, 'text/html') : null;
}

// A gather/kill quest whose creature is ALSO covered by the user's OWN farm config
// (e.g. a low-level alt gathering "Orc Essence" from the very orcs it already farms on
// g3w3) must NOT be redirected to the hardcoded g3w5 quest wave: that wave holds no such
// mob for a low-level char, so the quest would never progress AND — worse — it would
// reserve ALL the stamina and freeze the real farm ("preso una quest ma è ferma"). When
// we detect the overlap we let Phase 2 farm the configured waves instead; the server
// credits the quest (gather item / kill) as those very mobs are looted there.
function questCoveredByConfig(q) {
  if (!q) return false;
  const monster = (q.monster || '').toLowerCase().trim();
  if (!monster) return false;
  // singularise words (men→man, strip trailing 's') so plural/generic quest names ("Lizardmen",
  // "Troll Ravagers") match the singular config mob names.
  const _sing = w => w.replace(/men$/, 'man').replace(/s$/, '');
  const monWords = monster.split(/\s+/).map(_sing).filter(w => w.length >= 3 && w !== 'the' && w !== 'and');
  if (!monWords.length) return false;
  const targetWords = t => []
    .concat(t.include || [], t.srcName ? [t.srcName] : [])
    .flatMap(s => String(s).toLowerCase().split(/\s+/))
    .map(_sing)
    .filter(w => w.length >= 3);
  // Kill quests: ALL name words must match (strict — avoid cross-mob mismatches).
  // Gather quests: ANY word matches (lenient — "troll warriors" → any "troll" target qualifies).
  const wordMatch = (t, w) => targetWords(t).some(tw => tw === w || tw.startsWith(w) || w.startsWith(tw));
  const matches = (t) => q.gather ? monWords.some(w => wordMatch(t, w)) : monWords.every(w => wordMatch(t, w));
  for (const wave of WAVES)
    for (const t of (wave.targets || [])) {
      if (!matches(t)) continue;
      // TIMED target: Phase 1 already kills these on respawn — ALWAYS defer to it, never
      // try g3w5 and never give up waiting. Return 'timed' so the caller can tell the
      // difference (no have>0 guard needed: we just wait for the next respawn kill).
      if (t.timer) return 'timed';
      // Gather quests need no minimum damage — items drop on any kill, so any configured
      // target for that mob type qualifies. Kill quests still require dmgTarget >= minDmg.
      if (q.gather || (t.dmgTarget || 0) >= (q.minDmg || 0)) return true;
    }
  return false;
}

// a transient farm wave for the active quest's monster on g3w5. Unknown monster →
// empty include = match ALL g3w5 mobs (so gather quests still progress). Core token
// only (split on comma) so "Charybdis, Living Maelstrom" matches via "charybdis".
function questWaveFor(q) {
  // GATHER quests: the drop lands only when a SOURCE MOB DIES and we loot its corpse. Tagging it
  // (100k) just leaves the account idle on full stamina while the mob auto-dies on its ~48h timer
  // → ~0 drops/day (multibot bug, fixed 2026-08-17). So KILL the source: target above any gate-3
  // trash HP and let fightTarget stop at 'dead' (or stall out at 'cap' if it's truly unkillable).
  // KILL quests: exact mode, tag each mob at ≈minDmg (the game credits the auto-die kill).
  const GATHER_KILL = 5_000_000_000;   // above any gate-3 trash HP; fightTarget stops at 'dead'
  const dmg = q.gather ? GATHER_KILL : Math.round((q.minDmg || QUEST_DMG) * 1.02);
  // SINGULARISED word-subset match: quest text is often plural/generic ("Troll Ravagers",
  // "Lizardmen") while the wave mob is singular/specific ("Troll Ravager", "Lizardman
  // Shadowclaw"). Normalise BOTH sides the same way (men→man, strip trailing 's') and require
  // every quest word to be in the mob's name → no more plural misses. Empty → match all.
  const _qw = String(q.monster || '').toLowerCase().split(',')[0].split(/\s+/)
    .map(w => w.replace(/men$/, 'man').replace(/s$/, '')).filter(w => w.length >= 3 && w !== 'the' && w !== 'and');
  const questMatch = (m) => {
    const iw = String(m.name || '').toLowerCase().split(/\s+/).map(w => w.replace(/men$/, 'man').replace(/s$/, ''));
    return _qw.length ? _qw.every(w => iw.includes(w)) : true;
  };
  return {
    id: 'quest', label: `Quest: ${q.title}`, url: QUEST_WAVE,
    targets: [{
      key: 'quest', label: q.monster || 'quest mobs', srcName: 'quest',
      match: questMatch, dmgTarget: dmg,
      // Gather: item drops are RNG (not 1 per kill) → DON'T cap kills at `need`, keep farming
      // until enough items are collected+donated (the real stop is have>=need after delivery).
      // Kill quests: exact mode, no killLimit.
      exact: !q.gather, killLimit: null,
      useLSP: 'asNeeded', timer: false, quest: true, enabled: true,
    }],
  };
}

// DELIVER (consegna) the gathered items to the Guild. Gather quests DON'T credit on kill: the
// mob drops an item into the inventory and you must DONATE it (adventurers_donate_gather.php
// {quest_id,item_id}, ONE item per call) to advance the progress bar. This is the step the bot
// used to skip → gather quests stayed at 0/N forever. We read the inventory, match the required
// item by NAME → its data-item-id (the endpoint's item_id), and donate as many as we still need.
// Returns the number donated this pass. The guild re-read reconciles the authoritative progress.
let _lastDonate = 0;
async function donateGatherItems(q) {
  if (!q || !q.gather || !q.id || (!q.donateItemId && !q.item)) return 0;
  if (Date.now() - _lastDonate < 12_000) return 0;   // throttle: drops trickle in — no need to hammer
  _lastDonate = Date.now();
  const html = await getHtml(`${BASE}/inventory.php`);
  if (!html) return 0;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const wantId = q.donateItemId ? String(q.donateItemId) : null;   // authoritative id from the Donate button
  const want = (q.item || '').toLowerCase().replace(/\s+/g, ' ').trim();
  let itemId = null, have = 0;
  for (const c of doc.querySelectorAll('[data-item-id]')) {
    const cid = c.getAttribute('data-item-id');
    const raw = (c.querySelector('.item-name, [class*="name"], b, strong, h3, h4')?.textContent
              || c.getAttribute('title') || c.textContent || '').toLowerCase();
    const base = raw.replace(/\s*x\s*\d+\s*$/, '').replace(/\s+/g, ' ').trim();   // strip trailing "x12"
    const nameMatch = want && (base === want || base.includes(want) || want.includes(base));
    // Prefer the exact item id (inventory data-item-id == catalog id); fall back to name.
    if ((wantId && cid === wantId) || (!wantId && nameMatch)) {
      itemId = cid;
      have = parseInt((raw.match(/x\s*(\d+)/) || [])[1] || '1');
      break;
    }
  }
  if (!itemId || have <= 0) { dlog(`📦 quest: no "${q.item || ('#' + wantId)}" in inventory to deliver yet`, '#778'); return 0; }
  const remaining = Math.max(1, (q.need || 1) - (q.have || 0));
  const toDonate = Math.min(have, remaining);
  let done = 0;
  for (let i = 0; i < toDonate && running; i++) {
    const r = await post('adventurers_donate_gather.php', { quest_id: q.id, item_id: itemId });
    const okDonate = r && !r.error && (r.status === 'ok' || r.status === 'success'
                      || r.success === true || r.ok === true || r.donated || r.progress != null);
    if (okDonate) done++;
    else break;   // out of items / server rejected → stop (guild re-read will re-sync)
    await sleep(350);
  }
  if (done) { q.have = (q.have || 0) + done; log(`📦 delivered ${done}× ${q.item} → ${q.have}/${q.need}`, '#9cf'); save(); }
  return done;
}

// ── SKILL WARM UP quest (ported from the multibox engine) ──────────────────────
// "Use N skills against monsters" — the counter only credits MANA class skills, so we read
// the account's OWN skills off a mob's battle page (works for any class, automatic), pick the
// CHEAPEST mana skill, cast it, and drink mana potions when MP runs out. Needs a class
// selected at LV200+ (the accept filter already gates it).
let _warmupSkill = null;
async function battleSkills(monsterId) {
  const html = await getHtml(`${BASE}/battle.php?id=${monsterId}`);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out = [];
  for (const b of doc.querySelectorAll('.attack-btn, button[data-skill-id]')) {
    const id = b.getAttribute('data-skill-id');
    if (id == null) continue;
    const cost = b.querySelector('.skill-cost')?.textContent || '';
    const mp   = parseInt(b.getAttribute('data-mana-cost') || (cost.match(/(\d+)\s*MP/i) || [])[1] || '0');
    const stam = parseInt((cost.match(/(\d+)\s*STAM/i) || [])[1] || b.getAttribute('data-stam-cost') || '1');
    out.push({ skillId: parseInt(id), name: b.getAttribute('data-skill-name') || '', mp, stam });
  }
  return out;
}
// drink a mana potion (Large 163 first, then Small 162) so MP never blocks a skill cast.
async function drinkMana() {
  if (!S.potInv) await refreshInv();
  for (const item of MANA_ITEMS) {
    const e = S.potInv?.[item];
    if (e && e.inv && (e.qty == null || e.qty > 0)) {
      const r = await post('use_item.php', { inv_id: e.inv, qty: 1 });
      const ok = r && (r.status === 'success' || r.success === true || /mana/i.test(r.message || ''));
      if (ok) { if (typeof e.qty === 'number') e.qty = Math.max(0, e.qty - 1); log('🔵 drank mana potion for skill cast', '#6cf'); return true; }
    }
  }
  // out of mana potions → restock Small Mana from the Olympus Apothecary if opted in
  if (S.buyManaPotions && Date.now() - (S._manaRestockAt || 0) > 300_000) {
    S._manaRestockAt = Date.now();
    try { await post('olympus_damon_buy.php', { offer: 'small_mana', qty: 100 }); await refreshInv(); log('🔵 restocked Small Mana Potions', '#6cf'); } catch {}
    return drinkMana();
  }
  return false;
}
async function skillWarmup(q) {
  // find an alive farm mob to cast on (any configured non-timed wave)
  let mob = null;
  for (const wave of WAVES) {
    if (!wave.targets.some(t => !t.timer)) continue;
    const mobs = await fetchWave(wave.url, false);
    mob = mobs.find(m => !m.dead);
    if (mob) break;
  }
  if (!mob) { status = `📜 ${q.title} ${q.have || 0}/${q.need} — waiting for a monster to cast on`; return false; }
  // learn the cheapest mana skill once (per account/class)
  if (!_warmupSkill) {
    const mana = (await battleSkills(mob.id)).filter(s => s.mp > 0).sort((a, b) => a.mp - b.mp || a.stam - b.stam);
    if (!mana.length) { status = `📜 ${q.title}: no mana class skill found (class selected?)`; return false; }
    _warmupSkill = mana[0];
    log(`📜 skill warm-up: using "${_warmupSkill.name}" (${_warmupSkill.mp} MP / ${_warmupSkill.stam} stam)`, '#9cf');
  }
  const sk = _warmupSkill;
  status = `📜 skill warm-up ${q.have || 0}/${q.need}`;
  await join({ monster_id: mob.id });
  let r = await post('damage.php', { monster_id: mob.id, skill_id: sk.skillId, stamina_cost: sk.stam });
  // out of mana → drink a mana potion and retry the cast once
  if (r && r.status !== 'success' && /mana/i.test(r.message || '')) {
    if (await drinkMana()) r = await post('damage.php', { monster_id: mob.id, skill_id: sk.skillId, stamina_cost: sk.stam });
  }
  if (r && r.status === 'success') { _didWork = true; log(`📜 skill warm-up: cast ${sk.name} (${q.have || 0}/${q.need})`, '#9cf'); }
  return true;
}

// Drive the Adventurer's Guild "di seguito": finish a completed quest → accept the
// next available one (only ONE at a time) → farm its mob to the server target → on
// the next read finish it and accept the next, and so on. Cooldown quests are just
// tracked for the UI. The guild page is re-read at most every QUEST_INTERVAL; between
// reads we keep farming the cached active quest's mob (LSP refills the stamina).
//
// Returns TRUE while there is still quest work pending → the main loop then SKIPS the
// general farm waves, so stamina is spent ONLY on the quest (refilled with LSP) and
// never wasted on the waves. Returns FALSE only when nothing is left to do right now
// (no active quest and everything else on cooldown).
async function processQuests() {
  if (!S.questEnabled) return false;

  if (Date.now() - _lastQuest > QUEST_INTERVAL) {
    _lastQuest = Date.now();
    const doc = await fetchGuild();
    if (doc) {
      _questCooldowns = parseQuestCooldowns(doc);
      let active = parseActiveQuest(doc);

      // 1) finish a completed quest → frees the single active slot
      if (active && active.finishable) {
        const r = await post('adventurers_finish_quest.php', { quest_id: active.id });
        if (r && r.status === 'ok') { S.questDone++; log(`🏅 quest done: ${active.title} (${active.have}/${active.need})`, '#2f8'); }
        else log(`quest finish failed (${active.title}): ${r?.message || 'no resp'}`, '#f66');
        active = null;
      }

      // 2) no active quest → accept the next available (off cooldown), then farm it.
      // We NEVER give up a quest (2-day cooldown, precious skill points), so there is no
      // blacklist to skip: always take whatever the guild offers. Completion is handled by
      // farming the quest's mob (configure its wave — e.g. g3w5 lizards — in the account cfg).
      if (!active) {
        // Class-only quests (e.g. "Skill Warm Up") require a class selected at LV200+.
        // Skip them until the account reaches at least level 200.
        const lvl = S.userLevel || 0;
        const avail = parseAvailableQuests(doc)
          .filter(p => !p.skill || lvl >= 200);   // skill warm-up needs a class selected (LV200+)
        if (avail.length) {
          const p = avail[0];
          const r = await post('adventurers_accept_quest.php', { quest_id: p.id });
          if (r && r.status === 'ok') {
            S.questTaken++;
            _warmupSkill = null;   // re-learn the mana skill for this (possibly new) quest/class
            active = { id: p.id, title: p.title, monster: p.monster, minDmg: p.minDmg, gather: p.gather, skill: p.skill, item: p.item, have: 0, need: p.need || (p.skill ? 20 : 10), engaged: 0 };
            log(`📜 quest accepted: ${p.title}${p.skill ? ' (skill warm-up)' : p.monster ? ` → ${p.monster}` : ''} ${p.skill ? `(use ${p.need||20} skills)` : p.gather ? `(gather ${p.need||'?'}× ${p.item||'item'})` : `(min ${fmtDmg(p.minDmg)})`}`, '#9cf');
          } else log(`quest accept failed (${p.title}): ${r?.message || 'no resp'}`, '#f66');
        } else {
          dlog(`quests: none available · ${_questCooldowns.length} on cooldown`, '#778');
        }
      }

      // carry the local "engaged" count across guild re-reads (same quest id), and never
      // let it drop below the server-credited `have` → caps over-killing reliably.
      if (active) {
        const prev = (S.questActive && S.questActive.id === active.id) ? (S.questActive.engaged || 0) : 0;
        active.engaged = Math.max(prev, active.have || 0);
        // new quest (or first sight of it) → start its zero-progress clock (give-up guard)
        if (!S.questActive || S.questActive.id !== active.id) S._questSince = Date.now();
      }
      S.questActive = active;   // cache for the UI + the farm pass below
      save();
    }
  }

  // farm the active quest's mob (interruptible: timed bosses keep priority). Report
  // "pending" so the caller skips the waves until the quest slot is empty.
  const q = S.questActive;
  if (q && (q.have || 0) < (q.need || 10)) {
    // SKILL WARM UP quest: no mob to farm — cast a mana class skill on any alive monster and
    // drink mana potions to keep casting. Progress (have/need) is re-read from the guild page.
    if (q.skill) { await skillWarmup(q); return true; }
    // GATHER quests: DELIVER whatever the mob already dropped into the inventory (this is what
    // credits the progress bar — kills alone don't). Runs BEFORE the coverage check so it also
    // works when the item mob is farmed via the user's own config waves. Throttled internally.
    if (q.gather && q.item) {
      await donateGatherItems(q);
      // enough delivered → turn it in right now (don't wait for the 20s guild re-read)
      if ((q.have || 0) >= (q.need || 1)) {
        const rf = await post('adventurers_finish_quest.php', { quest_id: q.id });
        if (rf && rf.status === 'ok') {
          S.questDone++; S.questActive = null; save();
          log(`🏅 quest done: ${q.title} (${q.have}/${q.need} delivered)`, '#2f8');
          _lastQuest = 0;   // force a fresh guild read next pass → accept the next quest
          return false;
        }
        // finish rejected → keep the quest; the guild re-read reconciles have and retries
      }
    }
    // If the quest's creature is already in the user's farm config, let Phase 2 handle it —
    // wave loots credit the quest automatically. Gather quests always qualify (no dmg floor);
    // kill quests qualify only when the config's dmgTarget reaches the quest's minDmg.
    const qcov = questCoveredByConfig(q);
    if (qcov === 'timed') {
      // Quest mob is a configured TIMED target — Phase 1 kills it on respawn.
      // Never try g3w5, never give up: just wait for the next respawn cycle.
      status = `📜 quest via timed: ${q.title} — waiting respawn`;
      return false;
    }
    if (qcov) {
      status = `📜 quest via farm: ${q.title}`;
      return false;   // let the general farm run; loot on the configured wave credits it
    }
    // STALL GUARD A: zero engagement — mob not on g3w5 or below account's damage floor.
    // NEVER give up the quest (2-day cooldown, precious skill points): after 3 fruitless
    // passes just keep it and farm the general waves meanwhile — a configured quest wave
    // credits it via loot. (User: "non deve mai abbandonare una quest, mi fai perdere punti".)
    const noProgress = (q.engaged || 0) === 0 && (q.have || 0) === 0;
    const sig = `${q.id}:${q.have || 0}:${q.engaged || 0}`;
    if (S._questSig === sig) S._questStall = (S._questStall || 0) + 1;
    else { S._questSig = sig; S._questStall = 0; }
    if (noProgress && (S._questStall || 0) >= 3) {
      status = `📜 quest stalled: ${q.title} — keeping it, farming waves meanwhile`;
      return false;
    }
    // STALL GUARD B: engaged mobs but `have` never credited — wrong mob type, server mismatch,
    // or RNG gather drop. NEVER give up (2-day cooldown, precious points): after the patience
    // window fall back to the general waves so the farm never freezes, but KEEP the quest so its
    // points aren't lost. Gather drops are RNG → longer window than kill quests.
    const stallLimit = q.gather ? 30 * 60_000 : 15 * 60_000;
    if ((q.engaged || 0) > 0 && (q.have || 0) === 0 &&
        Date.now() - (S._questSince || 0) > stallLimit) {
      status = `📜 quest waiting for credit: ${q.title} — farming waves meanwhile`;
      return false;
    }
    // Fully engaged and nobody dead yet → DON'T idle on the quest wave: remember the
    // death cooldown (S._questNextDie, from the cards' data-expire), farm elsewhere,
    // and come back to loot right after the first engaged mob dies. (User: "attacca i
    // mob e ricorda il cooldown di morte, nel frattempo fa altro e poi torna a lootare".)
    if (!q.gather && (q.engaged || 0) >= (q.need || 10) && S._questNextDie && Date.now() < S._questNextDie + 1500) {
      status = `📜 quest ${q.have || 0}/${q.need || 10} — next kill in ${fmt(S._questNextDie - Date.now())} · farming meanwhile`;
      return false;
    }
    status = `📜 quest: ${q.title}`;
    await processWave(questWaveFor(q), null, true);
    // GATHER: item drops are RNG → keep the stamina on the quest wave until enough items are
    // collected AND delivered (have>=need, checked by the top guard). KILL: reserve stamina only
    // while we still need to ENGAGE more mobs; once `need` are engaged just wait for the credit.
    if (q.gather) return true;
    return (q.engaged || 0) < (q.need || 10);
  }
  // an active-but-finishable quest is turned in on the next read → still pending
  return !!(q && q.finishable);
}

// ── MAIN LOOP ─────────────────────────────────────────────────────────────────
// Pass 1: timed bosses across ALL waves (high priority, with LSP).
// Pass 2: farm mobs across ALL waves (use remaining stamina).
// fetchWave has a 30s cache so each wave is only fetched once per cycle.
// ── AUTO-PvP MODULE ─────────────────────────────────────────────────────────────
// Solo 1v1, a turni (~10s/turno). Pilota il match con la stessa API della pagina:
//   pvp_battle_state.php (GET stato) · pvp_battle_action.php (POST use_skill) · pvp_matchmake.php
// Risorsa = Rage (Berserker). Passivo "Rage Engine": il danno cresce con la Rage attuale.
// Ragnarok Cleave (adv:8) richiede Rage PIENA (requires_full_resource) — il nuke grosso.
// Le skill lanciate a Rage PIENA hanno effetto POTENZIATO (es. Ironclad → +DEF, 2 turni):
// le IMPARIAMO dal log per skill/livello-di-rage, così la strategia si adatta a ogni match.
const PVP_PAGE = /\/pvp(_battle)?\.php$/.test(location.pathname);
let _pvpUrlConsumed = false, _pvpStale = 0, _pvpLastSave = 0;
let _pvpTurnMid = null, _pvpMyTurns = 0;   // conta i MIEI turni nel match corrente (per l'apertura Ironclad)
let _pvpModeMid = null;                     // mid per cui S.pvp.curMode è già stato scelto (1 volta/match)

const pvpReqHeaders = extra => Object.assign({ 'X-Requested-With': 'XMLHttpRequest' }, extra || {});
async function pvpState(mid) {
  try {
    const r = await fetchT(`${BASE}/pvp_battle_state.php?match_id=${mid}&since_log_id=0`, { headers: pvpReqHeaders() }, 12000);
    return await r.json();
  } catch { return {}; }
}
async function pvpPostJson(path, body) {
  try {
    const r = await fetchT(`${BASE}/${path}`, {
      method:  'POST',
      headers: pvpReqHeaders({ 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }),
      body:    new URLSearchParams(body).toString(),
    }, 12000);
    const t = await r.text();
    try { return JSON.parse(t); } catch { return {}; }
  } catch { return {}; }
}
const pvpAction = (mid, since, skillId, targetKey) =>
  pvpPostJson('pvp_battle_action.php', { match_id: mid, since_log_id: since, action: 'use_skill', skill_id: skillId, target_key: targetKey });

// costo Rage EFFETTIVO: le skill avanzate richiedono la risorsa PIENA (il campo `cost`
// è fuorviante — contano `requires_full_resource` + `resource_cost`).
const pvpRageCost = (k, max) => k.requires_full_resource ? (max || 100)
  : (k.resource_cost != null ? k.resource_cost : (k.cost || 0));

const _pvpSeen = {};   // mid:logId → 1 (dedup tra i poll)
// statistiche del match CORRENTE (per diagnosticare PERCHÉ vinci/perdi). Si azzerano a ogni
// nuovo match (mid diverso). myDmg = danno che faccio, enemyDmg = danno che subisco,
// enemyHeal = quanto si cura il nemico, enemyBig = il suo colpo più forte su di me.
// myTokens/enemyTokens = somma dei costi-token delle skill usate nel match (da d.skill.cost).
let _pvpMatchStats = { mid: null, myDmg: 0, enemyDmg: 0, enemyHeal: 0, enemyBig: 0, myTokens: 0, enemyTokens: 0 };
// classifica una classe dai dati IMPARATI: curatore (si cura tanto / ha skill di cura) e/o
// nuker (colpo singolo molto forte). Guida la strategia in pvpPick.
function pvpProfile(cls) {
  const C = (S.pvp.db.classes || {})[cls];
  if (!C) return { healer: false, bursty: false, C: null };
  const m = Math.max(1, C.matches || 1);
  const hasHealSkill = Object.keys(C.skills || {}).some(n => /heal|recover|bless|sanct|mend/i.test(n));
  const healer = hasHealSkill || (C.healed || 0) / m > 50000;     // cura > ~50k a match
  const bursty = (C.bigHit?.dmg || 0) > 250000 || cls === 'Assassin'; // colpo singolo enorme
  return { healer, bursty, C };
}
// impara da OGNI voce di log: danno delle mie skill (bucket per Rage, così becca la variante
// POTENZIATA a Rage piena) + skill/effetti/retaliation/note di ogni classe avversaria.
function pvpLearn(mid, state, logs, rageBefore) {
  const db = S.pvp.db;
  const enemyU = Object.values(state.teams?.enemy?.players_by_num || {})[0];
  const cls = enemyU?.advanced_class_name || 'Unknown';
  if (_pvpMatchStats.mid !== mid) _pvpMatchStats = { mid, myDmg: 0, enemyDmg: 0, enemyHeal: 0, enemyBig: 0, myTokens: 0, enemyTokens: 0 };
  for (const l of (logs || [])) {
    const key = mid + ':' + l.id; if (_pvpSeen[key]) continue; _pvpSeen[key] = 1;
    const d = l.details; if (!d || !d.skill) continue;
    const dmg  = (d.target?.hp_before || 0) - (d.target?.hp_after || 0);  // >0 danno, <0 cura
    const self = (d.actor?.hp_before  || 0) - (d.actor?.hp_after  || 0);
    if (d.actor?.side === 'ally') {
      const name = d.skill.name;
      const m = db.my[name] = db.my[name] || { id: d.skill.id, cost: d.skill.cost, maxDmg: 0, byRage: {} };
      m.id = d.skill.id;
      if (dmg > m.maxDmg) m.maxDmg = dmg;
      if (dmg > 0) _pvpMatchStats.myDmg += dmg;
      _pvpMatchStats.myTokens += (d.skill.cost || 0);   // token spesi da me (per il report)
      const bucket = (rageBefore != null && rageBefore >= 100) ? 'full' : 'partial';
      const b = m.byRage[bucket] = m.byRage[bucket] || { maxDmg: 0, note: '' };
      if (dmg > b.maxDmg) b.maxDmg = dmg;
      // a Rage piena cattura il testo dell'effetto potenziato (dal contenuto del log)
      const eff = bucket === 'full' && (l.content || '').match(/((?:gains?|grants?|\+\d+%|defen\w*|shield|heal\w*|poison|stun)[^.]*?for \d+ (?:full )?turns?|\+\d+%[^.]*)/i);
      if (eff) b.note = eff[0].slice(0, 90);
    } else {
      const C = db.classes[cls] = db.classes[cls] || { class: cls, resource: enemyU?.advanced_resource_name, skills: {}, effects: {}, notes: {}, matches: 0, losses: 0, dmgToMe: 0, healed: 0, bigHit: { dmg: 0, skill: '' } };
      const sk = C.skills[d.skill.name] = C.skills[d.skill.name] || { id: d.skill.id, cost: d.skill.cost, maxDmg: 0, retaliationToMe: 0 };
      _pvpMatchStats.enemyTokens += (d.skill.cost || 0);   // token spesi dal nemico (visibili → report)
      if (dmg  > sk.maxDmg)          sk.maxDmg = dmg;
      if (self > sk.retaliationToMe) sk.retaliationToMe = self;
      if (d.formula?.attack_notes)  C.notes.attack  = d.formula.attack_notes;
      if (d.formula?.defense_notes) C.notes.defense = d.formula.defense_notes;
      // PATTERN per classe: quanto mi colpisce / quanto si cura / colpo più forte
      if (dmg > 0) {                                   // mi ha fatto danno
        _pvpMatchStats.enemyDmg += dmg;
        if (dmg > _pvpMatchStats.enemyBig) _pvpMatchStats.enemyBig = dmg;
        C.dmgToMe = (C.dmgToMe || 0) + dmg;
        if (dmg > (C.bigHit?.dmg || 0)) C.bigHit = { dmg, skill: d.skill.name };
      } else if (dmg < 0) {                            // si è curato
        _pvpMatchStats.enemyHeal += -dmg;
        C.healed = (C.healed || 0) + (-dmg);
      }
    }
  }
  if (enemyU) {
    const C = db.classes[cls] = db.classes[cls] || { class: cls, resource: enemyU.advanced_resource_name, skills: {}, effects: {}, notes: {}, matches: 0, losses: 0 };
    for (const e of (enemyU.effects || [])) { const n = e.name || e.label || e.id; if (n) C.effects[n] = e; }
  }
}

// SCOUT — impara da un match di ALTRI giocatori (pvp_battle_state.php?match_id=X). Qui NESSUN
// lato è "me": ogni lato è una classe da catalogare. Mappo actor.side → classe di quel lato e
// registro skill/danno/effetti/bigHit/cure in db.classes[cls] (MAI in db.my). Così il DB cresce
// su TUTTE le classi (anche quelle mai affrontate), pronto per pvpProfile/pvpPick.
function pvpScoutLearn(mid, state) {
  const db = S.pvp.db;
  const allyU  = Object.values(state.teams?.ally?.players_by_num  || {})[0];
  const enemyU = Object.values(state.teams?.enemy?.players_by_num || {})[0];
  const uOf = side => (side === 'ally' ? allyU : enemyU);
  let n = 0;
  for (const l of (state.new_logs || state.logs || [])) {
    const key = 'sc:' + mid + ':' + l.id; if (_pvpSeen[key]) continue; _pvpSeen[key] = 1;
    const d = l.details; if (!d || !d.skill || !d.actor) continue;
    const U = uOf(d.actor.side); const cls = U?.advanced_class_name;
    if (!cls || cls === 'Unknown') continue;
    const dmg  = (d.target?.hp_before || 0) - (d.target?.hp_after || 0);   // >0 danno · <0 cura
    const self = (d.actor?.hp_before  || 0) - (d.actor?.hp_after  || 0);   // backlash a chi colpisce
    const C = db.classes[cls] = db.classes[cls] || { class: cls, resource: U.advanced_resource_name, skills: {}, effects: {}, notes: {}, matches: 0, losses: 0, dmgToMe: 0, healed: 0, bigHit: { dmg: 0, skill: '' } };
    const sk = C.skills[d.skill.name] = C.skills[d.skill.name] || { id: d.skill.id, cost: d.skill.cost, maxDmg: 0, retaliationToMe: 0 };
    if (d.skill.id   != null) sk.id   = d.skill.id;
    if (d.skill.cost != null) sk.cost = d.skill.cost;
    if (dmg  > sk.maxDmg)          sk.maxDmg = dmg;
    if (self > (sk.selfDmg || 0))  sk.selfDmg = self;          // costo-HP della skill (es. ultimate backlash)
    if (d.formula?.attack_notes)  C.notes.attack  = d.formula.attack_notes;
    if (d.formula?.defense_notes) C.notes.defense = d.formula.defense_notes;
    if (dmg > 0 && dmg > (C.bigHit?.dmg || 0)) C.bigHit = { dmg, skill: d.skill.name };  // colpo più forte visto
    if (dmg < 0) C.healed = (C.healed || 0) + (-dmg);          // cura erogata da questa classe
    C.scoutSamples = (C.scoutSamples || 0) + 1;
    n++;
  }
  // effetti attivi visti su entrambi i giocatori (buff/debuff per classe)
  for (const U of [allyU, enemyU]) {
    const cls = U && U.advanced_class_name; if (!cls || cls === 'Unknown') continue;
    const C = db.classes[cls]; if (!C) continue;
    for (const e of (U.effects || [])) { const nm = e.name || e.label || e.id; if (nm) C.effects[nm] = e; }
  }
  return n;
}

// gira quando l'AutoPvP è idle (tra un match e l'altro, o anche da spento se lo scout è ON).
// VERIFICATO 2026-06-27 via chrome-devtools: pvp_battle_state.php?match_id=X NON è participant-gated
// → ritorna il log JSON COMPLETO di QUALSIASI match (anche di altri giocatori); gli ID sono ~sequenziali.
// Strategia: (1) impara i match RECENTI nuovi della lobby (avversari freschi), (2) CAMMINA A RITROSO sugli
// ID per minare le battaglie di TUTTI → copre ogni classe senza doverla combattere. Gli ID nella lobby
// "Recent Solo Battles" sono nel markup `<strong>Match:</strong> <span>#NNN</span>`. Throttle ~90s, max
// 6 match/giro per non saturare il rate-limit. Match troppo vecchi/di altre stagioni → 400 (saltati).
let _pvpScoutTs = 0, _pvpScoutBusy = false;
async function pvpScout(force) {
  const sc = S.pvp.scout; if (!sc || !sc.enabled) return;
  if (_pvpScoutBusy) return;
  if (!force && Date.now() - _pvpScoutTs < 90000) return;
  _pvpScoutTs = Date.now(); _pvpScoutBusy = true;
  try {
    const html = await getHtml(`${BASE}/pvp.php`);
    if (!html) return;
    await pvpSyncDefenses(html);   // conta nel record anche le difese (match che il bot non gioca)
    const recent = [...new Set([
      ...[...html.matchAll(/Match:\s*<\/strong>\s*<span>\s*#?\s*(\d+)/gi)].map(m => m[1]),
      ...[...html.matchAll(/pvp_battle\.php\?match_id=(\d+)/gi)].map(m => m[1]),   // fallback se il markup cambia
    ])];
    const head = recent.reduce((a, b) => Math.max(a, +b), 0);
    if (head && !sc.cursor) sc.cursor = head;            // primo avvio: parti dagli ID più recenti
    const learnOne = async (id) => {
      const st = await pvpState(id); sc.seenMids.push(id);
      if (st && st.match && (st.new_logs || st.logs)) return pvpScoutLearn(id, st);
      return 0;
    };
    let learned = 0, done = 0;
    // 1) match recenti NUOVI (gli avversari appena affrontati nella lobby)
    for (const id of recent.filter(x => !sc.seenMids.includes(x))) {
      if (done >= 4) break;                              // riserva slot al walk-back
      learned += await learnOne(id); done++; await sleep(450);
    }
    // 2) WALK-BACK dal cursore: mina le battaglie di TUTTI i giocatori (tutte le classi)
    let cur = sc.cursor || head, miss = 0;
    while (done < 6 && cur > 1) {
      const id = String(cur); cur--;
      if (sc.seenMids.includes(id)) continue;
      const got = await learnOne(id);
      if (got) { learned += got; miss = 0; }
      else if (++miss >= 3) { cur = head; break; }       // sotto il floor stagione (tanti 400) → riparti dai recenti
      done++; await sleep(450);
    }
    sc.cursor = cur;                                     // prossimo punto del walk-back (persiste)
    if (sc.seenMids.length > 2000) sc.seenMids = sc.seenMids.slice(-1500);
    sc.lastRun = Date.now(); sc.learned = (sc.learned || 0) + learned;
    S.pvp.note = `📚 scout +${learned} logs · ${Object.keys(S.pvp.db.classes || {}).length} classes`;
    save();
    if (activeTab === 'pvp') renderUI();
  } catch (e) { /* scout silenzioso: non deve mai rompere il loop di gioco */ }
  finally { _pvpScoutBusy = false; }
}

// conta nel record anche le DIFESE (i match in cui un altro giocatore ATTACCA me: il bot non li
// gioca, quindi pvpEndMatch li perde). Legge la lista "Recent Solo Battles" della lobby
// ("You defended - Won/Lost" + "Match: #N"), e per ogni difesa NUOVA scarica il log e ricava il
// risultato in modo affidabile (`win = match.winner_side === viewer.side`) + la classe avversaria
// (il lato opposto al viewer) → aggiorna W/L e il record per-classe. Dedup via S.pvp.defSeen.
// Gli ATTACchi sono saltati (li conta già pvpEndMatch). Vedi pvpScout per il markup.
async function pvpSyncDefenses(html) {
  const p = S.pvp;
  if (!Array.isArray(p.defSeen)) p.defSeen = [];
  const re = /You\s+(attacked|defended)\s*-\s*(Won|Lost)[\s\S]{0,400}?Match:\s*<\/strong>\s*<span>\s*#?\s*(\d+)/gi;
  const defs = [...html.matchAll(re)].filter(m => m[1].toLowerCase() === 'defended').map(m => m[3]);
  let added = 0;
  for (const mid of defs) {
    if (p.defSeen.includes(mid)) continue;
    p.defSeen.push(mid);                    // segna SUBITO: anche se il fetch fallisce non riconta all'infinito
    const st = await pvpState(mid);
    if (!st || !st.match) continue;
    const win = !!(st.match.winner_side && st.viewer && st.match.winner_side === st.viewer.side);
    if (win) p.wins++; else p.losses++;
    const oppSide = st.viewer?.side === 'ally' ? 'enemy' : 'ally';   // l'avversario = lato opposto a me
    const cls = Object.values(st.teams?.[oppSide]?.players_by_num || {})[0]?.advanced_class_name || '?';
    p.matches.push({ mid, enemyClass: cls, winner: win ? 'ally' : 'enemy', reason: win ? 'won' : 'def loss', role: 'defended' });
    const C = p.db.classes[cls];
    if (C) { C.matches = (C.matches || 0) + 1; if (!win) { C.losses = (C.losses || 0) + 1; C.lastLoss = 'def loss'; C.lossReasons = C.lossReasons || {}; C.lossReasons['def loss'] = (C.lossReasons['def loss'] || 0) + 1; } }
    pvpScoutLearn(mid, st);                 // impara anche le skill di questa difesa
    if (!p.scout.seenMids.includes(mid)) p.scout.seenMids.push(mid);
    added++;
    await sleep(450);
  }
  if (p.matches.length > 200) p.matches.splice(0, p.matches.length - 200);
  if (p.defSeen.length > 400) p.defSeen = p.defSeen.slice(-300);
  if (added) { save(); log(`⚔ PvP: +${added} defenses from lobby → ${p.wins}W/${p.losses}L`, '#9cf'); if (activeTab === 'pvp') renderUI(); }
  return added;
}

// APPRENDIMENTO VERO della strategia (bandit epsilon-greedy per-classe). Sceglie la modalità di
// FILLER per il match: 'aggressive' (a vita alta usa il miglior colpo affordable invece di Slash —
// più danno per turno) vs 'conserve' (Slash gratis, accumula Rage/token per il Ragnarok). Il bot
// PROVA entrambe contro ogni classe e tiene quella con winrate più alto. Diagnosi 2026-06-27: il
// solo-conserve perdeva partite pur facendo PIÙ danno totale (7 Slash da 14k = bleed di tempo
// mentre l'avversario picchia 100k+/turno) → default 'aggressive' per le classi nuove.
function pvpChooseFiller(cls) {
  const C = S.pvp.db.classes[cls]; const s = C && C.strat;
  if (!s) return 'aggressive';
  const na = s.agg?.n || 0, nc = s.con?.n || 0;
  if (na < 3) return 'aggressive';                       // esplora: almeno 3 prove a testa
  if (nc < 3) return 'conserve';
  if (Math.random() < 0.15) return Math.random() < 0.5 ? 'aggressive' : 'conserve';  // epsilon-explore
  const wr = b => b.n ? b.w / b.n : 0;
  return wr(s.agg) >= wr(s.con) ? 'aggressive' : 'conserve';   // exploit: la migliore finora
}

// scelta adattiva della skill — "quale e quando". Usa il danno IMPARATO nel db, il nuke a
// Rage piena, la consapevolezza della classe (curatori → burst) e una regola di sopravvivenza
// (HP basso a Rage piena → skill difensiva potenziata invece del nuke).
function pvpPick(state, myTurns) {
  const me = state.me || {};
  const rage = me.advanced_resource || 0, max = me.advanced_resource_max || 100;
  // TOKEN = pool del match (cap ~40, rigenera ogni turno). `skill.cost` è il costo in TOKEN
  // (Slash 0, Ironclad/War Aura 6, Power Slash 9, Ragnarok 15). Slash GRATIS = builder che carica
  // Rage E lascia rigenerare i token. La Rage (0-100, +25/turno) si AZZERA dopo 100 se non spesa.
  const tokens = Number(me.tokens) || 0;
  // ALLOW-LIST (utente): quando è attiva, il bot vede SOLO le skill spuntate → tutta la logica a
  // valle (usable/slash/nuke/filler…) sceglie automaticamente solo tra quelle. Serve a farmare gli
  // achievement ("usa 20× skill X"): spunta la/le skill volute (tieni un builder per non stallare).
  // Se il match non espone nessuna delle skill consentite, NON filtriamo (evita di bloccare il turno).
  let skills = me.skills || [];
  if (S.pvp.restrictSkills && (S.pvp.allowSkills || []).length) {
    const allow = new Set(S.pvp.allowSkills.map(x => String(x).toLowerCase()));
    const flt = skills.filter(k => allow.has(String(k.name || '').toLowerCase()));
    if (flt.length) skills = flt;
  }
  const enemy = Object.values(state.teams?.enemy?.players_by_num || {}).find(u => u.alive);
  if (!enemy) return null;
  const ehp = enemy.hp || 1e9;
  const cls = enemy.advanced_class_name || 'Unknown';
  const prof = pvpProfile(cls);   // {healer, bursty} imparato dai match precedenti
  const atFull = rage >= max;
  const cost = k => k && k.cost || 0;
  // danno IMPARATO di una mia skill nel bucket di Rage che vale ADESSO (full vs partial).
  const dmgOf = k => {
    const e = S.pvp.db.my[k && k.name]; if (!e) return null;
    const b = e.byRage || {};
    const v = atFull ? (b.full && b.full.maxDmg) : (b.partial && b.partial.maxDmg);
    return v || e.maxDmg || 0;
  };
  // Taunt è inutile in 1v1 (forza il bersaglio su di te ma sei solo) — il gioco stesso dice
  // "Solo PvP AI will not use Taunt". Mai sceglierla. Vedi pvp_skills_kb.json soloPvpExclude.
  const soloExclude = k => /^\s*taunt\s*$/i.test(k && k.name || '');
  // LANCIABILI ORA = abbastanza TOKEN per il costo, e le full-resource (Ragnarok) anche Rage piena.
  const usable = skills.filter(k => k.type === 'attack' && !soloExclude(k) && tokens >= cost(k) && (!k.requires_full_resource || atFull));
  const nukeSk    = skills.find(k => k.requires_full_resource);      // Ragnarok Cleave
  const warAuraSk = skills.find(k => /warrior aura/i.test(k.name));
  const comboCost = cost(warAuraSk) + cost(nukeSk) || 21;            // War Aura(6) + Ragnarok(15) = 21 token
  const slash     = skills.find(k => String(k.id) === '0');         // builder gratuito
  const ironclad  = usable.find(k => /ironclad/i.test(k.name)) || usable.find(k => /guard/i.test(k.name));

  const enemyFx = enemy.effects || [];
  const enemyStunned = enemyFx.some(e => /stun/i.test(e.name || e.label || e.key || ''));
  const shredUp      = enemyFx.some(e => /defense change|defen|armor|shred|break/i.test(e.name || e.label || e.key || ''));
  const haveDef = (Object.values(state.teams?.ally?.players_by_num || {})[0]?.effects || [])
    .some(e => /def|guard|iron|shield|aegis/i.test(e.name || e.label || e.key || ''));
  const eMax = enemy.advanced_resource_max || 0;
  // I NUKER (Assassino) lanciano il loro ULTIMATE appena la risorsa è piena — es. "Final Wish" è il
  // loro Ragnarok (risorsa piena + token). Per i bursty bracciamo già al 75% così l'Ironclad è su
  // PRIMA che colpiscano (al 100% reagirei troppo tardi). Per gli altri solo a barra piena.
  const enemyNukeReady = eMax > 0 && (enemy.advanced_resource || 0) >= eMax * (prof.bursty ? 0.75 : 1) && !enemyStunned;
  const enemyResFull   = eMax > 0 && (enemy.advanced_resource || 0) >= eMax && !enemyStunned;
  const haveNuke = Object.keys(S.pvp.db.my).some(n => /ragnarok/i.test(n)) || !!nukeSk;

  // HP% MIO — la combo War Aura→Ragnarok va scaricata SOTTO il 50% HP. Lì la lifesteal di Ragnarok
  // (Blood Frenzy scala con la vita mancante: ~43-50%) SUPERA la backlash da 261k → Ragnarok NET-HEALA
  // mentre nuca, ed è il picco di danno del Berserker. SOPRA il 50% NON si spreca: si Slasha (gratis),
  // si CONSERVANO i token, si lascia ciclare la Rage (use-it-or-lose-it) e rampare il Rage Engine.
  // Idea di Overlord 2026-06-23: "conserva i token, sotto il 50% combo War Aura→Ragnarok e ti curi subito".
  const meP = Object.values(state.teams?.ally?.players_by_num || {})[0] || {};
  const myHpPct = meP.hp_max ? (meP.hp || 0) / meP.hp_max : 1;
  const lowHp = myHpPct <= 0.50;          // finestra Ragnarok (net-heal)
  const comboWindow = myHpPct <= 0.55;    // lead-in: War Aura il turno prima, così lo shred è su quando scendi sotto 50
  // SCUDO NEMICO — il Magic Knight (Eclipse Sever) e il Paladin si auto-scudano (~90-700k): un Ragnarok
  // ci sbatte contro e viene ASSORBITO (loss 2026-06-23 vs MK: #111 Ragnarok 316k BLOCCATI). Non sprecare
  // il burst in uno scudo grosso → Slasha e aspetta che svanisca (la Rage ricicla). Vedi reference-pvp-skills-kb.
  const enemyShield = Number(enemy.shield) ||
    (() => { const s = (enemy.effects || []).find(e => /shield/i.test(e.label || e.key || ''));
             return s ? (parseInt(String(s.value).replace(/[^\d]/g, '')) || 0) : 0; })();
  const enemyShielded = enemyShield > 150000;   // scudo grosso → il Ragnarok verrebbe in gran parte bloccato
  // La strategia "conserva token + combo a vita bassa" è SPECIFICA del Berserker: solo RAGNAROK CLEAVE
  // net-heala a HP basso (Blood Frenzy) e solo lui ha il setup War Aura. Le ALTRE classi (un amico che usa
  // l'AutoPvP — Assassin/Mage/Magic Knight…) NON devono tenere l'ultimate per il low-HP: il loro nuke
  // (Final Wish, Mana Collapse, Eclipse Sever…) va sparato a risorsa PIENA, subito. `zerk` separa i regimi.
  // Se l'utente ha scelto la classe a mano (S.pvp.myClass) è quella a decidere: solo BERSERKER usa la
  // strategia combo-a-vita-bassa; TUTTE le altre classi giocano la linea generica (nuke a risorsa piena,
  // cura sotto il 35%, para il nuke nemico, miglior colpo affordable come filler). Senza scelta manuale
  // ricadiamo sul rilevamento storico (kit con Ragnarok) come prima.
  const zerk = S.pvp.myClass ? (S.pvp.myClass === 'Berserker')
             : ((nukeSk && /ragnarok/i.test(nukeSk.name || '')) ||
                Object.keys(S.pvp.db.my).some(n => /ragnarok/i.test(n)));

  // RACE MODE — contro nemici VELOCI/bursty o che storicamente ti battono a DPS (`out-damaged`,
  // es. l'Assassino): NON rallentare con Slash (45k) come filler né sprecare turni in Ironclad.
  // Corri col miglior colpo affordable (Power Slash ~455k) tenendo i token per il Ragnarok a Rage
  // piena. Eccezione: le classi che ti uccidono col NUKE (es. Magic Knight → `their nuke`) → la
  // parata resta giusta, quindi NON entrare in race (nukeKiller).
  const lr = (prof.C && prof.C.lossReasons) || {};
  const outDmgLosses = lr['out-damaged'] || 0, nukeLosses = lr['their nuke'] || 0;
  const dpm = (prof.C && prof.C.dmgToMe || 0) / Math.max(1, prof.C && prof.C.matches || 0);
  // NUKER = il suo colpo più forte è di fascia LETALE. ≥500k separa nettamente i nuker veri
  // (Assassin/Magic Knight/Grand Mage 720–880k) da TUTTI gli altri (≤377k). Contro un nuker NON
  // si corre la gara di DPS: si PARA il burst (Ironclad +41% def 2t) e poi si punisce. FIX 2026-06-23
  // (export 22 KO): l'Assassino era in RACE e perdeva 7/8 al suo Final Wish/Death Mark (Killing Tempo
  // lo fa scattare 2 volte a risorsa piena). Hardcode Assassin come safety con DB fresco (bigHit non
  // ancora imparato). Vedi reference-pvp-skills-kb / reference-berserker-pvp-strategy.
  const isNuker = (prof.C && (prof.C.bigHit?.dmg || 0) >= 500000) || cls === 'Assassin';
  const nukeKiller = isNuker || (nukeLosses >= 1 && outDmgLosses === 0);   // nuker o ti batte SOLO col nuke → para, non correre
  const race = !nukeKiller && (prof.bursty || outDmgLosses >= 1 || dpm > 400000);
  // miglior colpo NON-ultimate affordable (di norma Power Slash) — il workhorse della race
  const powerHit = usable.filter(k => !k.requires_full_resource && String(k.id) !== '0')
    .sort((a, b) => (dmgOf(b) || 0) - (dmgOf(a) || 0))[0];

  // 1) LETALE: la skill affordable più economica (in token) che uccide ORA (≥ HP nemico).
  const lethal = usable.filter(k => (dmgOf(k) || 0) >= ehp).sort((a, b) => cost(a) - cost(b))[0];
  if (lethal) { S.pvp.note = 'lethal ' + lethal.name; return { id: lethal.id, tk: enemy.key }; }

  // 1b) AUTO-CURA (classi NON-Berserker, es. amici su Saint/Paladin/Inquisitor) — sotto il 35% HP e
  //     senza colpo letale pronto, lancia la cura affordable più forte invece di subire. Il Berserker
  //     net-heala già col Ragnarok (zerk), quindi è escluso. `usable` ha solo gli attacchi → cerco in skills.
  if (!zerk && myHpPct <= 0.35) {
    const healSk = skills.find(k => /\b(heal|recover|mercy|mend)\b/i.test(k.name || '')
      && tokens >= cost(k) && (!k.requires_full_resource || atFull));
    if (healSk) { S.pvp.note = 'self-heal ' + healSk.name; return { id: healSk.id, tk: (meP.key || enemy.key) }; }
  }

  // 0) APERTURA — primo mio turno: Ironclad per reggere il nuke d'apertura (molti partono a risorsa
  //    piena e nukano subito). Ho 40 token a inizio match → Ironclad è sempre affordable al turno 1.
  if ((myTurns || 0) === 0 && ironclad && !haveDef && !race) {
    S.pvp.note = 'opener ironclad'; return { id: ironclad.id, tk: enemy.key };
  }

  // 2) ANTI-NUKE (solo BERSERKER) — il vecchio brace Ironclad (+41% DEF) veniva PENETRATO dai nuker
  //    veri (Assassin Death Mark 880k / MK Eclipse Sever 756k → vs Assassin 1W/8L, MK 2W/4L nell'export
  //    2026-06-24). Sostituito da RAMPAGE HOWL a 100 Rage: consuma tutta la Rage per −40% danno SUBITO
  //    per 2 turni (riduzione FLAT, non penetrabile) + colpisce 20x. Scatta SOLO a Rage piena (lì dà il
  //    −40%) quando il nemico sta per nukare e non ho già difesa su. Salto vs healer. Ha priorità sul
  //    Ragnarok (step 3): col nuke in arrivo si sopravvive, poi si punisce. Le ALTRE classi: nessuna
  //    difesa anti-nuke per ora (TBD — non gestito in questa versione).
  const rampage = usable.find(k => /rampage\s*howl/i.test(k.name || ''));
  if (zerk && atFull && rampage && (enemyNukeReady || enemyResFull) && !haveDef && !prof.healer) {
    S.pvp.note = 'anti-nuke Rampage Howl (-40% 2t)'; return { id: rampage.id, tk: enemy.key };
  }
  // 2b) ANTI-NUKE GENERICO (classi NON-Berserker) — il buco "TBD" lasciato sopra: se il nemico sta per
  //     nukare e non ho difesa su, alzo lo scudo/guard affordable più forte (Ironclad o equivalente)
  //     invece di mangiarmi il burst. Salto vs healer (non nukano) e se sono già coperto.
  if (!zerk && ironclad && (enemyNukeReady || enemyResFull) && !haveDef && !prof.healer) {
    S.pvp.note = 'anti-nuke ' + ironclad.name; return { id: ironclad.id, tk: enemy.key };
  }

  // 3) RAGE PIENA → Ragnarok (la barra è use-it-or-lose-it). Se non ho i 15 token NON sprecare il
  //    colpo: fall-through a Slash (i token rigenerano, al prossimo ciclo nuko). Se il nuke non è
  //    ancora nel DB, provalo per impararlo.
  if (atFull) {
    const nuke = usable.find(k => k.requires_full_resource);
    // BERSERKER (zerk): Ragnarok SOLO sotto il 50% HP (lì net-heala col lifesteal). Sopra il 50%: NON
    // bruciarlo a vita alta (backlash 261k con poca cura) — Slasha, lascia ciclare la Rage e conserva i
    // token. ALTRE classi: il loro ultimate va a risorsa piena SUBITO (no hold). `lethal` (step 1) chiude
    // comunque la partita a qualunque HP.
    // SCUDO: se il nemico ha uno scudo grosso il Ragnarok verrebbe assorbito → Slasha e aspetta che
    // svanisca (eccezione: se buca comunque, cioè il danno supera scudo + HP nemico → ffa, uccide).
    if (nuke && zerk && enemyShielded && slash && (dmgOf(nuke) || 0) < enemyShield + ehp) {
      S.pvp.note = 'hold Ragnarok (enemy shield ' + fmtDmg(enemyShield) + ')'; return { id: slash.id, tk: enemy.key };
    }
    // in modalità AGGRESSIVE (imparata) il Berserker NON aspetta il <50% HP: lancia il Ragnarok a Rage
    // piena (trade 762k danno per ~261k backlash = ottimo nella gara di DPS). In 'conserve' resta gated.
    if (nuke && (!zerk || lowHp || S.pvp.curMode === 'aggressive')) { S.pvp.note = nuke.name + '@full' + (lowHp && zerk ? ' (lowHP heal)' : ''); return { id: nuke.id, tk: enemy.key }; }
    if (nuke && zerk && !lowHp && slash) { S.pvp.note = 'hold Ragnarok (HP ' + Math.round(myHpPct * 100) + '% > 50)'; return { id: slash.id, tk: enemy.key }; }
    // l'ultimate ESISTE ma non ho i token (tokens < costo) → Slash per RICARICARE token, NON bruciare
    // la finestra su un mid-skill (la Rage si azzera comunque, al prossimo ciclo nuko coi token su).
    if (nukeSk && slash) { S.pvp.note = 'wait tokens (' + tokens + '/' + cost(nukeSk) + ')'; return { id: slash.id, tk: enemy.key }; }
    // NESSUN ultimate equipaggiato → il payoff a Rage piena è il miglior colpo affordable conosciuto.
    const best = usable.filter(k => dmgOf(k) != null).sort((a, b) => (dmgOf(b) || 0) - (dmgOf(a) || 0))[0];
    if (best) { S.pvp.note = best.name + '@full'; return { id: best.id, tk: enemy.key }; }
    if (slash) { S.pvp.note = 'build (slash)'; return { id: slash.id, tk: enemy.key }; }
  }

  // 4) ULTIMO COLPO PRIMA DEL PIENO (rage ≥ max-25) → War Aura (shred), così a 100 Ragnarok colpisce
  //    a difesa abbassata. MA solo se ho ≥ comboCost (21) token: War Aura ORA (6) + Ragnarok dopo (15).
  //    Se non ho abbastanza token → continua a Slashare (gratis) per rigenerarli. Vale anche vs healer.
  // Solo IN FINESTRA (HP ≤ 55%): se sopra il 50% si conservano i token e si Slasha — non si imposta
  // la combo a vita alta perché il Ragnarok dopo non andrebbe comunque (lo si terrebbe, vedi step 3).
  if (!atFull && zerk && comboWindow && !enemyShielded && rage >= max - 25 && warAuraSk && !shredUp && tokens >= comboCost) {
    S.pvp.note = 'war aura (combo setup)'; return { id: warAuraSk.id, tk: enemy.key };
  }

  // 4b) DIFESA SOTTO MINACCIA (solo conservazione token) — col Ragnarok equipaggiato (haveNuke) NON si
  //     fa più il "filler aggressivo" Power Slash: bruciava i token che servono alla combo. L'UNICA
  //     spesa di token concessa fuori-finestra è l'Ironclad DIFENSIVO quando il nemico sta per nukare e
  //     non ho difesa su (≈198k + GRANTS +41% def 2 turni): para il colpo e ti tiene vivo fino alla
  //     finestra <50% HP, e solo se restano i 21 token della combo. Altrimenti → Slash (conserva).
  //     FIX 2026-06-23 (export 110W/23L · strategia Overlord): conserva token, sotto il 50% combo che net-heala.
  //     Vedi reference-berserker-pvp-strategy. SOLO Berserker (zerk): le ALTRE classi (e i build senza
  //     ultimate) usano il miglior colpo affordable come filler — niente conservazione token.
  if (zerk) {
    const threat = (enemyNukeReady || enemyResFull) && !haveDef && !prof.healer;
    if (threat && ironclad && tokens - cost(ironclad) >= comboCost) {
      S.pvp.note = 'def-filler ' + ironclad.name; return { id: ironclad.id, tk: enemy.key };
    }
    // ADATTIVO (imparato per-classe da pvpChooseFiller): in modalità AGGRESSIVE non sprecare i turni
    // con Slash da 14k a vita alta — colpisci col miglior hit affordable RISERVANDO i token della combo
    // (Ragnarok). Fix del bleed di tempo che faceva perdere match pur out-damageando. In 'conserve' cade
    // a Slash come prima. Il bot prova entrambe e tiene la migliore per ogni classe.
    if (S.pvp.curMode === 'aggressive' && powerHit && tokens - cost(powerHit) >= comboCost
        && (dmgOf(powerHit) || 0) > (dmgOf(slash) || 0)) {
      S.pvp.note = 'aggr filler ' + powerHit.name; return { id: powerHit.id, tk: enemy.key };
    }
    // 'conserve' (o token insufficienti) → cadi a Slash (step 5) per caricare Rage e rigenerare token.
  } else if (powerHit && (dmgOf(powerHit) || 0) > (dmgOf(slash) || 0)) {
    S.pvp.note = 'filler ' + powerHit.name; return { id: powerHit.id, tk: enemy.key };
  }

  // 5) BUILD — Slash (gratis): ora solo FALLBACK, quando non posso permettermi un filler vero senza
  //    intaccare i 15 token riservati al Ragnarok. Carica Rage verso 100 e rigenera i token per la combo.
  if (slash && zerk) { S.pvp.note = 'build (slash→combo)'; return { id: slash.id, tk: enemy.key }; }

  // 6) FALLBACK (nessun nuke conosciuto/equipaggiato) → miglior colpo affordable, o Slash.
  const top = usable.filter(k => !k.requires_full_resource).sort((a, b) => (dmgOf(b) || 0) - (dmgOf(a) || 0))[0];
  if (top && (dmgOf(top) || 0) > 0) { S.pvp.note = 'best ' + top.name; return { id: top.id, tk: enemy.key }; }
  S.pvp.note = 'build (slash)';
  return { id: (slash || skills[skills.length - 1]).id, tk: enemy.key };
}

function pvpEndMatch(state) {
  const enemyU = Object.values(state.teams?.enemy?.players_by_num || {})[0];
  const cls = enemyU?.advanced_class_name || 'Unknown';
  const win = state.match?.winner_side === 'ally';
  // DIAGNOSI: perché ho vinto/perso, dalle statistiche del match (mydmg vs danno subito vs cure).
  const st = (_pvpMatchStats.mid === S.pvp.cur) ? _pvpMatchStats : { myDmg: 0, enemyDmg: 0, enemyHeal: 0, enemyBig: 0, myTokens: 0, enemyTokens: 0 };
  let reason;
  if (win) reason = 'won';
  else if (st.enemyHeal > st.myDmg * 0.45) reason = 'out-healed';      // si è curato troppo
  else if (st.enemyBig > st.myDmg * 0.5)   reason = 'their nuke';      // un colpo enorme
  else if (st.enemyDmg > st.myDmg)         reason = 'out-damaged';     // più DPS di me
  else reason = 'close';
  S.pvp.matches.push({ mid: S.pvp.cur, enemyClass: cls, winner: state.match?.winner_side, reason,
    myDmg: st.myDmg, enemyDmg: st.enemyDmg, enemyHeal: st.enemyHeal, myTokens: st.myTokens, enemyTokens: st.enemyTokens });
  if (S.pvp.matches.length > 200) S.pvp.matches.shift();
  if (win) S.pvp.wins++; else S.pvp.losses++;
  const C = S.pvp.db.classes[cls];
  if (C) {
    C.matches = (C.matches || 0) + 1;
    if (!win) { C.losses = (C.losses || 0) + 1; C.lastLoss = reason; C.lossReasons = C.lossReasons || {}; C.lossReasons[reason] = (C.lossReasons[reason] || 0) + 1; }
    // APPRENDIMENTO: accredita la vittoria/sconfitta alla modalità di filler usata in QUESTO match
    // → pvpChooseFiller imparerà quale modalità vince di più contro questa classe.
    if (S.pvp.curMode) {
      C.strat = C.strat || { agg: { w: 0, n: 0 }, con: { w: 0, n: 0 } };
      const b = S.pvp.curMode === 'aggressive' ? C.strat.agg : C.strat.con;
      b.n++; if (win) b.w++; C.strat.mode = S.pvp.curMode;
    }
  }
  S.pvp.cur = null; _pvpModeMid = null; _pvpUrlConsumed = true; save();
  const prof = pvpProfile(cls);
  log(`⚔ PvP ${win ? 'WIN' : 'LOSS'} vs ${cls}${prof.healer ? ' (healer)' : ''}${prof.bursty ? ' (nuker)' : ''} · ${reason} · myDmg ${fmtDmg(st.myDmg)} / theirHeal ${fmtDmg(st.enemyHeal)} / theirBig ${fmtDmg(st.enemyBig)} · 🎟 tokens me ${st.myTokens||0} / enemy ${st.enemyTokens||0} · ${S.pvp.wins}W/${S.pvp.losses}L`, win ? '#2f8' : '#f88');
}

// RESET del record PvP. `full=false` (default, "nuova stagione"): azzera SOLO il record — W/L,
// token spesi, lista match e i contatori per-classe (matches/losses/lossReasons/lastLoss) — ma
// MANTIENE le classi imparate (skill/danno/effetti), così il bot non riparte cieco a stagione nuova.
// `full=true`: cancella anche tutta la conoscenza (db) e la cronologia scout. Vedi pulsante nel tab.
function resetPvpRecord(full) {
  const p = S.pvp;
  p.wins = 0; p.losses = 0; p.tokensUsed = 0; p.matches = [];
  for (const C of Object.values(p.db.classes || {})) {
    C.matches = 0; C.losses = 0; C.lossReasons = {}; delete C.lastLoss;
  }
  if (full) {
    p.db = { classes: {}, my: {} };
    if (p.scout) { p.scout.seenMids = []; p.scout.learned = 0; p.scout.lastRun = 0; p.scout.cursor = null; }
    p.defSeen = [];
  }
  save(); renderUI();
  log(full ? '⚔ PvP: DB + record fully WIPED'
           : '⚔ PvP: season record reset (learned classes kept)', '#9cf');
}

// build a HUMAN-READABLE .txt report (per-class W/L + loss reasons + their big hit),
// with the raw JSON appended at the bottom for deep analysis. Used by the export button.
function pvpExportText() {
  const p = S.pvp, db = p.db || { classes: {}, my: {} };
  const tot = (p.wins || 0) + (p.losses || 0);
  const L = [];
  L.push('VEYRA PvP — export ' + new Date().toLocaleString());
  L.push('Record: ' + (p.wins || 0) + 'W / ' + (p.losses || 0) + 'L'
    + (tot ? '  (' + Math.round((p.wins || 0) / tot * 100) + '%)' : ''));
  L.push('');
  L.push('PER-CLASS (worst winrate first):');
  // media token spesi (miei/nemici) per classe, dai match registrati
  const tokAgg = {};
  for (const mm of (p.matches || [])) {
    if (mm.myTokens == null && mm.enemyTokens == null) continue;
    const a = tokAgg[mm.enemyClass] = tokAgg[mm.enemyClass] || { n: 0, my: 0, en: 0 };
    a.n++; a.my += (mm.myTokens || 0); a.en += (mm.enemyTokens || 0);
  }
  const rows = Object.values(db.classes || {}).map(C => {
    const m = C.matches || 0, l = C.losses || 0, w = m - l;
    return { C, m, l, w, wr: m ? Math.round(w / m * 100) : 0 };
  }).sort((a, b) => a.wr - b.wr || b.m - a.m);
  for (const r of rows) {
    const C = r.C;
    const big = C.bigHit ? (C.bigHit.skill + ' ' + (C.bigHit.dmg || 0).toLocaleString()) : '—';
    const lr  = C.lossReasons ? Object.entries(C.lossReasons).map(([k, v]) => k + '×' + v).join(', ') : '';
    const ta  = tokAgg[C.class];
    const tok = ta && ta.n ? '  · 🎟 avg me ' + Math.round(ta.my / ta.n) + ' / enemy ' + Math.round(ta.en / ta.n) : '';
    L.push('  ' + String(C.class || '?').padEnd(14)
      + (r.w + 'W/' + r.l + 'L').padEnd(8) + String(r.wr + '%').padStart(4)
      + '  · big hit: ' + big + tok + (lr ? '  · losses: ' + lr : ''));
  }
  L.push('');
  L.push('=== RAW DATA (JSON, for analysis) ===');
  L.push(JSON.stringify({ wins: p.wins, losses: p.losses, db, matches: p.matches }, null, 2));
  return L.join('\n');
}

async function pvpLoop() {
  while (running) {
    // anche da spento aggiorna i token ogni tanto, così il tab li mostra (throttle 60s)
    if (!S.pvp.enabled || paused) { await pvpRefreshTokens(); if (!paused) await pvpScout(); await sleep(2000); continue; }
    try {
      await pvpRefreshTokens();   // tieni il conteggio token fresco mentre gioca
      if (!S.pvp.cur) await pvpScout();   // tra un match e l'altro: impara dalle battaglie recenti (throttled)
      // riprendi un match già aperto dalla URL della battle page (una sola volta), poi matchmake
      if (!S.pvp.cur && !_pvpUrlConsumed) {
        const m = location.pathname.includes('pvp_battle.php') && new URL(location.href).searchParams.get('match_id');
        if (m) S.pvp.cur = m;
        _pvpUrlConsumed = true;
      }
      if (!S.pvp.cur) {
        const mm = await pvpPostJson('pvp_matchmake.php', { ladder: 'solo' });
        if (mm.status !== 'success') { S.pvp.note = mm.message || 'no tokens'; pvpTabRefresh(); await sleep(20000); continue; }
        if (mm.token_free_chance != null) S.pvp.freeChance = mm.token_free_chance;
        if (mm.token_free_proc) S.pvp.note = '🎟 FREE token (proc)!';
        S.pvp.cur = String(mm.match_id); S.pvp.tokensUsed++; pvpRefreshTokens(true); save(); await sleep(400); continue;
      }
      const s = await pvpState(S.pvp.cur);
      if (!s.match) { if (++_pvpStale > 3) { S.pvp.cur = null; _pvpStale = 0; } await sleep(700); continue; }
      _pvpStale = 0;
      const enemyU = Object.values(s.teams?.enemy?.players_by_num || {})[0];
      S.pvp.lastClass = enemyU?.advanced_class_name || '';
      // impara il MIO kit dal vivo (nomi skill) → popola le checkbox dell'allow-list col kit reale
      const myU = Object.values(s.teams?.ally?.players_by_num || {})[0];
      S.pvp.detectedClass = myU?.advanced_class_name || S.pvp.detectedClass || '';
      const kitNow = (s.me?.skills || myU?.skills || []).map(k => k.name).filter(Boolean);
      if (kitNow.length) { const set = new Set([...(S.pvp.myKit || []), ...kitNow]); S.pvp.myKit = [...set]; }
      // scegli UNA volta per match la modalità di filler imparata per questa classe (stabile fino a fine match)
      if (_pvpModeMid !== S.pvp.cur) { _pvpModeMid = S.pvp.cur; S.pvp.curMode = pvpChooseFiller(S.pvp.lastClass || 'Unknown'); }
      pvpLearn(S.pvp.cur, s, s.new_logs);
      if (s.match.ended) { pvpEndMatch(s); pvpRefreshTokens(true); pvpTabRefresh(); continue; }
      // FAST mode: il turno nemico passa da lento a ~1s → match molto più rapidi (il bottone
      // "enemy 1s" della pagina). Default del match è 'normal' → lo forziamo a 'fast_enemy'.
      if (s.match.solo_control_mode && s.match.solo_control_mode !== 'fast_enemy') {
        await pvpPostJson('pvp_battle_action.php', { match_id: S.pvp.cur, since_log_id: s.last_log_id, action: 'set_solo_control_mode', control_mode: 'fast_enemy' });
        continue;   // rileggi lo stato aggiornato al prossimo giro
      }
      if (s.turn?.side === 'ally') {              // solo: l'unico alleato sono io → mio turno
        if (_pvpTurnMid !== S.pvp.cur) { _pvpTurnMid = S.pvp.cur; _pvpMyTurns = 0; }  // nuovo match → azzera
        const rageBefore = s.me?.advanced_resource || 0;
        const p = pvpPick(s, _pvpMyTurns); if (!p) { await sleep(500); continue; }
        S.pvp.lastPick = p.id + (S.pvp.note ? ' · ' + S.pvp.note : '');
        let d = await pvpAction(S.pvp.cur, s.last_log_id, p.id, p.tk);
        if (!d || d.ok === false) {               // race "Not your turn"/reject → rileggi e ripiega su Slash
          const s2 = await pvpState(S.pvp.cur);
          if (s2.turn?.side === 'ally') d = await pvpAction(S.pvp.cur, s2.last_log_id, '0', p.tk);
        }
        _pvpMyTurns++;                             // un mio turno consumato (per l'apertura Ironclad)
        if (d && d.new_logs) pvpLearn(S.pvp.cur, d, d.new_logs, rageBefore);
        if (d?.match?.ended) pvpEndMatch(d);
        await sleep(220);
      } else {
        await sleep(700);
      }
      if (Date.now() - _pvpLastSave > 10000) { save(); _pvpLastSave = Date.now(); }  // persisti il DB imparato (throttle)
    } catch (e) { S.pvp.note = 'err: ' + e.message; await sleep(600); }
    pvpTabRefresh();
  }
}

// ── PvP TAB (nel pannello principale ⚔ PvP) ──────────────────────────────────────
// legge i token PvP (e i gem) dalla lobby pvp.php — "Solo Tokens: N" + costo refill.
let _pvpTokTs = 0;
async function pvpRefreshTokens(force) {
  if (!force && Date.now() - _pvpTokTs < 60000) return;
  _pvpTokTs = Date.now();
  const html = await getHtml(`${BASE}/pvp.php`);
  if (!html) return;
  const tok = html.match(/Solo Tokens:\s*<\/strong>\s*<span>\s*([\d]+)/i)
           || html.match(/Tokens:\s*<\/strong>\s*<span>\s*([\d]+)/i);
  if (tok) S.pvp.tokensAvail = parseInt(tok[1]);
  const cost = html.match(/Refill Solo Tokens \(([\d,]+) Gems\)/i);
  if (cost) S.pvp.refillCost = parseInt(cost[1].replace(/,/g, ''));
  S.pvp.tokensCheckedAt = Date.now();
  save();
  if (activeTab === 'pvp') renderUI();
}
// refresh the PvP tab live if it's the open tab
function pvpTabRefresh() { if (activeTab === 'pvp') renderUI(); }

// the ⚔ PvP tab body — ON/OFF + all match stats + tokens
function renderPvp() {
  const p = S.pvp;
  const sc = p.scout || (p.scout = { enabled: true, seenMids: [], lastRun: 0, learned: 0 });
  const scAge = sc.lastRun ? fmt(Date.now() - sc.lastRun) + ' ago' : 'mai';
  const total = p.wins + p.losses;
  const wr = total ? Math.round(p.wins / total * 100) : 0;
  const tokAge = p.tokensCheckedAt ? fmt(Date.now() - p.tokensCheckedAt) + ' ago' : 'never';
  // i token si ricaricano +3 ogni ora (allo scoccare dell'ora) → countdown al prossimo refill
  const _now = new Date();
  const _toHourMs = ((59 - _now.getMinutes()) * 60 + (60 - _now.getSeconds())) * 1000;
  const nextRefill = fmt(_toHourMs);
  // per-class breakdown (matches + losses learned)
  const rows = Object.values(p.db.classes || {}).sort((a, b) => (b.matches || 0) - (a.matches || 0)).map(c => {
    const m = c.matches || 0, l = c.losses || 0, w = m - l;
    const prof = pvpProfile(c.class);
    const tag = (prof.healer ? '💚' : '') + (prof.bursty ? '💥' : '');
    const nSk = Object.keys(c.skills || {}).length, nEf = Object.keys(c.effects || {}).length;
    const s = c.strat;
    const stratTip = s ? ` · learned play: aggressive ${s.agg?.w||0}/${s.agg?.n||0} vs conserve ${s.con?.w||0}/${s.con?.n||0}` : '';
    const wrA = s && s.agg?.n ? s.agg.w/s.agg.n : -1, wrC = s && s.con?.n ? s.con.w/s.con.n : -1;
    const best = (wrA<0 && wrC<0) ? '' : (wrA>=wrC ? '⚔' : '🛡');   // ⚔ = aggressive, 🛡 = conserve
    return `<div style="font-size:11px;padding:1px 0" title="${esc(c.class||'?')}: ${w} wins / ${l} losses · ${nSk} skills learned · ${nEf} status effects seen${stratTip}">
      <div style="display:flex;justify-content:space-between">
        <span style="color:#cda">${esc(c.class || '?')} ${tag}${best}</span>
        <span style="color:#778">${w}W/${l}L · ${nSk} skills · ${nEf} fx</span></div>
      ${c.lastLoss ? `<div style="color:#a88;font-size:10px;padding-left:8px">↳ last loss: ${esc(c.lastLoss)}</div>` : ''}</div>`;
  }).join('');
  const recent = (p.matches || []).slice(-6).reverse().map(m =>
    `<span title="${esc((m.enemyClass || '') + (m.reason ? ' · ' + m.reason : ''))}" style="color:${m.winner === 'ally' ? '#2f8' : '#f88'};cursor:help">${m.winner === 'ally' ? 'W' : 'L'}</span>`).join(' ');
  // ── la MIA classe (scelta a mano) + allow-list delle skill (per achievement) ──
  const classOpts = ['<option value="">— pick your class —</option>']
    .concat(PVP_CLASSES.map(c => `<option value="${c}" ${p.myClass === c ? 'selected' : ''}>${c}</option>`)).join('');
  const kitSkills = [...new Set([...(PVP_KITS[p.myClass] || []), ...(p.myKit || [])])];
  const allowSet = new Set((p.allowSkills || []).map(x => String(x).toLowerCase()));
  const skillBoxes = kitSkills.length
    ? kitSkills.map(nm => `<label style="display:inline-flex;align-items:center;gap:3px;font-size:11px;margin:1px 8px 2px 0;color:${p.restrictSkills ? '#cde' : '#667'}">
        <input type="checkbox" data-act="pvpskill" data-skill="${esc(nm)}" ${allowSet.has(nm.toLowerCase()) ? 'checked' : ''} ${p.restrictSkills ? '' : 'disabled'}>${esc(nm)}</label>`).join('')
    : '<span style="color:#667;font-size:10px">pick your class above (or play a match) to see your kit\'s skills</span>';
  return `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <button data-pvp-action="toggle" style="flex:1;border:none;border-radius:6px;padding:7px 0;cursor:pointer;
        font-size:13px;font-weight:bold;color:#fff;background:${p.enabled ? '#1f8a4c' : '#7a2540'}">
        ${p.enabled ? '⏸ AutoPvP ON — tap to STOP' : '▶ AutoPvP OFF — tap to START'}</button>
    </div>
    <div style="color:${p.enabled ? '#7df' : '#888'};font-size:11px;margin-bottom:7px">
      ${p.enabled ? '▶ auto-playing (matchmake + max damage)' : '⏸ manual — play by hand'}
      ${p.note ? `· <span style="color:#fa8">${esc(p.note)}</span>` : ''}</div>

    <div style="border:1px solid #2a2a44;border-radius:6px;padding:6px 7px;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
        <span style="font-size:11px;color:#9c6;font-weight:bold">🧬 My class</span>
        <select data-act="pvpclass" style="flex:1;background:#1a1a2e;color:#cde;border:1px solid #3a3a5a;border-radius:4px;padding:3px 5px;font-size:11px">${classOpts}</select>
      </div>
      <div style="color:#667;font-size:10px;margin:-2px 0 6px">Drives the strategy: only <b>Berserker</b> holds its ultimate for &lt;50% HP; the other classes nuke at full resource, self-heal below 35% and brace the enemy nuke.${p.detectedClass ? ` <span style="color:#586">(detected from match: ${esc(p.detectedClass)})</span>` : ''}</div>
      <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:#cde;margin-bottom:4px">
        <input type="checkbox" data-act="pvprestrict" ${p.restrictSkills ? 'checked' : ''} style="transform:scale(1.15)">
        🎯 Use ONLY the ticked skills <span style="color:#667">(for achievements like "use skill X 20×")</span>
      </label>
      <div style="line-height:1.7">${skillBoxes}</div>
      ${p.restrictSkills && !(p.allowSkills || []).length ? '<div style="color:#fa8;font-size:10px;margin-top:3px">⚠ no skill ticked → the bot plays unrestricted. Tick at least one skill (keep a builder like Slash so it doesn\'t stall).</div>' : ''}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 10px;margin-bottom:6px">
      <div>🎟 tokens left: <b style="color:${(p.tokensAvail|0) > 0 ? '#0cf' : '#f66'}">${p.tokensAvail != null ? p.tokensAvail : '?'}</b></div>
      <div>⏳ +3 in <b>${nextRefill}</b></div>
      <div title="chance that a match does NOT consume a token">🍀 free token: <b>${p.freeChance != null ? Math.round(p.freeChance * 100) + '%' : '?'}</b></div>
      <div style="color:#667;font-size:10px">read ${tokAge}</div>
    </div>
    <div style="color:#667;font-size:10px;margin:-2px 0 8px">+3 tokens recharge every hour (top of the hour). 🍀 free token = chance a match doesn't spend a token. The bot NEVER refills with gems (manual ${(p.refillCost||500).toLocaleString()}-gem button only) — it idles when out of tokens.</div>

    <div style="border-top:1px solid #2a2a44;margin:6px 0;padding-top:6px"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 10px;margin-bottom:6px">
      <div>✅ wins: <b style="color:#2f8">${p.wins}</b></div>
      <div>❌ losses: <b style="color:#f88">${p.losses}</b></div>
      <div>🏆 winrate: <b>${wr}%</b></div>
      <div>🎟 spent (session): <b>${p.tokensUsed}</b></div>
    </div>
    <div style="font-size:11px;color:#9ab;margin-bottom:6px">recent: ${recent || '—'}</div>
    <div style="font-size:11px;margin-bottom:3px">🆚 now: <b>${esc(p.lastClass || '—')}</b> · 🎯 <b>${esc(p.lastPick || '—')}</b></div>

    <div style="border-top:1px solid #2a2a44;margin:6px 0;padding-top:6px"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:5px">
      <div style="font-size:11px;color:${sc.enabled ? '#7df' : '#888'}">📡 Scout
        <span style="color:#9ab">+${(sc.learned||0).toLocaleString()} log · ${sc.seenMids.length} match · ${scAge}</span></div>
      <button data-pvp-action="scout" style="background:${sc.enabled ? '#1f5a7a' : '#3a2a2a'};color:#fff;border:none;border-radius:4px;padding:3px 8px;cursor:pointer;font-size:10px">${sc.enabled ? '📡 ON' : '📡 OFF'}</button>
    </div>
    <div style="color:#667;font-size:10px;margin:-3px 0 7px">reads the logs of ALL players' recent battles (even while AutoPvP is OFF) → learns each class's skills/damage/effects without having to fight them.</div>

    <div style="color:#9c6;font-size:12px;font-weight:bold;margin-bottom:3px">📚 Classes learned (${Object.keys(p.db.classes||{}).length})
      <span style="color:#667;font-weight:normal;font-size:10px">· 💚 healer 💥 nuker · ⚔/🛡 = best learned play · hover for details</span></div>
    ${rows || '<div style="color:#667;font-size:11px">none yet — start it, play a match, or let the scout run</div>'}

    <div style="display:flex;gap:6px;margin-top:9px">
      <button data-pvp-action="tokens" style="flex:1;background:#252540;color:#ccc;border:none;border-radius:4px;padding:4px 6px;cursor:pointer;font-size:10px">🔄 tokens</button>
      <button data-pvp-action="export" style="flex:1;background:#252540;color:#ccc;border:none;border-radius:4px;padding:4px 6px;cursor:pointer;font-size:10px">⬇ export</button>
      <button data-pvp-action="reset" title="reset ONLY the season W/L record — keeps the learned classes" style="flex:1;background:#3a2f1a;color:#fc8;border:none;border-radius:4px;padding:4px 6px;cursor:pointer;font-size:10px">🆕 reset record</button>
    </div>
    <div style="margin-top:5px">
      <button data-pvp-action="wipe" title="WIPE EVERYTHING: record + learned classes + scout history" style="width:100%;background:#3a2020;color:#f99;border:none;border-radius:4px;padding:3px 6px;cursor:pointer;font-size:10px">🗑 full wipe (record + learned DB)</button>
    </div>`;
}

// ── AUTOLEVEL: spend free stat points into STAMINA ──────────────────────────────
// More stamina = more hits per cycle = faster leveling for a low-level alt. Mirrors
// veyra_colab.allocate_stats: read v-points from stats.php, then POST stats_ajax.php
// {action:allocate, stat:stamina, amount}. Throttled to once/min. Enabled by S.autolevel.
let _lastStatAlloc = 0;
async function allocateStats() {
  if (Date.now() - _lastStatAlloc < 60_000) return;
  _lastStatAlloc = Date.now();
  try {
    const html = await getHtml(`${BASE}/stats.php`);
    if (!html) return;
    const m = html.match(/id=["']v-points["'][^>]*>\s*([\d,]+)/i);
    let pts = m ? parseInt(m[1].replace(/,/g, '')) : 0;
    if (!pts || pts <= 0) return;
    log(`🌱 autolevel: ${pts} free stat points → stamina`, '#9cf');
    let guard = 0;
    while (pts > 0 && running && !paused && guard++ < 50) {
      const amt = Math.min(pts, 100);
      await post('stats_ajax.php', { action: 'allocate', stat: 'stamina', amount: amt });
      pts -= amt;
    }
  } catch (e) { dlog(`stat alloc error: ${e.message}`, '#f66'); }
}

// ── MANA RESTOCK: keep Small Mana Potions stocked from the Olympus Apothecary ──────
// Opt-in (S.buyManaPotions). The farm engine never drinks mana (Berserker = stamina), so
// there's no "ran out mid-fight" trigger — instead we top the bag up periodically: when the
// Small Mana Potion (item 162) stock drops below MANA_POT.lowAt, buy a stack of 100 from the
// Apothecary of Epidaurus (olympus_damon_buy.php, unlimited). Throttled to ~30 min.
let _manaRestockAt = 0;
async function maybeRestockMana() {
  if (!S.buyManaPotions) return;
  if (Date.now() - _manaRestockAt < 1800_000) return;
  _manaRestockAt = Date.now();
  try {
    let have = S.potInv?.[MANA_POT.item]?.qty;
    if (have == null) { await refreshInv(); have = S.potInv?.[MANA_POT.item]?.qty; }
    if (typeof have === 'number' && have > MANA_POT.lowAt) return;   // still well stocked
    const r = await post('olympus_damon_buy.php', { offer: MANA_POT.offer, qty: MANA_POT.keepStocked });
    if (r?.message || r?.status) log(`🛒 Apothecary says: ${r.status || ''} ${r.message || ''}`.trim(), '#9cf');
    await refreshInv();
    const now = S.potInv?.[MANA_POT.item]?.qty;
    log(`🛒🔮 bought ${MANA_POT.keepStocked} Small Mana Potions from the Apothecary of Epidaurus (Olympus) — stock x${now ?? '?'}`, '#3f8');
  } catch (e) { dlog(`mana restock error: ${e.message}`, '#f66'); }
}

async function mainLoop() {
  readStamFromDOM();
  let invLoaded = false;
  while (running) {
    // PAUSED = fully idle: no fetch, no cookie writes, nothing — so you can drink
    // potions / fight bosses / play MANUALLY without the bot interfering. The pause
    // state is persisted (S.paused), so a page reload (e.g. after a potion) stays
    // paused instead of silently resuming.
    if (paused) { status = '⏸ paused — manual play'; await sleep(600); await refreshBossTimers(); renderUI(); continue; }
    // Farm e AutoPvP sono indipendenti (stamina vs token/Rage): girano in PARALLELO. L'unica
    // cosa condivisa è la banda di richieste — entrambi i loop gestiscono già il rate-limit
    // ("Slow down" → retry), quindi non serve mettere in pausa il farm durante il PvP.
    if (!invLoaded) { await refreshInv(); invLoaded = true; }
    _didWork = false;          // azzera: lo rialzano un colpo o un loot (vedi lootMob/fightTarget)
    let questPending = false;
    try {
      await refreshBossTimers();   // ⏱ tab data (throttled)
      await refreshTimers();   // keep boss death/respawn countdowns fresh (throttled 15s)
      if (S.autolevel) await allocateStats();   // spend free stat points → stamina (throttled)
      await maybeRestockMana();                 // keep Small Mana Potions stocked (opt-in, throttled)
      // Phase 0 — guild dungeon bosses (battle.php?dgmid) — single boss per source
      for (const src of (S.config || [])) {
        if (paused || !running) break;
        if (src.kind === 'dungeon'    && src.enabled !== false) await processDungeon(src);
        if (src.kind === 'single'     && src.enabled !== false) await processSingle(src);
        if (src.kind === 'dungeonloc' && src.enabled !== false) {
          if (src.cubeAuto) await processCubeAuto(src);   // 🧊 lanes enumerated live, survives new cubes
          else await processDungeonLocation(src);
        }
      }
      // Phase 1 — timed bosses (priorità assoluta, usano stamina poi pozione). Duel bosses
      // (multi-phase Olympus gods) go through processDuelBoss (phase 1 → headless duel →
      // phase 3); plain timed bosses through processWave.
      if (!paused && running) await processArmedBosses();   // 🎯 bosses armed from the Boss timers tab
      for (const wave of WAVES) {
        if (paused || !running) break;
        const plainTimed = wave.targets.filter(t => t.timer && !t.duel);
        if (plainTimed.length) await processWave(wave, plainTimed);
        for (const t of wave.targets.filter(t => t.timer && t.duel)) {
          if (paused || !running) break;
          await processDuelBoss(wave, t);
        }
      }
      // Phase 1.4 — Battle Pass hunt check (throttled 1h): skip bp-hunt source when done.
      if (!paused && running) await checkBpHunt();
      // Phase 1.5 — Adventurer's Guild quests (accept → farm to target → finish → next,
      // consecutively). While a quest is pending it OWNS the stamina (LSP refills it).
      if (!paused && running) questPending = await processQuests();
      // Phase 2 — general farm mobs (stamina rimanente, interrompibili dai timed).
      // SKIPPED while a quest is pending → "non sprecare stamina per le waves": the
      // stamina stays reserved for the quest, topped up with LSP, until it's turned in.
      _timedInterrupt = false;
      if (!questPending) for (const wave of WAVES) {
        if (paused || !running || _timedInterrupt) break;
        // Skip the BP lizard-hunt source when the seasonal quest is already complete.
        if (wave.id === 'bp-hunt' && S._bpDone) continue;
        const farmTargets = wave.targets.filter(t => !t.timer);
        if (farmTargets.length) await processWave(wave, farmTargets, true);
      }
    } catch (e) {
      console.error('[FarmBot]', e);
      log(`error: ${e.message}`, '#f66');
      status = 'error — retry…';
    }
    renderUI();
    // Backoff: a stamina 0 non c'è nulla da fare finché non rigenera (i farm non
    // usano pozioni, i timed sono già al target). Dormi a lungo invece di rifare
    // il giro ~2 volte al secondo spammando il log. Il cache wave (30s) scade nel
    // frattempo, così al risveglio rilegge stamina/boss freschi.
    // ECCEZIONE 🏰: se è armato un "dungeon boss", NON dormire 60s anche a stamina 0 —
    // la stanza può aprirsi da un momento all'altro (la gilda finisce le lanes) e il boss
    // beve LSP appena lo vede. Resta sveglio a ~3s così lo aggancia all'istante (AFK-safe).
    const bossWatch = (S.config || []).some(s => s.enabled !== false &&
      (s.targets || []).some(t => t.enabled !== false && t.dungeonBoss));
    // IDLE = giro completo con stamina ma NIENTE fatto (nessun colpo, nessun loot): i target sono
    // tutti al cap o non ci sono mob vivi → inutile riscorrere le wave ogni 600ms (era lo spam
    // "fetch g5w11…" col pannello pieno di stamina). Mostra "in attesa" e dormi a lungo; al
    // risveglio (≤30s) rilegge respawn/stamina freschi e riparte appena c'è qualcosa.
    const idle = !_didWork && !questPending;
    let napMs;
    if (bossWatch || armedSoon()) napMs = DUNGEON_BOSS_POLL;
    else if (stam < SKILL_COST){ status = '⏳ waiting for stamina…';           renderUI(); napMs = 60_000; }
    else if (idle)             { status = '✓ nothing to farm now · waiting for respawn'; renderUI(); napMs = 30_000; }
    else                         napMs = 600;
    await sleep(napMs);
  }
}

// ── UI HELPERS ────────────────────────────────────────────────────────────────
function fmt(ms) {
  const s = Math.floor(Math.abs(ms) / 1000);
  const m = Math.floor(s / 60), h = Math.floor(m / 60);
  return h ? `${h}h ${m%60}m` : `${m}m ${s%60}s`;
}

// full number for cap inputs (10,000,000 — never 10M / 1.2B)
function fullDmg(n) { return Math.round(Number(n) || 0).toLocaleString('en-US'); }
function fmtDmg(n) {
  if (n >= 1_000_000_000) return `${(n/1e9).toFixed(1)}B`;
  if (n >= 1_000_000)     return `${(n/1e6).toFixed(1)}M`;
  if (n >= 1_000)         return `${(n/1e3).toFixed(0)}K`;
  return String(n);
}

// Render a loot rewards object (shape varies per endpoint) into a short readable string,
// e.g. "gold 12K · exp 3.4K · Health Potion×2". Defensive: handles numbers, arrays of
// items ({name,qty} or plain strings) and nested objects without knowing the exact schema.
function fmtLoot(r) {
  if (r == null) return '';
  if (typeof r !== 'object') return String(r);
  const parts = [];
  for (const [k, v] of Object.entries(r)) {
    if (v == null || v === 0 || v === '' || v === false) continue;
    if (Array.isArray(v)) {
      for (const it of v) {
        if (it == null) continue;
        if (typeof it === 'object') {
          const nm = it.name || it.item || it.title || '?';
          const q  = it.qty || it.quantity || it.amount || it.count;
          parts.push(q ? `${nm}×${q}` : nm);
        } else parts.push(String(it));
      }
    } else if (typeof v === 'object') {
      const inner = fmtLoot(v); if (inner) parts.push(inner);
    } else if (typeof v === 'number') {
      parts.push(`${k} ${v >= 1000 ? fmtDmg(v) : v}`);
    } else {
      parts.push(`${k}: ${v}`);
    }
  }
  return parts.join(' · ');
}

// loot suffix for log lines: " → gold 12K · exp 3.4K · Health Potion×2" (empty if nothing)
function lootSfx(r) { const s = fmtLoot(r); return s ? ` → ${s}` : ''; }

function bar(n, max, w = 14) {
  const f = Math.min(Math.round(n / max * w), w);
  return '█'.repeat(f) + '░'.repeat(w - f);
}

// Trim a long monster name so it can't push the dmg/stamina off the status line.
function shortName(n, max = 20) { n = String(n || ''); return n.length > max ? n.slice(0, max) + '…' : n; }

// ── RENDER ────────────────────────────────────────────────────────────────────
let uiContent, uiPanel, minimized = S.minimized === true, activeTab = 'status';

function renderStatus() {
  const now    = Date.now();
  const potStock = STAM_POTS.map(p => `${p.name} ${S.potInv?.[p.item]?.qty ?? '?'}`).join('/');
  const potNone  = !pickPotion();

  // is anything actually configured to attack? drives the onboarding empty-state.
  const hasTargets = (S.config || []).some(w => w.enabled !== false &&
    ((w.targets && w.targets.length) || w.kind === 'single' || w.kind === 'dungeon'));

  // ── live state badge: what is the bot doing RIGHT NOW ─────────────────────────
  const inDuel = !paused && /duel|🤺/i.test(status);
  const badge  = paused  ? { t: '⏸ Paused', c: '#fa0', bg: '#33290f' }
               : inDuel  ? { t: '🤺 Duel',  c: '#c9a0ff', bg: '#241a33' }
               : hasTargets ? { t: '▶ Running', c: '#39d97f', bg: '#12291c' }
                            : { t: '◆ Not set up', c: '#8ab', bg: '#16202a' };

  // ── ONBOARDING — nothing set up yet: tell the user exactly what to do ──────────
  if (!hasTargets) {
    return `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <span style="background:${badge.bg};color:${badge.c};border-radius:20px;padding:3px 10px;font-size:11px;font-weight:bold">${badge.t}</span>
      </div>
      <div style="background:#10161f;border:1px solid #24405a;border-radius:8px;padding:11px 12px">
        <div style="color:#cfe6ff;font-size:13px;font-weight:bold;margin-bottom:8px">👋 How it works</div>
        <div style="color:#9db4c9;font-size:11px;line-height:1.7">
          The bot does nothing until you tell it <b style="color:#cfe">what to attack</b>.
          <div style="margin-top:8px">
            <b style="color:#7ab8ff">1.</b> Open a <b>wave / boss / dungeon</b> page in the game<br>
            <b style="color:#7ab8ff">2.</b> Open <b>⚙ Setup</b> → press <b style="color:#9cf">🔍 Scan this page</b><br>
            <b style="color:#7ab8ff">3.</b> Tick a monster, set the <b>damage</b> and pick<br>
            &nbsp;&nbsp;&nbsp;&nbsp;<b style="color:#fab">⏰ Timed</b> or <b style="color:#7df">🎯 Farm</b>, then <b style="color:#7fa">💾 Save</b><br>
            <b style="color:#7ab8ff">4.</b> ▶ The bot runs on its own
          </div>
        </div>
        <div style="display:flex;gap:6px;margin-top:11px">
          <button data-status-action="open-setup" style="flex:1;background:#2a3a6a;color:#cfe;border:none;border-radius:6px;padding:8px;cursor:pointer;font:bold 11px monospace">⚙ Open Setup</button>
          <button data-status-action="open-guide" style="flex:1;background:#252540;color:#c9a0ff;border:none;border-radius:6px;padding:8px;cursor:pointer;font:bold 11px monospace">📖 Guide</button>
        </div>
      </div>`;
  }

  // ── compact top strip: state badge + key live figures ─────────────────────────
  const lph = lvlPerHour();
  const chip = (ic, val, lbl, cc, title = '') =>
    `<div class="vfb-chip" title="${title}" style="--cc:${cc}"><i>${ic}</i><b>${val}</b><small>${lbl}</small></div>`;
  let h = `
    <div class="vfb-statusrow">
      <span class="vfb-badge" style="--bc:${badge.c};--bb:${badge.bg}"><i class="vfb-dot"></i>${badge.t.replace(/^\S+\s/, '')}</span>
      <span class="vfb-msg" title="${esc(status)}">${esc(paused ? 'manual play — bot is not touching the game' : status)}</span>
    </div>
    <div class="vfb-chips">
      ${chip('⚡', stam.toLocaleString(), 'Stamina', stam > 0 ? '#00e5ff' : '#ff4d6d', 'stamina')}
      ${chip('📈', lph == null ? '--' : lph.toFixed(lph >= 10 ? 0 : 1), 'Lv / hour', '#c77dff', 'levels per hour' + (userLevel != null ? ` · LV ${userLevel}` : ''))}
      ${chip('🧪', potStock, 'Potions', potNone ? '#ff4d6d' : '#3ddc97', 'stamina potions left' + (potNone ? ' — empty!' : ''))}
      ${chip('💀', S.timedKills.toLocaleString(), 'Boss kills', '#ffc857', 'boss kills')}
    </div>
  `;

  // -- card section helper -------------------------------------------------------
  const card = (icon, title, badgeTxt, body, accent = '#00e5ff') => `
    <div class="vfb-card" style="--ac:${accent}">
      <div class="vfb-card-h"><span class="vfb-card-t">${icon} ${title}</span>${badgeTxt ? `<span class="vfb-card-b">${badgeTxt}</span>` : ''}</div>${body}
    </div>`;

  const timedTargets = WAVES.flatMap(w => w.targets.filter(t => t.timer));
  if (timedTargets.length) {
    let body = '';
    for (const t of timedTargets) {
      const exp  = liveBoss[t.key];                                 // alive auto-die ts (s)
      const tm   = Object.entries(S.timers).find(([nm, v]) => v && t.match({ name: nm }));
      const done = S.timedBy[t.key] || 0;
      let info;
      if (exp)                       info = `<span style="color:#2f8">✅ alive · dies ${fmt(exp * 1000 - now)}</span>`;
      else if (tm && tm[1].nextTs) { const left = tm[1].nextTs * 1000 - now;
        info = left > 0 ? `<span style="color:#ff6">⟳ respawn ${fmt(left)}</span>` : `<span style="color:#2f8">✅ ready!</span>`; }
      else                           info = `<span style="color:#777">… waiting</span>`;

      // duel bosses show which phase the bot is in (P1 / duel / P3)
      let phaseChip = '';
      if (t.duel) {
        const d = (S.duel || {})[t.key] || {};
        phaseChip = (d.retryAt && now < d.retryAt)
            ? `<span style="color:#fa0;font-size:9px;margin-left:4px" title="duel lost — retrying">🤺 retry ${fmt(d.retryAt - now)}</span>`
          : d.dueled
            ? `<span style="color:#c9a0ff;font-size:9px;margin-left:4px" title="duel won — farming phase 3">🤺 P3</span>`
            : `<span style="color:#c9a0ff;font-size:9px;margin-left:4px" title="phase 1 / plays the duel when it starts">🤺 P1</span>`;
      }
      const short = t.label.length > 20 ? t.label.slice(0,20)+'…' : t.label;
      body += `<div class="vfb-row">
        <span style="color:#fab;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(short)}${phaseChip}${done ? ` <span style="color:#2f8">×${done}</span>` : ''}</span>
        <span style="flex-shrink:0">${info}</span></div>`;
    }
    h += card('⏰', 'Boss', `${timedTargets.length} · ${S.timedKills} done`, body, '#fab');
  }

  // ── 📜 QUEST card ─────────────────────────────────────────────────────────────
  if (S.questEnabled) {
    const q = S.questActive;
    let body;
    if (q) {
      const short = (q.title || '').length > 26 ? q.title.slice(0,26)+'…' : (q.title || 'quest');
      const objective = q.skill ? 'casting skills' : q.gather ? (q.item || 'gather item') : (q.monster || 'g3w5 mobs');
      body = `<div style="font-size:11px;color:#cfa;line-height:1.5">${esc(short)}<br>
        &nbsp;&nbsp;→ <span style="color:#7df">${esc(objective)}</span>
        <span style="color:#9c6">${q.have ?? 0}/${q.need ?? (q.skill ? 20 : 10)}</span></div>`;
    } else {
      body = `<div style="font-size:11px;color:#777">… all on cooldown (2-day rotation)</div>`;
    }
    h += card('📜', 'Quest', `${S.questDone} done`, body, '#9c6');
  }

  // farm progress — limit per mob comes from its matching farm target (no hardcode)
  const limitForName = (name) => {
    for (const w of WAVES) for (const t of w.targets)
      if (t.killLimit != null && t.match({ name })) return t.killLimit;
    return null;
  };
  // only NORMAL farm mobs here — timed bosses live in the ⏰ Boss timers block above.
  // Union killed mobs with farm mobs we've SEEN (farmSeen) so the tab shows what we
  // farm even at 0 kills, and updates live as new mob types appear.
  const farmNames = new Set([...Object.keys(S.kills), ...Object.keys(S.farmSeen || {})]);
  const killRows = [...farmNames]
    .filter(name => !isTimedName(name))
    .map(name => [name, S.kills[name] || 0])
    .sort((a, b) => b[1] - a[1]);
  if (killRows.length) {
    let body = '';
    for (const [name, k] of killRows) {
      const lim   = limitForName(name);
      const done  = lim != null && k >= lim;
      const color = done ? '#2f8' : (k > 0 ? '#fa0' : '#555');
      const short = name.length > 20 ? name.slice(0,20)+'…' : name;
      const prog  = lim != null
        ? `<span class="vfb-prog"><i style="width:${Math.min(100, Math.round(k / lim * 100))}%"></i></span><span style="color:${color}"> ${k}/${lim}${done?' ✓':''}</span>`
        : `<span style="color:${color}"> ×${k}</span>`;
      body += `<div style="font-size:11px;margin-bottom:3px"><span style="color:#7df">${esc(short)}</span>${prog}</div>`;
    }
    const resetBtn = `<button data-status-action="reset-farm" title="reset farmed monsters (kills + list)"
        style="background:#3a2a2a;color:#f99;border:none;border-radius:10px;padding:1px 8px;cursor:pointer;font-size:10px">🗑 reset</button>`;
    h += card('🎯', 'Farm', resetBtn, body, '#0af');
  }

  return h;
}

function renderLog() {
  if (!logBuf.length) return `<div style="color:#444;font-size:11px">no log yet</div>`;
  return logBuf.slice().reverse().map(e =>
    `<div class="vfb-log" style="--lc:${e.color}"><time>${e.ts}</time><span style="color:${e.color}">${e.msg}</span></div>`
  ).join('');
}

// ── SETTINGS TAB ──────────────────────────────────────────────────────────────
// "Scan questa pagina" reads the live DOM of whatever page you're on and lists
// its mobs; you tick the ones to hit, set danno + ⏰timed/🎯farm, ✕ to remove.
// Sources are grouped by page (any URL). The 2s auto-render skips this tab so
// typing/focus isn't lost; "💾" persists + rebuilds the runtime WAVES.
const _scan = {};   // source.id → [{name, count, boss}] from the last live scan
let _scanFlash = null;   // {msg, ok, ts} — transient confirmation banner shown in the Setup
                         // tab so a click on 🔍 Scan is always visibly acknowledged.

const esc = s => String(s ?? '').replace(/[&<>"]/g, c =>
  ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

const IN = 'background:#0c0c16;border:1px solid #2b2e49;border-radius:4px;color:#dfe6ff;font:11px monospace;padding:2px 4px';

// parse "3m" / "120k" / "50000000" → integer (null = invalid → keep old value)
function parseAmount(s) {
  s = String(s).trim().toLowerCase().replace(/[, _]/g, '');
  const m = s.match(/^([\d.]+)([kmbg]?)$/);   // b/g = miliardi (1e9)
  if (!m) return null;
  let n = parseFloat(m[1]); if (isNaN(n)) return null;
  if      (m[2] === 'k')                  n *= 1e3;
  else if (m[2] === 'm')                  n *= 1e6;
  else if (m[2] === 'b' || m[2] === 'g')  n *= 1e9;
  return Math.round(n);
}

// build a runtime target from a scanned mob name. srcName links the checklist row
// back to the target; include is the core token so it still matches if the boss's
// full title shifts. LSP + timer are derived (boss/timed → auto LSP, farm → none).
// Olympus gods that run the 3-phase cycle (phase 1 → solo PvP Duel Phase → phase 3).
// Detected from a scanned boss name = "<god>, <Sovereign|Divine|Duelist|Ascended> …".
// Heralds like "Pan, Wild Herald of Hermes" are NOT duel bosses — their first token isn't
// a god, so they're skipped. See the DUEL PHASE ENGINE + reference-duel-phase-bosses.
const OLYMPUS_GODS = ['ares', 'artemis', 'hermes', 'poseidon', 'apollo', 'zeus', 'athena',
                      'hades', 'hera', 'demeter', 'dionysus', 'hephaestus', 'aphrodite'];
function detectDuelGod(name) {
  const n = String(name).toLowerCase().trim();
  const m = n.match(/^([a-z]+),/);
  if (!m || !OLYMPUS_GODS.includes(m[1])) return null;
  return /\b(sovereign|divine|duelist|ascended)\b/.test(n) ? m[1] : null;
}

function mkTarget(name, boss) {
  const full = name.toLowerCase().trim();
  const god  = boss ? detectDuelGod(name) : null;   // multi-phase Olympus boss?
  return {
    key: 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    label: name, srcName: name,
    // DUEL boss → match on the god name + comma ("ares,") so it follows the boss through ALL
    // three phase names (Sovereign→Duelist→Ascended) while never colliding with a herald
    // ("Pan, Wild Herald of Hermes" doesn't contain "hermes,"). Plain boss → match the FULL
    // name so similarly-titled summon bosses don't collide. Farm → short first-segment token.
    include: [god ? god + ',' : (boss ? full : full.split(',')[0].trim())], exclude: [],
    dmgTarget: boss ? 3_000_000_000 : 100_000_000,   // boss/duel phase 1: 3B (edit in UI); farm: 100M/mob
    ...(god ? { duel: true, phase3Dmg: 3_000_000_000 } : {}),   // P3 target (edit in UI)
    killLimit: boss ? null : 400,
    useLSP: 'asNeeded',   // v1.18.0: farm usa LSP come i boss (FSP mai)
    timer: !!boss, enabled: true,
  };
}

// which saved target (if any) a checklist row maps to (case-insensitive — the row
// name may be a mixed-case label while include tokens are lowercase)
function targetFor(w, name) {
  const ln = String(name).toLowerCase();
  return (w.targets || []).find(t => (t.srcName || '').toLowerCase() === ln)
      || (w.targets || []).find(t => (t.label || '').toLowerCase() === ln)   // exclude-only farm targets have empty include + no srcName → match by label
      || (w.targets || []).find(t => (t.include || []).some(tok => tok && ln.includes(String(tok).toLowerCase())));
}

// current page URL, normalised (no hash, no dead_page) — the key for a source
function currentPageUrl() {
  const u = new URL(location.href);
  u.hash = ''; u.searchParams.delete('dead_page');
  return u.toString();
}

// Add/refresh ONE guild-dungeon LOCATION (guild_dungeon_location.php) as a 'dungeonloc'
// source and fill its mob checklist (_scan[src.id]). Shared by the location-page scan and
// the INSTANCE-page scan (which iterates every location). When `liveDoc` is given (user is
// on the location page) it reads the live DOM; otherwise it fetches the page. Lists DEAD
// instances too, so you can add them while everything is on cooldown.
async function scanDungeonLocation(locUrl, liveDoc, label) {
  const lu  = new URL(locUrl, location.href);
  const url = lu.toString();
  let mons = liveDoc ? _collectDungeonMons(liveDoc) : [];
  if (!mons.length) {
    const html = await getHtml(url);
    if (html) mons = parseDungeonMons(html);
  }
  const instId = lu.searchParams.get('instance_id');
  const locId  = lu.searchParams.get('location_id');
  // Resolve the STABLE dungeon type for this instance so the source survives the daily
  // instance rotation — and so re-scanning tomorrow updates the SAME source (matched by
  // type+location), not a duplicate pinned to a dead instance URL.
  let dType = null;
  try {
    const map = await resolveDungeonInstances(true);
    for (const [t, v] of Object.entries(map)) if (String(v.instanceId) === String(instId)) { dType = t; break; }
  } catch {}
  let src = S.config.find(w => w.kind === 'dungeonloc' &&
    ((dType != null && String(w.dungeonType) === String(dType) && String(w.location_id) === String(locId))
     || srcUrl(w) === url));
  if (!src) {
    src = {
      id: 'dl' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      kind: 'dungeonloc', url, dungeonType: dType, instance_id: instId, location_id: locId,
      label: label || pageLabel(url) || ('Location ' + (locId || '')),
      enabled: true, targets: [],
    };
    S.config.push(src);
  } else { src.url = url; if (dType != null) src.dungeonType = dType; src.instance_id = instId; src.location_id = locId; if (label) src.label = label; }

  const distinct = {};
  for (const m of mons) {
    const nm = m.name || '?';
    distinct[nm] = distinct[nm] || { total: 0, dead: 0 };
    distinct[nm].total++; if (m.dead) distinct[nm].dead++;
  }
  // boss:false → mkTarget builds a FARM-style target (no potions, kill counter); the user
  // can flip any to ⏰ Timed (potions) from the checklist if they want.
  const list = Object.entries(distinct)
    .map(([name, c]) => ({ name, count: c.total, boss: false }))
    .sort((a, b) => b.count - a.count);
  _scan[src.id] = list;
  return { src, list, mons };
}

// Scan the LIVE page the user is on (any URL: wave, event, gate, guild dungeon).
// Reads document directly → no fetch, no cookie race. Creates/refreshes the
// matching source in S.config and stores its mob checklist in _scan[source.id].
async function scanCurrentPage(btn) {
  // instant click feedback: mutate the live button + yield a paint frame BEFORE the
  // (mostly synchronous) DOM scan runs, so the press is always visible even when the
  // scan finishes in a few ms (user: "non capisco se clicca o meno").
  if (btn) {
    btn.textContent = '⏳ Scanning…';
    btn.style.background = '#3a5a9a';
    btn.disabled = true;
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  }
  const url = currentPageUrl();

  // ── GUILD DUNGEON boss page: battle.php?dgmid=…&instance_id=… ──
  // One boss per page (.battle-card.monster-card). Create a 'dungeon' source the
  // main loop fights via dungeon_join_battle/damage/dungeon_loot (id = dgmid+instance).
  const pu = new URL(location.href);
  const dgmid = pu.searchParams.get('dgmid');
  const instId = pu.searchParams.get('instance_id');
  if (dgmid && pu.pathname.includes('battle.php')) {
    const card = document.querySelector('.battle-card.monster-card, .monster-card');
    const bossName = (card?.querySelector('.card-title')?.textContent
                   || card?.dataset?.name || document.title || `Dungeon boss ${dgmid}`)
                   .replace(/[🧟👑⚔️🎁\s]+/g, ' ').trim() || `Dungeon boss ${dgmid}`;
    let src = S.config.find(w => w.kind === 'dungeon' && String(w.dgmid) === String(dgmid)
                              && String(w.instance_id) === String(instId));
    if (src) { src.url = url; src.label = bossName; }      // refresh (dgmid may be re-scanned)
    else {
      src = {
        id: 'd' + Date.now().toString(36), url, label: bossName, kind: 'dungeon',
        dgmid, instance_id: instId, enabled: true,
        targets: [{ key: 'boss', label: bossName, srcName: bossName, include: [], exclude: [],
                    dmgTarget: 100_000_000, killLimit: null, useLSP: 'asNeeded',
                    timer: false, enabled: true, dungeon: true }],
      };
      S.config.push(src);
    }
    save();
    log(`🏰 dungeon added: ${bossName} (dgmid ${dgmid}) — set the damage and press 💾`, '#9060ff');
    flashScan(`🏰 dungeon boss added: ${bossName} — set the damage & press 💾`);
    return;
  }

  // ── SINGLE BOSS page: battle.php?id=… (world/timed boss with a leaderboard) ──
  // No dgmid → a normal monster battle page. monster_id = the URL id; our running cumulative
  // damage is in #yourDamageValue. Add a 'single' source the main loop attacks (Phase 0) up
  // to the value you set, via the wave endpoints (user_join_battle / damage / loot).
  // monster_id: the page's own BATTLE_CFG.id is the authoritative value it POSTs to damage.php
  // (verified id === URL ?id for global bosses); fall back to the URL id if the global is absent.
  const cfg = (typeof window !== 'undefined' && window.BATTLE_CFG) || null;
  const singleId = (cfg && !cfg.isDungeon && cfg.id) ? String(cfg.id) : pu.searchParams.get('id');
  if (singleId && pu.pathname.includes('battle.php')) {
    const name = (document.querySelector('.card-title')?.textContent || document.title || `Boss ${singleId}`)
                   .replace(/[🧟👑⚔️🎁\s]+/g, ' ').trim() || `Boss ${singleId}`;
    const cur = readYourDamage(document);
    let src = S.config.find(w => w.kind === 'single' && String(w.monster_id) === String(singleId));
    if (src) { src.url = url; src.label = name; }
    else {
      src = {
        id: 'b' + Date.now().toString(36), url, label: name, kind: 'single',
        monster_id: singleId, enabled: true,
        targets: [{ key: 'boss', label: name, srcName: name, include: [], exclude: [],
                    dmgTarget: 3_000_000_000, useLSP: 'asNeeded', timer: true, enabled: true }],
      };
      S.config.push(src);
    }
    save();
    log(`🎯 boss added: ${name} (id ${singleId})${cur != null ? ` · your dmg now ${fmtDmg(cur)}` : ''} — set the STOP damage & press 💾`, '#9060ff');
    flashScan(`🎯 boss added: ${name} — set the stop damage & press 💾`);
    return;
  }

  // ── GUILD DUNGEON LOCATION page: guild_dungeon_location.php?instance_id=…&location_id=… ──
  // Many .mon instances (each its own dgmid). We farm by MONSTER NAME because instances
  // respawn with new dgmids, so the source stores the location URL + a name checklist and
  // the loop re-reads the page each pass. Lists DEAD instances too, so you can add them
  // while everything is dead / on cooldown (the user's exact case).
  if (pu.pathname.includes('guild_dungeon_location.php')) {
    const label = (document.title || 'Guild dungeon').replace(/\s*[—\-|·].*$/, '').trim() || pageLabel(url);
    const { src, list, mons } = await scanDungeonLocation(url, document, label);
    save();
    log(`🏰 location ${src.label}: ${list.length} monster types (${mons.length} instances${mons.length && mons.every(m=>m.dead) ? ', all dead now' : ''}) — tick them, set damage, press 💾`, '#9060ff');
    flashScan(`🏰 ${list.length} monster types found — tick them below`, list.length > 0);
    return;
  }

  // ── GUILD DUNGEON INSTANCE page: guild_dungeon_instance.php?id=… ──
  // The instance index lists its LOCATIONS (each → guild_dungeon_location.php). Scan ALL of
  // them in one go: fetch each, create a dungeonloc source with its mob checklist. Then the
  // user ticks the bosses/mobs to farm across the locations and sets the damage.
  if (pu.pathname.includes('guild_dungeon_instance.php')) {
    const seen = new Set();
    const locLinks = [...document.querySelectorAll('a[href]')]
      .map(a => ({ url: a.href, text: (a.textContent || '').replace(/\s+/g, ' ').trim() }))
      .filter(a => /guild_dungeon_location\.php/i.test(a.url) && !seen.has(a.url) && seen.add(a.url));
    if (!locLinks.length) {
      log('⚠ no locations found on this instance page — open a single location and scan that', '#f66');
      flashScan('⚠ no locations found here — open a single location and scan that', false);
      return;
    }
    let totalTypes = 0, totalMons = 0;
    for (const L of locLinks) {
      const label = L.text.replace(/\s*[—\-|·].*$/, '').trim() || pageLabel(L.url);
      const { list, mons } = await scanDungeonLocation(L.url, null, label);
      totalTypes += list.length; totalMons += mons.length;
    }
    save();
    log(`🏰 instance: ${locLinks.length} locations · ${totalTypes} monster types (${totalMons} instances) — tick the ones to farm, set damage, press 💾`, '#9060ff');
    flashScan(`🏰 ${locLinks.length} locations · ${totalTypes} monster types found`, totalTypes > 0);
    return;
  }

  // ── GUILD DUNGEON CUBE page: guild_dungeon_cube.php?instance_id=… ──
  // The "cube" dungeon is a node-based UI shell: its sections do NOT appear as plain links in
  // the DOM (Enter is resolved server-side). But every farmable section is a normal
  // guild_dungeon_location.php?instance_id=…&location_id=K page. So we PROBE location_id 1..40 for
  // this instance and keep the ones that actually contain monsters (PvE rooms + the boss room).
  // Invalid ids return a ~20-byte 4xx and PvP-only rooms have no .mon → both are skipped cheaply.
  if (pu.pathname.includes('guild_dungeon_cube.php')) {
    const instId = pu.searchParams.get('instance_id');
    if (!instId) { log('⚠ cube: missing instance_id in URL', '#f66'); flashScan('⚠ cube: missing instance_id in URL', false); return; }
    let found = 0, types = 0, mobs = 0;
    for (let loc = 1; loc <= 40; loc++) {
      const lurl = `${BASE}/guild_dungeon_location.php?instance_id=${instId}&location_id=${loc}`;
      const { src, list, mons } = await scanDungeonLocation(lurl, null, null);
      if (!mons.length) {                       // not a farmable section → drop the empty source
        const i = S.config.indexOf(src);
        if (i >= 0 && (!src.targets || !src.targets.length)) S.config.splice(i, 1);
        delete _scan[src.id];
        continue;
      }
      found++; types += list.length; mobs += mons.length;
    }
    save();
    log(found
      ? `🏰 cube ${instId}: ${found} farmable sections · ${types} monster types (${mobs} mobs) — tick them, set damage, press 💾`
      : `⚠ cube ${instId}: no farmable sections found (probed location_id 1–40)`, found ? '#9060ff' : '#f66');
    flashScan(found ? `🏰 cube: ${found} farmable sections · ${types} monster types` : '⚠ cube: no farmable sections found', !!found);
    return;
  }

  // Need the ALIVE view. If the live page already shows alive monster-cards
  // (user is in the alive view) read them directly; otherwise the page is in
  // the dead/unclaimed view (cookie=0) → fetch the alive view (cookie=1) so we
  // actually see the live mobs. (fetch carries the cookie set in this same tick,
  // so there's no race with the main loop.)
  let alive = Object.values(_collectMobs(document)).filter(m => !m.dead);
  let summonRoot = document;
  if (alive.length) {
    _collectAutoSummon(document);
  } else {
    const view = saveUserView();
    setCookieRaw('show_dead_bosses_only', 0);
    setHideDead(true);
    const html = await getHtml(url);
    restoreUserView(view);
    if (html) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      _collectAutoSummon(doc);
      alive = Object.values(_collectMobs(doc)).filter(m => !m.dead);
      summonRoot = doc;
    }
  }

  const bossNames = Object.keys(S.timers);
  const distinct = {};
  for (const m of alive) distinct[m.name] = (distinct[m.name] || 0) + 1;
  const list = Object.entries(distinct).map(([name, count]) => ({
    name, count,
    boss: bossNames.some(bn => bn.split(',')[0] && name.includes(bn.split(',')[0]))
        || /general|king|titan|herald|hunter|emperor|lord|queen|god|eternal|hermes|divine|olymp/i.test(name),
  }));

  // Also surface AUTO-SUMMON boss cards (the timed bosses — Hermes, Pan, …). They are
  // NOT .monster-card, so _collectMobs never sees them, and a timed boss is usually
  // DEAD (in respawn) when you scan — so it would never be selectable. List them here
  // so you can flag them ⏰ Timed even while dead. count = 0 → shown as "×0" (respawning).
  for (const c of summonRoot.querySelectorAll('.auto-summon-card')) {
    const nm = (c.querySelector('.auto-summon-name')?.textContent || '')
                 .replace(/\s+/g, ' ').toLowerCase().trim();
    if (!nm || distinct[nm] || list.some(r => r.name === nm)) continue;  // already listed as an alive card
    list.push({ name: nm, count: c.dataset.alive === '1' ? 1 : 0, boss: true });
  }

  list.sort((a, b) => (b.boss - a.boss) || (b.count - a.count));

  let src = S.config.find(w => srcUrl(w) === url);
  if (!src && !list.length) {
    log('⚠ no alive mobs here. Waves sometimes only show bosses (trash not spawned yet). Guild dungeons use a different system (open the boss battle page and scan that).', '#f66');
    flashScan('⚠ no alive monsters found on this page', false);
    return;
  }
  if (!src) {
    src = { id: 's' + Date.now().toString(36), url, label: pageLabel(url), enabled: true, targets: [] };
    S.config.push(src);
  }
  _scan[src.id] = list;
  save();
  log(`⚙ scan ${src.label}: ${list.length} alive mobs`, '#9060ff');
  const bossN = list.filter(r => r.boss).length;
  flashScan(`✓ ${list.length} monsters found${bossN ? ` (${bossN} boss)` : ''} — tick the ones to add`, list.length > 0);
}

// Show a transient confirmation banner in the Setup tab after a scan, then clear it.
// Re-renders only while the Setup tab is open (so it doesn't fight the status loop).
function flashScan(msg, ok = true) {
  _scanFlash = { msg, ok, ts: Date.now() };
  if (activeTab === 'settings') renderSettings();
  setTimeout(() => {
    if (_scanFlash && Date.now() - _scanFlash.ts >= 3300) {
      _scanFlash = null;
      if (activeTab === 'settings') renderSettings();
    }
  }, 3500);
}

function renderSettings() {
  if (!uiContent) return;
  const curUrl = currentPageUrl();
  const sectionTitle = (txt) =>
    `<div style="color:#9cf;font-size:11px;font-weight:bold;text-transform:uppercase;
      letter-spacing:.5px;margin:10px 0 6px">${txt}</div>`;
  const toggleRow = (act, on, title, onTxt, offTxt) =>
    `<label class="vfb-tg" style="display:flex;align-items:center;gap:8px;margin-bottom:6px;cursor:pointer;
      font-size:11px;background:#10101c;border:1px solid ${on?'#2a4a35':'#3a3144'};border-radius:6px;padding:7px 8px">
      <input type="checkbox" class="vfb-sw" data-act="${act}" ${on?'checked':''}>
      <span style="flex:1">
        <span style="color:#dfe6ff">${title}</span><br>
        <span style="color:#667;font-size:10px">${on?onTxt:offTxt}</span>
      </span>
      <span style="color:${on?'#2f8':'#777'};font-weight:bold;font-size:11px">${on?'ON':'OFF'}</span>
    </label>`;

  let h = sectionTitle('How the bot fights');
  h += toggleRow('lspenable', S.lspEnabled,
        '🧪 Stamina potions while farming',
        'Timed bosses AND farming use potions',
        'Only timed bosses use potions — farming runs on natural stamina');
  h += toggleRow('fspfallback', S.fspFallback,
        '🥤 Use FSP when LSP runs out',
        'When every LSP is gone, drink a Full Stamina Potion (item 35) instead of waiting',
        'FSP stash is never touched — the bot waits for natural stamina once LSP is out');
  h += toggleRow('fsponly', !!S.fspOnly,
        '💧 FSP only (Full Stamina Potion)',
        'Drinks ONLY FSP (item 35) — LSP and small potions are never touched',
        'Normal order: LSP first (FSP only if the fallback above is ON)');
  h += toggleRow('questenable', S.questEnabled,
        '📜 Auto Adventurer&apos;s Guild quests',
        'Accept a quest → farm its mob on g3w5 (≥5m each) → turn in → next',
        'Quests off — never touch the Adventurer&apos;s Guild');
  h += toggleRow('exactdmg', S.exactDmg !== false,
        '🎯 Exact damage on every target',
        'Steps 100→50→10→1 stamina toward YOUR stop-at value using worst-case damage/stamina; overshoot ≤ one 1-stamina hit',
        '🧠 SMART big hits: starts with your biggest hit (up to x1000), then steps down so it still lands on your stop-at value');
  if (S.exactDmg === false) {
    const bm = parseInt(S.bigHitMax) || 100;
    h += `<div style="background:#10101c;border:1px solid #3a3144;border-radius:6px;padding:7px 8px;margin-bottom:6px;font-size:11px;display:flex;align-items:center;gap:8px">
      <span style="flex:1;color:#dfe6ff">💥 Largest hit to use<br><span style="color:#667;font-size:10px">bigger = fewer attacks & fewer HP potions; it steps down near your target</span></span>
      <select data-act="bighitmax" style="background:#1b1b2e;color:#dfe6ff;border:1px solid #3a3144;border-radius:4px;padding:4px">
        ${[[100,'x100 (100 stam)'],[200,'x200 (200 stam)'],[1000,'x1000 (1000 stam)']].map(([v,l]) => `<option value="${v}" ${bm===v?'selected':''}>${l}</option>`).join('')}
      </select></div>`;
  }
  h += toggleRow('bgmode', S.bgMode !== false,
        '🌙 Keep running in background tab / other app',
        'Unthrottled worker timers + keep-alive (click the page once after opening it)',
        'Browser may slow the bot to ~1 action/min when the tab is hidden');
  h += toggleRow('debuglog', S.debug,
        '🐞 Debug log',
        'Verbose: every wave scan + per-target match line (for troubleshooting)',
        'Clean log — only real actions (attacks, loot, level-ups, potions, waiting)');

  // ── HP auto-heal: fixed at 5% (no slider) ───────────────────────────────────
  h += `
    <div style="background:#10101c;border:1px solid #3a3144;border-radius:6px;padding:8px;margin-bottom:6px">
      <div style="display:flex;align-items:center;gap:8px;font-size:11px">
        <span style="flex:1;color:#dfe6ff">❤️ Auto-heal HP threshold</span>
        <span style="font-weight:bold;color:#f88">5% (fixed)</span>
      </div>
      <div style="font-size:10px;color:#667;margin-top:4px">Drinks an HP potion when your HP drops to 5% or below</div>
    </div>`;

  // ── Mana potions (mana-using classes only — Mage/Hunter/etc., NOT Berserker) ──
  // Checkbox enable (default OFF) + slider for how many mana potions to use.
  const mOn = !!S.manaEnabled, mN = S.manaPots | 0;
  h += `
    <div style="background:#10101c;border:1px solid ${mOn?'#2a3a5a':'#3a3144'};border-radius:6px;padding:8px;margin-bottom:6px">
      <label style="display:flex;align-items:center;gap:8px;font-size:11px;cursor:pointer">
        <input type="checkbox" data-act="manaenable" ${mOn?'checked':''} style="transform:scale(1.2)">
        <span style="flex:1;color:#dfe6ff">🔵 Mana potions <span style="color:#667;font-size:10px">(mana classes: Mage/Hunter — not Berserker)</span></span>
        <span style="color:${mOn?'#6cf':'#777'};font-weight:bold;font-size:11px">${mOn?'ON':'OFF'}</span>
      </label>
      <div style="display:flex;align-items:center;gap:8px;font-size:11px;margin-top:7px;opacity:${mOn?'1':'.45'}">
        <span style="flex:1;color:#dfe6ff">How many to use</span>
        <span id="vfb-mana-val" style="font-weight:bold;color:#6cf">${mN}</span>
      </div>
      <input type="range" min="0" max="4000" step="50" value="${mN}" data-act="manapots" ${mOn?'':'disabled'}
        style="width:100%;margin:7px 0 3px;accent-color:#39f;cursor:pointer;opacity:${mOn?'1':'.45'}">
      <div style="color:#667;font-size:10px">${mOn?`Drinks up to ${mN} mana potion(s) when MP runs low (L item 163, then S 162). Wiring activates with adaptive class detection.`:'OFF — never spends mana potions'}</div>
    </div>`;

  h += sectionTitle('Targets — what to attack');
  h += `
    <div style="display:flex;gap:6px;margin-bottom:6px;position:sticky;top:-8px;
      background:#0d0d18;padding:4px 0;z-index:2">
      <button data-action="scanpage" style="flex:1;background:#2a3a6a;color:#cfe;border:none;
        border-radius:5px;padding:7px;cursor:pointer;font:bold 11px monospace">🔍 Scan this page</button>
      <button data-action="save" title="Save &amp; apply" style="background:#2f8050;color:#fff;border:none;
        border-radius:5px;padding:7px 10px;cursor:pointer;font:bold 11px monospace">💾 Save</button>
      <button data-action="reset" title="Restore defaults" style="background:#3a2a2a;color:#f99;border:none;
        border-radius:5px;padding:7px 9px;cursor:pointer;font:12px monospace">↺</button>
    </div>
    <div style="color:#667;font-size:10px;margin-bottom:8px;line-height:1.5">
      You're on: <span style="color:#9cf">${esc(pageLabel(curUrl))}</span><br>
      Open a wave / boss / guild-dungeon page → <b style="color:#9cf">Scan this page</b> → the
      monsters appear under <b style="color:#9cf">Scan results</b>; tick one to add it to
      <b style="color:#7f8">Set targets</b> above, set its damage &amp; type. ✕ removes it.
    </div>`;

  // transient scan confirmation banner (set by flashScan after a 🔍 Scan)
  if (_scanFlash && Date.now() - _scanFlash.ts < 3400) {
    h += `<div style="background:${_scanFlash.ok ? '#143226' : '#3a2416'};
      color:${_scanFlash.ok ? '#7ff0a8' : '#ffb877'};border-radius:6px;
      padding:7px 9px;margin-bottom:8px;font-size:11px;font-weight:bold">${esc(_scanFlash.msg)}</div>`;
  }

  // ── Editable row for one target/monster. Works both for a CONFIGURED target (on →
  // shows the dmg + mode + kill controls) and a freshly-SCANNED, not-yet-added mob
  // (off → just the add checkbox + name). srcLabel shows the page when a group spans
  // more than one page. wi is the S.config index; name/handlers are unchanged.
  const targetRow = (wi, w, name, boss, count, srcLabel) => {
    const t   = targetFor(w, name);
    const on  = !!t;
    const grp = `mode_${wi}_${String(name).replace(/\W+/g, '_')}`;
    let s = `<div style="border:1px solid ${on?'#2f5040':'#23253f'};border-radius:6px;padding:5px 6px;margin-bottom:5px;background:#0e0e18">
      <div style="display:flex;align-items:center;gap:6px">
        <input type="checkbox" data-act="row" data-wi="${wi}" data-name="${esc(name)}" ${on?'checked':''}>
        <span style="flex:1;color:${boss?'#fab':'#7df'};font-size:12px">${(t&&t.duel)?'🤺 ':boss?'👑 ':''}${esc(name)}${count!=null?` <span style="color:#556">×${count}</span>`:''}${srcLabel?`<br><span style="color:#556;font-size:9px">📄 ${esc(srcLabel)}</span>`:''}</span>
        ${on?`<button data-action="deltarget" data-wi="${wi}" data-name="${esc(name)}" title="remove target" style="background:#3a2a2a;color:#f88;border:none;border-radius:4px;padding:1px 7px;cursor:pointer;font:12px monospace">✕</button>`:''}
      </div>`;
    if (on) {
      const mode = t.dungeonBoss ? 'dungeonboss' : (t.timer ? 'timed' : 'farm');
      const farm = mode === 'farm';
      const dgb  = mode === 'dungeonboss';
      s += `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px;padding-left:0" class="vfb-trow">
        <span style="color:#9cf;font-size:10px">${dgb ? 'max dmg' : t.duel ? 'P1 stop at' : 'stop at'}</span>
        <input style="${IN};width:118px" data-fld="dmg" data-wi="${wi}" data-name="${esc(name)}" value="${esc(fullDmg(t.dmgTarget))}" title="${dgb ? 'GUILD CAP — the bot stops STRICTLY under this much damage (never crosses it)' : t.duel ? 'Phase 1 damage target (leaderboard). The bot attacks phase 1 up to here, then plays the Duel Phase.' : "stop attacking once you've dealt this much damage"}">
        ${t.duel ? `<span style="color:#c9a0ff;font-size:10px" title="Phase 3 damage target (combined total damage to this boss = the XP cap number shown on the card). After winning the duel the bot attacks phase 3 up to here.">P3 stop at</span>
        <input style="${IN};width:118px" data-fld="phase3" data-wi="${wi}" data-name="${esc(name)}" value="${esc(fullDmg(t.phase3Dmg || t.dmgTarget))}" title="Phase 3 target — set this to the boss's XP cap (the big number on the card), e.g. 54,000,000,000">` : ''}
        <label class="vfb-seg" style="color:#fab" title="Timed boss: fight to the damage target, then move on (may use potions)">
          <input type="radio" name="${grp}" data-act="mode" data-wi="${wi}" data-name="${esc(name)}" value="timed" ${mode==='timed'?'checked':''}> ⏰ Timed
        </label>
        <label class="vfb-seg" style="color:#c9a0ff" title="Dungeon boss: auto-detects the room opening (polls ~3s, AFK), drinks a potion the instant the boss appears, and stops STRICTLY UNDER the damage cap above — never overshoots the guild limit">
          <input type="radio" name="${grp}" data-act="mode" data-wi="${wi}" data-name="${esc(name)}" value="dungeonboss" ${dgb?'checked':''}> 🏰 Dungeon Boss
        </label>
        <label class="vfb-seg" style="color:#7df" title="Farm: kill regular monsters (no potions)">
          <input type="radio" name="${grp}" data-act="mode" data-wi="${wi}" data-name="${esc(name)}" value="farm" ${farm?'checked':''}> 🎯 Farm</label>`;
      if (farm) s += `<input style="${IN};width:46px" data-fld="killLimit" data-wi="${wi}" data-name="${esc(name)}" value="${esc(t.killLimit ?? 400)}" title="how many monsters to kill"><span style="color:#556;font-size:10px">kills</span>`;
      if (dgb)  s += `<div style="flex-basis:100%;color:#8a7fb8;font-size:9px;margin-top:2px;line-height:1.4">🏰 attacks on its own the instant the room opens (~3s, AFK) and stops <b>below</b> ${esc(fmtDmg(t.dmgTarget))} — never over the guild limit</div>`;
      if (t.duel) s += `<div style="flex-basis:100%;color:#c9a0ff;font-size:9px;margin-top:2px;line-height:1.4">🤺 <b>Duel boss</b> (auto-detected): farms phase 1 → <b>plays the solo PvP duel for you</b> → farms phase 3. Winning the duel depends on this account's gear; on a loss it retries in 10&nbsp;min.</div>`;
      // "match name ⊇" — only attack monsters whose name CONTAINS one of these words.
      // For a multi-phase boss (Hermes: phase1 "Divine Herald", phase2 "Fleet Duelist",
      // phase3 "Ascended Herald") type the phase-only word — e.g. "ascended" — so the bot
      // engages ONLY that phase's card. Comma-separated; empty = match the scanned name.
      s += `<div style="flex-basis:100%;display:flex;align-items:center;gap:5px;margin-top:4px">
        <span style="color:#9cf;font-size:10px;white-space:nowrap" title="Attack only monsters whose name contains one of these words (comma-separated). Use a phase-only word like 'ascended' to hit just Hermes phase 3.">match name ⊇</span>
        <input style="${IN};flex:1;min-width:90px" data-fld="match" data-wi="${wi}" data-name="${esc(name)}" value="${esc((t.include||[]).join(', '))}" placeholder="(any name — careful!)" title="e.g. 'ascended' = only Hermes phase 3. Empty matches EVERY monster on the page.">
        ${(t.exclude&&t.exclude.length)?`<span style="color:#a88;font-size:9px;white-space:nowrap" title="never these">≠ ${esc(t.exclude.join(', '))}</span>`:''}
      </div>`;
      s += `</div>`;
    }
    s += `</div>`;
    return s;
  };

  // guild-dungeon (dgmid) source: a single boss with just a damage field
  const dungeonRow = (wi, w, srcLabel) => {
    const t = (w.targets || [])[0];
    return `<div style="border:1px solid #2f5040;border-radius:6px;padding:5px 6px;margin-bottom:5px;background:#0e0e18">
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <span style="flex:1;color:#c9a0ff;font-size:12px">🏰 ${esc((t&&t.label)||w.label)} <span style="color:#556;font-size:9px">dgmid ${esc(w.dgmid)}</span></span>
        <span style="color:#9cf;font-size:10px">stop at</span>
        <input style="${IN};width:118px" data-fld="dmg" data-wi="${wi}" data-name="${esc((t&&(t.srcName||t.label))||'')}" value="${esc(fullDmg(t?t.dmgTarget:0))}">
        <button data-action="delwave" data-wi="${wi}" title="delete" style="background:#3a2a2a;color:#f88;border:none;border-radius:4px;padding:2px 6px;cursor:pointer;font:11px monospace">🗑</button>
      </div>
      ${srcLabel?`<div style="color:#556;font-size:9px;margin-top:3px">📄 ${esc(srcLabel)}</div>`:''}</div>`;
  };

  // single boss (battle.php?id) source: one mob, an EXACT damage target, delete when done
  const singleRow = (wi, w, srcLabel) => {
    const t = (w.targets || [])[0];
    return `<div style="border:1px solid #4a3a2a;border-radius:6px;padding:5px 6px;margin-bottom:5px;background:#0e0e18">
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <span style="flex:1;color:#f0b060;font-size:12px">🎯 ${esc((t&&t.label)||w.label)} <span style="color:#556;font-size:9px">id ${esc(w.monster_id)}</span></span>
        <span style="color:#9cf;font-size:10px">do exactly</span>
        <input style="${IN};width:118px" data-fld="dmg" data-wi="${wi}" data-name="${esc((t&&(t.srcName||t.label))||'')}" value="${esc(fullDmg(t?t.dmgTarget:0))}" title="attack until YOUR total damage on this boss reaches this — near-exact (overshoot ≤ one 1-stamina hit)">
        <button data-action="delwave" data-wi="${wi}" title="delete this boss target" style="background:#3a2a2a;color:#f88;border:none;border-radius:4px;padding:2px 6px;cursor:pointer;font:11px monospace">🗑</button>
      </div>
      <div style="color:#8a7a5a;font-size:9px;margin-top:3px;line-height:1.4">attacks this exact mob up to the damage above (potions on), then stops. 🗑 to remove when you're done.</div>
      ${srcLabel?`<div style="color:#556;font-size:9px;margin-top:2px">📄 ${esc(srcLabel)}</div>`:''}</div>`;
  };

  // ── SET TARGETS — every configured target, grouped by type ──────────────────────
  const groups = { timed: [], single: [], dungeonboss: [], farm: [] };
  S.config.forEach((w, wi) => {
    if (w.kind === 'single')  { groups.single.push({ single: true, wi, w }); return; }
    if (w.kind === 'dungeon') { groups.dungeonboss.push({ dungeon: true, wi, w }); return; }
    for (const t of (w.targets || [])) {
      const mode = t.dungeonBoss ? 'dungeonboss' : (t.timer ? 'timed' : 'farm');
      groups[mode].push({ wi, w, name: t.srcName || t.label, boss: !!t.timer });
    }
  });
  const totalSet = groups.timed.length + groups.single.length + groups.dungeonboss.length + groups.farm.length;

  h += `<div style="color:#9cf;font-size:11px;font-weight:bold;margin:6px 0 5px">📋 Set targets <span style="color:#556;font-weight:normal">· ${totalSet}</span></div>`;
  if (!totalSet) {
    h += `<div style="color:#556;font-size:11px;padding:2px 2px 6px">Nothing set yet — scan a page below and tick a monster to add it here.</div>`;
  } else {
    const groupBlock = (key, icon, title, col) => {
      const arr = groups[key];
      if (!arr.length) return '';
      const multiPage = new Set(arr.map(e => e.wi)).size > 1;
      let s = `<div style="color:${col};font-size:11px;font-weight:bold;margin:8px 0 4px">${icon} ${title} <span style="color:#556;font-weight:normal">· ${arr.length}</span></div>`;
      for (const e of arr) {
        const lbl = multiPage ? (e.w.label || pageLabel(srcUrl(e.w))) : '';
        s += e.single  ? singleRow(e.wi, e.w, lbl)
           : e.dungeon ? dungeonRow(e.wi, e.w, lbl)
                       : targetRow(e.wi, e.w, e.name, e.boss, null, lbl);
      }
      return s;
    };
    h += groupBlock('timed',       '⏰', 'Timed bosses',   '#fab');
    h += groupBlock('single',      '🎯', 'Boss (exact dmg)', '#f0b060');
    h += groupBlock('dungeonboss', '🏰', 'Dungeon bosses', '#c9a0ff');
    h += groupBlock('farm',        '🎯', 'Farm',           '#7df');
  }

  // ── SCAN RESULTS — monsters found on the CURRENT page that aren't set yet ────────
  const curSrc = S.config.find(w => w.kind !== 'dungeon' && w.kind !== 'single' && srcUrl(w) === curUrl);
  const curWi  = curSrc ? S.config.indexOf(curSrc) : -1;
  const scanList = curSrc ? (_scan[curSrc.id] || []) : [];
  const toAdd = curSrc ? scanList.filter(r => !targetFor(curSrc, r.name)) : [];

  h += `<div style="border-top:1px solid #2a2a44;margin:10px 0 6px"></div>`;
  h += `<div style="color:#9cf;font-size:11px;font-weight:bold;margin:4px 0 5px">🔍 Scan results <span style="color:#556;font-weight:normal">· ${esc(pageLabel(curUrl))}</span></div>`;
  if (!curSrc || !scanList.length) {
    h += `<div style="color:#556;font-size:11px;padding:2px">Press <b style="color:#9cf">🔍 Scan this page</b> to list this page's monsters here.</div>`;
  } else if (!toAdd.length) {
    h += `<div style="color:#556;font-size:11px;padding:2px">✓ every monster found here is already set above.</div>`;
  } else {
    for (const r of toAdd) h += targetRow(curWi, curSrc, r.name, r.boss, r.count, '');
  }

  // ── PAGES — enable / rename / delete each scanned source ─────────────────────────
  if (S.config.length) {
    h += `<div style="border-top:1px solid #2a2a44;margin:10px 0 6px"></div>`;
    h += `<div style="color:#9cf;font-size:11px;font-weight:bold;margin:4px 0 5px">📄 Pages <span style="color:#556;font-weight:normal">· ${S.config.length}</span></div>`;
    S.config.forEach((w, wi) => {
      const url = srcUrl(w), isCurrent = url === curUrl;
      const nt  = (w.targets || []).length;
      h += `<div style="display:flex;align-items:center;gap:5px;margin-bottom:4px;background:#10101c;border:1px solid ${isCurrent?'#2f8050':'#23253f'};border-radius:6px;padding:5px 6px">
        <input type="checkbox" data-act="wave-enable" data-wi="${wi}" ${w.enabled!==false?'checked':''} title="page on/off">
        <input style="${IN};flex:1" data-fld="label" data-wi="${wi}" value="${esc(w.label || pageLabel(url))}">
        <span style="color:${isCurrent?'#2f8':'#556'};font-size:9px;white-space:nowrap">${isCurrent?'● here · ':''}${nt}t</span>
        <button data-action="delwave" data-wi="${wi}" title="delete page" style="background:#3a2a2a;color:#f88;border:none;border-radius:4px;padding:2px 6px;cursor:pointer;font:11px monospace">🗑</button>
      </div>`;
    });
  }

  uiContent.innerHTML = h;
  wireSettings();
}

// Apply edits LIVE: debounced save + rebuild so a changed damage/kill target takes
// effect immediately (the runtime WAVES are rebuilt) WITHOUT having to reach the 💾
// Save button — which on a phone is often scrolled off-screen, so edits silently never
// applied ("continua a fare 50m nonostante abbia risettato i danni"). 💾 still works.
let _applyTimer = null;
function scheduleApply() {
  clearTimeout(_applyTimer);
  _applyTimer = setTimeout(() => { save(); rebuildWaves(); log('⚙ changes applied', '#778'); }, 700);
}

// Delegated handlers (assigned, not added, so no listener buildup per render).
function wireSettings() {
  const wave = wi => S.config[+wi];

  uiContent.oninput = e => {
    const el = e.target;
    // ❤️ HP auto-heal slider — update live (no full re-render, so the drag isn't lost)
    if (el.dataset.act === 'hphealpct') {
      const v = Math.max(0, Math.min(90, parseInt(el.value) || 0));
      S.hpHealPct = v; save();
      const off = v <= 0;
      const vEl = document.getElementById('vfb-hp-val');
      const dEl = document.getElementById('vfb-hp-desc');
      if (vEl) { vEl.textContent = off ? 'OFF' : v + '%'; vEl.style.color = off ? '#777' : '#f88'; }
      if (dEl) dEl.textContent = off
        ? 'OFF — never auto-heal; waits for natural HP regen (no potions spent)'
        : `Drinks an HP potion when your HP drops to ${v}% or below`;
      return;
    }
    // 🔵 mana potions count slider — update live
    if (el.dataset.act === 'manapots') {
      S.manaPots = Math.max(0, Math.min(4000, parseInt(el.value) || 0)); save();
      const vEl = document.getElementById('vfb-mana-val');
      if (vEl) vEl.textContent = S.manaPots;
      return;
    }
    const f = el.dataset.fld; if (!f) return;
    const w = wave(el.dataset.wi); if (!w) return;
    if (f === 'label') { w.label = el.value; scheduleApply(); return; }
    const t = targetFor(w, el.dataset.name); if (!t) return;
    if (f === 'dmg') {
      const n = parseAmount(el.value);
      if (n != null) { t.dmgTarget = n; el.value = fullDmg(n); }
    } else if (f === 'phase3') {
      const n = parseAmount(el.value);
      if (n != null) { t.phase3Dmg = n; el.value = fullDmg(n); }
    } else if (f === 'killLimit') {
      const raw = el.value.replace(/[^\d]/g, '');
      t.killLimit = raw === '' ? 1 : Math.max(1, parseInt(raw));
    } else if (f === 'match') {
      // edit the include tokens (name-contains filter). Comma-separated, lowercased.
      // e.g. "ascended" → attack only Hermes phase 3; empty → match every monster.
      t.include = el.value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    }
    scheduleApply();
  };

  uiContent.onchange = e => {
    const el = e.target, a = el.dataset.act; if (!a) return;
    if (a === 'lspenable')  { S.lspEnabled  = el.checked; save(); renderSettings(); return; }
    if (a === 'fspfallback'){ S.fspFallback = el.checked; save(); renderSettings(); return; }
    if (a === 'fsponly')    { S.fspOnly     = el.checked; save(); renderSettings(); log(`💧 FSP-only mode ${el.checked ? 'ON — only Full Stamina Potions will be drunk' : 'OFF'}`, '#9cf'); return; }
    if (a === 'bighitmax')  { S.bigHitMax   = parseInt(el.value) || 100; save(); renderSettings(); return; }
    if (a === 'questenable'){ S.questEnabled= el.checked; save(); renderSettings(); return; }
    if (a === 'debuglog')   { S.debug       = el.checked; save(); renderSettings(); return; }
    if (a === 'exactdmg')   { S.exactDmg    = el.checked; save(); renderSettings(); return; }
    if (a === 'bgmode')     { S.bgMode      = el.checked; save(); renderSettings(); if (S.bgMode) log('🌙 background mode ON — click anywhere on the page once to arm keep-alive', '#9cf'); return; }
    if (a === 'manaenable') { S.manaEnabled = el.checked; save(); renderSettings(); return; }
    // ⚔ PvP: classe scelta a mano + allow-list skill
    if (a === 'pvpclass')   { S.pvp.myClass = el.value; save(); el.blur(); renderUI(); log(`⚔ PvP: my class = ${el.value || 'auto'}`, '#ff5c8a'); return; }
    if (a === 'pvprestrict'){ S.pvp.restrictSkills = el.checked; save(); el.blur(); renderUI(); log(`⚔ PvP: skill allow-list ${el.checked ? 'ON' : 'OFF'}`, '#ff5c8a'); return; }
    if (a === 'pvpskill')   {
      const nm = el.dataset.skill || '';
      const set = new Set((S.pvp.allowSkills || []).map(x => String(x).toLowerCase()));
      if (el.checked) set.add(nm.toLowerCase()); else set.delete(nm.toLowerCase());
      // ricostruisci con i nomi originali (case corretto) dal kit
      const kit = [...new Set([...(PVP_KITS[S.pvp.myClass] || []), ...(S.pvp.myKit || [])])];
      S.pvp.allowSkills = kit.filter(k => set.has(k.toLowerCase()));
      save(); renderUI(); return;
    }
    const w = wave(el.dataset.wi); if (!w) return;
    const nm = el.dataset.name;
    if (a === 'wave-enable') {
      w.enabled = el.checked;
      scheduleApply();
    } else if (a === 'row') {
      if (el.checked) {
        if (!targetFor(w, nm)) {
          const boss = (_scan[w.id] || []).find(r => r.name === nm)?.boss;
          (w.targets = w.targets || []).push(mkTarget(nm, !!boss));
        }
      } else {
        const t = targetFor(w, nm);
        if (t) w.targets.splice(w.targets.indexOf(t), 1);
      }
      scheduleApply(); renderSettings();
    } else if (a === 'mode') {
      const t = targetFor(w, nm); if (!t) return;
      if (el.value === 'timed')             { t.timer = true;  t.dungeonBoss = false; t.killLimit = null;             t.useLSP = 'asNeeded'; }
      else if (el.value === 'dungeonboss')  { t.timer = false; t.dungeonBoss = true;  t.killLimit = null;             t.useLSP = 'asNeeded'; }
      else                                  { t.timer = false; t.dungeonBoss = false; t.killLimit = t.killLimit || 400; t.useLSP = 'asNeeded'; }
      const _keep = uiContent.scrollTop;
      try { el.blur(); } catch {}
      scheduleApply(); renderSettings();
      uiContent.scrollTop = _keep;
      uiPanel.scrollTop = 0; uiPanel.scrollLeft = 0;
    }
  };

  uiContent.onclick = async e => {
    const b = e.target.closest('[data-action]'); if (!b) return;
    const a = b.dataset.action, wi = +b.dataset.wi, nm = b.dataset.name;
    if (a === 'save') {
      save(); rebuildWaves();
      b.textContent = '✓ Saved'; setTimeout(() => { b.textContent = '💾 Save'; }, 1200);
      log('⚙ config saved & applied', '#9060ff');
    } else if (a === 'reset') {
      S.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
      for (const w of S.config) { if (!w.url) w.url = srcUrl(w); if (!w.label) w.label = pageLabel(w.url); }
      for (const k of Object.keys(_scan)) delete _scan[k];
      save(); rebuildWaves(); renderSettings();
      log('⚙ config reset to defaults', '#9060ff');
    } else if (a === 'scanpage') {
      await scanCurrentPage(b);
    } else if (a === 'delwave') {
      const w = S.config[wi];
      if (w) delete _scan[w.id];
      S.config.splice(wi, 1);
      scheduleApply(); renderSettings();
    } else if (a === 'deltarget') {
      const w = S.config[wi], t = w && targetFor(w, nm);
      if (t) w.targets.splice(w.targets.indexOf(t), 1);
      scheduleApply(); renderSettings();
    }
  };
}

function renderUI() {
  if (!uiContent || minimized) return;
  if (activeTab === 'settings') return;   // Settings owns its DOM (live inputs) — don't clobber
  // MOBILE FIX: never rebuild innerHTML while the user is interacting with a control in the
  // panel. On phones a <select> opens a native picker that keeps FOCUS on the element; the
  // farm/PvP loops call renderUI()/pvpTabRefresh() every pass, and clobbering innerHTML mid-pick
  // destroyed the open <select> → the choice was discarded and reverted to the saved value
  // ("il dropdown classe PvP non salva, resta fisso su Archer"). Skip the rebuild until focus
  // leaves. Desktop was too fast to notice.
  const ae = document.activeElement;
  if (ae && uiContent.contains(ae) && /^(SELECT|INPUT|TEXTAREA)$/.test(ae.tagName)) return;
  if (activeTab === 'guide' && uiContent.dataset.view === 'guide') return;   // static page — don't rebuild (keeps scroll + open sections)
  uiContent.dataset.view = activeTab;
  uiContent.innerHTML = activeTab === 'timers' ? renderTimers()
                      : activeTab === 'pvp' ? renderPvp()
                      : activeTab === 'log' ? renderLog()
                      : activeTab === 'guide' ? renderGuide()
                      : renderStatus();
}

// ── 📖 GUIDE TAB — plain-language explainer so first-timers get the bot ──────────
function renderGuide() {
  const sec = (icon, title, body, open) => `
    <details class="vfb-gd"${open ? ' open' : ''}>
      <summary><span class="vfb-gi">${icon}</span><span>${title}</span></summary>
      <div class="vfb-gb">${body}</div>
    </details>`;
  const step = (n, t) => `<div class="vfb-st"><b>${n}</b><span>${t}</span></div>`;
  const tip  = t => `<div class="vfb-tip">💡 ${t}</div>`;
  const warn = t => `<div class="vfb-tip vfb-warn">⚠️ ${t}</div>`;
  return `
    <div class="vfb-ghero">
      <div style="font-size:15px;font-weight:800;color:#fff">📖 Beginner's guide</div>
      <div style="font-size:11.5px;color:#b9c4ee;margin-top:3px">New here? Read <b>Quick start</b> first — it takes one minute. Tap any section to open or close it.</div>
    </div>

    ${sec('🚀', 'Quick start (5 steps)', `
      ${step(1, 'Open a <b>wave</b>, <b>boss</b> or <b>guild dungeon</b> page on the game site (the page with the monsters).')}
      ${step(2, 'Tap <b>⚙ Setup</b> at the bottom, then <b>🔍 Scan this page</b>. The monsters on the page show up under <i>Scan results</i>.')}
      ${step(3, 'Tick the monster you want. It moves to <b>Set targets</b>.')}
      ${step(4, 'Choose its <b>mode</b> (⏰ Timed, 🏰 Dungeon Boss or 🎯 Farm) and type a <b>stop at</b> damage. See "The 3 modes" below.')}
      ${step(5, 'Tap <b>💾 Save</b>, then press <b>▶</b> at the top. The bot now plays by itself.')}
      ${tip('The bot starts <b>paused</b>. Until you press ▶ it does nothing at all.')}
    `, true)}

    ${sec('🧭', 'What each tab does', `
      <b>📊 Status</b> — what the bot is doing right now, stamina, potions, level per hour, kills.<br>
      <b>📋 Log</b> — a live diary of every action (attacks, loot, potions, errors). Check it when something looks wrong.<br>
      <b>⚙️ Setup</b> — where you pick targets and options. Always press 💾 Save after changing targets.<br>
      <b>⚔️ PvP</b> — optional auto-PvP ladder module.<br>
      <b>⏱️ Timers</b> — respawn countdowns for timed bosses.<br>
      <b>📖 Guide</b> — this page.
    `)}

    ${sec('🎯', 'The 3 modes (very important)', `
      <b style="color:#fab">⏰ Timed</b> — a boss that respawns on a timer. The bot hits it up to your <i>stop at</i> damage, then moves on. It <b>always</b> uses stamina potions so you never miss the spawn window.<br><br>
      <b style="color:#c9a0ff">🏰 Dungeon Boss</b> — a guild-dungeon boss with a damage cap. The bot waits until the room opens, attacks, and <b>stops just under</b> your number — it never goes over.<br><br>
      <b style="color:#7df">🎯 Farm</b> — normal monsters. Set how many <b>kills</b> you want (default 400) and the bot grinds them for loot and EXP.
      ${tip('Not sure? Use <b>Farm</b> for regular monsters and <b>Timed</b> for world bosses.')}
    `)}

    ${sec('✍️', 'The boxes under a target', `
      <b>stop at / max dmg</b> — total damage the bot should deal to that monster. Type the full number, e.g. <i>100,000,000</i> or <i>2000000000</i>.<br>
      <b>kills</b> (Farm only) — how many monsters to kill before stopping.<br>
      <b>match name ⊇</b> — the bot only attacks monsters whose name <b>contains</b> these words. Leave the scanned name as it is. Wrong or empty = it may hit the wrong monster.<br>
      <b>✕</b> — removes the target.
    `)}

    ${sec('🛡️', 'Overdamage & Dungeon Boss', `
      In <b>🏰 Dungeon Boss</b> mode the bot checks every hit: if even its smallest hit could push you past your number, it <b>stops right there</b>.<br>
      ${warn('Guild bosses only drop loot when you pass the real threshold. If you get no drops, raise your number a little above the guild\'s limit.')}
    `)}

    ${sec('🧪', 'Potions explained', `
      <b>LSP</b> = Large Stamina Potion (+5000 stamina). Used by default when stamina runs out.<br>
      <b>FSP</b> = Full Stamina Potion (full refill). Never touched unless you switch it on in Setup.<br>
      <b>HP potion</b> — the bot drinks one only when your HP is <b>5% or lower</b> (fixed). If you die, it revives you.<br>
      <b>Mana potions</b> — only for mana classes (Mage, Hunter). Berserkers can leave it OFF.<br>
      ${tip('Turn <b>Stamina potions while farming</b> OFF if you want to keep your potions and only use natural regen.')}
    `)}

    ${sec('⚙️', 'Setup switches in plain words', `
      <b>Stamina potions while farming</b> — ON: farming also drinks potions. OFF: only timed bosses drink.<br>
      <b>Use FSP when LSP runs out</b> — backup potion. OFF keeps your FSP safe.<br>
      <b>Auto Adventurer's Guild quests</b> — takes quests, farms the monster, turns them in.<br>
      <b>Exact damage on every target</b> — ON: hits of up to 100 stamina, very precise. OFF: <b>🧠 smart big hits</b> — it starts with your chosen biggest hit (up to x1000), then steps down as it nears your number so it still stops on target. Fewer hits also means fewer HP potions.<br>
      <b>Keep running in background</b> — keeps the bot alive when you switch apps. Tap the page once after opening it.<br>
      <b>Debug log</b> — shows extra detail. Leave OFF unless you are troubleshooting.
    `)}

    ${sec('🤺', 'Olympus duel bosses', `
      Gods like Ares, Hermes, Artemis and Poseidon have <b>3 phases</b>: fight → <b>PvP duel</b> → fight.<br>
      The bot plays the duel for you. Winning depends on your gear; after a loss it retries in 10 minutes.<br>
      You set two numbers: <b>P1</b> (phase 1) and <b>P3</b> (phase 3 — use the big XP-cap number on the boss card).
    `)}

    ${sec('📱', 'Using the panel on your phone', `
      <b>Move it</b> — drag the little bar at the very top of the panel, or the title row.<br>
      <b>Minimize</b> — tap <b>—</b>. A small <b>OVERLORD</b> pill remains: tap it to reopen, tap its ▶/⏸ to start or pause, drag it anywhere.<br>
      <b>Pause</b> — ⏸ stops the bot completely so you can play by hand. ▶ resumes.<br>
      <b>🗑</b> — resets the top counters only. Your targets and settings are kept.
    `)}

    ${sec('✅', 'Good habits for beginners', `
      • Start with <b>one</b> target and watch the 📋 Log for a minute.<br>
      • Keep the game tab open. Don't run the bot in two tabs at once.<br>
      • Save after every change in Setup.<br>
      • Use <b>⏸</b> before you fight something by hand, so you and the bot don't collide.<br>
      • Check your potion count on the Status tab now and then.
    `)}

    ${sec('❓', 'Something is wrong?', `
      <b>Nothing happens</b> → Is it paused (▶)? Did you Scan, tick a monster and 💾 Save?<br>
      <b>A boss isn't attacked</b> → Check the <i>stop at</i> number and the <i>match name</i> box.<br>
      <b>"Out of stamina"</b> in the Log → turn on potions in Setup, or wait for regen.<br>
      <b>"Slow down" / rate-limited</b> → normal. The bot slows itself and keeps going.<br>
      <b>Panel off-screen</b> → minimize with <b>—</b> and reopen from the pill.<br>
      ${tip('Still stuck? Open the 📋 Log and read the last red or orange line — it usually says exactly what is wrong.')}
    `)}

    <div style="text-align:center;color:#6b78a8;font-size:10.5px;margin:10px 0 2px">Overlord Farmer · made by Overlord</div>
  `;
}

// Reset ONLY the top counters (uptime, boss kills, heals, potions used, attacks,
// quest tallies). The per-mob farm progress — S.kills and the 🎯 Farming bars — is
// deliberately kept (user: "le statistiche superiori, non quelle dei mob farmati").
function resetStats() {
  S.started   = Date.now();
  S.timedKills = 0; S.timedBy = {};
  S.hpHeals    = 0; S.lspUses = 0; S.attacks = 0;
  S.questTaken = 0; S.questDone = 0;
  S.lvlBaseFrac = null; S.lvlBaseTs = null;   // re-baseline the lvl/hour average
  save();
  noteLevelProgress();   // immediately re-seed from the current reading if we have one
  log('🗑 top stats reset (farmed monsters kept)', '#9cf');
  renderUI();
}

// Reset ONLY the per-mob farm progress: the S.kills counters AND the farmSeen list
// that drives the 🎯 Farming tab. Separate from resetStats (top counters) so the user
// can wipe the farmed-monster tallies independently (user: "reset anche per i mostri
// farmati, icona cestino"). Single click, like the top 🗑.
function resetFarm() {
  S.kills = {};
  S.farmSeen = {};
  save();
  log('🗑 farmed monsters reset', '#9cf');
  renderUI();
}

// ── BUILD PANEL ───────────────────────────────────────────────────────────────
function vfbLogo(size, u) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64"><defs><linearGradient id="g${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#00e5ff"/><stop offset="1" stop-color="#ff2e63"/></linearGradient><radialGradient id="f${u}" cx="50%" cy="50%" r="65%"><stop offset="0" stop-color="#0d4a6a"/><stop offset="1" stop-color="#070b14"/></radialGradient><linearGradient id="b${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#b9a7d6"/></linearGradient></defs><polygon points="32,2 58,17 58,47 32,62 6,47 6,17" fill="url(#f${u})" stroke="url(#g${u})" stroke-width="3" stroke-linejoin="round"/><g stroke-linecap="round"><path d="M16 12 46 50M48 12 18 50" stroke="url(#b${u})" stroke-width="4"/><path d="M34.3 46.7 43.7 39.3M29.7 46.7 20.3 39.3" stroke="#ffc857" stroke-width="3"/></g><path d="M18 31Q32 16 46 31 32 46 18 31Z" fill="#070b14" stroke="url(#g${u})" stroke-width="2.5" stroke-linejoin="round"/><circle cx="32" cy="31" r="5.5" fill="#ffc857"/><ellipse cx="32" cy="31" rx="1.7" ry="5" fill="#070b14"/></svg>`;
}
function buildUI() {
  if (!document.getElementById('vfb-theme')) {
    const th = document.createElement('style'); th.id = 'vfb-theme';
    th.textContent = `
:root { --vb-bg0:#070915; --vb-bg1:#0d1230; --vb-card:rgba(12,16,42,.88); --vb-line:rgba(139,110,255,.45); --vb-lav:#c4a8ff; --vb-pink:#ff7ab6; --vb-blue:#3b82f6; --vb-vio:#7c4dff;
  --vb-text:#eaf0ff; --vb-mute:#8f9bc4; --sh-bg3:#0f1436; --sh-mute:#8f9bc4; --sh-line:rgba(139,110,255,.45); }
#vfb-panel { width:min(560px,calc(100vw - 16px)) !important; font-family:'Segoe UI',system-ui,-apple-system,Roboto,sans-serif !important; color:var(--vb-text) !important;
  background:radial-gradient(120% 90% at 0% 0%,rgba(124,77,255,.38),transparent 55%),linear-gradient(150deg,#150f38 0%,#0b0f2c 50%,#070915 100%) !important;
  border:1px solid var(--vb-line) !important; border-radius:22px !important;
  box-shadow:0 24px 70px rgba(0,0,0,.85),0 0 46px rgba(124,77,255,.28),inset 0 1px 0 rgba(255,255,255,.07) !important; overflow:hidden; overflow:clip; }
@keyframes vfbIn { from { opacity:0; transform:translateY(10px) scale(.98); } to { opacity:1; transform:none; } }
@keyframes vfbPulse { 50% { opacity:.5; transform:scale(.88); } }
@keyframes vfbShine { to { background-position:200% 0; } }
.vfb-grip { position:relative; z-index:2; height:10px; display:flex; align-items:center; justify-content:center; cursor:grab; touch-action:none; user-select:none; -webkit-user-select:none; }
.vfb-grip::before { content:''; width:44px; height:4px; border-radius:99px; background:linear-gradient(90deg,#7c4dff,#3b82f6); opacity:.55; transition:.15s; }
.vfb-grip:hover::before, .vfb-grip:active::before { opacity:1; box-shadow:0 0 12px rgba(124,77,255,.9); }
#vfb-panel .vfb-hdr { display:flex !important; flex-wrap:wrap; align-items:center; gap:8px 8px; padding:6px 14px 10px !important; background:transparent !important; border-radius:0 !important;
  border-bottom:1px solid rgba(255,255,255,.07); touch-action:none; user-select:none; -webkit-user-select:none; cursor:grab; }
.vfb-brand { order:1; flex:1 1 auto; min-width:0; display:flex; align-items:center; gap:12px; }
.vfb-ico { flex:0 0 auto; width:46px; height:46px; border-radius:14px; display:flex; align-items:center; justify-content:center;
  background:linear-gradient(135deg,#7c4dff,#3b82f6); box-shadow:0 6px 20px rgba(124,77,255,.55),inset 0 1px 0 rgba(255,255,255,.35); }
.vfb-ico svg { filter:drop-shadow(0 0 6px rgba(0,0,0,.5)); }
.vfb-title { font-size:17px; font-weight:800; letter-spacing:.3px; color:#fff; line-height:1.15; }
.vfb-sub { font-size:11px; color:var(--vb-mute); margin-top:2px; letter-spacing:.3px; }
.vfb-by { order:2; flex:0 0 auto; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:7px 16px; border-radius:16px;
  background:linear-gradient(135deg,rgba(124,77,255,.75),rgba(59,130,246,.45)); border:1px solid rgba(180,160,255,.55); box-shadow:0 4px 18px rgba(124,77,255,.4); }
.vfb-by b { font-size:15px; font-weight:800; color:#fff; letter-spacing:.3px; line-height:1.1; }
.vfb-by small { font-size:9px; color:#d8ccff; margin-top:2px; white-space:nowrap; }
.vfb-brk { order:3; flex:0 0 100%; height:0; }
#vfb-panel .vfb-tb { font-family:inherit !important; font-weight:700 !important; cursor:pointer; transition:.15s; color:var(--vb-mute) !important;
  background:rgba(255,255,255,.06) !important; border:1px solid rgba(255,255,255,.09) !important; border-radius:10px !important; }
#vfb-panel .vfb-ctl { order:2; width:36px; height:36px; padding:0 !important; font-size:15px !important; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,.09) !important; color:#fff !important; }
#vfb-panel .vfb-tab { order:4; padding:7px 13px !important; font-size:11.5px !important; }
#vfb-panel .vfb-tb:hover { background:rgba(124,77,255,.4) !important; color:#fff !important; transform:translateY(-1px); box-shadow:0 0 14px rgba(124,77,255,.55); }
#vfb-panel .vfb-tb.vfb-on { background:linear-gradient(135deg,#7c4dff,#3b82f6) !important; color:#fff !important; border-color:rgba(255,255,255,.25) !important; box-shadow:0 4px 18px rgba(124,77,255,.5); }
#vfb-panel .vfb-body { padding:12px 14px !important; max-height:min(62vh,600px) !important; }
#vfb-panel input, #vfb-panel select, #vfb-panel textarea { background:rgba(5,8,26,.9) !important; color:var(--vb-text) !important; border:1px solid rgba(255,255,255,.14) !important; border-radius:10px !important; font-family:Consolas,monospace !important; padding:6px 9px; }
#vfb-panel input:focus, #vfb-panel select:focus, #vfb-panel textarea:focus { outline:none; border-color:#8b6eff !important; box-shadow:0 0 12px rgba(124,77,255,.45); }
#vfb-panel input[type="checkbox"] { accent-color:#3b82f6; width:16px; height:16px; padding:0; }
#vfb-panel input[type="range"] { accent-color:#7c4dff; background:transparent !important; border:0 !important; box-shadow:none !important; }
#vfb-panel button:not(.vfb-tb) { border-radius:12px !important; font-family:inherit !important; font-weight:700; transition:transform .12s, filter .12s; }
#vfb-panel button:not(.vfb-tb):hover { filter:brightness(1.2); transform:translateY(-1px); }
#vfb-panel button:not(.vfb-tb):active { transform:scale(.97); }
#vfb-panel a { color:#9db8ff !important; }
#vfb-panel div, #vfb-panel span { font-family:inherit; }
#vfb-panel ::-webkit-scrollbar { width:9px; height:9px; }
#vfb-panel ::-webkit-scrollbar-thumb { background:rgba(139,110,255,.6); border-radius:8px; }
#vfb-panel ::-webkit-scrollbar-track { background:rgba(255,255,255,.04); }
/* ---- status ---- */
.vfb-statusrow { display:flex; align-items:center; gap:9px; margin-bottom:10px; }
.vfb-badge { display:inline-flex; align-items:center; gap:7px; padding:5px 13px; border-radius:999px; font-size:11px; font-weight:800; letter-spacing:1.2px; text-transform:uppercase; white-space:nowrap;
  color:var(--bc); background:var(--bb); border:1px solid color-mix(in srgb, var(--bc) 45%, transparent); box-shadow:0 0 14px color-mix(in srgb, var(--bc) 30%, transparent); }
.vfb-dot { width:9px; height:9px; border-radius:50%; background:var(--bc); box-shadow:0 0 8px var(--bc); animation:vfbPulse 1.6s infinite; }
.vfb-msg { flex:1; min-width:0; font-size:11px; color:#9db8ff; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.vfb-chips { display:grid; grid-template-columns:repeat(4,1fr); gap:9px; margin-bottom:12px; }
.vfb-chip { text-align:center; padding:9px 4px 8px; border-radius:16px; background:var(--vb-card); border:1px solid rgba(255,255,255,.08); border-top:2px solid var(--cc); overflow:hidden; }
.vfb-chip i { font-style:normal; font-size:15px; display:block; line-height:1.25; }
.vfb-chip b { display:block; font-family:Consolas,monospace; font-size:14px; font-weight:800; color:#fff; text-shadow:0 0 12px var(--cc); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.vfb-chip small { display:block; font-size:9px; letter-spacing:1px; text-transform:uppercase; color:var(--vb-mute); margin-top:1px; }
.vfb-card { margin-bottom:10px; padding:11px 13px; border-radius:16px; background:var(--vb-card); border:1px solid rgba(255,255,255,.08); border-left:3px solid var(--ac,#7c4dff);
  box-shadow:0 4px 18px rgba(0,0,0,.4); transition:transform .15s, box-shadow .15s; }
.vfb-card:hover { transform:translateY(-1px); box-shadow:0 8px 24px rgba(0,0,0,.5),0 0 18px color-mix(in srgb, var(--ac,#7c4dff) 28%, transparent); }
.vfb-card-h { display:flex; align-items:center; gap:8px; margin-bottom:8px; padding-bottom:7px; border-bottom:1px solid rgba(255,255,255,.07); }
.vfb-card-t { flex:1; font-size:11.5px; font-weight:800; letter-spacing:1.3px; text-transform:uppercase; color:var(--vb-lav); }
.vfb-card-b { font-size:10px; color:var(--vb-mute); background:rgba(255,255,255,.07); border-radius:999px; padding:2px 10px; }
.vfb-prog { display:inline-block; vertical-align:middle; width:86px; height:8px; border-radius:99px; background:rgba(255,255,255,.09); overflow:hidden; margin-left:6px; }
.vfb-prog > i { display:block; height:100%; border-radius:99px; background:linear-gradient(90deg,#7c4dff,#3b82f6,#22d3ee); box-shadow:0 0 8px rgba(59,130,246,.7); transition:width .4s; }
.vfb-row { display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:11px; padding:4px 0; border-bottom:1px solid rgba(255,255,255,.055); }
.vfb-row:last-child { border-bottom:0; }
.vfb-pill { font-size:10px; font-weight:800; letter-spacing:.5px; padding:2px 10px; border-radius:999px; white-space:nowrap; color:var(--pc); background:color-mix(in srgb, var(--pc) 15%, transparent); border:1px solid color-mix(in srgb, var(--pc) 42%, transparent); }
.vfb-tsec { color:var(--vb-lav); font-size:11px; font-weight:800; letter-spacing:1.3px; text-transform:uppercase; }
.vfb-log { border-left:3px solid var(--lc); padding:3px 8px; margin-bottom:3px; border-radius:0 8px 8px 0; background:rgba(255,255,255,.03); font-size:11px; line-height:1.45; word-break:break-word; }
.vfb-log time { color:#6b78a8; font-family:Consolas,monospace; font-size:10px; margin-right:5px; }
/* ---- setup screen: section headings + option rows in the same style ---- */
#vfb-panel [style*="text-transform:uppercase"] { color:var(--vb-lav) !important; letter-spacing:1.4px !important; font-size:11.5px !important; }
#vfb-panel label[style*="border-radius:6px"], #vfb-panel [style*="#10101c"], #vfb-panel [style*="#0e0e18"], #vfb-panel [style*="#0c0c16"] { background:var(--vb-card) !important; border-radius:14px !important; border-color:rgba(255,255,255,.09) !important; }
#vfb-panel [style*="#2a4a35"] { border-color:rgba(61,220,151,.55) !important; background:linear-gradient(135deg,rgba(61,220,151,.10),transparent),var(--vb-card) !important; }
#vfb-panel [style*="#3a3144"], #vfb-panel [style*="#23253f"], #vfb-panel [style*="#1c1c30"], #vfb-panel [style*="#2b2e49"] { border-color:rgba(255,255,255,.09) !important; }
#vfb-panel [style*="#9060ff"], #vfb-panel [style*="rgb(144, 96, 255)"] { color:var(--vb-lav) !important; }
#vfb-panel [style*="#c9a0ff"] { color:#ff9ccb !important; }
#vfb-panel [style*="#10161f"] { background:var(--vb-card) !important; border-color:var(--vb-line) !important; border-radius:16px !important; }
#vfb-panel [data-status-action="open-setup"], #vfb-panel [data-act="save"], #vfb-panel .vfb-primary { background:linear-gradient(135deg,#7c4dff,#3b82f6) !important; color:#fff !important; box-shadow:0 4px 18px rgba(124,77,255,.45); }
/* ---- terminal console (like the Hybrid Farmer log) ---- */
#vfb-console { margin:0 14px 14px; height:132px; overflow-y:auto; padding:8px 10px; border-radius:12px; background:#000; border:1px solid rgba(255,255,255,.14);
  font:11.5px/1.5 Consolas,'Courier New',monospace; color:#3ddc97; word-break:break-word; }
#vfb-console div { white-space:pre-wrap; }
/* ---- minimized dock ---- */
#vfb-dock { font-family:'Segoe UI',system-ui,-apple-system,Roboto,sans-serif !important; background:linear-gradient(135deg,rgba(38,22,86,.97),rgba(9,12,34,.97)) !important;
  border:1px solid var(--vb-line) !important; box-shadow:0 10px 34px rgba(0,0,0,.8),0 0 28px rgba(124,77,255,.4) !important; }
#vfb-dock .vfb-title { font-size:14px; }
#vfb-dock-pp { box-shadow:0 0 14px rgba(124,77,255,.5); }

/* ===== v3.3 UI polish ===== */
#vfb-panel { --r:14px; font-size:13px; }
#vfb-panel .vfb-hdr { display:grid !important; grid-template-columns:1fr auto; gap:10px 8px; padding:4px 14px 12px !important; cursor:grab; }
.vfb-brand { grid-column:1; order:unset; gap:11px; }
.vfb-names { min-width:0; }
.vfb-title { font-size:17px; background:linear-gradient(90deg,#fff,#c4a8ff 60%,#ff9ccb); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.vfb-sub { font-size:11px; color:var(--vb-mute); letter-spacing:.2px; }
.vfb-by, .vfb-brk { display:none !important; }
.vfb-ctls { grid-column:2; display:flex; gap:6px; }
#vfb-panel .vfb-ctls button { width:36px; height:36px; padding:0; font-size:15px; line-height:1; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#fff;
  background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.1); border-radius:11px; transition:.15s; }
#vfb-panel .vfb-ctls button:hover { background:rgba(124,77,255,.45); box-shadow:0 0 14px rgba(124,77,255,.5); }
#vfb-panel .vfb-ctls #vfb-r:hover { background:rgba(255,80,110,.4); }
.vfb-tabs { grid-column:1 / -1; display:grid !important; grid-template-columns:repeat(6,1fr); gap:5px; padding:4px; border-radius:15px; background:rgba(5,8,26,.55); border:1px solid rgba(255,255,255,.07); }
#vfb-panel .vfb-tabs button { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; min-height:46px; padding:5px 2px; cursor:pointer;
  background:transparent; color:var(--vb-mute); border:0; border-radius:11px; font-family:inherit; font-weight:700; transition:.15s; }
#vfb-panel .vfb-tabs button i { font-style:normal; font-size:16px; line-height:1; }
#vfb-panel .vfb-tabs button span { font-size:10px; line-height:1; letter-spacing:.2px; }
#vfb-panel .vfb-tabs button:hover { background:rgba(124,77,255,.22); color:#fff; }
#vfb-panel .vfb-tabs button.vfb-on { background:linear-gradient(135deg,#7c4dff,#3b82f6); color:#fff; box-shadow:0 4px 16px rgba(124,77,255,.5); }
#vfb-panel .vfb-body { padding:12px 14px 14px !important; max-height:min(60vh,600px) !important; max-height:min(60dvh,600px) !important; overscroll-behavior:contain; }
#vfb-panel .vfb-body, #vfb-panel .vfb-body * { line-height:1.4; }
/* switches */
#vfb-panel input.vfb-sw { -webkit-appearance:none; appearance:none; flex:0 0 auto; width:40px !important; height:23px !important; border-radius:99px !important; padding:0 !important; cursor:pointer; position:relative; transition:.2s;
  background:rgba(255,255,255,.14) !important; border:1px solid rgba(255,255,255,.16) !important; transform:none !important; margin:0; }
#vfb-panel input.vfb-sw::after { content:''; position:absolute; top:2px; left:2px; width:17px; height:17px; border-radius:50%; background:#fff; transition:.2s; box-shadow:0 1px 4px rgba(0,0,0,.5); }
#vfb-panel input.vfb-sw:checked { background:linear-gradient(135deg,#22c55e,#3ddc97) !important; border-color:rgba(61,220,151,.7) !important; box-shadow:0 0 12px rgba(61,220,151,.45); }
#vfb-panel input.vfb-sw:checked::after { transform:translateX(17px); }
#vfb-panel label.vfb-tg { padding:10px 12px !important; gap:12px !important; flex-direction:row-reverse; }
#vfb-panel label.vfb-tg > span:last-child { display:none; }       /* the ON/OFF text is redundant next to a switch */
#vfb-panel label.vfb-tg > span:first-of-type { flex:1; }
/* segmented mode selector */
.vfb-trow { display:flex; flex-wrap:wrap; gap:7px; align-items:center; }
#vfb-panel label.vfb-seg { flex:1 1 30%; min-width:92px; justify-content:center; gap:0 !important; padding:8px 6px; border-radius:11px; font-size:11.5px !important; font-weight:700; text-align:center; white-space:nowrap;
  background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); opacity:.78; transition:.15s; cursor:pointer; }
#vfb-panel label.vfb-seg { position:relative; }
#vfb-panel label.vfb-seg input { position:absolute !important; inset:0; width:100% !important; height:100% !important; min-height:0 !important; margin:0; opacity:0; cursor:pointer; }
#vfb-panel label.vfb-seg:has(input:checked) { opacity:1; background:linear-gradient(135deg,rgba(124,77,255,.55),rgba(59,130,246,.4)); border-color:rgba(190,170,255,.8); color:#fff !important; box-shadow:0 0 14px rgba(124,77,255,.45); }
/* inputs / buttons: bigger touch targets, no iOS zoom */
#vfb-panel input:not([type=checkbox]):not([type=radio]):not([type=range]), #vfb-panel select { min-height:34px; font-size:13px !important; border-radius:10px !important; }
#vfb-panel button:not(.vfb-tb) { min-height:32px; }
#vfb-panel [data-action="deltarget"], #vfb-panel [data-action="delwave"] { width:32px; height:32px; padding:0 !important; background:rgba(255,80,110,.16) !important; color:#ff8fa6 !important; border:1px solid rgba(255,80,110,.4) !important; border-radius:10px !important; }
#vfb-panel input[type="checkbox"]:not(.vfb-sw) { width:20px; height:20px; border-radius:6px; cursor:pointer; }
.vfb-chip { border-radius:14px; }
.vfb-chip b { font-size:15px; }
.vfb-card { border-radius:var(--r); }
.vfb-row { padding:6px 0; font-size:12px; }
#vfb-console { height:112px; font-size:11px; margin:0 14px 12px; }
#vfb-panel :focus-visible { outline:2px solid #9db8ff; outline-offset:2px; }
@media (prefers-reduced-motion:reduce) { #vfb-panel *, #vfb-dock * { animation:none !important; transition:none !important; } }

/* ---- guide ---- */
.vfb-ghero { padding:12px 14px; border-radius:16px; margin-bottom:10px; background:linear-gradient(135deg,rgba(124,77,255,.35),rgba(59,130,246,.2)); border:1px solid rgba(180,160,255,.35); }
.vfb-gd { margin-bottom:8px; border-radius:14px; background:var(--vb-card); border:1px solid rgba(255,255,255,.09); overflow:hidden; }
.vfb-gd[open] { border-color:rgba(139,110,255,.55); }
.vfb-gd summary { list-style:none; cursor:pointer; display:flex; align-items:center; gap:10px; padding:12px 14px; font-size:13px; font-weight:800; color:#e6dcff; min-height:44px; }
.vfb-gd summary::-webkit-details-marker { display:none; }
.vfb-gd summary::after { content:'▾'; margin-left:auto; color:var(--vb-mute); transition:transform .2s; }
.vfb-gd[open] summary::after { transform:rotate(180deg); }
.vfb-gi { font-size:18px; }
.vfb-gb { padding:2px 14px 14px; font-size:12.5px; line-height:1.65 !important; color:#c3cdee; }
.vfb-gb b { color:#fff; }
.vfb-st { display:flex; gap:10px; align-items:flex-start; margin:8px 0; }
.vfb-st b { flex:0 0 24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; color:#fff !important; background:linear-gradient(135deg,#7c4dff,#3b82f6); }
.vfb-tip { margin-top:10px; padding:9px 11px; border-radius:11px; background:rgba(61,220,151,.1); border:1px solid rgba(61,220,151,.35); color:#b8f5d8; font-size:12px; }
.vfb-tip.vfb-warn { background:rgba(255,184,77,.1); border-color:rgba(255,184,77,.4); color:#ffd9a0; }
/* panel = flex column on every layout (PC: header, tabs, body, console) */
#vfb-panel { display:flex !important; flex-direction:column; }
#vfb-panel .vfb-grip { order:0; flex:0 0 auto; }
#vfb-panel .vfb-hdr { order:1; flex:0 0 auto; display:block !important; padding:2px 14px 6px !important; }
#vfb-panel .vfb-tabs { order:2; flex:0 0 auto; margin:0 14px 8px; }
#vfb-panel .vfb-body { order:3; flex:1 1 auto; min-height:0; }
#vfb-panel #vfb-console { order:4; flex:0 0 auto; }
#vfb-panel.vfb-phone .vfb-tabs { margin:0; }
#vfb-panel.vfb-hidden, #vfb-panel.vfb-phone.vfb-hidden, #vfb-panel.vfb-pc.vfb-hidden { display:none !important; }
/* header structure (shared) */
.vfb-title { white-space:normal !important; overflow:visible !important; text-overflow:clip !important; line-height:1.15; font-size:clamp(15px,4.6vw,18px) !important; }
.vfb-brand { gap:10px; }
#vfb-panel.vfb-phone .vfb-ctls { gap:5px; }
#vfb-panel.vfb-phone .vfb-ctls button { width:38px; height:38px; }
#vfb-panel.vfb-phone .vfb-ico { width:36px; height:36px; flex:0 0 36px; }
#vfb-dock .vfb-title { white-space:nowrap !important; }

.vfb-top { display:flex; align-items:center; justify-content:space-between; gap:8px; min-width:0; }
.vfb-brand { flex:1 1 auto; min-width:0; }
.vfb-ctls { flex:0 0 auto; }
.vfb-tabs { grid-column:1 / -1; }
#vfb-panel.vfb-hidden, #vfb-panel.vfb-phone.vfb-hidden, #vfb-panel.vfb-pc.vfb-hidden { display:none !important; }
/* ===== PC: floating, draggable window ===== */
#vfb-panel.vfb-pc { width:min(600px,calc(100vw - 24px)) !important; }
#vfb-panel.vfb-pc .vfb-body { max-height:min(62vh,640px) !important; }
/* ===== PHONE: fixed bottom sheet · header on top · scrolling content · bottom tab bar ===== */
#vfb-panel.vfb-phone { position:fixed !important; width:calc(100vw - 12px) !important; max-width:none !important; max-height:calc(100dvh - 12px); height:min(70dvh,680px); border-radius:22px !important;
  display:flex !important; flex-direction:column; overflow:hidden; }
#vfb-panel.vfb-phone .vfb-grip { display:flex; height:14px; }
#vfb-panel.vfb-phone .vfb-hdr { display:block !important; order:1; flex:0 0 auto; padding:0 !important; touch-action:none; }
#vfb-panel.vfb-phone .vfb-top { flex:0 0 auto; padding:6px 12px 8px; border-bottom:1px solid rgba(255,255,255,.07); touch-action:none; cursor:grab; }
#vfb-panel.vfb-phone .vfb-ico { width:38px; height:38px; border-radius:12px; }
#vfb-panel.vfb-phone .vfb-ico svg { width:26px; height:26px; }
#vfb-panel.vfb-phone .vfb-title { font-size:16px; }
#vfb-panel.vfb-phone .vfb-sub { font-size:10.5px; }
#vfb-panel.vfb-phone .vfb-ctls button { width:40px; height:40px; }
#vfb-panel.vfb-phone .vfb-body { order:3; flex:1 1 auto; min-height:0; max-height:none !important; overflow-y:auto !important; -webkit-overflow-scrolling:touch; touch-action:pan-y; overscroll-behavior:contain; padding:12px 12px 16px !important; }
#vfb-panel.vfb-phone .vfb-tabs { order:4; flex:0 0 auto; margin:0; border-radius:0 0 22px 22px; border:0; border-top:1px solid rgba(255,255,255,.1); background:rgba(5,8,26,.92);
  padding:6px 6px calc(6px + env(safe-area-inset-bottom,0px)); gap:2px; }
#vfb-panel.vfb-phone .vfb-tabs button { min-height:50px; border-radius:13px; }
#vfb-panel.vfb-phone .vfb-tabs button i { font-size:19px; }
#vfb-panel.vfb-phone #vfb-console { display:none; order:5; }       /* the 📋 Log tab shows the same lines — save the space */
#vfb-panel.vfb-phone .vfb-chips { grid-template-columns:repeat(2,1fr); }
#vfb-panel.vfb-phone label.vfb-seg { flex:1 1 100%; padding:11px 8px; }
#vfb-panel.vfb-phone .vfb-trow input { flex:1 1 40%; }
#vfb-panel.vfb-phone input:not([type=checkbox]):not([type=radio]):not([type=range]), #vfb-panel.vfb-phone select { min-height:40px; font-size:16px !important; }
@media (max-width:330px) { #vfb-panel .vfb-tabs button span { font-size:9px; } }
`;
    document.head.appendChild(th);
  }
  // one-off stylesheet: animated rainbow "Overlord" branding (header + minimized dock)
  if (!document.getElementById('vfb-style')) {
    const st = document.createElement('style');
    st.id = 'vfb-style';
    st.textContent = `
      @keyframes vfbRainbow { to { background-position: 200% center; } }
      .vfb-rainbow {
        font-weight: 900; letter-spacing: .5px;
        background: linear-gradient(90deg,#ff004c,#ff8a00,#ffe600,#37e36b,#22b8ff,#a64bff,#ff004c);
        background-size: 200% auto;
        -webkit-background-clip: text; background-clip: text;
        -webkit-text-fill-color: transparent; color: transparent;
        animation: vfbRainbow 3s linear infinite;
      }`;
    document.head.appendChild(st);
  }

  uiPanel = document.createElement('div');
  uiPanel.id = 'vfb-panel';
  Object.assign(uiPanel.style, {
    position: 'fixed', bottom: '8px', right: '8px',
    // responsive width so the panel never overflows a phone screen (was a fixed 330px
    // that ran off the right edge on mobile, hiding the Save button + farm counter)
    width: 'min(330px, calc(100vw - 16px))',
    maxWidth: 'calc(100vw - 16px)', boxSizing: 'border-box',
    background: '#0d0d18',
    border: '1px solid #3a3a5c', borderRadius: '10px',
    zIndex: '2147483647', fontFamily: 'monospace', fontSize: '12px',
    boxShadow: '0 4px 28px #0009',
  });

  const hdr = document.createElement('div');
  hdr.className = 'vfb-hdr';
  Object.assign(hdr.style, {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '7px 10px', background: '#16162a',
    borderRadius: '10px 10px 0 0', cursor: 'grab',
  });
  hdr.innerHTML = `
    <div class="vfb-top"><span class="vfb-brand"><span class="vfb-ico">${vfbLogo(30, 'h')}</span><span class="vfb-names"><div class="vfb-title">Overlord Farmer</div><div class="vfb-sub">made by Overlord</div></span></span>
    <span class="vfb-ctls">
      <button id="vfb-p" title="Pause / resume">⏸</button>
      <button id="vfb-r" title="Reset stats (boss / heals / uptime — keeps farm kills)">🗑</button>
      <button id="vfb-m" title="Minimize">—</button>
    </span></div>
  `;

  uiContent = document.createElement('div');
  Object.assign(uiContent.style, {
    padding: '8px 10px',
    // cap the scroll area so the bottom of the content (the 🎯 Farming counter, and the
    // long Setup list) is never pushed past the screen / under the mobile browser bars —
    // it scrolls INSIDE the panel instead. (user: "non si vede la parte inferiore")
    maxHeight: 'min(72vh, 640px)',
    overflowY: 'auto', WebkitOverflowScrolling: 'touch', color: '#ccc',
  });

  uiContent.classList.add('vfb-body');
  const grip = document.createElement('div');
  grip.className = 'vfb-grip';
  grip.title = 'drag to move';
  _vfbCon = document.createElement('div');
  _vfbCon.id = 'vfb-console';
  const tabsEl = document.createElement('div');
  tabsEl.className = 'vfb-tabs';
  tabsEl.innerHTML = `    
      <button id="vfb-tab-s"><i>📊</i><span>Status</span></button>
      <button id="vfb-tab-l"><i>📋</i><span>Log</span></button>
      <button id="vfb-tab-g"><i>⚙️</i><span>Setup</span></button>
      <button id="vfb-tab-pvp" title="Auto-PvP: ON/OFF + match stats + tokens"><i>⚔️</i><span>PvP</span></button>
      <button id="vfb-tab-t" title="Boss timers (all gates/waves)"><i>⏱️</i><span>Timers</span></button>
      <button id="vfb-tab-guide" title="How the bot works"><i>📖</i><span>Guide</span></button>
    `;
  uiPanel.append(grip, hdr, tabsEl, uiContent, _vfbCon);
  // PHONE vs PC layout: phones get a bottom-sheet with a bottom tab bar; PC keeps the floating, draggable window.
  const applyLayout = () => {
    const phone = window.innerWidth <= 700 || (window.matchMedia('(pointer:coarse)').matches && window.innerWidth <= 900);
    uiPanel.classList.toggle('vfb-phone', phone);
    uiPanel.classList.toggle('vfb-pc', !phone);
  };
  // phone: whatever the panel's top is, never let its bottom run off-screen (that's what made the content unreachable)
  function fitPanelHeight() {
    if (!uiPanel.classList.contains('vfb-phone')) { uiPanel.style.height = ''; return; }
    const top = uiPanel.style.top ? parseFloat(uiPanel.style.top) : null;
    if (top == null || isNaN(top)) { uiPanel.style.height = ''; return; }
    uiPanel.style.height = Math.max(150, Math.min(window.innerHeight * 0.7, window.innerHeight - top - 8)) + 'px';
  }
  window.fitPanelHeight = fitPanelHeight;
  // Firefox mobile can drop a panel's paint after scrolling: after scrolling stops, force a repaint,
  // and if the content area is ever empty, rebuild it.
  let _rp = null;
  const repaint = () => { clearTimeout(_rp); _rp = setTimeout(() => {
    if (!uiPanel || uiPanel.classList.contains('vfb-hidden')) return;
    uiPanel.style.opacity = '0.999'; requestAnimationFrame(() => { uiPanel.style.opacity = ''; });
  }, 120); };
  uiContent.addEventListener('scroll', repaint, { passive: true });
  // the panel must NEVER scroll itself (a focused hidden control can scroll it → everything slides out of view = blank panel)
  const unscroll = () => { if (uiPanel.scrollTop || uiPanel.scrollLeft) { uiPanel.scrollTop = 0; uiPanel.scrollLeft = 0; } };
  uiPanel.addEventListener('scroll', unscroll, { passive: true });
  uiPanel.style.overflow = 'clip';
  if (getComputedStyle(uiPanel).overflowX !== 'clip') uiPanel.style.overflow = 'hidden';
  setInterval(() => {
    if (!uiPanel || minimized || !uiContent) return;
    unscroll();
    if (!document.body.contains(uiPanel)) document.body.appendChild(uiPanel);          // page script removed it → put it back
    if (!uiContent.firstElementChild) { activeTab === 'settings' ? renderSettings() : renderUI(); }
    repaint();
  }, 4000);
  applyLayout();
  window.addEventListener('resize', () => { applyLayout(); fitPanelHeight(); });
  window.addEventListener('orientationchange', applyLayout);
  renderConsole();
  document.body.appendChild(uiPanel);

  // ── MINIMIZED DOCK ────────────────────────────────────────────────────────────
  // When collapsed, the whole panel is hidden and this compact pill docks at the
  // bottom of the screen (fixed, centered — easy to reach with a thumb on mobile,
  // no fiddly dragging). Tap the ⚔Overlord logo to reopen the panel; tap the round
  // play/pause button to run or pause the bot without opening anything.
  const dockEl = document.createElement('div');
  dockEl.id = 'vfb-dock';
  Object.assign(dockEl.style, {
    position: 'fixed', bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
    left: '50%', transform: 'translateX(-50%)',
    display: 'none', alignItems: 'center', gap: '10px',
    background: '#0d0d18', border: '1px solid #3a3a5c', borderRadius: '26px',
    padding: '6px 8px 6px 14px', zIndex: '2147483647',
    boxShadow: '0 4px 22px #000b', fontFamily: 'monospace',
    cursor: 'grab', touchAction: 'none',   // draggable on PC + mobile (Pointer Events)
  });
  dockEl.innerHTML = `
    <span id="vfb-dock-logo" style="cursor:pointer;display:flex;align-items:center;gap:7px;user-select:none">
      ${vfbLogo(26, 'd')}
      <span class="vfb-title">OVERLORD</span>
    </span>
    <button id="vfb-dock-pp" title="run / pause the bot"
      style="border:none;border-radius:50%;width:38px;height:38px;cursor:pointer;
      font-size:16px;line-height:38px;text-align:center;padding:0">▶</button>`;
  document.body.appendChild(dockEl);

  // Drag the minimized dock anywhere — PC (mouse) AND mobile (touch) via Pointer Events.
  // A small movement threshold distinguishes a DRAG (reposition) from a TAP (logo→expand,
  // ⏯→pause), so dragging never accidentally opens the panel or toggles the bot. The
  // position persists in S.dockPos. (user: "quando minimizzato devo poterlo spostare".)
  let dockDrag = null, dockMoved = false;
  const applyDockPos = (left, top) => {
    const w = dockEl.offsetWidth || 120, h = dockEl.offsetHeight || 50;
    left = Math.max(0, Math.min(window.innerWidth  - w, left));
    top  = Math.max(0, Math.min(window.innerHeight - h, top));
    Object.assign(dockEl.style, { left: left+'px', top: top+'px', right: 'auto', bottom: 'auto', transform: 'none' });
  };
  if (S.dockPos && S.dockPos.left != null) applyDockPos(S.dockPos.left, S.dockPos.top);
  dockEl.addEventListener('pointerdown', e => {
    const r = dockEl.getBoundingClientRect();
    // remember WHAT was pressed: pointer capture (below) steals the synthetic `click`
    // from the child elements, so we resolve the tap here in pointerup instead.
    dockDrag = { dx: e.clientX - r.left, dy: e.clientY - r.top, sx: e.clientX, sy: e.clientY, tgt: e.target };
    dockMoved = false;
    try { dockEl.setPointerCapture(e.pointerId); } catch {}
  });
  dockEl.addEventListener('pointermove', e => {
    if (!dockDrag) return;
    if (!dockMoved && Math.hypot(e.clientX - dockDrag.sx, e.clientY - dockDrag.sy) < 6) return;
    dockMoved = true;
    dockEl.style.cursor = 'grabbing';
    e.preventDefault();
    applyDockPos(e.clientX - dockDrag.dx, e.clientY - dockDrag.dy);
  });
  const endDockDrag = () => {
    if (!dockDrag) return;
    const tgt = dockDrag.tgt;
    dockDrag = null;
    dockEl.style.cursor = 'grab';
    if (dockMoved) {
      const r = dockEl.getBoundingClientRect();
      S.dockPos = { left: Math.round(r.left), top: Math.round(r.top) }; save();
    } else {
      // a TAP (no drag) → act on what was pressed: ⏯ toggles pause, anything else reopens
      if (tgt && tgt.closest && tgt.closest('#vfb-dock-pp')) setPaused(!paused);
      else setMinimized(false);
    }
  };
  dockEl.addEventListener('pointerup', endDockDrag);
  dockEl.addEventListener('pointercancel', endDockDrag);

  // Delegated click handler for buttons INSIDE the status tab. The status tab is
  // re-rendered every 2s via innerHTML, so a per-button onclick wouldn't survive —
  // delegate on the stable uiContent element instead. (The settings tab uses its own
  // uiContent.onclick from wireSettings; the two don't collide — this matches only
  // [data-status-action], that one only [data-action].)
  uiContent.addEventListener('click', e => {
    const b = e.target.closest('[data-status-action]');
    if (b) {
      e.stopPropagation();
      const sa = b.dataset.statusAction;
      if (sa === 'reset-farm')  resetFarm();
      else if (sa === 'open-setup') setTab('settings');
      else if (sa === 'open-guide') setTab('guide');
      return;
    }
    // ⚔ PvP tab actions
    const pb = e.target.closest('[data-pvp-action]');
    if (!pb) return;
    e.stopPropagation();
    const a = pb.dataset.pvpAction;
    if (a === 'toggle') {
      S.pvp.enabled = !S.pvp.enabled; S.pvp.note = S.pvp.enabled ? 'starting…' : 'off';
      if (S.pvp.enabled) _pvpUrlConsumed = false;    // ricomincia a leggere la URL del match
      save(); renderUI();
      log(`⚔ AutoPvP ${S.pvp.enabled ? 'ON' : 'OFF'}${S.pvp.enabled ? ' — farming pauses' : ''}`, '#ff5c8a');
    } else if (a === 'tokens') {
      pvpRefreshTokens(true);
    } else if (a === 'scout') {
      S.pvp.scout.enabled = !S.pvp.scout.enabled; save(); renderUI();
      log(`📡 PvP Scout ${S.pvp.scout.enabled ? 'ON — learning from recent battles' : 'OFF'}`, '#7df');
      if (S.pvp.scout.enabled) pvpScout(true);   // primo giro subito
    } else if (a === 'reset') {
      resetPvpRecord(false);
    } else if (a === 'wipe') {
      resetPvpRecord(true);
    } else if (a === 'export') {
      try {
        const txt = pvpExportText();
        const url = URL.createObjectURL(new Blob([txt], { type: 'text/plain;charset=utf-8' }));
        const a2 = document.createElement('a');
        a2.href = url; a2.download = 'veyra_pvp_' + new Date().toISOString().slice(0, 10) + '.txt';
        document.body.appendChild(a2); a2.click(); a2.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        try { navigator.clipboard.writeText(txt); } catch {}   // best-effort copy too
        log('⚔ PvP export → file downloaded: ' + a2.download, '#9cf');
      } catch (e) { log('⚔ export failed: ' + e.message, '#f88'); }
    }
  });

  // Wire the delegated change/input/click handlers ONCE at init. Prima venivano
  // assegnati SOLO dentro renderSettings()→wireSettings(): se l'utente non apriva mai
  // la tab ⚙ Settings, uiContent.onchange restava null → il dropdown "🧬 My class" del
  // PvP (e le checkbox skill/restrict) non reagivano ("dropdown lockato su Archer").
  wireSettings();

  // restore saved position (left/top) if the panel was dragged before
  {
    const phone = uiPanel.classList.contains('vfb-phone');
    const pos = phone ? S.posPhone : S.pos;
    if (pos && pos.left != null) {
      const left = Math.max(0, Math.min(window.innerWidth  - (phone ? 40 : 60), pos.left));
      const top  = Math.max(0, Math.min(window.innerHeight - (phone ? 150 : 36), pos.top));
      Object.assign(uiPanel.style, { left: left+'px', top: top+'px', right: 'auto', bottom: 'auto' });
      fitPanelHeight();
    }
  }

  function setTab(t) {
    activeTab = t;
    uiContent.dataset.view = '';
    const sel = (id, active) => {
      const b = document.getElementById(id);
      b.classList.toggle('vfb-on', !!active);
    };
    sel('vfb-tab-s', t === 'status');
    sel('vfb-tab-l', t === 'log');
    sel('vfb-tab-g', t === 'settings');
    sel('vfb-tab-guide', t === 'guide');
    sel('vfb-tab-pvp', t === 'pvp');
    sel('vfb-tab-t', t === 'timers');
    if (t === 'timers') _timerForce = true;
    if (t === 'settings') renderSettings();
    else renderUI();
    if (t === 'pvp') pvpRefreshTokens(true);   // mostra subito i token aggiornati
  }
  document.getElementById('vfb-tab-s').classList.add('vfb-on');
  document.getElementById('vfb-tab-s').onclick = e => { e.stopPropagation(); setTab('status'); };
  document.getElementById('vfb-tab-l').onclick = e => { e.stopPropagation(); setTab('log'); };
  document.getElementById('vfb-tab-guide').onclick = e => { e.stopPropagation(); setTab(activeTab === 'guide' ? 'status' : 'guide'); };
  document.getElementById('vfb-tab-t').onclick = e => { e.stopPropagation(); setTab(activeTab === 'timers' ? 'status' : 'timers'); };
  uiContent.addEventListener('click', e => { if (e.target && e.target.id === 'vfb-t-refresh') { e.stopPropagation(); _timerForce = true; renderUI(); } });
  document.getElementById('vfb-tab-pvp').onclick = e => { e.stopPropagation(); setTab(activeTab === 'pvp' ? 'status' : 'pvp'); };
  // ⚙ toggles Settings open/closed (closing returns to Status)
  document.getElementById('vfb-tab-g').onclick = e => {
    e.stopPropagation();
    setTab(activeTab === 'settings' ? 'status' : 'settings');
  };

  // keep the dock's play/pause button in step with the live paused state
  function syncDock() {
    const b = document.getElementById('vfb-dock-pp');
    if (!b) return;
    b.textContent      = paused ? '▶' : '⏸';                 // show the ACTION on tap
    b.style.background  = paused ? '#16331f' : '#33290f';
    b.style.color       = paused ? '#39d97f' : '#ffb02e';
  }
  // single source of truth for pausing — header button + dock button both call this
  function setPaused(v) {
    paused = v; S.paused = paused; save();   // survive page navigation
    const hp = document.getElementById('vfb-p');
    if (hp) hp.textContent = paused ? '▶' : '⏸';
    syncDock();
    renderUI();
  }
  document.getElementById('vfb-p').onclick = e => { e.stopPropagation(); setPaused(!paused); };
  document.getElementById('vfb-p').textContent = paused ? '▶' : '⏸';   // reflect persisted state

  // collapse/expand: hide the whole panel and show the bottom dock instead (or back)
  function setMinimized(v) {
    minimized = v; S.minimized = minimized; save();   // stay collapsed across reloads
    uiPanel.style.display = minimized ? 'none' : 'block';
    uiPanel.classList.toggle('vfb-hidden', minimized);   // class wins over the phone layout's display:flex !important
    dockEl.style.display  = minimized ? 'flex' : 'none';
    const mb = document.getElementById('vfb-m');
    if (mb) mb.textContent = '—';
    if (!minimized) renderUI();   // refresh content that went stale while docked
    syncDock();
  }
  // (dock logo + ⏯ taps are handled in endDockDrag's pointerup — pointer capture steals
  // the synthetic click from these children, so onclick handlers here would never fire.)

  // 🗑 reset the TOP counters — SINGLE click (user: "si dovrebbe clickare una sola
  // volta", the old two-click ✓? was confusing). Keeps S.kills (per-mob farm progress
  // + the 🎯 Farming bars) untouched, so an accidental click only wipes uptime/boss/
  // heal tallies, which is cheap.
  const rbtn = document.getElementById('vfb-r');
  rbtn.onclick = e => {
    e.stopPropagation();
    resetStats();
    rbtn.textContent = '✓'; rbtn.style.background = '#2f5040';
    setTimeout(() => { rbtn.textContent = '🗑'; rbtn.style.background = ''; }, 900);
  };
  document.getElementById('vfb-m').onclick = e => { e.stopPropagation(); setMinimized(true); };
  // reflect the persisted collapsed state on load (so a refresh doesn't re-open it)
  uiContent.style.display = 'block';
  setMinimized(minimized);

  // drag the panel anywhere (mouse + touch via Pointer Events); position persists.
  // Grab it by the ▬ handle on top OR any empty part of the header (not the buttons).
  let drag = null;
  const setGrab = v => { grip.style.cursor = v; hdr.style.cursor = v; const t = hdr.querySelector('.vfb-top'); if (t) t.style.cursor = v; };
  const dragStart = e => {
    if (e.target.closest && e.target.closest('button, a, input, select, textarea')) return;   // buttons stay clickable
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    const r = uiPanel.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top, id: e.pointerId };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    setGrab('grabbing');
  };
  const dragMove = e => {
    if (!drag) return;
    const left = Math.max(0, Math.min(window.innerWidth  - uiPanel.offsetWidth, e.clientX - drag.dx));
    const phone = uiPanel.classList.contains('vfb-phone');
    const top  = Math.max(0, Math.min(window.innerHeight - (phone ? 150 : 36), e.clientY - drag.dy));
    Object.assign(uiPanel.style, { left: left+'px', top: top+'px', right: 'auto', bottom: 'auto' });
    fitPanelHeight();
  };
  const endDrag = () => {
    if (!drag) return;
    drag = null;
    setGrab('grab');
    const r = uiPanel.getBoundingClientRect();
    S[uiPanel.classList.contains('vfb-phone') ? 'posPhone' : 'pos'] = { left: Math.round(r.left), top: Math.round(r.top) };
    save();
  };
  const topEl = hdr.querySelector('.vfb-top');
  for (const el of [grip, topEl]) {
    el.style.touchAction = 'none';   // phones: stop the browser from panning/scrolling instead of dragging
    el.addEventListener('pointerdown', dragStart);
    el.addEventListener('pointermove', dragMove);
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);
  }
  window.addEventListener('resize', () => {   // keep the panel on-screen after rotate / resize
    if (uiPanel.style.left && uiPanel.offsetWidth) {
      const l = Math.max(0, Math.min(window.innerWidth - uiPanel.offsetWidth, parseFloat(uiPanel.style.left) || 0));
      const t = Math.max(0, Math.min(window.innerHeight - 36, parseFloat(uiPanel.style.top) || 0));
      Object.assign(uiPanel.style, { left: l + 'px', top: t + 'px' });
    }
  });

  // Periodic refresh — ma NON ricostruire il pannello mentre l'utente sta usando
  // un controllo: il menu nativo di un <select> aperto (es. la classe PvP) verrebbe
  // distrutto a metà scelta → "impossibile selezionare la classe". Salta anche gli
  // input/textarea a fuoco per non cancellare il valore che si sta digitando.
  setInterval(() => {
    const ae = document.activeElement;
    if (ae && uiContent && uiContent.contains(ae) &&
        (ae.tagName === 'SELECT' || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
    renderUI();
  }, 2000);
}

// ── KEEP-AWAKE (mobile) ───────────────────────────────────────────────────────
// Mobile browsers FREEZE JS timers when the tab is backgrounded and SUSPEND the page
// entirely when the screen locks → the bot stalls (it resumes only when you wake/unlock).
// The Screen Wake Lock API keeps the screen ON while THIS tab is in the foreground, so
// just leaving the phone on with the page open keeps farming. It does NOT survive a
// MANUAL screen lock or switching apps — no browser allows real background execution, so
// for true 24/7 farming use the server bot instead. The lock auto-releases when the tab
// is hidden; we re-acquire it the moment the tab becomes visible again.
let _wakeLock = null;
async function keepAwake() {
  try {
    if ('wakeLock' in navigator && document.visibilityState === 'visible' && !_wakeLock) {
      _wakeLock = await navigator.wakeLock.request('screen');
      _wakeLock.addEventListener('release', () => { _wakeLock = null; });
      log('📱 wake-lock ON · screen stays awake while the tab is open in the foreground', '#9cf');
    }
  } catch { /* unsupported / denied / not allowed (e.g. low battery) — ignore */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !_wakeLock) keepAwake();
});

// ── INIT ──────────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
// ⏱ TIMERS — boss timer dashboard (ported from the Boss Tracker), now part of the
// same engine/panel. Runs INSIDE mainLoop (sequential with the farm → no cookie races),
// also while paused. Data feeds the ⏱ tab on every page.
// ═══════════════════════════════════════════════════════════════════════════════
const TIMER_PAGES = [
  { label: "Gates of Olympus",    url: `${BASE}/active_wave.php?gate=5&wave=9`  },
  { label: "Hermes's Pantheon",   url: `${BASE}/active_wave.php?gate=5&wave=10` },
  { label: "Artemis's Pantheon",  url: `${BASE}/active_wave.php?gate=5&wave=11` },
  { label: "Poseidon's Pantheon", url: `${BASE}/active_wave.php?gate=5&wave=12` },
  { label: "Ares's Pantheon",     url: `${BASE}/active_wave.php?gate=5&wave=13` },
  { label: "Apollo's Pantheon",   url: `${BASE}/active_wave.php?gate=5&wave=14` },
  { label: "Hera's Pantheon",     url: `${BASE}/active_wave.php?gate=5&wave=15` },
  { label: "Athena's Pantheon",   url: `${BASE}/active_wave.php?gate=5&wave=16` },
  { label: "Zeus's Pantheon",     url: `${BASE}/active_wave.php?gate=5&wave=17` },
  { label: "Grakthar's Kingdom",  url: `${BASE}/active_wave.php?gate=3&wave=8`  },
];
const TIMER_MIN_MS      = 5 * 60_000;    // never re-fetch more often than this
const TIMER_SPAWN_LEAD  = 60_000;        // re-fetch just before a known spawn
const TIMER_FALLBACK_MS = 30 * 60_000;   // otherwise poll every 30 min
let _timerSections = [], _timerLast = 0, _timerBusy = false, _timerForce = true;

const tNorm = s => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
const tEsc  = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const T_ALIASES = {
  'hermes divine herald of the endless road':    ['hermes fleet duelist of the crossroads'],
  'artemis divine huntress of the moonlit wilds': ['artemis lunar duelist of the sacred hunt'],
  'poseidon sovereign of the drowned steps':     ['poseidon duelist of the crushing tide', 'poseidon ascended sovereign of the endless sea'],
  'ares sovereign of the red bastion':           ['ares duelist of the blood oath', 'ares ascended god of unending war'],
  'apollo sovereign of the sun basilica':        ['apollo duelist of the sun court', 'apollo ascended god of the living sun'],
  'zeus sovereign of the storm throne':          ['zeus duelist of the storm throne', 'zeus ascended sovereign of the storm throne'],
  'hera sovereign of the crown court':           ['hera duelist of the crown court', 'hera ascended sovereign of the crown court'],
  'athena sovereign of the ivory war library':   ['athena duelist of the ivory war library', 'athena ascended sovereign of the ivory war library'],
};

function parseTimerCards(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const monsterMap = {};   // normName -> { id, dmg, dieTs } (highest id = newest spawn)
  doc.querySelectorAll('.monster-card').forEach(mc => {
    const mid = mc.getAttribute('data-monster-id'); if (!mid) return;
    const norm = tNorm(mc.getAttribute('data-name')); if (!norm) return;
    const dmg = parseInt(mc.getAttribute('data-userdmg') || '0', 10);
    const dieTs = parseInt(mc.getAttribute('data-expire') || '0', 10);
    if (!monsterMap[norm] || parseInt(mid) > parseInt(monsterMap[norm].id)) monsterMap[norm] = { id: mid, dmg, dieTs };
  });
  const findEntry = name => {
    const k = tNorm(name);
    if (monsterMap[k]) return monsterMap[k];
    for (const a of (T_ALIASES[k] || [])) if (monsterMap[a]) return monsterMap[a];
    const words = k.split(' ').filter(w => w.length > 2);
    const fz = Object.entries(monsterMap).find(([m]) => words.every(w => m.includes(w)));
    return fz ? fz[1] : null;
  };
  const now = Math.floor(Date.now() / 1000);
  const out = [];
  doc.querySelectorAll('.auto-summon-card').forEach(card => {
    const alive  = card.getAttribute('data-alive') === '1';
    const nextTs = parseInt(card.getAttribute('data-next-ts') || '0', 10);
    const name   = card.querySelector('.auto-summon-name')?.textContent.trim() || 'Unknown';
    const sub    = card.querySelector('.auto-summon-sub')?.innerHTML.trim() || '';
    const entry  = alive ? findEntry(name) : null;
    const isPhaseBoss = /^(hermes, divine|artemis, divine|poseidon, sovereign|ares, sovereign|apollo, sovereign|zeus, sovereign|hera, sovereign|athena, sovereign)/i.test(name);
    let autodieSecs = 0;
    const m = sub.match(/Auto-die[^<]*<b[^>]*>\s*([\d.]+)h\s*<\/b>/i);
    if (m) autodieSecs = parseFloat(m[1]) * 3600;
    let dieTs = 0;
    if (alive) {
      if (isPhaseBoss && entry?.dieTs) dieTs = entry.dieTs;
      else {
        let cycle = autodieSecs >= 5 * 3600 ? 12 * 3600 : /drakzareth/i.test(name) ? 8 * 3600 : 6 * 3600;
        dieTs = nextTs - cycle + autodieSecs;
      }
    }
    const timeLeft = alive ? Math.max(0, dieTs - now) : 0;
    let phase = null, battleUrl = entry ? `${BASE}/battle.php?id=${entry.id}` : null;
    if (alive && isPhaseBoss) {
      phase = timeLeft > 24 * 3600 ? 'p1' : 'p2';
      if (phase === 'p2') {
        const pv = doc.body.innerHTML.match(/pvp_style_battle\.php\?source=monster_phase&(?:amp;)?active_id=(\d+)/);
        if (pv) battleUrl = `${BASE}/pvp_style_battle.php?source=monster_phase&active_id=${pv[1]}`;
        else phase = 'p3';
      }
    }
    out.push({ alive, nextTs, dieTs, name, battleUrl, userDmg: entry ? entry.dmg : 0, phase, isPhaseBoss });
  });
  return out;
}

async function refreshBossTimers() {
  if (_timerBusy) return;
  const now = Date.now();
  if (!_timerForce) {
    if (_timerLast && now - _timerLast < TIMER_MIN_MS) return;
    const upcoming = _timerSections.flatMap(s => s.bosses).filter(b => !b.alive && b.nextTs * 1000 > now).map(b => b.nextTs * 1000);
    const soon = upcoming.length && Math.min(...upcoming) - now < TIMER_SPAWN_LEAD;
    if (_timerLast && !soon && now - _timerLast < TIMER_FALLBACK_MS) return;
  }
  _timerBusy = true; _timerForce = false;
  const view = saveUserView();
  try {
    setCookieRaw('hide_dead_monsters', 1);   // alive monsters only (same as the tracker)
    const secs = [];
    for (const p of TIMER_PAGES) {
      const html = await getHtml(p.url);
      secs.push(html ? { label: p.label, bosses: parseTimerCards(html) } : { label: p.label, bosses: [], error: true });
    }
    _timerSections = secs; _timerLast = Date.now();
  } catch (e) {
    console.error('[Timers]', e);
  } finally {
    restoreUserView(view);
    _timerBusy = false;
  }
}

function tFmt(secs) {
  secs = Math.max(0, Math.floor(secs));
  const d = Math.floor(secs / 86400), h = Math.floor(secs % 86400 / 3600), m = Math.floor(secs % 3600 / 60), s = secs % 60;
  return d ? `${d}d ${h}h ${m}m` : h ? `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s` : `${m}m ${String(s).padStart(2, '0')}s`;
}

function renderTimers() {
  const now = Math.floor(Date.now() / 1000);
  let h = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <span class="vfb-card-t" style="--ac:#7df3ff">⏱ Boss timers</span>
    <span style="color:#8aa0c4;font-size:10px">${_timerLast ? 'updated ' + new Date(_timerLast).toLocaleTimeString() : (_timerBusy ? 'loading…' : 'waiting for first fetch…')}
      <button id="vfb-t-refresh" class="vfb-tb" style="margin-left:6px;cursor:pointer;font-size:11px">↻</button></span></div>`;
  if (!_timerSections.length) return h + `<div class="vfb-card" style="--ac:#00e5ff;color:#8aa0c4;font-size:11px">Fetching timers from all gates/waves…</div>`;
  for (const sec of _timerSections) {
    const alive = sec.bosses.filter(b => b.alive).length;
    let body = '';
    if (!sec.bosses.length && !sec.error) body = `<div style="color:#667;font-size:10px">no boss cards</div>`;
    if (sec.error) body = `<div style="color:#ff4d6d;font-size:10px">fetch failed</div>`;
    for (const b of sec.bosses) {
      const ph = b.phase ? ` <span class="vfb-pill" style="--pc:#c77dff">${b.phase.toUpperCase()}</span>` : '';
      let pill, pc;
      if (b.alive) {
        pc = '#3ddc97';
        pill = `ALIVE${b.dieTs ? ' · ' + tFmt(b.dieTs - now) : ''}${b.userDmg ? ' · ' + fmtDmg(b.userDmg) : ''}`;
      } else {
        pc = b.nextTs && b.nextTs - now <= 300 ? '#ffc857' : '#8aa0c4';
        pill = b.nextTs ? (b.nextTs > now ? tFmt(b.nextTs - now) : 'spawning…') : 'dead';
      }
      const nm = shortName(b.name, 30);
      const name = b.battleUrl ? `<a href="${tEsc(b.battleUrl)}" style="text-decoration:none">${tEsc(nm)}</a>` : `<span style="color:#e8f6ff">${tEsc(nm)}</span>`;
      const _ak = tNorm(b.name), _ac = (S.bossArm || {})[_ak], _open = _armOpen.has(_ak);
      const arrow = `<span class="vfb-arm-arrow" data-k="${tEsc(_ak)}" title="Auto-hit settings">${_open ? '▾' : '▸'}</span>${_ac && _ac.on ? '<span class="vfb-arm-on-dot" title="Armed">●</span>' : ''}`;
      body += `<div class="vfb-row"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${arrow}${name}${ph}</span><span class="vfb-pill" style="--pc:${pc}">${pill}</span></div>`;
      if (_open) body += armBoxHTML(b);
    }
    h += `<div class="vfb-card" style="--ac:${alive ? '#3ddc97' : '#7c4dff'}"><div class="vfb-card-h"><span class="vfb-tsec" style="flex:1">${tEsc(sec.label)}</span>${alive ? `<span class="vfb-card-b" style="color:#3ddc97">${alive} alive</span>` : ''}</div>${body}</div>`;
  }
  return h;
}


// ── 🎯 ARMED BOSSES (Boss timers tab) ─────────────────────────────────────────
// Click ▸ next to a boss in the timers tab → same box as the dungeon farmer's monster row.
// Settings are saved (S.bossArm) and the moment an armed boss turns ALIVE the main loop
// goes and hits it with those settings.
const ARM_DEFAULT = { on: false, hits: 5, max: 0, skill: 'POWER_SLASH', cap: '10,000,000', smart: false };
const ARM_BASE_SKILLS = {
  SLASH: { id: 0, cost: 1 }, POWER_SLASH: { id: -1, cost: 10 }, HEROIC_SLASH: { id: -2, cost: 50 },
  ULTIMATE_SLASH: { id: -3, cost: 100 }, LEGENDARY_SLASH: { id: -4, cost: 200 }, WORLD_BREAKER_SLASH: { id: -5, cost: 1000 },
};
const _armOpen = new Set(), _armDone = {}, _armCool = {}, _armLast = {};
let _armPoll = 0;

function armCfg(key) { S.bossArm = S.bossArm || {}; return (S.bossArm[key] = Object.assign({}, ARM_DEFAULT, S.bossArm[key] || {})); }
function armSkills() {
  let cls = {};
  try { cls = JSON.parse(localStorage.getItem('ds_class_skills') || '{}') || {}; } catch {}
  const all = { ...ARM_BASE_SKILLS };
  for (const [k, v] of Object.entries(cls)) if (v && Number.isFinite(Number(v.id))) all[k] = { id: Number(v.id), cost: Number(v.cost) || 1 };
  return all;
}
function armBossId(b) { return (String(b.battleUrl || '').match(/battle\.php\?id=(\d+)/) || [])[1] || null; }
function armActionable(b, key) {
  const cfg = (S.bossArm || {})[key]; if (!cfg || !cfg.on || !b.alive) return null;
  const id = armBossId(b); if (!id) return null;                 // duel phase (PvP-style page) is not handled here
  if (Date.now() < (_armCool[id] || 0)) return null;
  const cap = parseAmount(cfg.cap) || 0;
  if (_armDone[id] === 'dead') return null;
  if (cap > 0 && Math.max(b.userDmg || 0, _armDone[id] || 0) >= cap) return null;
  return id;
}
function armBosses() { return _timerSections.flatMap(s => s.bosses.map(b => ({ b, label: s.label }))); }
function armedSoon() {
  const arm = S.bossArm || {}; const on = Object.keys(arm).filter(k => arm[k] && arm[k].on); if (!on.length) return false;
  const now = Date.now();
  return armBosses().some(({ b }) => on.includes(tNorm(b.name)) && (b.alive ? !!armActionable(b, tNorm(b.name)) : (b.nextTs && b.nextTs * 1000 - now < 180000)));
}
// true when an armed boss is alive and waiting to be hit (also polls fast around a spawn)
async function armedBossReady() {
  const arm = S.bossArm || {}; const on = Object.keys(arm).filter(k => arm[k] && arm[k].on); if (!on.length) return false;
  const now = Date.now();
  const due = armBosses().some(({ b }) => on.includes(tNorm(b.name)) && !b.alive && b.nextTs && b.nextTs * 1000 - now < 30000);
  if (due && now - _armPoll > 10000) { _armPoll = now; _timerForce = true; await refreshBossTimers(); }
  return armBosses().some(({ b }) => on.includes(tNorm(b.name)) && !!armActionable(b, tNorm(b.name)));
}

async function fightArmed(b, id, key, cfg, secLabel) {
  const idp = { monster_id: id };
  const cap = parseAmount(cfg.cap) || 0;
  const start = Math.max(b.userDmg || 0, typeof _armDone[id] === 'number' ? _armDone[id] : 0);
  const skills = armSkills();
  const skill = skills[cfg.skill] || skills.POWER_SLASH;
  log(`🎯 ${b.name} is ALIVE (${secLabel}) → ${cfg.smart ? 'Smart attack' : `${cfg.skill.replace(/_/g, ' ')} ×${cfg.hits}`}, cap ${cap ? fmtDmg(cap) : 'none'}`, '#3ddc97');
  status = `🎯 ${shortName(b.name)}`;
  let total = start, reason = 'done';
  if (cfg.smart) {
    const r = await fightTarget(idp, b.name, start, cap > 0 ? cap : 1e15, 'asNeeded', false, null, true, null, true, false);
    total = r.dmg; reason = r.reason;
  } else {
    await join(idp);
    let stall = 0, nulls = 0;
    outer: while (running && !paused && (cap <= 0 || total < cap)) {
      for (let h = 0; h < Math.max(1, parseInt(cfg.hits) || 1); h++) {
        if (!running || paused) { reason = 'interrupt'; break outer; }
        if (stam < skill.cost) { if (!(await useLSP(true))) { reason = 'nostam'; break outer; } }
        const d = await attack(idp, skill.id, skill.cost);
        if (d === 'throttled') { h--; continue; }
        if (d === 'dead') { reason = 'dead'; break outer; }
        if (!d) { if (++nulls > 5) { reason = 'nostam'; break outer; } if (stam < skill.cost && !(await useLSP(true))) { reason = 'nostam'; break outer; } continue; }
        const msg = String(d.message || '');
        if (/already dead|is dead/i.test(msg)) { reason = 'dead'; _armDone[id] = 'dead'; break outer; }
        if (/not enough mana/i.test(msg)) { if (!(await drinkMana())) { reason = 'nomana'; break outer; } continue; }
        nulls = 0;
        const nt = parseInt(String(d.totaldmgdealt ?? '').replace(/,/g, ''), 10);
        if (Number.isFinite(nt)) { if (nt > total) { total = nt; stall = 0; } else if (++stall >= 3) { reason = 'cap'; break outer; } }
        _didWork = true;
        if (cap > 0 && total >= cap) break outer;
      }
    }
  }
  if (reason === 'dead') _armDone[id] = 'dead'; else _armDone[id] = total;
  if (cap > 0 && total >= cap) reason = 'cap reached';
  else if (reason !== 'dead') _armCool[id] = Date.now() + 60_000;   // couldn't finish (stamina/mana) → retry in 1 min
  _armLast[key] = `${fmtDmg(total)} · ${reason}`;
  log(`🎯 ${b.name}: ${fmtDmg(total)}${cap ? ' / ' + fmtDmg(cap) : ''} — ${reason}`, reason === 'cap reached' || reason === 'done' ? '#2f8' : '#fa0');
  _didWork = true; _timerForce = true;
}

async function processArmedBosses() {
  const arm = S.bossArm || {}; if (!Object.values(arm).some(a => a && a.on)) return;
  await armedBossReady();
  for (const { b, label } of armBosses()) {
    if (paused || !running) return;
    const key = tNorm(b.name), id = armActionable(b, key);
    if (id) await fightArmed(b, id, key, armCfg(key), label);
  }
}

function armBoxHTML(b) {
  const key = tNorm(b.name), c = armCfg(key), skills = armSkills();
  const opts = Object.keys(skills).map(k => `<option value="${tEsc(k)}" ${c.skill === k ? 'selected' : ''}>${tEsc(k.replace(/_/g, ' '))}</option>`).join('');
  const stepper = f => `<div class="vfb-arm-step-w"><button type="button" class="vfb-arm-step" data-d="-1">−</button><input type="text" class="vfb-arm-in" data-k="${tEsc(key)}" data-f="${f}" value="${tEsc(c[f])}"><button type="button" class="vfb-arm-step" data-d="1">+</button></div>`;
  return `<div class="vfb-arm-box">
    <div class="vfb-arm-top"><label class="vfb-arm-sw" title="Hit this boss automatically as soon as it is alive"><input type="checkbox" class="vfb-arm-on" data-k="${tEsc(key)}" ${c.on ? 'checked' : ''}><span></span></label>
      <b>${tEsc(b.name)}</b><small>${_armLast[key] ? tEsc(_armLast[key]) : (c.on ? 'armed' : 'off')}</small></div>
    <div class="vfb-arm-grid">
      <div><label>Hits</label>${stepper('hits')}</div>
      <div><label>Max mobs</label><span title="Bosses are single targets — kept for layout, not used">${stepper('max')}</span></div>
      <div class="vfb-arm-wide"><label>Skill</label><select class="vfb-arm-in" data-k="${tEsc(key)}" data-f="skill">${opts}</select></div>
      <div class="vfb-arm-wide"><label>Damage cap</label><input type="text" class="vfb-arm-in" data-k="${tEsc(key)}" data-f="cap" value="${tEsc(c.cap)}" placeholder="10,000,000"></div>
      <label class="vfb-arm-smart" title="Smart attack: exact-damage tiers, never overshoots the cap (ignores Skill/Hits)"><input type="checkbox" class="vfb-arm-in" data-k="${tEsc(key)}" data-f="smart" ${c.smart ? 'checked' : ''}><span>🧠 Smart</span></label>
    </div></div>`;
}

function injectArmCss() {
  if (document.getElementById('vfb-arm-css')) return;
  const st = document.createElement('style'); st.id = 'vfb-arm-css';
  st.textContent = `
  .vfb-arm-arrow{cursor:pointer;display:inline-block;width:16px;color:#7df3ff;user-select:none}
  .vfb-arm-on-dot{color:#3ddc97;font-size:9px;margin-right:3px}
  .vfb-arm-box{margin:4px 0 8px;padding:8px;border:1px solid #1f6f7a;border-radius:10px;background:linear-gradient(160deg,#0d2a33,#0a1a24)}
  .vfb-arm-top{display:flex;align-items:center;gap:8px;margin-bottom:6px}
  .vfb-arm-top b{color:#e8f6ff;font-size:12px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.vfb-arm-top small{color:#8aa0c4;font-size:10px}
  .vfb-arm-sw{position:relative;width:38px;height:20px;flex:0 0 auto;cursor:pointer}.vfb-arm-sw input{display:none}
  .vfb-arm-sw span{position:absolute;inset:0;border-radius:20px;background:#2a3b55;transition:.2s}
  .vfb-arm-sw span:before{content:'';position:absolute;left:2px;top:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:.2s}
  .vfb-arm-sw input:checked+span{background:linear-gradient(90deg,#ff4d9d,#7c4dff)}.vfb-arm-sw input:checked+span:before{transform:translateX(18px)}
  .vfb-arm-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 8px}.vfb-arm-wide{grid-column:span 1}
  .vfb-arm-grid label{display:block;font-size:9px;letter-spacing:.06em;text-transform:uppercase;color:#6f8fb0;margin-bottom:2px}
  .vfb-arm-in{width:100%;box-sizing:border-box;background:#0a121d;color:#fff;border:1px solid #2a3b55;border-radius:7px;padding:5px 7px;font-size:12px;min-width:0}
  .vfb-arm-step-w{display:flex;gap:4px;align-items:center}.vfb-arm-step-w .vfb-arm-in{text-align:center;flex:1}
  .vfb-arm-step{width:26px;height:26px;border:0;border-radius:50%;background:#1b2a44;color:#e6f1ff;font-size:15px;line-height:1;cursor:pointer;flex:0 0 auto}
  .vfb-arm-smart{display:flex!important;align-items:center;justify-content:center;gap:5px;align-self:end;height:28px;border:1px solid #2fa59a;border-radius:8px;color:#9ff3e6!important;font-size:11px!important;text-transform:none!important;cursor:pointer;margin:0!important}
  .vfb-arm-smart input{width:auto}`;
  document.head.appendChild(st);
}
function wireArmUI() {
  injectArmCss();
  uiContent.addEventListener('click', e => {
    const ar = e.target.closest && e.target.closest('.vfb-arm-arrow');
    if (ar) { e.stopPropagation(); const k = ar.dataset.k; _armOpen.has(k) ? _armOpen.delete(k) : _armOpen.add(k); renderUI(); return; }
    const st = e.target.closest && e.target.closest('.vfb-arm-step');
    if (st) {
      e.stopPropagation();
      const inp = st.parentElement.querySelector('.vfb-arm-in'), f = inp.dataset.f, k = inp.dataset.k;
      const v = Math.max(f === 'hits' ? 1 : 0, (parseInt(inp.value) || 0) + parseInt(st.dataset.d));
      inp.value = v; armCfg(k)[f] = v; save();
    }
  });
  uiContent.addEventListener('change', e => {
    const el = e.target; if (!el.classList) return;
    if (el.classList.contains('vfb-arm-on')) {
      const c = armCfg(el.dataset.k); c.on = el.checked; save(); delete _armCool[el.dataset.k];
      log(`🎯 Boss auto-hit ${el.checked ? 'ARMED' : 'off'}: ${el.dataset.k}`, '#7df3ff'); _timerForce = el.checked; renderUI(); return;
    }
    if (el.classList.contains('vfb-arm-in')) {
      const c = armCfg(el.dataset.k), f = el.dataset.f;
      if (f === 'cap') { const n = parseAmount(el.value); if (n != null) el.value = fullDmg(n); }
      c[f] = f === 'smart' ? el.checked : (f === 'hits' || f === 'max') ? Math.max(f === 'hits' ? 1 : 0, parseInt(el.value) || 0) : el.value;
      save();
    }
  });
}

function init() {
  purgeDomainCookies();   // remove the bad domain= duplicates older versions left
  buildUI();
  wireArmUI();
  try { parseLevel(document.body.innerHTML); } catch {}   // seed LV/EXP from the live page header
  renderUI();
  keepAwake();            // mobile: keep the screen on while the tab is in the foreground
  bgKeepAlive();          // v3.1: worker timers + web-lock + silent audio → runs in background tab / other app
  log(`🔧 Overlord Farmer (made by Overlord) v3.2.0 — ${paused ? '⏸ PAUSED (manual play — press ▶ to start farming)' : '▶ running'} · quests ${S.questEnabled?'ON':'OFF'} · auto-heal ${S.hpHealPct>0?`≤${S.hpHealPct}%`:'OFF'}`, '#9cf');
  dlog(`debug: precise tiers ≤x100 on threshold targets, free on farm trash · LSP(251) only (FSP never touched) · view cookies hide_dead=${getCookieRaw('hide_dead_monsters')} bossOnly=${getCookieRaw('show_dead_bosses_only')} · console: copy(window.__farmLog())`, '#778');
  // DIAGNOSTIC: dump the LIVE runtime targets (what the loop actually uses) so a
  // stale/duplicate dmgTarget is visible. console: copy(window.__farmConfig())
  try {
    window.__farmConfig = () => JSON.stringify(WAVES.map(w => ({
      id: w.id, label: w.label,
      targets: (w.targets || []).map(t => ({ key: t.key, label: t.label, dmgTarget: t.dmgTarget, timer: t.timer, killLimit: t.killLimit, include: t.include, exclude: t.exclude })),
    })), null, 2);
  } catch {}
  for (const w of WAVES) {
    for (const t of (w.targets || [])) {
      log(`📋 ${w.id} · ${t.timer ? '⏰' : '🎯'} ${t.label} → stop@${fmtDmg(t.dmgTarget)}${t.killLimit != null ? ` ·${t.killLimit}k` : ''}${(t.include && t.include.length) ? ` inc[${t.include.join(',')}]` : ''}${(t.exclude && t.exclude.length) ? ` exc[${t.exclude.join(',')}]` : ''}`, '#cb8');
    }
  }
  // AUTO-PvP: tab ⚔ PvP nel pannello (su ogni pagina). Il loop gira sempre ma agisce solo
  // quando S.pvp.enabled è ON; allora il farm va in pausa (guardia in mainLoop). Da spento
  // aggiorna comunque il conteggio token per il tab.
  log(`⚔ AutoPvP ${S.pvp.enabled ? 'ON (auto)' : 'OFF (open the ⚔ PvP tab)'} · classes learned: ${Object.keys(S.pvp.db.classes || {}).length}`, '#ff5c8a');
  // Built-in AutoPvP is replaced by the Auto PvP Matchmaking script (runs on pvp.php): keep it off here.
  S.pvp.enabled = false;
  { const pt = document.getElementById('vfb-tab-pvp'); if (pt) pt.style.display = 'none'; }
  mainLoop().catch(e => console.error('[FarmBot]', e));
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', init)
  : init();
    }


    /* ===== AUTO PVP MATCHMAKING v2.4.1 (Slayfer) — pasted exactly as-is; runs only on pvp.php =====
       The AntiThrottle library it @requires is pasted first, also unchanged. */
    function autoPvpMatchmaking() {
// ---- AntiThrottle.js (original) ----
// =========================================================================
// --- Web Worker Anti-Throttling Hack ---
// =========================================================================
(function bypassTimerThrottling() {
    // 1. The Worker code (runs in a separate background thread)
    const workerCode = `
        const timers = new Map();
        
        self.onmessage = function(e) {
            const { type, id, delay, isInterval } = e.data;
            
            if (type === 'start') {
                const timerFn = isInterval ? setInterval : setTimeout;
                const nativeId = timerFn(() => {
                    self.postMessage({ id });
                }, delay);
                timers.set(id, { nativeId, isInterval });
            } 
            else if (type === 'clear') {
                if (timers.has(id)) {
                    const { nativeId, isInterval } = timers.get(id);
                    if (isInterval) clearInterval(nativeId);
                    else clearTimeout(nativeId);
                    timers.delete(id);
                }
            }
        };
    `;

    // 2. Create the Worker from a Blob URL
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));

    // 3. Keep track of callbacks in the main thread
    let timerIdCounter = 0;
    const callbacks = new Map();

    worker.onmessage = function(e) {
        const id = e.data.id;
        if (callbacks.has(id)) {
            const { cb, isInterval } = callbacks.get(id);
            cb(); // Execute the callback
            if (!isInterval) callbacks.delete(id);
        }
    };

    // 4. Save original functions in case we need them
    const originalSetTimeout = window.setTimeout;
    const originalClearTimeout = window.clearTimeout;
    const originalSetInterval = window.setInterval;
    const originalClearInterval = window.clearInterval;

    // 5. Override native functions
    window.setTimeout = function(cb, delay, ...args) {
        const id = ++timerIdCounter;
        callbacks.set(id, { cb: () => cb(...args), isInterval: false });
        worker.postMessage({ type: 'start', id, delay: delay || 0, isInterval: false });
        return id;
    };

    window.clearTimeout = function(id) {
        callbacks.delete(id);
        worker.postMessage({ type: 'clear', id });
    };

    window.setInterval = function(cb, delay, ...args) {
        const id = ++timerIdCounter;
        callbacks.set(id, { cb: () => cb(...args), isInterval: true });
        worker.postMessage({ type: 'start', id, delay: delay || 0, isInterval: true });
        return id;
    };

    window.clearInterval = function(id) {
        callbacks.delete(id);
        worker.postMessage({ type: 'clear', id });
    };

    console.log("Anti-Throttling Web Worker initialized!");
})();
// ---- Auto PvP Matchmaking 2.4.1 (original) ----
(async function () {
  "use strict";
  try {
    // =========================================================================
    // --- Skills Dictionary ---
    // =========================================================================
    const PVP_SKILLS = {
      Base: {
        0: {
          name: "Slash",
          fullResource: false,
          resource: 0,
          cost: 0,
          type: "attack",
          target: "enemy",
          icon: "/images/skills/slash.webp",
        },
        "-1": {
          name: "Power Slash",
          fullResource: false,
          resource: 0,
          cost: 9,
          type: "attack",
          target: "enemy",
          icon: "/images/skills/power_slash.webp",
        },
      },
      Cleric: {
        Base: {
          8: {
            name: "Heal",
            fullResource: false,
            resource: 0,
            cost: 5,
            type: "support",
            target: "ally_alive",
            icon: "/images/skills/Heal.webp",
          },
          9: {
            name: "Judgment Seal",
            fullResource: false,
            resource: 0,
            cost: 3,
            type: "attack",
            target: "enemy",
            icon: "/images/skills/Judgment Seal.webp",
          },
          18: {
            name: "Sanctified Breach",
            fullResource: false,
            resource: 0,
            cost: 3,
            type: "support",
            target: "ally_alive",
            icon: "/images/skills/Sanctified Breach.webp",
          },
        },
        Saint: {},
        Inquisitor: {},
      },
      Hunter: {
        Base: {
          6: {
            name: "Back Stab",
            fullResource: false,
            resource: 0,
            cost: 3,
            type: "attack",
            target: "enemy",
            icon: "/images/skills/Back Stab.webp",
          },
          7: {
            name: "Killer Instinct",
            fullResource: false,
            resource: 0,
            cost: 5,
            type: "support",
            target: "enemy",
            icon: "/images/skills/Killer Instinct.webp",
          },
        },
        Assassin: {
          "adv:20": {
            name: "Final Wish",
            fullResource: true,
            resource: 100,
            cost: 15,
            type: "attack",
            target: "enemy",
            icon: "/images/advanced_classes/skills/final_wish.webp",
          },
        },
        Archer: {},
      },
      Mage: {
        Base: {
          4: {
            name: "Fireball",
            fullResource: false,
            resource: 0,
            cost: 6,
            type: "attack",
            target: "enemy",
            icon: "/images/skills/fireball.webp",
          },
          5: {
            name: "Arcane Sacrifice",
            fullResource: false,
            resource: 0,
            cost: 2,
            type: "attack",
            target: "enemy",
            icon: "/images/skills/arcane_sacrifice.webp",
          },
        },
        Grandmage: {
          "adv:9": {
            name: "Meteor Sigil",
            fullResource: false,
            resource: 0,
            cost: 6,
            type: "attack",
            target: "enemy",
            icon: "/images/advanced_classes/skills/mana_collapse.webp",
          },
          "adv:10": {
            name: "Mana Collapse",
            fullResource: false,
            resource: 0,
            cost: 12,
            type: "attack",
            target: "enemy",
            icon: "/images/advanced_classes/skills/mana_collapse.webp",
          },
          "adv:11": {
            name: "Elemental Dominion",
            fullResource: true,
            resource: 5,
            cost: 8,
            type: "attack",
            target: "enemy",
            icon: "/images/advanced_classes/skills/elemental_dominion.webp",
          },
          "adv:12": {
            name: "Astral Cataclysm",
            fullResource: true,
            resource: 100,
            cost: 15,
            type: "attack",
            target: "enemy",
            icon: "/images/advanced_classes/skills/astral_cataclysm.webp",
          },
        },
        "Magic Knight": {},
      },
      Warrior: {
        Base: {
          2: {
            name: "Ironclad Strike",
            fullResource: false,
            resource: 0,
            cost: 6,
            type: "attack",
            target: "enemy",
            icon: "/images/skills/Ironclad Strike.webp",
          },
          3: {
            name: "Warrior Aura",
            fullResource: false,
            resource: 0,
            cost: 6,
            type: "attack",
            target: "enemy",
            icon: "/images/skills/Warrior Aura.webp",
          },
          19: {
            name: "Blood Pact",
            fullResource: false,
            resource: 0,
            cost: 5,
            type: "attack",
            target: "enemy",
            icon: "/images/skills/blood_pact.webp",
          },
          20: {
            name: "Taunt",
            fullResource: false,
            resource: 0,
            cost: 10,
            type: "attack",
            target: "enemy",
            icon: "/images/skills/taunt.webp",
          },
        },
        Berserker: {},
        Paladin: {
          "adv:1": {
            name: "Radiant Guard",
            fullResource: false,
            resource: 0,
            cost: 8,
            type: "attack",
            target: "enemy",
            icon: "/images/advanced_classes/skills/radiant_guard.webp",
          },
          "adv:2": {
            name: "Judgment Bash",
            fullResource: false,
            resource: 0,
            cost: 5,
            type: "attack",
            target: "enemy",
            icon: "/images/advanced_classes/skills/judgment_bash.webp",
          },
          "adv:3": {
            name: "Aegis Intervention",
            fullResource: false,
            resource: 0,
            cost: 6,
            type: "attack",
            target: "enemy",
            icon: "/images/advanced_classes/skills/aegis_intervention.webp",
          },
          "adv:4": {
            name: "Sanctified Berdict",
            fullResource: true,
            resource: 100,
            cost: 12,
            type: "attack",
            target: "enemy",
            icon: "/images/advanced_classes/skills/sanctified_verdict.webp",
          },
        },
      },
    };

    const ALL_SKILLS = {};
    for (const [cls, advClasses] of Object.entries(PVP_SKILLS)) {
      if (cls === "Base") {
        Object.assign(ALL_SKILLS, advClasses);
      } else {
        for (const [advCls, skills] of Object.entries(advClasses)) {
          Object.assign(ALL_SKILLS, skills);
        }
      }
    }

    // =========================================================================
    // --- Config & State ---
    // =========================================================================
    const DEFAULT_PVP_CONFIG = {
      baseClass: "Base",
      advancedClass: "Base",
      basicSkillId: "0",
      chosenSkillId: "9",
      supportSkillId: "8",
      classMemory: {}, // Store memory of selections: classMemory['Mage_Grandmage'] = { basic: '0', main: 'adv10', supp: '5' }
      healThreshold: 50,
      autoQueue: true,
      pollInterval: 1000,
      allowAnySkill: false,
      soundMatchEnd: true,
      soundNoTokens: true,
      retryNoTokens: false,
      showStandbyWarning: true,
    };

    let config = await GM.getValue("veyra_pvp2_config", null);
    config = { ...DEFAULT_PVP_CONFIG, ...(config || {}) };

    let isRunning = await GM.getValue("veyra_pvp2_running", false);
    let matchId = null;
    let sinceLogId = 0;
    let enemyTargetKey = null;
    let myTargetKey = null;
    let abortController = null;
    let myTabId = sessionStorage.getItem("veyra_pvp2_tab_id");
    const navType = performance.getEntriesByType("navigation")[0]?.type;

    // If the tab was duplicated, it copies the sessionStorage but triggers a 'navigate' event.
    // We only trust the saved ID if this was a strict 'reload' (F5 refresh).
    if (!myTabId || navType !== "reload") {
      myTabId = Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem("veyra_pvp2_tab_id", myTabId);
    }

    // Live match state for resumption
    let activeMatchState = await GM.getValue("veyra_pvp2_active_match", null);
    if (!activeMatchState)
      activeMatchState = { matchId: null, turnCount: 0, skillUsage: {} };

    // Session stats & History
    let sessionStats = await GM.getValue("veyra_pvp2_stats", null);
    if (!sessionStats)
      sessionStats = {
        matches: 0,
        wins: 0,
        losses: 0,
        history: [],
        globalSkills: {},
      };
    if (!sessionStats.globalSkills) sessionStats.globalSkills = {};

    async function saveStats() {
      await GM.setValue("veyra_pvp2_stats", sessionStats);
    }
    async function saveConfig() {
      await GM.setValue("veyra_pvp2_config", config);
    }
    async function saveActiveMatch() {
      await GM.setValue("veyra_pvp2_active_match", activeMatchState);
    }

    let isMaster = false;
    // Lock logic is now handled by initLockManager at the bottom

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    function getCookie(name) {
      const value = "; " + document.cookie;
      const parts = value.split("; " + name + "=");
      if (parts.length === 2) return parts.pop().split(";").shift();
      return null;
    }

    // =========================================================================
    // --- Audio ---
    // =========================================================================
    function playChime() {
      if (!config.soundMatchEnd) return;
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const playTone = (freq, time, dur) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = "sine";
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0, time);
          gain.gain.linearRampToValueAtTime(0.5, time + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.01, time + dur);
          osc.start(time);
          osc.stop(time + dur);
        };
        const now = ctx.currentTime;
        playTone(523.25, now, 0.4);
        playTone(659.25, now + 0.2, 0.6);
      } catch (e) {}
    }

    function playErrorBeep() {
      if (!config.soundNoTokens) return;
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        osc.type = "square";
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      } catch (e) {}
    }

    // =========================================================================
    // --- UI ---
    // =========================================================================
    async function setupUI() {
      let savedUI = await GM.getValue("veyra_pvp2_ui", null);
      if (!savedUI || typeof savedUI !== "object") savedUI = {};
      if (!savedUI.left) savedUI.left = "calc(100vw - 420px)";
      if (!savedUI.top) savedUI.top = "50px";
      if (!savedUI.width) savedUI.width = "400px";
      if (savedUI.minimized === undefined) savedUI.minimized = false;
      if (!savedUI.activeTab) savedUI.activeTab = "matchmaking";

      const css = `
        #pvp-container {
            position: fixed;
            top: ${savedUI.top};
            left: ${savedUI.left};
            width: ${savedUI.width};
            min-width: 350px;
            background: rgba(15, 12, 20, 0.95);
            border: 1px solid rgba(241, 201, 107, 0.6);
            border-radius: 12px;
            color: #f8ead2;
            font-family: Georgia, "Times New Roman", serif;
            z-index: 999999;
            display: flex;
            flex-direction: column;
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(12px);
            resize: horizontal;
            overflow: hidden;
            font-size: 13px;
        }
        #pvp-header {
            background: rgba(0,0,0,0.3);
            padding: 10px 14px;
            cursor: grab;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            user-select: none;
        }
        #pvp-header:active { cursor: grabbing; }
        #pvp-title { font-weight: bold; font-size: 15px; color: #ffd88a; }
        .pvp-btn-minimize { background: none; border: none; color: #d9b66f; cursor: pointer; font-size: 18px; font-weight: bold; }
        .pvp-btn-minimize:hover { color: white; }

        .pvp-tabs { display: flex; border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.02); }
        .pvp-tab { padding: 8px 16px; cursor: pointer; font-weight: bold; color: #cdbfba; transition: 0.2s; border-bottom: 2px solid transparent; flex:1; text-align:center;}
        .pvp-tab:hover { color: #f8ead2; background: rgba(255,255,255,0.05); }
        .pvp-tab.active { color: #ffd88a; border-bottom-color: #d9b66f; background: rgba(255,255,255,0.08); }

        #pvp-content { padding: 12px; max-height: 70vh; overflow-y: auto; }
        .pvp-minimized #pvp-content, .pvp-minimized .pvp-tabs { display: none; }

        .pvp-tab-content { display: none; flex-direction: column; gap: 12px; }
        .pvp-tab-content.active { display: flex; }

        .pvp-section { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px; }
        .pvp-section-title { font-weight: bold; font-size: 11px; text-transform: uppercase; color: #d9b66f; margin-bottom: 8px; }

        .pvp-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
        .pvp-row label { font-size: 12px; color: #cdbfba; flex: 1; }
        .pvp-row select, .pvp-row input[type="number"] {
            background: #221b28; color: #f8ead2; border: 1px solid #555; padding: 5px; border-radius: 4px; flex: 1;
        }

        .pvp-checkbox-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }

        #pvp-status-box {
            background: #110e14; border: 1px solid #444; border-radius: 4px; padding: 8px; font-size: 11px;
            color: #cdbfba; height: 120px; overflow-y: auto; font-family: monospace; line-height: 1.4;
        }
        .pvp-status-action { color: #6db3f2; }
        .pvp-status-good { color: #4ade80; }
        .pvp-status-bad { color: #f87171; }
        .pvp-status-info { color: #fbbf24; }

        .pvp-btn {
            padding: 8px 14px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; width: 100%; transition: 0.2s;
        }
        .pvp-btn-start { background: #d9b66f; color: #1b1210; }
        .pvp-btn-start:hover { background: #ffd88a; }
        .pvp-btn-stop { background: #cf2d45; color: white; }
        .pvp-btn-stop:hover { background: #ef4444; }

        .pvp-history-item { background: rgba(255,255,255,0.05); padding: 8px; border-radius: 6px; margin-bottom: 6px; font-size: 12px;}
        .pvp-history-win { border-left: 4px solid #4ade80; }
        .pvp-history-loss { border-left: 4px solid #f87171; }
        `;
      const styleEl = document.createElement("style");
      styleEl.textContent = css;
      document.head.appendChild(styleEl);

      const getFilteredSkillsArr = () => {
        let arr = Object.entries(PVP_SKILLS["Base"]);
        if (config.baseClass !== "Base" && PVP_SKILLS[config.baseClass]) {
          if (PVP_SKILLS[config.baseClass]["Base"]) {
            arr = arr.concat(
              Object.entries(PVP_SKILLS[config.baseClass]["Base"]),
            );
          }
          if (
            config.advancedClass !== "Base" &&
            PVP_SKILLS[config.baseClass][config.advancedClass]
          ) {
            arr = arr.concat(
              Object.entries(
                PVP_SKILLS[config.baseClass][config.advancedClass],
              ),
            );
          }
        }
        return arr;
      };

      const getOpts = (filterFn, selectedId) =>
        getFilteredSkillsArr()
          .filter(filterFn)
          .map(
            ([id, s]) =>
              '<option value="' +
              id +
              '"' +
              (selectedId === id ? " selected" : "") +
              ">" +
              s.name +
              " (" +
              s.cost +
              ")" +
              "</option>",
          )
          .join("");

      const container = document.createElement("div");
      container.id = "pvp-container";
      if (savedUI.minimized) container.classList.add("pvp-minimized");

      container.innerHTML = `
            <div id="pvp-header">
                <div id="pvp-title">⚔️ AutoPvP 2.0</div>
                <button class="pvp-btn-minimize" id="pvp-toggle-min">${savedUI.minimized ? "+" : "×"}</button>
            </div>
            <div class="pvp-tabs">
                <div class="pvp-tab ${savedUI.activeTab === "matchmaking" ? "active" : ""}" data-tab="matchmaking">Match</div>
                <div class="pvp-tab ${savedUI.activeTab === "history" ? "active" : ""}" data-tab="history">Historial</div>
                <div class="pvp-tab ${savedUI.activeTab === "config" ? "active" : ""}" data-tab="config">Config</div>
            </div>
            <div id="pvp-content">

                <div class="pvp-tab-content ${savedUI.activeTab === "matchmaking" ? "active" : ""}" id="tab-matchmaking">
                    <div class="pvp-section" style="display:flex; justify-content:space-between; font-weight:bold;">
                        <span style="color:#4ade80" id="pvp-my-hp">Me: ?/?</span>
                        <span style="color:#f87171" id="pvp-enemy-hp">Enemy: ?/?</span>
                    </div>
                    <div class="pvp-section">
                        <div class="pvp-section-title">Live Status</div>
                        <div id="pvp-status-box">Idle.</div>
                    </div>
                    <div class="pvp-section">
                        <div class="pvp-section-title">Session Skills Used</div>
                        <div id="pvp-global-skills-match" style="font-size:12px; color:#cdbfba;"></div>
                    </div>
                    <button id="pvp-start-btn" class="pvp-btn ${isRunning ? "pvp-btn-stop" : "pvp-btn-start"}">${isRunning ? "Stop AutoPvP" : "Start AutoPvP"}</button>
                </div>

                <div class="pvp-tab-content ${savedUI.activeTab === "history" ? "active" : ""}" id="tab-history">
                    <div class="pvp-section" style="display:flex; justify-content:space-around; font-size:14px; font-weight:bold;">
                        <span>Total: <span id="hist-total">${sessionStats.matches}</span></span>
                        <span style="color:#4ade80">W: <span id="hist-wins">${sessionStats.wins}</span></span>
                        <span style="color:#f87171">L: <span id="hist-losses">${sessionStats.losses}</span></span>
                    </div>
                    <div class="pvp-section">
                        <div class="pvp-section-title">Session Skills Used</div>
                        <div id="pvp-global-skills-hist" style="font-size:12px; color:#cdbfba;"></div>
                    </div>
                    <button id="pvp-clear-hist" class="pvp-btn" style="background:#444; color:white; padding:4px;">Clear History</button>
                    <div id="pvp-history-list" style="margin-top:10px;"></div>
                </div>

                <div class="pvp-tab-content ${savedUI.activeTab === "config" ? "active" : ""}" id="tab-config">
                    <div class="pvp-section">
                        <div class="pvp-section-title">Class Filters</div>
                        <div class="pvp-row">
                            <label>Base Class</label>
                            <select id="pvp-base-class">
                                ${Object.keys(PVP_SKILLS)
                                  .map(
                                    (k) =>
                                      `<option value="${k}" ${config.baseClass === k ? "selected" : ""}>${k}</option>`,
                                  )
                                  .join("")}
                            </select>
                        </div>
                        <div class="pvp-row">
                            <label>Advanced Class</label>
                            <select id="pvp-adv-class"></select>
                        </div>
                        <div class="pvp-section-title" style="margin-top:10px;">Combat Skills</div>
                        <div class="pvp-row">
                            <label>Basic Attack (0-cost)</label>
                            <select id="pvp-basic">${getOpts(([, s]) => s.cost === 0, config.basicSkillId)}</select>
                        </div>
                        <div class="pvp-row">
                            <label>Main Skill</label>
                            <select id="pvp-main">${getOpts(([, s]) => config.allowAnySkill || s.type === "attack", config.chosenSkillId)}</select>
                        </div>
                        <div class="pvp-row">
                            <label>Support Skill</label>
                            <select id="pvp-support">${getOpts(([, s]) => config.allowAnySkill || s.type === "support", config.supportSkillId)}</select>
                        </div>
                        <div class="pvp-row">
                            <label>Support HP %</label>
                            <input type="number" id="pvp-threshold" value="${config.healThreshold}" min="0" max="100">
                        </div>
                        <div class="pvp-checkbox-row">
                            <input type="checkbox" id="pvp-any-skill" ${config.allowAnySkill ? "checked" : ""}>
                            <label>Allow any skill on any field</label>
                        </div>
                    </div>
                    <div class="pvp-section">
                        <div class="pvp-section-title">System</div>
                        <div class="pvp-checkbox-row">
                            <input type="checkbox" id="pvp-autoqueue" ${config.autoQueue ? "checked" : ""}>
                            <label>Auto-queue next match</label>
                        </div>
                        <div class="pvp-checkbox-row">
                            <input type="checkbox" id="pvp-sound-end" ${config.soundMatchEnd ? "checked" : ""}>
                            <label>Play sound on Match End</label>
                        </div>
                        <div class="pvp-checkbox-row">
                            <input type="checkbox" id="pvp-sound-tokens" ${config.soundNoTokens ? "checked" : ""}>
                            <label>Play sound when Out of Tokens</label>
                        </div>
                        <div class="pvp-checkbox-row">
                            <input type="checkbox" id="pvp-retry-tokens" ${config.retryNoTokens ? "checked" : ""}>
                            <label>Keep retrying when Out of Tokens (checks every 60s)</label>
                        </div>
                        <div class="pvp-checkbox-row">
                            <input type="checkbox" id="pvp-standby-warn" ${config.showStandbyWarning ? "checked" : ""}>
                            <label>Show visual warning on Standby tabs</label>
                        </div>
                    </div>
                </div>

            </div>
        `;
      document.body.appendChild(container);

      const updateAdvClassDropdown = () => {
        const advSelect = document.getElementById("pvp-adv-class");
        if (!advSelect) return;

        const advClasses = Object.keys(
          PVP_SKILLS[config.baseClass] || {},
        ).filter((k) => k !== "Base");

        let html = `<option value="Base" ${config.advancedClass === "Base" ? "selected" : ""}>Base (None)</option>`;

        if (config.baseClass !== "Base") {
          advClasses.forEach((c) => {
            html += `<option value="${c}" ${config.advancedClass === c ? "selected" : ""}>${c}</option>`;
          });
        }

        advSelect.innerHTML = html;
      };
      updateAdvClassDropdown();

      const updateSkillsDropdowns = async () => {
        const memKey = config.baseClass + "_" + config.advancedClass;

        if (config.classMemory[memKey]) {
          if (config.classMemory[memKey].basic)
            config.basicSkillId = config.classMemory[memKey].basic;
          if (config.classMemory[memKey].main)
            config.chosenSkillId = config.classMemory[memKey].main;
          if (config.classMemory[memKey].supp)
            config.supportSkillId = config.classMemory[memKey].supp;
        }

        const arr = getFilteredSkillsArr();
        const ensureValid = (currentId, filterFn) => {
          const validIds = arr.filter(filterFn).map((x) => x[0]);
          if (validIds.includes(currentId)) return currentId;
          return validIds.length > 0 ? validIds[0] : "";
        };

        config.basicSkillId = ensureValid(
          config.basicSkillId,
          ([, s]) => s.cost === 0,
        );
        config.chosenSkillId = ensureValid(
          config.chosenSkillId,
          ([, s]) => config.allowAnySkill || s.type === "attack",
        );
        config.supportSkillId = ensureValid(
          config.supportSkillId,
          ([, s]) => config.allowAnySkill || s.type === "support",
        );

        document.getElementById("pvp-basic").innerHTML = getOpts(
          ([, s]) => s.cost === 0,
          config.basicSkillId,
        );
        document.getElementById("pvp-main").innerHTML = getOpts(
          ([, s]) => config.allowAnySkill || s.type === "attack",
          config.chosenSkillId,
        );
        document.getElementById("pvp-support").innerHTML = getOpts(
          ([, s]) => config.allowAnySkill || s.type === "support",
          config.supportSkillId,
        );

        await saveConfig();
      };

      // Initial update to ensure valid selections
      updateSkillsDropdowns(); // Non-blocking is fine here on init

      document.getElementById("pvp-base-class").onchange = async (e) => {
        config.baseClass = e.target.value;
        if (!config.advClassMemory) config.advClassMemory = {};
        config.advancedClass =
          config.advClassMemory[config.baseClass] || "Base";
        updateAdvClassDropdown();
        await updateSkillsDropdowns();
      };

      document.getElementById("pvp-adv-class").onchange = async (e) => {
        config.advancedClass = e.target.value;
        if (!config.advClassMemory) config.advClassMemory = {};
        config.advClassMemory[config.baseClass] = config.advancedClass;
        await updateSkillsDropdowns();
      };

      renderHistory();
      renderGlobalSkills();

      // Drag
      const header = document.getElementById("pvp-header");
      let isDragging = false,
        startX,
        startY,
        initialX,
        initialY;

      // Bounds Checking
      const checkBounds = () => {
        const rect = container.getBoundingClientRect();
        let newTop = rect.top;
        let newLeft = rect.left;
        let changed = false;

        console.log(
          "Checking bounds: ",
          rect,
          window.innerWidth,
          window.innerHeight,
        );
        console.log("Current position: ", newLeft, newTop);

        // Prevent left side from going off-screen
        if (newLeft < 0) {
          newLeft = 20;
          changed = true;
        }
        // Prevent right side from going off-screen
        else if (newLeft + rect.width > window.innerWidth) {
          newLeft = Math.max(20, window.innerWidth - rect.width - 40);
          changed = true;
        }

        // Prevent top from going off-screen
        if (newTop < 0) {
          newTop = 20;
          changed = true;
        }
        // Prevent bottom from going off-screen
        else if (newTop + rect.height > window.innerHeight) {
          newTop = Math.max(20, window.innerHeight - rect.height - 20);
          changed = true;
        }

        if (changed) {
          container.style.top = newTop + "px";
          container.style.left = newLeft + "px";
        }

        console.log(
          "Checking bounds 2: ",
          rect,
          window.innerWidth,
          window.innerHeight,
        );
        console.log("Current position 2: ", newLeft, newTop);

        return changed;
      };

      header.onpointerdown = (e) => {
        if (e.target.id === "pvp-toggle-min") return;
        e.preventDefault();
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialX = container.offsetLeft;
        initialY = container.offsetTop;
        header.style.cursor = "grabbing";
        try {
          header.setPointerCapture(e.pointerId);
        } catch (err) {}
      };

      header.onpointermove = (e) => {
        if (!isDragging) return;
        container.style.left = initialX + e.clientX - startX + "px";
        container.style.top = initialY + e.clientY - startY + "px";
      };

      const stopDrag = async (e) => {
        if (!isDragging) return;
        isDragging = false;
        header.style.cursor = "grab";
        try {
          header.releasePointerCapture(e.pointerId);
        } catch (err) {}

        checkBounds(); // Keep it in bounds when let go

        if (container.style.left) savedUI.left = container.style.left;
        if (container.style.top) savedUI.top = container.style.top;
        await GM.setValue("veyra_pvp2_ui", savedUI);
      };

      header.onpointerup = stopDrag;
      header.onpointercancel = stopDrag;

      // Check bounds on load and resize
      const enforceBounds = () => {
        if (checkBounds()) {
          savedUI.left = container.style.left;
          savedUI.top = container.style.top;
          GM.setValue("veyra_pvp2_ui", savedUI);
        }
      };
      enforceBounds();
      setTimeout(enforceBounds, 500);
      window.addEventListener("resize", enforceBounds);

      // Tabs
      document.querySelectorAll(".pvp-tab").forEach((tab) => {
        tab.onclick = async () => {
          document
            .querySelectorAll(".pvp-tab, .pvp-tab-content")
            .forEach((el) => el.classList.remove("active"));
          tab.classList.add("active");
          const tName = tab.getAttribute("data-tab");
          document.getElementById("tab-" + tName).classList.add("active");
          savedUI.activeTab = tName;
          await GM.setValue("veyra_pvp2_ui", savedUI);
        };
      });

      // Min/Max
      document.getElementById("pvp-toggle-min").onclick = async () => {
        container.classList.toggle("pvp-minimized");
        savedUI.minimized = container.classList.contains("pvp-minimized");
        document.getElementById("pvp-toggle-min").innerText = savedUI.minimized
          ? "+"
          : "×";
        await GM.setValue("veyra_pvp2_ui", savedUI);
      };

      // Start/Stop
      document.getElementById("pvp-start-btn").onclick = async (e) => {
        isRunning = !isRunning;
        await GM.setValue("veyra_pvp2_running", isRunning);
        e.target.innerText = isRunning ? "Stop AutoPvP" : "Start AutoPvP";
        e.target.className = isRunning
          ? "pvp-btn pvp-btn-stop"
          : "pvp-btn pvp-btn-start";
        if (isRunning) mainLoop();
        else if (abortController) abortController.abort();
      };

      // Config Listeners
      const listen = (id, key, isCheckbox, isNum) => {
        document.getElementById(id).onchange = async (e) => {
          let val = isCheckbox ? e.target.checked : e.target.value;
          if (isNum) val = Number(val);
          config[key] = val;

          if (
            ["basicSkillId", "chosenSkillId", "supportSkillId"].includes(key)
          ) {
            const memKey = config.baseClass + "_" + config.advancedClass;
            if (!config.classMemory[memKey]) config.classMemory[memKey] = {};
            if (key === "basicSkillId") config.classMemory[memKey].basic = val;
            if (key === "chosenSkillId") config.classMemory[memKey].main = val;
            if (key === "supportSkillId") config.classMemory[memKey].supp = val;
          }

          await saveConfig();

          // If 'any skill' changed, re-render dropdowns
          if (key === "allowAnySkill") {
            await updateSkillsDropdowns();
          }
        };
      };
      listen("pvp-basic", "basicSkillId", false, false);
      listen("pvp-main", "chosenSkillId", false, false);
      listen("pvp-support", "supportSkillId", false, false);
      listen("pvp-threshold", "healThreshold", false, true);
      listen("pvp-any-skill", "allowAnySkill", true, false);
      listen("pvp-autoqueue", "autoQueue", true, false);
      listen("pvp-sound-end", "soundMatchEnd", true, false);
      listen("pvp-sound-tokens", "soundNoTokens", true, false);
      listen("pvp-retry-tokens", "retryNoTokens", true, false);
      listen("pvp-standby-warn", "showStandbyWarning", true, false);

      // Clear History
      document.getElementById("pvp-clear-hist").onclick = async () => {
        sessionStats.matches = 0;
        sessionStats.wins = 0;
        sessionStats.losses = 0;
        sessionStats.history = [];
        sessionStats.globalSkills = {};
        await saveStats();
        document.getElementById("hist-total").innerText = 0;
        document.getElementById("hist-wins").innerText = 0;
        document.getElementById("hist-losses").innerText = 0;
        renderHistory();
        renderGlobalSkills();
      };
    }

    function renderHistory() {
      const list = document.getElementById("pvp-history-list");
      if (!list) return;
      if (sessionStats.history.length === 0) {
        list.innerHTML =
          '<div style="opacity:0.5; text-align:center;">No history yet.</div>';
        return;
      }
      list.innerHTML = sessionStats.history
        .map((m) => {
          const cls =
            m.result === "Win" ? "pvp-history-win" : "pvp-history-loss";
          const resColor = m.result === "Win" ? "#4ade80" : "#f87171";
          const skillsStr =
            Object.entries(m.skills).length > 0
              ? '<ul style="margin: 2px 0 0 15px; padding: 0;">' +
                Object.entries(m.skills)
                  .map(([k, v]) => `<li>${ALL_SKILLS[k]?.name || k} x${v}</li>`)
                  .join("") +
                "</ul>"
              : "None";
          return `
                <div class="pvp-history-item ${cls}">
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                        <strong>Match #${m.id}</strong>
                        <span style="color:${resColor}; font-weight:bold;">${m.result}</span>
                    </div>
                    <div style="color:#cdbfba;">Turns: ${m.turns} | Time: ${m.time}</div>
                    <div style="color:#94a3b8; font-size:11px; margin-top:4px;">Skills: ${skillsStr}</div>
                </div>
            `;
        })
        .join("");
    }

    function renderGlobalSkills() {
      const skillsStr =
        Object.entries(sessionStats.globalSkills || {}).length > 0
          ? '<ul style="margin: 2px 0 0 15px; padding: 0;">' +
            Object.entries(sessionStats.globalSkills)
              .map(([k, v]) => `<li>${ALL_SKILLS[k]?.name || k} x${v}</li>`)
              .join("") +
            "</ul>"
          : "None";

      const mBox = document.getElementById("pvp-global-skills-match");
      const hBox = document.getElementById("pvp-global-skills-hist");
      if (mBox) mBox.innerHTML = skillsStr;
      if (hBox) hBox.innerHTML = skillsStr;
    }

    // =========================================================================
    // --- UI Helpers ---
    // =========================================================================
    function setStatus(text, cssClass) {
      const box = document.getElementById("pvp-status-box");
      if (!box) return;
      const cls = cssClass ? ` class="pvp-status-${cssClass}"` : "";
      box.innerHTML = `<p${cls}>${text}</p>`;
      box.scrollTop = box.scrollHeight;
    }

    function appendStatus(text, cssClass) {
      const box = document.getElementById("pvp-status-box");
      if (!box) return;
      const ps = box.querySelectorAll("p");
      if (ps.length >= 15) ps[0].remove();
      const p = document.createElement("p");
      if (cssClass) p.className = `pvp-status-${cssClass}`;
      p.textContent = text;
      p.style.margin = "2px 0";
      box.appendChild(p);
      box.scrollTop = box.scrollHeight;
    }

    function updateHealthUI(myHp, myMax, enemyHp, enemyMax) {
      const el1 = document.getElementById("pvp-my-hp");
      const el2 = document.getElementById("pvp-enemy-hp");
      if (el1 && myMax) el1.textContent = `Me: ${myHp}/${myMax}`;
      if (el2 && enemyMax) el2.textContent = `Enemy: ${enemyHp}/${enemyMax}`;
    }

    function pushHistory(matchId, resultStr, turnCount, skillUsageObj) {
      sessionStats.matches++;
      if (resultStr === "Win") sessionStats.wins++;
      else sessionStats.losses++;

      sessionStats.history.unshift({
        id: matchId,
        result: resultStr,
        turns: turnCount,
        skills: JSON.parse(JSON.stringify(skillUsageObj)),
        time: new Date().toLocaleTimeString(),
      });
      if (sessionStats.history.length > 10) sessionStats.history.pop();

      document.getElementById("hist-total").innerText = sessionStats.matches;
      document.getElementById("hist-wins").innerText = sessionStats.wins;
      document.getElementById("hist-losses").innerText = sessionStats.losses;
      renderHistory();
      saveStats(); // Note: No await here but it's safe to run in background
    }

    // =========================================================================
    // --- API Functions (with robust error handling) ---
    // =========================================================================
    const BASE_URL = "https://demonicscans.org";

    async function safeFetch(url, options) {
      try {
        const resp = await fetch(url, options);
        let data = null;
        try {
          data = await resp.json();
        } catch (e) {}

        if (!resp.ok) {
          return {
            status: "error",
            message: (data && data.error) ? data.error : (data && data.message ? data.message : `HTTP Error ${resp.status}`),
            error: data && data.error ? data.error : null,
            ok: false,
          };
        }
        return data || { status: "success" };
      } catch (e) {
        return {
          status: "error",
          message: e.message || "Network Timeout/Failure",
          error: e.message,
          ok: false,
        };
      }
    }

    async function apiPost(endpoint, bodyParams) {
      const body = Object.entries(bodyParams)
        .map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v))
        .join("&");
      return safeFetch(BASE_URL + "/" + endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          "x-requested-with": "XMLHttpRequest",
        },
        body: body,
        credentials: "include",
      });
    }

    async function apiGet(endpoint, params) {
      const qs = Object.entries(params)
        .map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v))
        .join("&");
      return safeFetch(BASE_URL + "/" + endpoint + "?" + qs, {
        method: "GET",
        credentials: "include",
      });
    }

    // =========================================================================
    // --- Skill Decision Logic ---
    // =========================================================================
    function decideSkill(meData, teamsData) {
      let myPlayer = null;
      Object.values(teamsData.ally.players_by_num).forEach((p) => {
        if (String(p.user_id) === String(getCookie("demon"))) myPlayer = p;
      });
      if (!myPlayer) myPlayer = Object.values(teamsData.ally.players_by_num)[0];

      const tokens = meData.tokens;
      const resources = meData.advanced_resource;
      const maxResources = meData.advanced_resource_max;
      const resourcesName = meData.advanced_resource_name;
      const hpPct = (myPlayer.hp / myPlayer.hp_max) * 100;

      const chosenSkill = ALL_SKILLS[config.chosenSkillId];
      const supportSkill = ALL_SKILLS[config.supportSkillId];
      const basicSkill = ALL_SKILLS[config.basicSkillId] || ALL_SKILLS["0"];

      if (supportSkill && hpPct <= config.healThreshold) {
        if (
          tokens >= supportSkill.cost &&
          resources >= supportSkill.resource &&
          (supportSkill.fullResource ? resources >= maxResources : true)
        ) {
          const target =
            supportSkill.target === "ally_alive" ? myTargetKey : enemyTargetKey;
          return {
            id: config.supportSkillId,
            target,
            reason: `HP low (${Math.round(hpPct)}%), using support`,
          };
        } else {
          const target =
            basicSkill.target === "ally_alive" ? myTargetKey : enemyTargetKey;
          const reason = `Building up resources for support (${resourcesName}: ${resources}/${supportSkill.resource}, tokens: ${tokens}/${supportSkill.cost})`;
          return { id: config.basicSkillId, target, reason };
        }
      }

      if (
        chosenSkill &&
        tokens >= chosenSkill.cost &&
        resources >= chosenSkill.resource &&
        (chosenSkill.fullResource ? resources >= maxResources : true)
      ) {
        const target =
          chosenSkill.target === "ally_alive" ? myTargetKey : enemyTargetKey;
        return {
          id: config.chosenSkillId,
          target,
          reason: `Using ${chosenSkill.name} (${tokens}t, ${resourcesName}: ${resources}/${maxResources})`,
        };
      }

      const basicTarget =
        basicSkill.target === "ally_alive" ? myTargetKey : enemyTargetKey;
      return {
        id: config.basicSkillId,
        target: basicTarget,
        reason: `Restoring tokens (${tokens}t) and resources (${resourcesName}: ${resources}/${maxResources})`,
      };
    }

    // =========================================================================
    // --- Main Loop ---
    // =========================================================================
    async function mainLoop() {
      abortController = new AbortController();

      while (isRunning) {
        try {
          // ---- Matchmaking / Resumption ----
          if (!activeMatchState.matchId) {
            setStatus("Starting matchmaking...", "info");
            const mmResult = await apiPost("pvp_matchmake.php", {
              ladder: "solo",
            });

            // If the server gives us a match_id, we can proceed even if status is 'error' (e.g. "already in an active match")
            if (mmResult.status !== "success" && !mmResult.match_id) {
              const msg = mmResult.message || mmResult.error || "Network failure";
              setStatus("Matchmaking failed: " + msg, "bad");

              // Check for 'no tokens'/'no energy'
              if (
                msg.toLowerCase().includes("token") ||
                msg.toLowerCase().includes("energy") ||
                msg.toLowerCase().includes("no pvp tokens left")
              ) {
                if (config.retryNoTokens) {
                  appendStatus("Out of Tokens! Retrying in 60s...", "info");
                  playErrorBeep();
                  await sleep(60000);
                  continue;
                } else {
                  appendStatus("Out of PvP Tokens! Stopping.", "bad");
                  playErrorBeep();
                  document.getElementById("pvp-start-btn").click(); // Turn off visually and logically
                  break;
                }
              }

              await sleep(3000);
              continue;
            }

            activeMatchState.matchId = mmResult.match_id;
            activeMatchState.turnCount = 0;
            activeMatchState.skillUsage = {};
            await saveActiveMatch();

            if (
              mmResult.status !== "success" ||
              (mmResult.message && mmResult.message.includes("active match"))
            ) {
              appendStatus(
                "Rejoining active match #" + activeMatchState.matchId,
                "info",
              );
            } else {
              appendStatus("Match found! #" + activeMatchState.matchId, "good");
            }
          } else {
            appendStatus(
              "Resuming existing match #" + activeMatchState.matchId,
              "info",
            );
          }

          matchId = activeMatchState.matchId;
          sinceLogId = 0;

          // ---- Initial state poll ----
          await sleep(1000);
          const initState = await apiGet("pvp_battle_state.php", {
            match_id: matchId,
            since_log_id: sinceLogId,
          });

          // If the server says the match doesn't exist anymore, reset it
          const errorMsg = (initState.message || initState.error || "").toLowerCase();
          if (
            !initState ||
            (initState.status === "error" && errorMsg.includes("not found")) ||
            (initState.ok === false && errorMsg.includes("not found"))
          ) {
            appendStatus("Match expired or not found. Resetting...", "bad");
            activeMatchState = { matchId: null, turnCount: 0, skillUsage: {} };
            await saveActiveMatch();
            continue;
          }

          if (initState.status === "error") {
            appendStatus("State fetch error, retrying...", "bad");
            await sleep(2000);
            continue;
          }

          sinceLogId = initState.last_log_id || 0;
          const myUserId = getCookie("demon");
          myTargetKey = "ally:" + myUserId;

          const enemyPlayers = initState.teams?.enemy?.players_by_num || {};
          const firstEnemy = Object.values(enemyPlayers)[0];
          if (firstEnemy) {
            enemyTargetKey = "enemy:" + firstEnemy.user_id;
            appendStatus(
              "vs " + firstEnemy.username + " (" + firstEnemy.role + ")",
              "info",
            );
          } else {
            appendStatus("Could not find enemy, waiting...", "bad");
          }

          // Try setting fast enemy turns
          await apiPost("pvp_battle_action.php", {
            match_id: matchId,
            since_log_id: sinceLogId,
            action: "set_solo_control_mode",
            control_mode: "fast_enemy",
          });

          // ---- Combat Loop ----
          let matchEnded = false;

          while (isRunning && !matchEnded) {
            const state = await apiGet("pvp_battle_state.php", {
              match_id: matchId,
              since_log_id: sinceLogId,
            });
            if (state.status === "error") {
              await sleep(config.pollInterval);
              continue;
            }

            sinceLogId = state.last_log_id || sinceLogId;

            if (state.teams?.ally && state.teams?.enemy) {
              const m =
                Object.values(state.teams.ally.players_by_num).find(
                  (p) => String(p.user_id) === String(getCookie("demon")),
                ) || Object.values(state.teams.ally.players_by_num)[0];
              const e = Object.values(state.teams.enemy.players_by_num)[0];
              if (m && e) updateHealthUI(m.hp, m.hp_max, e.hp, e.hp_max);
            }

            const handleMatchEnd = async (endData) => {
              matchEnded = true;
              playChime();
              const result = endData.winner_side === "ally" ? "Win" : "Loss";
              setStatus(
                "Match #" + matchId + " ended: " + result,
                result === "Win" ? "good" : "bad",
              );
              pushHistory(
                matchId,
                result,
                activeMatchState.turnCount,
                activeMatchState.skillUsage,
              );

              // Clear active match so we queue next time
              activeMatchState = {
                matchId: null,
                turnCount: 0,
                skillUsage: {},
              };
              await saveActiveMatch();
            };

            if (state.match?.ended) {
              await handleMatchEnd(state.match);
              break;
            }

            if (!state.turn || state.turn.side !== "ally") {
              await sleep(config.pollInterval);
              continue;
            }

            // My Turn
            activeMatchState.turnCount++;
            const decision = decideSkill(state.me, state.teams);

            if (!decision.target) {
              appendStatus("No valid target, waiting...", "bad");
              await sleep(config.pollInterval);
              continue;
            }

            const actionResult = await apiPost("pvp_battle_action.php", {
              match_id: matchId,
              since_log_id: sinceLogId,
              action: "use_skill",
              skill_id: decision.id,
              target_key: decision.target,
            });

            if (actionResult.status !== "error") {
              sinceLogId = actionResult.last_log_id || sinceLogId;

              // Track usage internally
              activeMatchState.skillUsage[decision.id] =
                (activeMatchState.skillUsage[decision.id] || 0) + 1;
              sessionStats.globalSkills[decision.id] =
                (sessionStats.globalSkills[decision.id] || 0) + 1;
              saveStats(); // Save async in background
              renderGlobalSkills();
              await saveActiveMatch();

              const skillName = ALL_SKILLS[decision.id]?.name || "Unknown";
              appendStatus(
                "T" +
                  activeMatchState.turnCount +
                  ": " +
                  skillName +
                  " | " +
                  decision.reason,
                "action",
              );

              if (actionResult.teams?.enemy) {
                const updatedE = Object.values(
                  actionResult.teams.enemy.players_by_num,
                )[0];
                if (updatedE) enemyTargetKey = "enemy:" + updatedE.user_id;
              }

              if (actionResult.match?.ended) {
                await handleMatchEnd(actionResult.match);
                break;
              }
            } else {
              appendStatus(actionResult.message || "Action failed", "bad");
            }
            await sleep(config.pollInterval);
          }

          if (!isRunning) break;

          if (config.autoQueue) {
            appendStatus("Queuing next match in 3s...", "info");
            await sleep(3000);
          } else {
            setStatus("Auto-queue is off. Stopped.", "info");
            document.getElementById("pvp-start-btn").click();
          }
        } catch (err) {
          appendStatus("Loop error: " + err.message, "bad");
          await sleep(3000);
        }
      }
    }

    async function initLockManager() {
      let warnBox = null;
      let isStandby = false;

      async function showStandby() {
        if (isStandby) return;
        isStandby = true;
        document.getElementById("pvp-container")?.remove();
        isRunning = false; // Gracefully stop mainLoop if running

        const saved = await GM.getValue("veyra_pvp2_config", null);
        const tempConfig = { ...DEFAULT_PVP_CONFIG, ...(saved || {}) };
        if (tempConfig.showStandbyWarning && !warnBox) {
          warnBox = document.createElement("div");
          warnBox.innerHTML = `⚠️ <b>AutoPvP Standby</b><br>Another tab is active.`;
          Object.assign(warnBox.style, {
            position: "fixed",
            top: "10px",
            right: "10px",
            background: "rgba(255,150,0,0.9)",
            color: "black",
            padding: "10px",
            borderRadius: "6px",
            zIndex: "999999",
            fontFamily: "monospace",
            fontSize: "12px",
            pointerEvents: "none",
            boxShadow: "0 4px 10px rgba(0,0,0,0.5)",
          });
          document.body.appendChild(warnBox);
        }
      }

      function hideStandby() {
        if (!isStandby) return;
        isStandby = false;
        if (warnBox) {
          warnBox.remove();
          warnBox = null;
        }
      }

      async function checkLock() {
        let master = await GM.getValue("veyra_pvp2_master", null);
        if (!master) master = { id: "", time: 0 };
        const now = Date.now();

        if (isMaster) {
          if (master.id !== myTabId && master.id !== "") {
            // Lost lock!
            isMaster = false;
            console.warn(
              "AutoPvP: Lost master lock! Stepping down to standby.",
            );
            showStandby();
          } else {
            // Renew lock
            await GM.setValue("veyra_pvp2_master", { id: myTabId, time: now });
          }
        } else {
          // In standby
          if (
            now - master.time > 3000 ||
            master.id === myTabId ||
            master.id === ""
          ) {
            // Claimed lock!
            await GM.setValue("veyra_pvp2_master", { id: myTabId, time: now });
            isMaster = true;
            hideStandby();

            // Boot up app
            isRunning = await GM.getValue("veyra_pvp2_running", false);
            await setupUI();
            if (isRunning) mainLoop();
          } else {
            showStandby();
          }
        }
      }

      await checkLock(); // Initial check
      setInterval(checkLock, 1000);
    }

    initLockManager();
  } catch (err) {
    const errBox = document.createElement("div");
    Object.assign(errBox.style, {
      position: "fixed",
      top: "10px",
      left: "10px",
      background: "#ff3333",
      color: "white",
      padding: "15px",
      borderRadius: "8px",
      zIndex: "9999999",
      fontFamily: "monospace",
      fontSize: "14px",
      maxWidth: "80%",
      boxShadow: "0 4px 10px rgba(0,0,0,0.5)",
    });
    errBox.innerHTML = `<b>AutoPvP Fatal Crash:</b><br><br>${err.message}<br><br>${err.stack}`;
    document.body.appendChild(errBox);
    console.error("AutoPvP Error:", err);
  }
})();
    }

})();
