'use strict';

var telegram = require('telegram');
var sessions = require('telegram/sessions');
var events = require('telegram/events');
var url = require('url');
var fs = require('fs');
var toml = require('toml');
require('dotenv/config');
var input = require('input');

var _documentCurrentScript = typeof document !== 'undefined' ? document.currentScript : null;
function _interopNamespaceDefault(e) {
    var n = Object.create(null);
    if (e) {
        Object.keys(e).forEach(function (k) {
            if (k !== 'default') {
                var d = Object.getOwnPropertyDescriptor(e, k);
                Object.defineProperty(n, k, d.get ? d : {
                    enumerable: true,
                    get: function () { return e[k]; }
                });
            }
        });
    }
    n.default = e;
    return Object.freeze(n);
}

var fs__namespace = /*#__PURE__*/_interopNamespaceDefault(fs);
var toml__namespace = /*#__PURE__*/_interopNamespaceDefault(toml);

function isEmpty(obj) {
    for (const prop in obj) {
        if (Object.hasOwn(obj, prop)) {
            return false;
        }
    }
    return true;
}
function round(num, decimals) {
    var decimals = 10 ** decimals;
    return Math.round((num + Number.EPSILON) * decimals) / decimals;
}

// const LOGS_DIR = './logs';
// function getCurrentFileName(): string {
//     let today = new Date();
//     let dd = String(today.getDate()).padStart(2, '0');
//     let mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
//     let yyyy = today.getFullYear();
//     let today_row = mm + '-' + dd + '-' + yyyy;
//     return `${LOGS_DIR}/${today_row}.log`;
// }
var globallevel = {
    levelIndex: 0
};
function writeToFile(message) {
    return;
    // fs.appendFile(getCurrentFileName(), message + '\n', (err: any) => {
    //     if (err) {
    //         console.error(err);
    //     }
    // }
    // );
}
const LEVELS = ['DEBUG', 'INFO', 'ERROR'];
function formatMessage(level, message, colors = true) {
    const currentTime = new Date();
    const hours = currentTime.getHours().toString().padStart(2, '0');
    const minutes = currentTime.getMinutes().toString().padStart(2, '0');
    const seconds = currentTime.getSeconds().toString().padStart(2, '0');
    const now = `${hours}:${minutes}:${seconds}`;
    const filePath = url.fileURLToPath((typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (_documentCurrentScript && _documentCurrentScript.src || new URL('bundle.js', document.baseURI).href))).replace(/^.*[\\/]/, '');
    const levelColor = level === 'DEBUG' ? '\x1b[36m%s\x1b[0m' :
        level === 'INFO' ? '\x1b[32m%s\x1b[0m' :
            level === 'ERROR' ? '\x1b[31m%s\x1b[0m' :
                '\x1b[37m%s\x1b[0m';
    if (!colors) {
        return `[${now}] [${level}] ${filePath}: ${message}`;
    }
    return levelColor.replace('%s', `[${now}] [${level}] ${filePath}: ${message}`);
}
function info(message) {
    if (globallevel.levelIndex <= LEVELS.indexOf('INFO')) {
        console.log(formatMessage('INFO', message));
        writeToFile(formatMessage('INFO', message, false));
    }
}
function error(message) {
    if (globallevel.levelIndex <= LEVELS.indexOf('ERROR')) {
        console.log(formatMessage('ERROR', message));
        writeToFile(formatMessage('ERROR', message, false));
    }
}

const ca_pattern = /CA\*\*: ([A-Za-z\d]+)/;
const mcap_pattern = /Market Cap: \*\*\$([\d+.]+)\*\*/;
const holders_pattern = /Holders: \*\*([\d]+)\*\*/;
class Sniper {
    config;
    constructor(config) {
        this.config = config;
    }
    parseMsgText(msg) {
        msg = msg.replace("`", "");
        const template = {
            ca: "",
            mcap: 0,
            holders: 0,
            liq: 0,
            top_holders_rate: 0,
            renounced_mint: 0,
            burn_rate: 0,
            renounced_freeze: 0,
        };
        try {
            template['ca'] = ca_pattern.exec(msg)[1];
        }
        catch (e) {
            error("CA not found in message");
            return template;
        }
        try {
            template['mcap'] = parseFloat(mcap_pattern.exec(msg)[1]);
        }
        catch (e) {
            error("Market Cap not found in message");
            return template;
        }
        try {
            template['holders'] = parseInt(holders_pattern.exec(msg)[1]);
        }
        catch (e) {
            error("Holders not found in message");
            return template;
        }
        return template;
    }
    async fillExtraInfo(ca, template) {
        try {
            const r = await fetch(`https://gmgn.ai/defi/quotation/v1/tokens/security/sol/${ca}`);
            let body = await r.json();
            body = body.data ?? {};
            body = body.goplus ?? {};
            if (isEmpty(body)) {
                error(`No data found for CA: ${ca}`);
                return template;
            }
            template['liq'] = body['liquidity'];
            template['top_holders_rate'] = body['top_10_holder_rate'];
            template['renounced_mint'] = body['renounced_mint'];
            template['burn_rate'] = Number.parseFloat(body.burn_ratio ?? "0");
            template['renounced_freeze'] = body['renounced_freeze_account'];
            return template;
        }
        catch (e) {
            error(`error fetching data for CA: ${ca}, ${e}`);
            return template;
        }
    }
    filterToken(token) {
        if (token.mcap < this.config.min_mcap) {
            return false;
        }
        if (token.holders < this.config.min_holders) {
            return false;
        }
        if (token.liq < this.config.min_liquidity) {
            return false;
        }
        if (token.top_holders_rate > this.config.max_top_holders_ratio) {
            return false;
        }
        if (token.renounced_mint != this.config.renounced_mint) {
            return false;
        }
        if (token.burn_rate < this.config.burn_rate) {
            return false;
        }
        if (token.renounced_freeze != this.config.renounced_freeze) {
            return false;
        }
        return true;
    }
    async snipe(token, client) {
        info(`sniping token: ${token.ca}`);
        await client.sendMessage(this.config.sniper_url, { message: token.ca });
        for (let i = 0; i < this.config.logging_channels.length; i++) {
            const currentLogginChannel = this.config.logging_channels[i];
            await client.sendMessage(currentLogginChannel, { message: `${token.ca}\nMCAP: $${round(token.mcap, 2)}\nLIQ: $${round(token.liq, 2)}\nHOLDERS: ${token.holders}\nHOLDERS_RATE: ${round(token.top_holders_rate, 4)}` });
        }
    }
}

const seenTokens = new Set();
const CONFIG_PATH = "./config.toml";
const apiId = parseInt(process.env.API_ID);
const apiHash = process.env.API_HASH;
const storeSession = new sessions.StoreSession("my_session"); // fill this later with the value from session.save()
(async () => {
    const configFile = await fs__namespace.promises.readFile(CONFIG_PATH, "utf-8");
    const config = toml__namespace.parse(configFile);
    const sniper = new Sniper(config);
    info("Loading interactive example...");
    const client = new telegram.TelegramClient(storeSession, apiId, apiHash, {
        connectionRetries: 5,
    });
    await client.start({
        phoneNumber: async () => await input.text("Please enter your number: "),
        password: async () => await input.text("Please enter your password: "),
        phoneCode: async () => await input.text("Please enter the code you received: "),
        onError: (err) => console.log(err),
    });
    info("You should now be connected.");
    client.session.save(); // Save this string to avoid logging in again
    client.addEventHandler((update) => {
        let tokenInfo = sniper.parseMsgText(update.message.text);
        const CA = tokenInfo.ca ?? "";
        if ((CA == "") || (seenTokens.has(CA))) {
            return;
        }
        else {
            seenTokens.add(CA);
        }
        (async () => {
            tokenInfo = await sniper.fillExtraInfo(tokenInfo.ca, tokenInfo);
            info(`new token: ${tokenInfo.ca} ${tokenInfo.mcap} ${round(tokenInfo.liq, 2)} ${tokenInfo.holders} ${round(tokenInfo.top_holders_rate, 4)} ${tokenInfo.renounced_mint} ${tokenInfo.renounced_freeze} ${tokenInfo.burn_rate}`);
            const shouldSnipe = sniper.filterToken(tokenInfo);
            if (shouldSnipe) {
                await sniper.snipe(tokenInfo, client);
            }
        })();
    }, new events.NewMessage({ "chats": config.channels }));
})();
