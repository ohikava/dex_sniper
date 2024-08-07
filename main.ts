import { TelegramClient } from "telegram";
import { StoreSession } from "telegram/sessions";
import { NewMessage, NewMessageEvent } from "telegram/events";
import { Config } from "./interfaces";
import { Sniper } from "./sniper";
import * as fs from 'fs';
import * as toml from 'toml';
import "dotenv/config";
import input from "input";
import * as logger from "./logger";

const seenTokens = new Set<string>();



const CONFIG_PATH = "./config.toml";

const apiId = parseInt(process.env.API_ID as string);
const apiHash = process.env.API_HASH as string;

const storeSession = new StoreSession("my_session"); // fill this later with the value from session.save()


(async () => {
  const configFile = await fs.promises.readFile(CONFIG_PATH, "utf-8");
  const config: Config = toml.parse(configFile);
  
  const sniper = new Sniper(config);

  logger.info("Loading interactive example...");
  const client = new TelegramClient(storeSession, apiId, apiHash, {
    connectionRetries: 5,
  });
  await client.start({
    phoneNumber: async () => await input.text("Please enter your number: "),
    password: async () => await input.text("Please enter your password: "),
    phoneCode: async () =>
      await input.text("Please enter the code you received: "),
    onError: (err) => console.log(err),
  });
  
  logger.info("You should now be connected.");
  client.session.save(); // Save this string to avoid logging in again

  client.addEventHandler((update: NewMessageEvent) => {

    let tokenInfo = sniper.parseMsgText(update.message.text);

    const CA = tokenInfo.ca ?? "";

    if ((CA == "") || (seenTokens.has(CA))) {
        return;
    } else {
        seenTokens.add(CA);
    }

        (async () => {
        tokenInfo = await sniper.fillExtraInfo(tokenInfo.ca, tokenInfo);
        
        const shouldSnipe = sniper.filterToken(tokenInfo);

        if (shouldSnipe) {
            await sniper.snipe(tokenInfo, client);
            }
        })();
  }, new NewMessage({"chats": ["@sadlfsadf"]}));
})();