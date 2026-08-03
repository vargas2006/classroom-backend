import arcjet, {shield, detectBot, slidingWindow} from "@arcjet/node";

if (!process.env.ARCJET_KEY && process.env.NODE_ENV !== 'test'){
    console.warn('WARN: ARCJET_KEY is not set. Security middleware will not function correctly.')
}



const aj = arcjet({
  key: process.env.ARCJET_KEY || "ajkey_placeholder",
  rules: [
    shield({ mode: "LIVE" }),
    detectBot({
      mode: "LIVE", 
      allow: [
        "CATEGORY:SEARCH_ENGINE",
        "CATEGORY:PREVIEW",
        "CATEGORY:TOOL", // allows Postman, curl, Insomnia, etc.
      ],
    }),
  ],
});

export default aj