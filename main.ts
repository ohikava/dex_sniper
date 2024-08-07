import { TelegramClient } from "telegram";
import { StoreSession } from "telegram/sessions";
import "dotenv/config";


import input from "input"; // npm i input

const apiId = parseInt(process.env.API_ID as string);
const apiHash = process.env.API_HASH as string;

const storeSession = new StoreSession("my_session"); // fill this later with the value from session.save()

(async () => {
  console.log("Loading interactive example...");
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
  console.log("You should now be connected.");
  console.log(client.session.save()); // Save this string to avoid logging in again
  await client.sendMessage("me", { message: "Hello!" });
})();