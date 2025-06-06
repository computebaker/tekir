import Prelude from "@prelude.so/sdk";

// Initialize Prelude client
const prelude = new Prelude({
    apiToken: process.env.PRELUDE_API_KEY
});

export { prelude };
