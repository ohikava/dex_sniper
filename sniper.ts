import {TokenInterface, Config} from "./interfaces";
import { isEmpty, round } from "./utils";
import * as logger from "./logger";
import { TelegramClient } from "telegram";

const ca_pattern = /CA\*\*: ([A-Za-z\d]+)/
const mcap_pattern = /Market Cap: \*\*\$([\d+.]+)\*\*/
const holders_pattern = /Holders: \*\*([\d]+)\*\*/

export class Sniper {
    private config: Config;
  constructor(config: Config) {
    this.config = config;
  }

  public parseMsgText(msg: string): TokenInterface {
    msg = msg.replace("`", "")
    const template: TokenInterface = {
        ca: "",
        mcap: 0,
        holders: 0,
        liq: 0,
        top_holders_rate: 0,
        renounced_mint: 0,
        burn_rate: 0,
        renounced_freeze: 0,
    }


    try {
        template['ca'] = ca_pattern.exec(msg)[1];
    } catch (e) {
        logger.error("CA not found in message");
        return template;
    }

    try {
        template['mcap'] = parseFloat(mcap_pattern.exec(msg)[1]);
    } catch (e) {
        logger.error("Market Cap not found in message");
        return template;
    }

    try {
        template['holders'] = parseInt(holders_pattern.exec(msg)[1]);
    } catch (e) {
        logger.error("Holders not found in message");
        return template;
    }

    return template;

    }

    public async fillExtraInfo(ca: string, template: TokenInterface) {
        try {
            const r = await fetch(`https://gmgn.ai/defi/quotation/v1/tokens/security/sol/${ca}`);
            let body = await r.json();
            body = body.data ?? {};
            body = body.goplus ?? {};

            if (isEmpty(body)) {
                logger.error(`No data found for CA: ${ca}`);
                return template;
            }

            template['liq'] = body['liquidity'];
            template['top_holders_rate'] = body['top_10_holder_rate'];
            template['renounced_mint'] = body['renounced_mint'];
            template['burn_rate'] = Number.parseFloat(body.burn_ratio ?? "0");
            template['renounced_freeze'] = body['renounced_freeze_account'];
            return template;
        } catch (e) {
            logger.error(`error fetching data for CA: ${ca}, ${e}`);
            return template;
        }
        
    }

    public filterToken(token: TokenInterface): boolean {
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

    public async snipe(token: TokenInterface, client: TelegramClient) {
        logger.info(`sniping token: ${token.ca}`);

        await client.sendMessage(this.config.sniper_url, { message: token.ca });
        for(let i = 0; i < this.config.logging_channels.length; i ++) {
            const currentLogginChannel = this.config.logging_channels[i];

            await client.sendMessage(currentLogginChannel, {message:`${token.ca}\nMCAP: $${round(token.mcap, 2)}\nLIQ: $${round(token.liq, 2)}\nHOLDERS: ${token.holders}\nHOLDERS_RATE: ${round(token.top_holders_rate, 4)}`})
        }
    }
}