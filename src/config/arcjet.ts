import arcjet, {shield, detectBot, slidingWindow} from "@arcjet/node";

if (!process.env.ARCJET_KEY && process.env.NODE_ENV !== 'test'){
    throw new Error('ARCJET_KEY env is required')
}



const aj = arcjet({
  // Get your site key from https://app.arcjet.com and set it as an environment
  // variable rather than hard coding.
  key: process.env.ARCJET_KEY!,
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
    slidingWindow({
        mode: 'LIVE',
        interval: '2s', //second
        max: 3, //request per 2 seconds
    })

  ],
});

export default aj