const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const expansion = window.MOONPIE_EXPANSION || {};

const STORE_KEY = "moonpie-miss-you-v9";
const defaultState = { mood: "soft", widgets: [], widgetCloudMigrated: false, openedReasons: [], softMode: false, lastWorld: "home", hasEnteredUniverse: false, bestBubbleScore: 0, bubbleBestByProfile: {}, challengeIndex: 0, profile: "Michelle", reasonDeck: [], reasonCursor: 0, lastReasonIndex: -1, lastComfortByMood: {}, handDeck: [], handCursor: 0, visitLog: [], giftMemory: {} };
let state = loadState();
let selectedMood = state.mood || "soft";
let deferredInstallPrompt = null;
let gardenTreeCanvas = null;
let gardenTreeCtx = null;
let gardenPetals = [];
let gardenProgress = 0.16;
let gardenAnimationFrame = null;
let gardenCelebrationTimer = null;
const GARDEN_BLOOM_DURATION = 9200;
let navIdleTimer = null;
let lastScrollY = 0;
let widgetSyncTimer = null;
const screenHistory = [];
const renderedScreens = new Set(["home", "atlas"]);
let widgetSyncStarted = false;

const worlds = [
  { id: "garden", icon: "🌸", title: "Love Garden", sub: "tree, lilies, bouquet", count: 3, tone: "garden" },
  { id: "letters", icon: "💌", title: "Letters", sub: "open one slowly", count: 10, tone: "letter" },
  { id: "poems", icon: "🪷", title: "Poems", sub: "written after midnight", count: 5, tone: "poem" },
  { id: "notices", icon: "🗒️", title: "Tiny Things", sub: "I notice everything", count: 12, tone: "notice" },
  { id: "day", icon: "☀️", title: "One Perfect Day", sub: "come live it with me", count: 8, tone: "day" },
  { id: "places", icon: "🌍", title: "Our Worlds", sub: "places waiting for us", count: 12, tone: "place" },
  { id: "songs", icon: "🎵", title: "Songs That Are You", sub: "listen while you read", count: 7, tone: "song" },
  { id: "promises", icon: "🌸", title: "Promises", sub: "kept here for you", count: 9, tone: "promise" },
  { id: "distance", icon: "🛰️", title: "While Apart", sub: "two dots, one thread", count: 6, tone: "distance" },
  { id: "reasons", icon: "💗", title: "100 Reasons", sub: "pluck one from the sky", count: 100, tone: "reason" },
  { id: "memory", icon: "📸", title: "Our Little World", sub: "the bits I keep", count: 9, tone: "memory" },
  { id: "birthday", icon: "💐", title: "Girlfriend Day Wish", sub: "save this one for last", count: 1, tone: "birthday" },
  { id: "doodles", icon: "✍️", title: "Widget Studio", sub: "write, draw, send comfort", count: 2, tone: "create" },
  { id: "games", icon: "🎮", title: "Love Arcade", sub: "tap tiny feelings", count: 6, tone: "game" },
  { id: "care", icon: "🫶", title: "Emergency Care", sub: "when missing gets heavy", count: 5, tone: "care" }
];

const comfortNotes = {
  soft: [
    "Come closer in your head. I am probably smiling at my phone somewhere, thinking about you too.",
    "You do not have to be brave for this minute. Let me be the soft place. Breathe in. I love you. Breathe out. Still yours.",
    "Distance is loud, but it is not bigger than us. It is just the room between two people already walking toward each other."
  ],
  heavy: [
    "If today feels too much, do only the next tiny thing. Drink water. Unclench your jaw. Let my love be simple for you.",
    "Missing me is not proof that something is wrong. It is proof that what we have is real enough to leave an ache.",
    "I would sit beside you through the whole heavy thing if I could. Since I cannot, let this be my hand on your shoulder."
  ],
  sleepy: [
    "Put the phone near you. Imagine my voice getting quieter and quieter until the room feels safe. Goodnight, Moonpie.",
    "You are allowed to sleep before replying. I will still be here. Morning-you deserves rest too.",
    "Close your eyes for ten seconds. I am not disappearing. I am tucked into tomorrow, waiting."
  ],
  clingy: [
    "Be clingy. I like being loved by you in the specific, dramatic, adorable way only you can manage.",
    "If I were there, I would let you steal my hoodie, my arm, half the blanket, and probably my entire heart again.",
    "You can miss me loudly here. This app was literally built for that. Come be ridiculous. I am yours."
  ]
};

const letters = [
  {
    title: "Every Night With You",
    tab: "our magical nights",
    theme: "moon",
    preview: "For the nights I never want to end, because every hour with you becomes my favorite hour.",
    salutation: "My babyy,",
    body: [
      "I love our nights so much. I love the way the rest of the world becomes quieter and it feels like time has made one private little room just for you and me.",
      "Even when we are talking about the smallest things, it feels magical because it is your voice, your laugh, your sleepy little protests, and your beautiful mind keeping me company. I always want one more minute, then another, then another, because there could never be enough of you for me.",
      "Some nights we laugh until everything feels lighter. Some nights we talk softly and honestly. Some nights we are simply there together, and even that feels precious to me. You turn ordinary hours into memories I want to keep forever.",
      "Babyy, I hope you always know how loved you are in those moments. You will always be my little babyy, my Moonpie, and my favorite person to stay awake for."
    ],
    closing: "Goodnight only means I get to love you again tomorrow."
  },
  {
    title: "For When You Miss Me",
    tab: "open on hard days",
    theme: "stars",
    preview: "A letter for the nights when the distance starts speaking too loudly.",
    salutation: "My sweet girl,",
    body: [
      "If you opened this because missing me got loud, come closer for a minute. Put your shoulders down. Unclench your jaw. Breathe like I am beside you and not across a screen.",
      "I know distance can make love feel unfair. It asks us to be patient when all we want is one hand, one hug, one ordinary evening where nobody has to say goodbye. But distance is not stronger than us. It is just the space we keep crossing, one call, one message, one soft little promise at a time.",
      "When you miss me, remember that I am never somewhere forgetting you. I carry you always into my day. I think about you all the time, and I could never get a sufficient amount of you. You are my sweet addiction, the thought my mind happily returns to again and again.",
      "So stay here for a moment. Let this letter be my hand on your cheek. I love you. I am here. We are still us."
    ],
    closing: "Come back to this whenever the missing feels heavy. Love, Daddy."
  },
  {
    title: "Your Voice",
    tab: "the sound of home",
    theme: "voice",
    preview: "Because one hello from you can change the whole shape of my day.",
    salutation: "Princess,",
    body: [
      "There is a tiny second when you first pick up and I can hear the room around you before I hear the full sentence. I love that second. It feels like the door opening.",
      "Your voice does something to me that I still do not know how to explain without sounding dramatic. It settles me. It pulls me out of my head. It makes the day feel less sharp around the edges.",
      "I love your sleepy voice. I love your playful voice. I love the voice you use when you are trying to sound fine but you want me to notice you are not. I love the little pauses, the soft protests, the way you say my name like it belongs somewhere safe.",
      "I thought music was my favorite thing to listen to, but everything changed once I heard your voice. Even when 'you know what' is happening... aaaaah, I looove it sooo much, and III looove youuu sooo much, babyygirl.",
      "If I could keep one sound in my pocket for every hard day, I would choose your laugh. Not the polite one. The real one. The one that makes me feel like I have won something I did not know I was hoping for."
    ],
    closing: "Call me in your heart. I will answer there too."
  },
  {
    title: "Your Girlfriend Day Letter",
    tab: "save this one",
    theme: "birthday",
    preview: "For the day the world got a little luckier, because I get to call you mine.",
    salutation: "Happy Girlfriend Day, Michelle,",
    body: [
      "There is no candle to blow out for this one, just a whole day the world set aside to say what I already know every day: I am the luckiest person alive because you chose to be mine.",
      "I wish I could place flowers in your hands for real. I wish I could watch your face while you read this. I wish I could make the whole day gentle around you, like the world knows it is carrying someone precious.",
      "You deserve more than a message. You deserve a room full of lilies, a sky full of pink light, and a love that does not make you wonder if you are too much.",
      "You are not too much. You are my favorite kind of everything. My Moonpie. My Princess. My babyy. My person in the softest part of my chest.",
      "So happy Girlfriend Day, Moonpie. Here's to every one of these we get, near or far, until there is no more distance left to close."
    ],
    closing: "Make a wish anyway. I am wishing for you too."
  },
  {
    title: "The Future I Keep Seeing",
    tab: "our someday",
    theme: "kitchen",
    preview: "A letter about the ordinary life I want with you, because ordinary with you is magic.",
    salutation: "My love,",
    body: [
      "When I think about our future, I do not only picture big trips and perfect photos. I picture the little things. You walking into the kitchen while I am trying to make coffee. Us deciding what to eat and somehow making it a full debate. Your things mixed with mine in a way that says nobody is leaving.",
      "I want the boring parts with you. Groceries. Laundry. Sleepy mornings. Late night snacks. Sitting beside each other while doing different things, then looking up just to smile because we are finally in the same room.",
      "I want to learn how you like your days. What makes you quiet. What makes you laugh without trying. What breakfast becomes your comfort food. What corner of the couch becomes yours. I want the privilege of knowing you up close.",
      "The future I keep seeing is not perfect. It is better than perfect. It is real. It has us in it, choosing each other in a hundred small ways."
    ],
    closing: "One day, no countdown. Just us."
  },
  {
    title: "The Things I Notice",
    tab: "tiny evidence",
    theme: "lilies",
    preview: "Because loving you means paying attention to the details you think nobody sees.",
    salutation: "Moonpie,",
    body: [
      "I notice the little shifts in you. The way your energy changes when you are tired. The way you try to be okay quickly, even when something still hurts. The way your softness does not disappear, even when the world gives you reasons to protect it.",
      "I notice how you care. You do not always announce it. You just hold things. You remember. You check in. You give pieces of yourself quietly, and sometimes I wonder if you know how rare that is.",
      "I notice the way you make me want to slow down and be gentler. Not because you ask for it, but because loving you makes care feel important. It makes me want to become someone who can hold your heart properly.",
      "If you ever feel unseen, come back here. I see you. Not perfectly, because I am still learning, but sincerely. I am watching with love. I am learning the language of you."
    ],
    closing: "Every detail of you matters to me."
  },
  {
    title: "When You Need Reassurance",
    tab: "read twice",
    theme: "safe",
    preview: "For the moments when your heart needs me to say the simple thing clearly.",
    salutation: "My baby,",
    body: [
      "I love you. I am not saying it as decoration. I am saying it as a place you can rest.",
      "You do not have to perform for my love. You do not have to be easy every day. You do not have to be cheerful before you are ready. I want the real you, the sleepy you, the unsure you, the sweet girl who reaches for me when she needs extra love, the brave you, and the quiet you.",
      "If your mind ever tries to convince you that you are a burden, let this letter interrupt it. You are not a burden to me. You are someone I choose. Someone I want to understand. Someone whose feelings matter, even when they are inconvenient or messy.",
      "I cannot promise I will always say everything perfectly. I can promise I will keep trying, keep listening, keep coming closer instead of making you feel alone with what hurts."
    ],
    closing: "You are loved here. Fully and on purpose."
  },
  {
    title: "Until I Can Hold You",
    tab: "the airport letter",
    theme: "airport",
    preview: "For the countdown, the waiting, and the hug that will make all of this real.",
    salutation: "My Michelle,",
    body: [
      "I think about the first real hug more than I probably should. I think about seeing you and forgetting every clever thing I planned to say. I think about that first second when distance finally loses.",
      "I want to hold you long enough for both of us to believe it. Not a quick hug. Not a polite one. The kind where the whole body exhales. The kind that says, there you are, I made it, we made it.",
      "Until then, we keep building the bridge. Calls. Messages. Little apps like this. Small promises. Screens that try their best to become hands. None of it replaces being there, but all of it proves we are still reaching.",
      "One day I will not have to send my love through paragraphs. I will put it in your hand. I will kiss your forehead. I will look at you and let the silence say the part I could never type well enough."
    ],
    closing: "Wait for me in the future. I am walking there."
  },
  {
    title: "If You Ever Doubt It",
    tab: "certainty",
    theme: "safe",
    preview: "A clear letter for the small scared voice that asks if I still mean it.",
    salutation: "My beautiful girl,",
    body: [
      "If a worried thought ever asks whether I still love you, let this be the answer that arrives before the fear gets comfortable.",
      "Yes. I love you when the conversation is easy. I love you when we are sleepy. I love you when we miss each other and it makes us sensitive. I love you in the quiet after the call, when the room feels too still and I wish you were beside me.",
      "You do not have to earn the same answer every day. My heart is not a test you keep retaking. I know what I feel for you. I know who you are to me.",
      "You are the person I want to tell things to. You are the person I keep imagining in all the ordinary places. You are the soft thought that keeps returning, even when my day is full."
    ],
    closing: "The answer is yes. Again and again."
  },
  {
    title: "This Little Universe",
    tab: "why I built this",
    theme: "stars",
    preview: "For when you wonder why I made this little place for you.",
    salutation: "Moonpie,",
    body: [
      "I built this because sometimes love needs somewhere to wait. Not because a website can replace my arms, but because I wanted you to have a place where my care does not disappear when I am busy, asleep, or far away.",
      "Every room in here is trying to do one thing. It is trying to meet you gently. If you miss me, there is a place for that. If you need reassurance, there is a place for that. If you want something playful, soft, romantic, dramatic, or silly, I want this little universe to open its doors for you.",
      "Maybe it is just code. But it is code carrying my attention. It is me trying to say, I thought about you here. I thought about what might make you smile. I thought about what might make you feel less alone for a minute.",
      "So whenever you open this, please know it was not made for a screen. It was made for your heart."
    ],
    closing: "Welcome home, my love."
  }
];

const poems = [
  ["Moonlit", "If the moon borrowed your softness,\nit would return brighter.\nIf the night learned your name,\nit would stop being lonely."],
  ["Distance", "There is a map between us,\nbut my heart is terrible at geography.\nIt keeps walking straight to you."],
  ["Your Laugh", "I have heard music,\nthen I heard you laugh,\nand suddenly music had competition."],
  ["Kitchen Future", "One day I will love you\nwith coffee cooling beside us,\nwith ordinary light,\nwith both of us finally there."],
  ["Still", "Even from far away,\nyou are not far from me.\nYou are the quiet place\nmy day keeps returning to."]
];

const notices = [
  "How your voice changes when you are pretending not to be sleepy.",
  "The way you pause before saying something honest.",
  "How you make tiny things feel worth remembering.",
  "The specific little protest you make when I have to go.",
  "How your face probably looks when a song you love comes on.",
  "The way you love people without announcing it.",
  "Your soft stubbornness. I notice it. I love it.",
  "How you say my name differently when you miss me.",
  "The brave way you keep being gentle.",
  "How even your silence can feel warm."
];

const dayPlan = [
  ["7:42 AM", "I wake first, pull you closer, and spend a shameless minute admiring the beautiful girl asleep beside me."],
  ["8:30 AM", "Breakfast in bed with pink lilies, your favorite things, terrible plating, and one bite I insist tastes better from my fork."],
  ["10:15 AM", "We dress up for each other, make a tiny getting-ready playlist, and take mirror pictures before we even leave."],
  ["11:30 AM", "A flower market date. You choose the prettiest stems while I secretly add the ones that remind me of you."],
  ["1:00 PM", "A playful lunch with shared plates, dramatic food ratings, and a dessert ordered only because your eyes lit up."],
  ["2:45 PM", "A surprise activity: pottery, painting, an arcade, or making something silly we can keep in our future home."],
  ["4:30 PM", "A slow drive with our playlist, your hand in mine, spontaneous stops, and absolutely no checking the time."],
  ["5:48 PM", "Golden-hour picnic. Fruit, cake, a blanket, handwritten notes, and fifty photographs because one could never be enough."],
  ["7:30 PM", "We change for dinner and I get to fall for you all over again when you walk toward me."],
  ["9:15 PM", "A soft-lit dinner where we ask each other sweet questions, remember our funniest moments, and dream out loud."],
  ["10:45 PM", "A moonlit walk, slow dancing somewhere private, forehead kisses, and the kind of hug that resets the whole heart."],
  ["11:58 PM", "We end the day wrapped together, trading wishes for our next year and refusing to let the last two minutes hurry us."]
];

const places = [
  ["Airport Arrival", "./assets/worlds/airport-hug-1.webp", "The doors open, you look around, and the whole world narrows to one hug."],
  ["Santorini", "./assets/worlds/santorini-1.webp", "White terraces, lilac sky, and me taking too many pictures of you."],
  ["The Maldives", "./assets/worlds/maldives-1.webp", "No schedule. Water everywhere. You wake up and I stop noticing the ocean."],
  ["Paris at Midnight", "./assets/worlds/paris-1.webp", "The tower sparkles and I pretend I did not arrange it for you."],
  ["Our Tiny Kitchen", "./assets/worlds/kitchen-1.webp", "Coffee, sleepy hair, stealing bites, arguing lovingly about the last piece."]
];

const songs = [
  ["Sleep Well", "d4vd", "For the soft nights when missing each other gets too loud."],
  ["Best Part", "Daniel Caesar ft. H.E.R.", "Because you are exactly that: the part my day keeps waiting for."],
  ["Those Eyes", "New West", "A song for tiny things, private jokes, and the ordinary ways love proves itself."],
  ["Until I Found You", "Stephen Sanchez", "Ridiculous-romantic in the correct way."],
  ["Melting", "Kali Uchis", "For the moments where all I can do is be dramatically in love with you."],
  ["Japanese Denim", "Daniel Caesar", "For late calls, warm silence, and wanting more time."],
  ["Glue Song", "beabadoobee", "Because you stuck, Moonpie. Beautifully, inconveniently, permanently."]
];

const promises = [
  "I will keep choosing you when it is easy and when distance makes it annoying.",
  "I will not make you feel dramatic for missing me.",
  "I will learn the small ways you need love and keep practicing them.",
  "I will build toward the ordinary future, not just talk about it.",
  "I will be gentle with the parts of you that had to become guarded.",
  "I will keep writing things down so you can find me when I am not there.",
  "I will make the airport hug worth the waiting.",
  "I will remember that you are not a notification. You are my person.",
  "I will love you in public ways, private ways, boring ways, forever ways."
];

const distanceBeacons = [
  ["If you opened this at night", "I am probably missing you too. The dark just makes it easier to hear."],
  ["If you are waiting for my reply", "My silence is not absence. Sometimes I am just living the day that leads me back to you."],
  ["If you want my hand", "Put your palm on the screen. I know it is silly. Do it anyway."],
  ["If you feel far away", "Far is a measurement. Us is a decision."],
  ["If goodbye hurt", "Goodbyes are proof that our next hello still matters."]
];

const memories = [
  ["The first safe feeling", "Not loud. Just something in me unclenching."],
  ["The calls that ran late", "Neither of us wanting to be the one to end it."],
  ["The little protests", "Your no when I have to go. It ruins me beautifully."],
  ["The way we dream", "We talk like the future is half-built already."],
  ["The private language", "Moonpie. Princess. Babyy. Home in small names."]
];

const reasons = [
  "Your laugh. The real one, not the polite one.",
  "The way you make ordinary moments feel like they matter.",
  "How you love without measuring what comes back.",
  "Your patience, a gift you give quietly.",
  "The face you make when I say I have to go.",
  "How you say my name differently when you miss me.",
  "Your kindness; it costs you something and you give it anyway.",
  "The way you actually listen.",
  "How soft your eyes go when you are happy.",
  "Your warmth; people feel it before you speak.",
  "How you make love feel uncomplicated.",
  "Your voice, in every mood.",
  "How curious you are about the world.",
  "Your sense of humour. You find the funny thing first.",
  "How you make space for people without making it a thing.",
  "Your resilience. Still here. Still soft.",
  "The way you make a place feel like home.",
  "How you talk about your dreams like they are half real already.",
  "Your grit. Beneath the softness there is real steel.",
  "The way you commit. To people. To things. To us.",
  "How you eat food you love. Pure joy.",
  "Your consistency. You are who you say you are.",
  "How you make difficult things manageable just by being near.",
  "Your intelligence. You think in ways that surprise me.",
  "How your face changes when a song you love comes on.",
  "The way you say goodnight.",
  "How you grow. Always becoming.",
  "How you make me want to be better without asking.",
  "Your presence. The room shifts when you walk in.",
  "The specific shape of how you love me.",
  "Your tenderness, the softness not everyone earns.",
  "How you make distance feel smaller just by existing.",
  "Your voice when you are sleepy and still talking.",
  "The way you dream out loud with me.",
  "How you became my first thought and my last.",
  "Your attention. When you give it, you really give it.",
  "How you make the ordinary feel sacred.",
  "Your ability to be soft and strong at once.",
  "Full sentences at 2am. That is just who you are.",
  "How you say I love you like you mean all three words.",
  "The way you hold my words. Actually hold them.",
  "How you never made love feel like something I have to earn.",
  "Your eyes. I could write a separate list.",
  "How you are funny without trying.",
  "Your trust, that you gave it to me.",
  "How you make home feel like a feeling, not a place.",
  "Your voice at the start of a call. Just the hello.",
  "How you make things I worry about feel manageable.",
  "The fact that you were born. That you exist. That you made it to today.",
  "You. Just you. Always, only, entirely you."
];

const careSteps = [
  ["01", "Come closer", "Put one hand on your chest and one on your stomach. Take four gentle breaths while imagining my hand resting over yours."],
  ["02", "Tell me the true thing", "You never have to package your feelings neatly for me. Send: 'Babyy, I need you close today.' That is already enough."],
  ["03", "Let your body feel safer", "Drink some water, loosen your shoulders, unclench your jaw, and find the softest thing within reach."],
  ["04", "Borrow my voice", "Open Every Night With You or Your Voice and read it slowly. Every sentence is me sitting beside you for a minute."],
  ["05", "Make the room gentler", "Lower one bright light, play one of our songs, and let this lilac little universe stay open beside you."],
  ["06", "Give the ache somewhere to go", "Write one tiny widget, draw a heart, or leave me the exact sentence you wish I could hear right now."],
  ["07", "Choose one future", "Open Our Worlds and pick where we are going tonight. Imagine the first ten minutes there together."],
  ["08", "Rest without proving anything", "If it is late, let yourself sleep. You never have to stay awake to prove you miss me. I will still love you in the morning."]
];

const careResponses = {
  missing: ["💗", "I miss you too, babyy.", "Do not fight the feeling. Come sit with me here. Picture my arms around you, my cheek against your hair, and the first long airport hug waiting for us. Send me one tiny note if you want me to know this moment found you."],
  reassurance: ["🌸", "You are still my girl.", "Nothing about a quiet hour, a delayed reply, or a difficult mood changes how beautiful and important you are to me. You do not need to earn the answer again. I love you, I choose you, and you will always be my little babyy."],
  overwhelmed: ["🪷", "Only the next tiny thing.", "You do not have to solve the whole day right now. Put both feet down. Name three things you can see, two things you can feel, and one sound near you. Then drink a little water. I am proud of you for making this minute gentler."],
  sleep: ["💕", "Let the night hold you softly.", "You are allowed to stop for today. Put the phone close, lower the light, and imagine me whispering goodnight until your breathing becomes slow. I am not disappearing while you sleep. I will still be yours in the morning."]
};

const challenges = [
  ["Voice-note dare", "Send one voice note where you say exactly what you miss, no making it neat."],
  ["Photo scavenger hunt", "Find something pink, something soft, and something that reminds you of us. Send all three."],
  ["Two-minute date", "Start a timer. For two minutes, we can text only tiny future plans."],
  ["The food treaty", "Name the snack you would steal from me first. I get to object dramatically."],
  ["Sleepy promise", "Before sleeping, send one sentence future-you wants to wake up remembering."],
  ["Airport scene", "Describe the first ten seconds when we finally see each other again."]
];

const dicePrompts = [
  "Send a kiss emoji and one very specific thing you want me to do when I see you.",
  "Pick a song for tonight and pretend it is playing in our tiny kitchen.",
  "Tell me one thing you want us to do in matching hoodies.",
  "Send me the most clingy sentence you can write without deleting it.",
  "Choose: forehead kiss, long hug, stolen hoodie, or late-night walk.",
  "Write a fake postcard from one future place we will visit."
];

const futureWorlds = expansion.worlds || [];
const handMessages = expansion.handMessages || [];
if (expansion.extraLetters?.length) letters.push(...expansion.extraLetters);
if (expansion.poems?.length) poems.splice(0, poems.length, ...expansion.poems);
if (expansion.notices?.length) notices.splice(0, notices.length, ...expansion.notices);
if (expansion.reasons?.length) reasons.splice(0, reasons.length, ...expansion.reasons);
if (expansion.memories?.length) memories.splice(0, memories.length, ...expansion.memories);
if (expansion.songs?.length) songs.splice(0, songs.length, ...expansion.songs);
const placesWorld = worlds.find(world => world.id === "places");
if (placesWorld) placesWorld.count = futureWorlds.length || places.length;
const poemsWorld = worlds.find(world => world.id === "poems");
if (poemsWorld) poemsWorld.count = poems.length;
const lettersWorld = worlds.find(world => world.id === "letters");
if (lettersWorld) lettersWorld.count = letters.length;
const noticesWorld = worlds.find(world => world.id === "notices");
if (noticesWorld) noticesWorld.count = notices.length;
const reasonsWorld = worlds.find(world => world.id === "reasons");
if (reasonsWorld) reasonsWorld.count = reasons.length;
const memoryWorld = worlds.find(world => world.id === "memory");
if (memoryWorld) memoryWorld.count = memories.length;
const songsWorld = worlds.find(world => world.id === "songs");
if (songsWorld) songsWorld.count = songs.length;

const bubbleEmojis = ["💗", "💕", "🌸", "💋", "🌙", "✨", "🎀", "🪷", "❤️", "💖"];
const celebrationPieces = ["💗", "🌸", "🎀", "✨", "💕", "🪷", "❤️", "💖"];

function loadState() {
  try { return { ...defaultState, ...JSON.parse(localStorage.getItem(STORE_KEY) || "{}") }; }
  catch { return { ...defaultState }; }
}

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  renderLatestWidget();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function shuffledIndexes(length, avoidFirst = -1) {
  const deck = Array.from({ length }, (_, index) => index);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  if (deck.length > 1 && deck[0] === avoidFirst) [deck[0], deck[1]] = [deck[1], deck[0]];
  return deck;
}

function nextComfort(mood) {
  const list = comfortNotes[mood] || comfortNotes.soft;
  const previous = Number(state.lastComfortByMood?.[mood] ?? -1);
  const choices = list.map((_, index) => index).filter(index => index !== previous);
  const index = pick(choices.length ? choices : [0]);
  state.lastComfortByMood = { ...(state.lastComfortByMood || {}), [mood]: index };
  return list[index];
}

function nextReason() {
  if (!Array.isArray(state.reasonDeck) || state.reasonDeck.length !== reasons.length || state.reasonCursor >= state.reasonDeck.length) {
    state.reasonDeck = shuffledIndexes(reasons.length, Number(state.lastReasonIndex ?? -1));
    state.reasonCursor = 0;
  }
  const index = state.reasonDeck[state.reasonCursor++];
  state.lastReasonIndex = index;
  saveState();
  $("#reason-text").textContent = reasons[index];
  return index;
}

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2100);
}

function burstAt(x = window.innerWidth / 2, y = window.innerHeight / 2, amount = 8) {
  amount = Math.min(amount, window.innerWidth < 520 ? 5 : 9);
  const marks = ["💕", "🌸", "✨", "💗", "🎀"];
  for (let i = 0; i < amount; i++) {
    const dot = document.createElement("span");
    dot.className = "tap-burst";
    dot.textContent = marks[i % marks.length];
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
    dot.style.setProperty("--dx", `${(Math.random() - .5) * 120}px`);
    dot.style.setProperty("--dy", `${-40 - Math.random() * 110}px`);
    dot.style.setProperty("--rot", `${(Math.random() - .5) * 80}deg`);
    document.body.appendChild(dot);
    setTimeout(() => dot.remove(), 900);
  }
}

function flowerConfetti(amount = 56) {
  amount = Math.min(amount, window.innerWidth < 520 ? 24 : 48);
  for (let i = 0; i < amount; i++) {
    const piece = document.createElement("span");
    piece.className = "flower-confetti";
    piece.textContent = celebrationPieces[i % celebrationPieces.length];
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.setProperty("--fall", `${2.6 + Math.random() * 2.4}s`);
    piece.style.setProperty("--drift", `${(Math.random() - .5) * 180}px`);
    piece.style.setProperty("--delay", `${Math.random() * .5}s`);
    piece.style.setProperty("--spin", `${(Math.random() - .5) * 360}deg`);
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 5600);
  }
}

function finishIntro() {
  const loader = $("#intro-loader");
  if (!loader) return;
  setTimeout(() => {
    loader.classList.add("done");
    setTimeout(() => loader.remove(), 700);
  }, 680);
}

function flowerPageTransition() {
  if (document.body.classList.contains("app-locked") || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const veil = document.createElement("div");
  veil.className = "page-flower-transition";
  const flowers = ["🌸", "🌹", "🌷", "🪻", "🪷", "🌺", "💗", "🌸", "🌹", "🌷"];
  flowers.forEach((flower, index) => {
    const petal = document.createElement("i");
    petal.textContent = flower;
    petal.className = `flower-flight flight-${index % 4}`;
    petal.style.left = `${4 + index * 10}%`;
    petal.style.top = `${12 + (index % 3) * 24}%`;
    petal.style.setProperty("--delay", `${index * .025}s`);
    petal.style.setProperty("--size", `${2.3 + (index % 4) * .55}rem`);
    petal.style.setProperty("--sway", `${(index % 2 ? 1 : -1) * (80 + index * 7)}px`);
    veil.appendChild(petal);
  });
  document.body.appendChild(veil);
  setTimeout(() => veil.remove(), 1800);
}

function ensureScreenRendered(name) {
  if (renderedScreens.has(name)) return;
  const renderers = {
    garden: setupGardenTree,
    letters: renderLetters,
    poems: renderPoems,
    notices: renderNotices,
    day: renderDay,
    places: renderPlaces,
    songs: renderSongs,
    promises: renderPromises,
    distance: renderDistance,
    reasons: renderReasons,
    memory: renderMemory,
    birthday: renderBirthday,
    care: renderCare,
    games: renderGames,
    doodles: () => { renderWidgets(); setupCanvas(); }
  };
  renderers[name]?.();
  renderedScreens.add(name);
}

function openScreen(name, options = {}) {
  ensureScreenRendered(name);
  const current = document.body.dataset.world || "home";
  const changed = current !== name;
  if (changed && !options.fromBack) screenHistory.push(current);
  state.lastWorld = name;
  saveState();
  document.body.dataset.world = name;
  const backButton = $("#back-button");
  if (backButton) backButton.classList.toggle("hidden", name === "home");
  $$(".screen").forEach(s => s.classList.toggle("active", s.id === `screen-${name}`));
  $$(".tab").forEach(t => t.classList.toggle("active", t.dataset.open === name));
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (name === "doodles") requestAnimationFrame(resizeCanvas);
  if (name === "garden") requestAnimationFrame(resizeGardenTree);
  if (name === "games") fetchBubbleScores();
  if (name === "songs") {
    $$(".spotify-card iframe[data-src]").forEach(frame => {
      if (!frame.getAttribute("src")) frame.setAttribute("src", frame.dataset.src);
    });
  }
  if (changed) flowerPageTransition();
  revealNav(2600);
}

function goBack() {
  if ($("#letter-modal")?.open) return $("#letter-modal").close();
  if ($("#world-modal")?.open) return $("#world-modal").close();
  let destination = screenHistory.pop() || "home";
  if (destination === document.body.dataset.world) destination = "home";
  openScreen(destination, { fromBack: true });
}

function setMood(mood) {
  selectedMood = mood;
  state.mood = mood;
  saveState();
  $$(".mood-chip").forEach(btn => btn.classList.toggle("active", btn.dataset.mood === mood));
  $("#comfort-note").textContent = nextComfort(mood);
  saveState();
  if (window.Poo) window.Poo.setMood(mood);
}

function renderAtlas() {
  const html = worlds.map((world, i) => `
    <button class="world-tile tone-${world.tone}" data-open="${world.id}" type="button" style="--i:${i}">
      <span class="world-icon">${world.icon}</span>
      <span class="world-copy">
        <strong>${world.title}</strong>
        <small>${world.sub}</small>
      </span>
      <span class="world-count">${world.count}</span>
    </button>
  `).join("");
  $("#home-worlds").innerHTML = html;
  $("#atlas-grid").innerHTML = html;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function renderLetters() {
  $("#letter-list").innerHTML = letters.map((letter, i) => `
    <button class="letter-card letter-folder theme-${letter.theme}" type="button" data-letter="${i}">
      <span class="folder-tab">${escapeHtml(letter.tab)}</span>
      <span class="seal">${String(i + 1).padStart(2, "0")}</span>
      <span class="folder-icon" aria-hidden="true"></span>
      <h3>${escapeHtml(letter.title)}</h3>
      <p>${escapeHtml(letter.preview)}</p>
      <small>tap to open the letter</small>
    </button>
  `).join("");
}

function renderPoems() {
  $("#poem-list").innerHTML = poems.map(([title, form, body]) => `
    <article class="poem-card premium-card">
      <p class="card-label">${escapeHtml(form || "after midnight")}</p>
      <h3>${escapeHtml(title)}</h3>
      <pre>${escapeHtml(body)}</pre>
    </article>
  `).join("");
}

function renderNotices() {
  $("#notice-list").innerHTML = notices.map((notice, i) => `
    <article class="notice-note" style="--r:${(i % 5) - 2}deg">
      <span>${String(i + 1).padStart(2, "0")}</span>
      <p>${notice}</p>
    </article>
  `).join("");
}

function renderDay() {
  $("#day-timeline").innerHTML = dayPlan.map(([time, text]) => `
    <article class="timeline-row">
      <time>${time}</time>
      <p>${text}</p>
    </article>
  `).join("");
}

function renderPlaces() {
  const list = futureWorlds.length ? futureWorlds : places.map(([name, image, intro]) => ({ name, intro, eyebrow: "future coordinate", photos: [image], moments: [] }));
  $("#place-rail").innerHTML = list.map((place, index) => `
    <button class="world-portal" type="button" data-world-portal="${index}">
      <img src="${escapeHtml(place.photos[0])}" alt="${escapeHtml(place.name)}" loading="${index < 2 ? "eager" : "lazy"}" fetchpriority="${index < 2 ? "high" : "low"}" decoding="async" width="960" height="720" onerror="this.closest('.world-portal').classList.add('image-unavailable');this.remove()">
      <span class="world-portal-copy">
        <span class="portal-number">world ${String(index + 1).padStart(2, "0")}</span>
        <h3>${escapeHtml(place.name)}</h3>
        <p>${escapeHtml(place.eyebrow)}</p>
        <small>enter this world · ${place.photos.length} scenes · ${place.moments.length} moments</small>
      </span>
    </button>
  `).join("");
}

function openFutureWorld(index) {
  const place = futureWorlds[index];
  if (!place) return;
  const modal = $("#world-modal");
  $("#world-modal-body").innerHTML = `
    <section class="world-hero" style="background-image:url('${escapeHtml(place.photos[0])}')">
      <div><p class="card-label">${escapeHtml(place.eyebrow)}</p><h2>${escapeHtml(place.name)}</h2><p>One of the futures I keep imagining with you.</p></div>
    </section>
    <p class="world-intro">${escapeHtml(place.intro)}</p>
    ${place.photos.length > 1 ? `<div class="world-gallery"><figure><img src="${escapeHtml(place.photos[1])}" alt="A second scene from ${escapeHtml(place.name)}" loading="eager" decoding="async" width="960" height="720" onerror="this.closest('figure').remove()"><figcaption>one more view from our little world</figcaption></figure></div>` : ""}
    <div class="world-moments">${place.moments.map(([title, text], momentIndex) => `<article class="world-moment"><span>experience ${String(momentIndex + 1).padStart(2, "0")}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p></article>`).join("")}</div>
  `;
  document.body.classList.add("focus-mode");
  modal.showModal();
  flowerPageTransition();
}

function renderSongs() {
  $("#song-list").innerHTML = songs.map(([name, artist, note, spotifyId], i) => `
    <article class="song-card spotify-card premium-card">
      <div class="song-note">
        <p class="card-label">track ${String(i + 1).padStart(2, "0")}</p>
        <h3>${escapeHtml(name)}</h3>
        <strong>${escapeHtml(artist)}</strong>
        <p>${escapeHtml(note)}</p>
      </div>
      ${spotifyId ? `<iframe title="Play ${escapeHtml(name)} on Spotify" data-src="https://open.spotify.com/embed/track/${encodeURIComponent(spotifyId)}?utm_source=generator&theme=0" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>` : ""}
    </article>
  `).join("");
}

function renderPromises() {
  $("#promise-list").innerHTML = promises.map((promise, i) => `
    <article class="promise-row premium-card">
      <span>Promise ${i + 1}</span>
      <p>${promise}</p>
    </article>
  `).join("");
}

function renderDistance() {
  $("#distance-list").innerHTML = distanceBeacons.map(([title, text]) => `
    <article class="beacon-card">
      <div class="signal"></div>
      <h3>${title}</h3>
      <p>${text}</p>
    </article>
  `).join("");
}

function renderReasons() {
  nextReason();
  $("#reason-stack").innerHTML = reasons.map((r, i) => `<div class="reason-chip">${i + 1}. ${r}</div>`).join("");
}

function renderMemory() {
  $("#memory-list").innerHTML = memories.map(([title, text], i) => `
    <article class="memory-polaroid" style="--r:${[-2,1.5,-1,2,-1.5][i % 5]}deg">
      <div class="fake-photo">${["🌙","📞","💬","🛫","💗"][i % 5]}</div>
      <h3>${title}</h3>
      <p>${text}</p>
    </article>
  `).join("");
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - clamp01(value), 3);
}

function easeInOut(value) {
  const t = clamp01(value);
  return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function seededGardenRandom(seed = 1347) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function buildGardenPetals() {
  const rand = seededGardenRandom();
  const colors = ["#c9142f", "#e51d43", "#ff355d", "#ff5b7e", "#ff799a", "#f6a7bb", "#ffc3cf", "#d92d68"];
  const petals = [];
  let guard = 0;

  while (petals.length < 560 && guard < 14000) {
    guard += 1;
    const x = rand() * 2.62 - 1.31;
    const y = rand() * 2.44 - 1.18;
    const heart = Math.pow(x * x + y * y - 1, 3) - x * x * Math.pow(y, 3);
    if (heart > 0) continue;

    const edgeBias = Math.pow(rand(), .72);
    petals.push({
      x: 160 + x * (104 - edgeBias * 7) + (rand() - .5) * 12,
      y: 152 - y * (92 - edgeBias * 5) + (rand() - .5) * 10,
      fromX: 156 + (rand() - .5) * 38,
      fromY: 318 - rand() * 78,
      size: 4.2 + rand() * 7.8,
      rot: (rand() - .5) * 1.8,
      color: colors[Math.floor(rand() * colors.length)],
      delay: rand() * .52,
      shine: rand() > .78
    });
  }

  const branchCanopy = [
    [78, 151], [94, 187], [111, 219], [246, 129], [231, 163], [212, 202],
    [114, 98], [126, 129], [207, 70], [198, 105], [146, 64], [180, 54],
    [95, 232], [118, 250], [244, 212], [222, 233]
  ];
  branchCanopy.forEach(([anchorX, anchorY], branchIndex) => {
    for (let i = 0; i < 8; i += 1) {
      petals.push({
        x: anchorX + (rand() - .5) * 34,
        y: anchorY + (rand() - .5) * 30,
        fromX: 158 + (rand() - .5) * 24,
        fromY: 320 - rand() * 58,
        size: 5.2 + rand() * 7.2,
        rot: (rand() - .5) * 1.9,
        color: colors[(branchIndex + i) % colors.length],
        delay: .12 + rand() * .44,
        shine: rand() > .58
      });
    }
  });

  return petals;
}

function resizeGardenTree() {
  if (!gardenTreeCanvas) return;
  const rect = gardenTreeCanvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth <= 620 ? 1.35 : 2);
  gardenTreeCanvas.dataset.dpr = String(dpr);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (gardenTreeCanvas.width !== width || gardenTreeCanvas.height !== height) {
    gardenTreeCanvas.width = width;
    gardenTreeCanvas.height = height;
  }
  drawGardenTree(gardenProgress);
}

function curvePoint(curve, t) {
  const mt = 1 - t;
  return [
    mt ** 3 * curve[0][0] + 3 * mt * mt * t * curve[1][0] + 3 * mt * t * t * curve[2][0] + t ** 3 * curve[3][0],
    mt ** 3 * curve[0][1] + 3 * mt * mt * t * curve[1][1] + 3 * mt * t * t * curve[2][1] + t ** 3 * curve[3][1]
  ];
}

function drawCurve(ctx, curve, progress, width, color) {
  if (progress <= 0) return;
  const steps = Math.max(4, Math.ceil(44 * clamp01(progress)));
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  const start = curvePoint(curve, 0);
  ctx.moveTo(start[0], start[1]);
  for (let i = 1; i <= steps; i += 1) {
    const pt = curvePoint(curve, clamp01((i / steps) * progress));
    ctx.lineTo(pt[0], pt[1]);
  }
  ctx.stroke();
  ctx.restore();
}

function drawHeartPetal(ctx, x, y, size, rotation, color, alpha, scale = 1, glow = false) {
  if (alpha <= 0) return;
  const s = size * scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(s, s);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = .85;
  }
  ctx.strokeStyle = "rgba(255,255,255,.24)";
  ctx.lineWidth = .08;
  ctx.beginPath();
  ctx.moveTo(0, -.72);
  ctx.bezierCurveTo(.58, -1.08, 1.04, -.42, .72, .17);
  ctx.bezierCurveTo(.5, .58, .1, .83, 0, 1.04);
  ctx.bezierCurveTo(-.1, .83, -.5, .58, -.72, .17);
  ctx.bezierCurveTo(-1.04, -.42, -.58, -1.08, 0, -.72);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawGardenTree(progress = 0.16) {
  if (!gardenTreeCanvas || !gardenTreeCtx) return;
  const ctx = gardenTreeCtx;
  const dpr = Number(gardenTreeCanvas.dataset.dpr || 1);
  const w = gardenTreeCanvas.width / dpr;
  const h = gardenTreeCanvas.height / dpr;
  const scale = Math.min(w / 320, h / 390);
  const ox = (w - 320 * scale) / 2;
  const oy = (h - 390 * scale) / 2;
  const wind = Math.sin(performance.now() / 900) * 2.2;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);

  const glow = ctx.createRadialGradient(166, 165, 20, 166, 165, 170);
  glow.addColorStop(0, "rgba(255,92,133,.17)");
  glow.addColorStop(.55, "rgba(255,173,196,.08)");
  glow.addColorStop(1, "rgba(255,173,196,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(166, 164, 170, 145, 0, 0, Math.PI * 2);
  ctx.fill();

  const trunkProgress = easeOutCubic(progress / .42);
  drawCurve(ctx, [[158, 365], [154, 296], [151, 207], [164, 48]], trunkProgress, 19, "#7a471f");
  drawCurve(ctx, [[164, 363], [160, 294], [158, 204], [169, 58]], trunkProgress, 8, "rgba(122,73,36,.48)");

  [
    { c: [[160, 267], [122, 236], [92, 200], [73, 150]], w: 8, start: .24 },
    { c: [[160, 241], [202, 216], [232, 174], [251, 126]], w: 8, start: .27 },
    { c: [[162, 207], [125, 182], [110, 139], [113, 95]], w: 6.6, start: .31 },
    { c: [[165, 177], [196, 152], [212, 110], [207, 68]], w: 6.6, start: .34 },
    { c: [[158, 153], [137, 130], [136, 96], [146, 63]], w: 5.2, start: .39 },
    { c: [[166, 138], [186, 111], [186, 80], [180, 51]], w: 5.2, start: .42 },
    { c: [[154, 299], [129, 286], [106, 263], [92, 232]], w: 5.4, start: .28 },
    { c: [[164, 288], [203, 276], [231, 246], [246, 211]], w: 5.4, start: .33 }
  ].forEach(branch => drawCurve(ctx, branch.c, easeOutCubic((progress - branch.start) / .28), branch.w, "#78502c"));

  const bloom = easeInOut((progress - .46) / .52);
  if (bloom > 0) {
    gardenPetals.forEach((petal, index) => {
      const appear = easeOutCubic((bloom - petal.delay) / .62);
      if (appear <= 0) return;
      const x = petal.fromX + (petal.x - petal.fromX) * appear + Math.sin(performance.now() / 650 + index) * wind * appear * .18;
      const y = petal.fromY + (petal.y - petal.fromY) * appear - Math.sin(appear * Math.PI) * 22;
      drawHeartPetal(ctx, x, y, petal.size, petal.rot + wind * .016, petal.color, .1 + appear * .9, .28 + appear * .8, petal.shine);
      if (petal.shine && appear > .82) {
        drawHeartPetal(ctx, x - 1.5, y - 1.8, petal.size * .38, petal.rot, "#fff0f4", (appear - .82) * 1.2, .75);
      }
    });
  }

  ctx.restore();
}

function setupGardenTree() {
  if (gardenTreeCanvas) return;
  gardenTreeCanvas = $("#garden-tree-canvas");
  if (!gardenTreeCanvas) return;
  gardenTreeCtx = gardenTreeCanvas.getContext("2d");
  gardenPetals = buildGardenPetals();
  resizeGardenTree();
  window.addEventListener("resize", resizeGardenTree);
}

function animateGardenTree() {
  if (!gardenTreeCanvas) return;
  if (gardenAnimationFrame) cancelAnimationFrame(gardenAnimationFrame);
  const start = performance.now();
  const duration = GARDEN_BLOOM_DURATION;
  gardenProgress = 0;
  let lastPaint = -Infinity;

  function tick(now) {
    gardenProgress = easeInOut((now - start) / duration);
    if (now - lastPaint >= 32 || gardenProgress >= 1) {
      drawGardenTree(gardenProgress);
      lastPaint = now;
    }
    if (gardenProgress < 1) {
      gardenAnimationFrame = requestAnimationFrame(tick);
    } else {
      gardenProgress = 1;
      drawGardenTree(1);
      gardenAnimationFrame = null;
    }
  }

  gardenAnimationFrame = requestAnimationFrame(tick);
}

function bloomGarden() {
  const stage = $("#garden-stage");
  stage?.classList.add("bloomed");
  $(".home-garden")?.classList.add("bloomed");
  resizeGardenTree();
  animateGardenTree();
  clearTimeout(gardenCelebrationTimer);
  gardenCelebrationTimer = setTimeout(() => {
    flowerConfetti(44);
    burstAt(window.innerWidth / 2, window.innerHeight / 2, 16);
    toast("look, Moonpie. Your garden is blooming");
    if (window.Poo) window.Poo.react("love");
  }, GARDEN_BLOOM_DURATION - 1200);
}

const girlfriendDayCompliments = [
  "You make ordinary Tuesdays feel like an event.",
  "You are the softest, funniest, most stubbornly loving person I know.",
  "You argue like you mean it and love like you mean it more.",
  "You are worth every time zone and every bad connection call.",
  "You have never once made me feel silly for how much I adore you.",
  "You are the calmest chaos I have ever loved.",
  "Whatever room you are in becomes the good one.",
];

const girlfriendDayDares = [
  "Send me a voice note laughing on purpose, badly, right now.",
  "Take a selfie making the face you make when you see my texts.",
  "Describe today in exactly one word and send it with no context.",
  "Play our song out loud for fifteen seconds, wherever you are.",
  "Text me the last thing that made you smile before this app did.",
  "Look in a mirror and say one nice thing about yourself. Out loud. I'll wait.",
  "Send me a voice memo of you saying my name the way you say it when I do something dumb.",
];

const girlfriendDayFutures = [
  "A rooftop dinner the night we finally land in the same city.",
  "A slow, boring Sunday morning where neither of us has anywhere to be.",
  "Getting lost somewhere on purpose, just to see what you'd say about it.",
  "Cooking something ambitious and ruining it together, laughing the whole time.",
  "Falling asleep mid-conversation because we are finally in the same room.",
  "An ordinary grocery run that takes two hours because we won't stop talking.",
  "Meeting your people, and mine, in the same loud, warm room.",
];

const giftKinds = {
  compliment: { label: "a compliment", list: girlfriendDayCompliments },
  song: { label: "a song for today", list: songs },
  promise: { label: "a promise", list: promises },
  dare: { label: "a tiny dare", list: girlfriendDayDares },
  future: { label: "a future we're owed", list: girlfriendDayFutures },
};

function nextGiftIndex(kind, listLength) {
  if (!state.giftMemory || typeof state.giftMemory !== "object") state.giftMemory = {};
  const mem = state.giftMemory[kind] && Array.isArray(state.giftMemory[kind].deck)
    ? state.giftMemory[kind]
    : { deck: [], cursor: 0, last: -1 };
  if (mem.deck.length !== listLength || mem.cursor >= mem.deck.length) {
    mem.deck = shuffledIndexes(listLength, mem.last);
    mem.cursor = 0;
  }
  const index = mem.deck[mem.cursor++];
  mem.last = index;
  state.giftMemory[kind] = mem;
  saveState();
  return index;
}

function revealGift(kind, box) {
  box?.classList.add("opened");
  const panel = $("#gift-reveal");
  if (!panel) return;
  navigator.vibrate?.(20);
  const rect = box?.getBoundingClientRect();
  burstAt(rect ? rect.left + rect.width / 2 : window.innerWidth / 2, rect ? rect.top : window.innerHeight / 2, 10);
  let html = "";
  if (kind === "hug") {
    html = `<p class="card-label">from Poo</p><p>She heard it's Girlfriend Day too. Go say hi to her.</p>`;
    window.Poo?.react?.("love");
  } else if (kind === "dance") {
    html = `<p class="card-label">a slow dance</p><p>She's already spinning. Go open her up.</p>`;
    window.Poo?.open?.();
    setTimeout(() => window.Poo?.react?.("dance"), 250);
  } else if (kind === "moonwish") {
    const info = moonPhaseInfo(new Date());
    html = `<p class="card-label">a wish on tonight's moon</p><h3>${info.emoji} ${escapeHtml(info.name)}</h3><p>Make a wish on it. Wherever you are, I'm looking at the same one.</p>`;
  } else if (giftKinds[kind]) {
    const { label, list } = giftKinds[kind];
    const index = nextGiftIndex(kind, list.length);
    const entry = list[index];
    if (kind === "song") {
      const [title, artist, note] = entry;
      html = `<p class="card-label">${escapeHtml(label)}</p><h3>${escapeHtml(title)}</h3><p class="gift-song-artist">${escapeHtml(artist)}</p><p>${escapeHtml(note)}</p>`;
    } else {
      html = `<p class="card-label">${escapeHtml(label)}</p><p>${escapeHtml(entry)}</p>`;
    }
  }
  panel.innerHTML = html;
  panel.classList.remove("hidden");
  flowerConfetti(30);
}

function renderBirthday() {
  $("#birthday-wish").innerHTML = `
    <div class="birthday-stage" data-birthday-stage="wish">
      <p class="card-label">it's girlfriend day</p>
      <div class="wish-moon">🌙</div>
      <h2>Make a wish, Michelle.</h2>
      <p>Write it here or keep it secret. Either way, I am rooting for every soft thing your heart asks for.</p>
      <textarea id="birthday-wish-text" rows="3" maxlength="180" placeholder="my wish is..."></textarea>
      <button class="primary-btn wide" id="seal-wish" type="button">seal my wish</button>
    </div>

    <div class="birthday-stage hidden" data-birthday-stage="letter">
      <p class="card-label">wish sealed</p>
      <div class="birthday-envelope">💌</div>
      <h2>Happy Girlfriend Day, Michelle.</h2>
      <p class="birthday-letter">You deserve more than a page. You deserve a little universe that stays on your phone, waits quietly, and opens whenever missing me gets loud.</p>
      <p class="birthday-letter">My Moonpie. My Princess. My babyy. I love you in every screen, every letter, every future place, every silly widget, and every ordinary day we have not reached yet.</p>
      <p class="birthday-letter">Whatever you wished for, I hope life is gentle enough to bring it close. And if your wish has anything to do with us, I am already walking toward it.</p>
      <button class="secondary-btn wide" id="replay-birthday" type="button">make another wish</button>
    </div>
  `;
}

function renderCare() {
  $("#care-list").innerHTML = careSteps.map(([n, title, text]) => `
    <article class="care-step"><span>${n}</span><div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p></div></article>
  `).join("");
}

function showCareResponse(mode) {
  const response = careResponses[mode];
  if (!response) return;
  $$("[data-care-mode]").forEach(button => button.classList.toggle("active", button.dataset.careMode === mode));
  $("#care-response").innerHTML = `<span>${response[0]}</span><h3>${escapeHtml(response[1])}</h3><p>${escapeHtml(response[2])}</p>`;
  burstAt(window.innerWidth / 2, Math.min(window.innerHeight * .62, 520), 8);
  if (window.Poo) window.Poo.react("shy");
}

let breathingTimer = null;
function startBreathingCare() {
  if (breathingTimer) return;
  const orb = $("#breathing-orb");
  const copy = $("#breathing-copy");
  const button = $("#start-breathing");
  const phases = [
    { label: "breathe in", seconds: 4, className: "inhale" },
    { label: "hold softly", seconds: 2, className: "hold" },
    { label: "breathe out", seconds: 6, className: "exhale" }
  ];
  let round = 1;
  let phaseIndex = 0;
  let remaining = phases[0].seconds;
  button.disabled = true;
  const paint = () => {
    const phase = phases[phaseIndex];
    orb.className = `breathing-orb ${phase.className}`;
    orb.innerHTML = `<span>${phase.label}<br><strong>${remaining}</strong></span>`;
    copy.textContent = `Round ${round} of 3. Stay with my count, babyy.`;
  };
  paint();
  breathingTimer = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      phaseIndex += 1;
      if (phaseIndex >= phases.length) {
        phaseIndex = 0;
        round += 1;
        if (round > 3) {
          clearInterval(breathingTimer);
          breathingTimer = null;
          orb.className = "breathing-orb complete";
          orb.innerHTML = "<span>still here<br>with you</span>";
          copy.textContent = "Three full breaths. Your body did something kind for you. I am proud of you.";
          button.disabled = false;
          button.textContent = "breathe together again";
          flowerConfetti(18);
          if (window.Poo) window.Poo.react("cheer");
          return;
        }
      }
      remaining = phases[phaseIndex].seconds;
    }
    paint();
  }, 1000);
}

function renderGames() {
  const challenge = challenges[state.challengeIndex % challenges.length];
  $("#challenge-title").textContent = challenge[0];
  $("#challenge-text").textContent = challenge[1];
  $("#bubble-score").textContent = "0";
  renderBubbleLeaderboard(state.bubbleBestByProfile || {});
}

let bubbleScore = 0;
let bubbleTimer = null;
let bubbleClock = null;
let bubbleRoundActive = false;
let bubbleRoundStarted = 0;
let bubbleSpawned = 0;
let bubbleHits = 0;
let bubbleMisses = 0;
let bubbleCombo = 0;
let bubbleMaxCombo = 0;
let bubbleWrongTaps = 0;
let bubbleOccupiedSlots = new Set();
let bubbleTarget = "heart";
const SCORE_API = "../api/scores?room=moonpie-score-v1";

function updateBubbleHud() {
  $("#bubble-score").textContent = String(bubbleScore);
  $("#bubble-combo").textContent = `x${bubbleCombo}`;
  const attempts = bubbleHits + bubbleMisses + bubbleWrongTaps;
  $("#bubble-accuracy").textContent = `${attempts ? Math.round((bubbleHits / attempts) * 100) : 100}%`;
  const cue = $("#bubble-cue");
  if (cue) cue.textContent = bubbleTarget === "flower" ? "Catch flowers now" : "Catch pink hearts now";
}

function renderBubbleLeaderboard(scores = {}) {
  ["Michelle", "Michael"].forEach(profile => {
    const card = $(`[data-score-player="${profile}"]`);
    if (!card) return;
    const result = scores[profile];
    card.querySelector("strong").textContent = String(result?.score || 0);
    card.querySelector("small").textContent = result?.score
      ? `${Math.round(result.accuracy || 0)}% accuracy · x${result.maxCombo || 0} combo`
      : "waiting for a round";
    card.classList.toggle("leading", Number(result?.score || 0) === Math.max(...Object.values(scores).map(item => Number(item?.score || 0)), 1));
  });
}

async function fetchBubbleScores() {
  try {
    const response = await fetch(SCORE_API, { cache: "no-store", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("scoreboard unavailable");
    const data = await response.json();
    const scores = {};
    (data.scores || []).forEach(result => { if (result?.profile) scores[result.profile] = result; });
    state.bubbleBestByProfile = scores;
    saveState();
    renderBubbleLeaderboard(scores);
  } catch {
    renderBubbleLeaderboard(state.bubbleBestByProfile || {});
  }
}

async function submitBubbleScore(result) {
  const current = state.bubbleBestByProfile?.[state.profile];
  if (!current || result.score >= Number(current.score || 0)) {
    state.bubbleBestByProfile = { ...(state.bubbleBestByProfile || {}), [state.profile]: { ...result, profile: state.profile } };
    renderBubbleLeaderboard(state.bubbleBestByProfile);
    saveState();
  }
  try {
    await fetch(SCORE_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...result, profile: state.profile }) });
    await fetchBubbleScores();
  } catch { toast("score saved here; shared board will reconnect"); }
}

function startBubbleGame() {
  const field = $("#bubble-field");
  if (!field) return;
  clearTimeout(bubbleTimer);
  clearInterval(bubbleClock);
  field.innerHTML = "";
  bubbleScore = 0;
  bubbleSpawned = 0;
  bubbleHits = 0;
  bubbleMisses = 0;
  bubbleCombo = 0;
  bubbleMaxCombo = 0;
  bubbleWrongTaps = 0;
  bubbleOccupiedSlots = new Set();
  bubbleTarget = "heart";
  bubbleRoundActive = true;
  bubbleRoundStarted = performance.now();
  $("#start-bubbles").disabled = true;
  $("#start-bubbles").textContent = "round in progress · go babyy!";
  $("#bubble-time").textContent = "30.0";
  updateBubbleHud();
  scheduleBubble();
  bubbleClock = setInterval(() => {
    const remaining = Math.max(0, 30 - (performance.now() - bubbleRoundStarted) / 1000);
    $("#bubble-time").textContent = remaining.toFixed(1);
    if (remaining <= 0) endBubbleGame();
  }, 100);
  burstAt(window.innerWidth / 2, window.innerHeight / 2, 14);
}

function scheduleBubble() {
  if (!bubbleRoundActive) return;
  const elapsed = (performance.now() - bubbleRoundStarted) / 1000;
  const nextTarget = Math.floor(elapsed / 4) % 2 ? "flower" : "heart";
  if (nextTarget !== bubbleTarget) {
    bubbleTarget = nextTarget;
    $$(".love-bubble", $("#bubble-field")).forEach(bubble => bubble.remove());
    bubbleOccupiedSlots.clear();
    updateBubbleHud();
  }
  spawnBubble();
  const delay = elapsed < 8 ? 560 : elapsed < 17 ? 400 : elapsed < 24 ? 285 : 205;
  bubbleTimer = setTimeout(scheduleBubble, delay);
}

function spawnBubble() {
  const field = $("#bubble-field");
  if (!field || !bubbleRoundActive) return;
  const columns = 4;
  const rows = 4;
  const available = Array.from({ length: columns * rows }, (_, index) => index).filter(index => !bubbleOccupiedSlots.has(index));
  if (!available.length) return;
  const slot = pick(available);
  bubbleOccupiedSlots.add(slot);
  const bubble = document.createElement("button");
  bubble.className = "love-bubble";
  bubble.type = "button";
  const roll = Math.random();
  const kind = roll < .24 ? { emoji: pick(["💔", "☁️", "🫧"]), points: -3, className: "danger", target: "decoy" }
    : roll < .58 ? { emoji: pick(["🌹", "🌸", "🪷", "🌷", "🪻"]), points: 3, className: "bonus", target: "flower" }
      : { emoji: pick(["💗", "💕", "💖", "❤️", "💋"]), points: 2, className: "heart", target: "heart" };
  const elapsed = (performance.now() - bubbleRoundStarted) / 1000;
  const duration = Math.max(.78, 1.95 - elapsed * .038 + Math.random() * .34);
  bubble.classList.add(`bubble-${kind.className}`);
  bubble.dataset.points = String(kind.points);
  bubble.dataset.target = kind.target;
  bubble.dataset.slot = String(slot);
  bubble.textContent = kind.emoji;
  const column = slot % columns;
  const row = Math.floor(slot / columns);
  bubble.style.left = `${5 + column * 24}%`;
  bubble.style.top = `${14 + row * 21}%`;
  bubble.style.setProperty("--life", `${duration}s`);
  bubble.style.setProperty("--size", `${kind.className === "bonus" ? 54 : 48}px`);
  bubble.addEventListener("pointerdown", event => popBubble(bubble, event), { once: true });
  field.appendChild(bubble);
  bubbleSpawned += 1;
  setTimeout(() => {
    if (!bubble.isConnected || bubble.dataset.popped === "true") return;
    if (bubble.dataset.target === bubbleTarget && bubbleRoundActive) {
      bubbleMisses += 1;
      bubbleCombo = 0;
      updateBubbleHud();
    }
    bubbleOccupiedSlots.delete(slot);
    bubble.remove();
  }, duration * 1000);
}

function popBubble(bubble, event) {
  if (!bubble || bubble.dataset.popped === "true") return;
  event?.preventDefault?.();
  event?.stopPropagation?.();
  bubble.dataset.popped = "true";
  const points = Number(bubble.dataset.points || 1);
  const correctTarget = bubble.dataset.target === bubbleTarget;
  if (points < 0 || !correctTarget) {
    bubbleScore = Math.max(0, bubbleScore - (points < 0 ? Math.abs(points) : 2));
    bubbleCombo = 0;
    bubbleWrongTaps += 1;
  } else {
    bubbleHits += 1;
    bubbleCombo += 1;
    bubbleMaxCombo = Math.max(bubbleMaxCombo, bubbleCombo);
    bubbleScore += points + Math.floor(bubbleCombo / 6);
  }
  bubbleOccupiedSlots.delete(Number(bubble.dataset.slot));
  updateBubbleHud();
  const rect = bubble.getBoundingClientRect();
  burstAt(event?.clientX || rect.x + rect.width / 2, event?.clientY || rect.y + rect.height / 2, 7);
  bubble.remove();
}

function endBubbleGame() {
  if (!bubbleRoundActive) return;
  bubbleRoundActive = false;
  clearTimeout(bubbleTimer);
  clearInterval(bubbleClock);
  bubbleTimer = null;
  bubbleClock = null;
  $$(".love-bubble", $("#bubble-field")).forEach(bubble => bubble.remove());
  $("#bubble-time").textContent = "0.0";
  $("#start-bubbles").disabled = false;
  $("#start-bubbles").textContent = "play another 30 second round";
  state.bestBubbleScore = Math.max(state.bestBubbleScore || 0, bubbleScore);
  saveState();
  const attempts = bubbleHits + bubbleMisses + bubbleWrongTaps;
  const result = { score: bubbleScore, accuracy: attempts ? Math.round((bubbleHits / attempts) * 100) : 0, maxCombo: bubbleMaxCombo };
  submitBubbleScore(result);
  flowerConfetti(bubbleScore >= 30 ? 28 : 14);
  toast(`${state.profile}: ${bubbleScore} points · ${result.accuracy}% accuracy · x${bubbleMaxCombo} combo`);
  if (window.Poo) window.Poo.react(bubbleScore >= 30 ? "love" : "cheer");
}

function nextChallenge() {
  state.challengeIndex = (state.challengeIndex + 1) % challenges.length;
  saveState();
  renderGames();
  burstAt(window.innerWidth / 2, window.innerHeight / 2, 8);
}

function rollLoveDice() {
  $("#dice-result").textContent = pick(dicePrompts);
  burstAt(window.innerWidth / 2, window.innerHeight / 2, 10);
  if (window.Poo) window.Poo.react("cheer");
}

function showBirthdayStage(stage) {
  $$("[data-birthday-stage]").forEach(panel => {
    panel.classList.toggle("hidden", panel.dataset.birthdayStage !== stage);
  });
}

function seedOpeningFlowers() {
  const field = $("#opening-petals");
  if (!field || field.childElementCount) return;
  const flowers = ["🌸", "🌹", "🌷", "🪻", "🪷", "🌺", "💗", "🌸", "🌹", "🌷", "🪻", "🪷"];
  flowers.forEach((flower, index) => {
    const piece = document.createElement("i");
    piece.textContent = flower;
    piece.className = `opening-flower flower-path-${index % 4}`;
    piece.style.left = `${4 + (index * 8.2) % 92}%`;
    piece.style.top = `${8 + (index % 4) * 21}%`;
    piece.style.fontSize = `${2.4 + (index % 4) * .65}rem`;
    piece.style.setProperty("--delay", `${-1 * (index % 6) * .55}s`);
    piece.style.setProperty("--drift", `${(index % 2 ? 1 : -1) * (55 + index * 5)}px`);
    field.appendChild(piece);
  });
}

function completeBouquetUnwrap() {
  const button = $("#unwrap-bouquet");
  if (button?.classList.contains("untied")) return;
  button?.classList.add("untied");
  navigator.vibrate?.([35, 45, 35]);
  flowerConfetti(90);
  burstAt(window.innerWidth / 2, window.innerHeight * .36, 18);
  setTimeout(() => {
    $("#opening-listen")?.classList.add("hidden");
    $("#opening-reveal")?.classList.remove("hidden");
    flowerConfetti(72);
  }, 550);
}

function enterUniverse() {
  const opening = $("#birthday-opening");
  opening?.classList.add("leaving");
  document.body.classList.remove("app-locked");
  state.hasEnteredUniverse = true;
  saveState();
  setupWidgetSync();
  flowerPageTransition();
  setTimeout(() => opening?.remove(), 700);
}

function setupOpeningRitual() {
  if (state.hasEnteredUniverse) {
    document.body.classList.remove("app-locked");
    $("#entry-gate")?.remove();
    $("#birthday-opening")?.remove();
    return;
  }
  seedOpeningFlowers();
  let selectedProfile = state.profile || "Michelle";
  $$(".profile-option").forEach(button => {
    button.classList.toggle("active", button.dataset.profile === selectedProfile);
    button.addEventListener("click", () => {
      selectedProfile = button.dataset.profile;
      $$(".profile-option").forEach(option => option.classList.toggle("active", option === button));
    });
  });
  $("#passkey-form")?.addEventListener("submit", event => {
    event.preventDefault();
    const input = $("#passkey-input");
    if (input.value !== "2502") {
      $("#passkey-error").textContent = "That date did not open it. Think of the day that became ours.";
      input.value = "";
      input.focus();
      $(".gate-card")?.classList.remove("wrong-key");
      requestAnimationFrame(() => $(".gate-card")?.classList.add("wrong-key"));
      return;
    }
    state.profile = selectedProfile;
    saveState();
    $("#passkey-error").textContent = "";
    $("#entry-gate")?.classList.add("leaving");
    $("#birthday-opening")?.classList.remove("hidden");
    setTimeout(() => $("#entry-gate")?.remove(), 650);
  });
  $("#unwrap-bouquet")?.addEventListener("click", completeBouquetUnwrap);
  $("#enter-universe")?.addEventListener("click", enterUniverse);
}

function sealBirthdayWish() {
  const wish = $("#birthday-wish-text")?.value.trim();
  showBirthdayStage("letter");
  flowerConfetti(72);
  burstAt(window.innerWidth / 2, window.innerHeight / 2, 20);
  toast(wish ? "wish sealed. letter unlocked." : "secret wish sealed. letter unlocked.");
}

function replayBirthday() {
  renderBirthday();
  toast("make a new wish");
}

function renderWidgets() {
  const list = $("#widget-list");
  if (!state.widgets.length) {
    list.innerHTML = `<article class="saved-widget"><strong>No widgets saved yet.</strong><p>I have not left you a tiny note here yet.</p></article>`;
    return;
  }
  list.innerHTML = state.widgets.map((widget, index) => ({ ...widget, index })).slice().reverse().map(w => `
    <article class="saved-widget">
      <button class="delete-widget" type="button" data-delete-widget="${w.id || w.createdAt || w.index}" aria-label="delete widget">delete</button>
      <span class="shared-widget-sender">from ${escapeHtml(w.sender || "one of us")}</span>
      ${w.type === "doodle" ? `<img src="${w.value}" alt="saved handwritten widget">` : `<p>${escapeHtml(w.value)}</p>`}
      <time>${new Date(w.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</time>
    </article>
  `).join("");
}

function renderLatestWidget() {
  const latest = state.widgets[state.widgets.length - 1];
  const box = $("#latest-widget");
  if (!latest) {
    box.innerHTML = `<div class="card-label">latest widget</div><p>No widget yet. I will leave something here for the next time you miss me.</p>`;
    return;
  }
  box.innerHTML = `<div class="card-label">latest widget · from ${escapeHtml(latest.sender || "one of us")}</div>${latest.type === "doodle" ? `<img src="${latest.value}" alt="latest doodle">` : `<p>${escapeHtml(latest.value)}</p>`}`;
}

let canvas, ctx, strokes = [], activeStroke = null;

function setupCanvas() {
  if (canvas) return;
  canvas = $("#doodle-canvas");
  if (!canvas) return;
  ctx = canvas.getContext("2d");
  resizeCanvas();
  window.addEventListener("resize", () => requestAnimationFrame(resizeCanvas));
  canvas.addEventListener("pointerdown", startStroke);
  canvas.addEventListener("pointermove", moveStroke);
  canvas.addEventListener("pointerup", endStroke);
  canvas.addEventListener("pointerleave", endStroke);
  canvas.addEventListener("pointercancel", endStroke);
  canvas.addEventListener("touchstart", startTouchStroke, { passive: false });
  canvas.addEventListener("touchmove", moveTouchStroke, { passive: false });
  canvas.addEventListener("touchend", endStroke);
  canvas.addEventListener("touchcancel", endStroke);
}

function resizeCanvas() {
  if (!canvas) return;
  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  redrawCanvas();
}

function pointFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  const source = e.touches?.[0] || e.changedTouches?.[0] || e;
  return { x: source.clientX - rect.left, y: source.clientY - rect.top };
}

function startStroke(e) {
  e.preventDefault();
  if (e.pointerId != null) {
    try { canvas.setPointerCapture?.(e.pointerId); } catch { /* capture can fail on older mobile webviews */ }
  }
  activeStroke = { color: $("#ink-color").value, width: 4.5, points: [pointFromEvent(e)] };
  strokes.push(activeStroke);
  redrawCanvas();
}

function moveStroke(e) {
  if (!activeStroke) return;
  e.preventDefault();
  activeStroke.points.push(pointFromEvent(e));
  redrawCanvas();
}

function startTouchStroke(e) {
  if (window.PointerEvent) return;
  startStroke(e);
}

function moveTouchStroke(e) {
  if (window.PointerEvent) return;
  moveStroke(e);
}

function endStroke() {
  activeStroke = null;
}

function redrawCanvas() {
  if (!ctx) return;
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  strokes.forEach(stroke => {
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.beginPath();
    stroke.points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.stroke();
  });
}

function saveDoodle() {
  resizeCanvas();
  if (!strokes.length) return toast("draw something first");
  const createdAt = Date.now();
  const widget = { id: `doodle-${createdAt}`, type: "doodle", value: canvas.toDataURL("image/webp", .72), createdAt, sender: state.profile || "Michelle", syncPending: true };
  state.widgets.push(widget);
  strokes = [];
  redrawCanvas();
  saveState();
  renderWidgets();
  renderLatestWidget();
  showLoveNotification(state.widgets[state.widgets.length - 1], "Handwritten widget saved");
  pushSharedWidget(widget);
  burstAt(window.innerWidth / 2, window.innerHeight - 150, 12);
  toast("handwritten widget saved");
}

function toggleDoodleExpand() {
  const expanded = document.body.classList.toggle("doodle-expanded");
  const button = $("#expand-doodle");
  if (button) {
    button.textContent = expanded ? "×" : "⛶";
    button.setAttribute("aria-label", expanded ? "close big drawing page" : "make drawing bigger");
  }
  setTimeout(resizeCanvas, 80);
}

function saveTextWidget() {
  const text = $("#widget-text").value.trim();
  if (!text) return toast("write a tiny note first");
  const createdAt = Date.now();
  const widget = { id: `text-${createdAt}`, type: "text", value: text, createdAt, sender: state.profile || "Michelle", syncPending: true };
  state.widgets.push(widget);
  $("#widget-text").value = "";
  saveState();
  renderWidgets();
  renderLatestWidget();
  showLoveNotification(state.widgets[state.widgets.length - 1], "Love widget saved");
  pushSharedWidget(widget);
  burstAt(window.innerWidth / 2, window.innerHeight - 150, 10);
  toast("text widget saved");
}

function deleteWidget(id) {
  const before = state.widgets.length;
  state.widgets = state.widgets.filter((widget, index) => String(widget.id || widget.createdAt || index) !== String(id));
  if (state.widgets.length === before) return;
  saveState();
  renderWidgets();
  renderLatestWidget();
  deleteSharedWidget(id);
  toast("widget deleted");
}

function widgetNotificationBody(widget) {
  if (!widget) return "A little love note is waiting inside Moonpie.";
  if (widget.type === "doodle") return "A handwritten love widget is waiting for you.";
  return String(widget.value || "A little love note is waiting for you.").slice(0, 110);
}

function updatePhoneStatus() {
  const status = $("#phone-status");
  if (!status) return;
  const installText = deferredInstallPrompt ? "Install is ready." : "Use browser menu if install is not offered yet.";
  const permission = "Notification" in window ? Notification.permission : "unsupported";
  const notifyText = permission === "granted" ? "Nudges are allowed." : permission === "denied" ? "Notifications are blocked in browser settings." : "Nudges need permission.";
  status.textContent = `${installText} ${notifyText}`;
}

async function requestLoveNotifications() {
  if (!("Notification" in window)) {
    toast("notifications are not supported here");
    updatePhoneStatus();
    return;
  }
  const result = await Notification.requestPermission();
  updatePhoneStatus();
  toast(result === "granted" ? "nudges allowed" : "nudges not allowed yet");
}

async function showLoveNotification(widget, title = "Moonpie miss-you widget") {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    updatePhoneStatus();
    return;
  }
  const options = {
    body: widgetNotificationBody(widget),
    icon: "./icon.svg",
    badge: "./icon.svg",
    tag: "moonpie-widget",
    renotify: true,
    data: { url: "./?v=37" }
  };
  try {
    const registration = await navigator.serviceWorker?.ready;
    if (registration?.showNotification) {
      await registration.showNotification(title, options);
    } else {
      new Notification(title, options);
    }
  } catch {
    try { new Notification(title, options); } catch { /* notification failed silently */ }
  }
}

function sendTestNudge() {
  showLoveNotification({ type: "text", value: "Come back, I miss you. A tiny piece of my heart is waiting here." }, "Come back, Moonpie");
  toast(("Notification" in window && Notification.permission === "granted") ? "test nudge sent" : "allow nudges first");
}

const WIDGET_API = "../api/widgets?room=moonpie-2504";

function setSyncStatus(message, connected = false) {
  const status = $("#sync-status");
  if (!status) return;
  status.textContent = message;
  $("#shared-shelf-card")?.classList.toggle("sync-connected", connected);
}

function mergeWidgets(remoteWidgets = [], pendingWidgets = []) {
  const merged = new Map();
  [...remoteWidgets, ...pendingWidgets].forEach(widget => {
    if (!widget?.id || !widget?.value) return;
    merged.set(String(widget.id), widget);
  });
  state.widgets = [...merged.values()].sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0)).slice(-80);
  saveState();
  renderWidgets();
  renderLatestWidget();
}

async function fetchSharedWidgets({ quiet = false } = {}) {
  try {
    const response = await fetch(WIDGET_API, { cache: "no-store", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("sync unavailable");
    const data = await response.json();
    const beforeLatest = state.widgets[state.widgets.length - 1]?.id;
    const remoteWidgets = Array.isArray(data.widgets) ? data.widgets : [];
    const pendingWidgets = state.widgetCloudMigrated
      ? state.widgets.filter(widget => widget?.syncPending)
      : state.widgets.map(widget => ({ ...widget, syncPending: true }));
    state.widgetCloudMigrated = true;
    mergeWidgets(remoteWidgets, pendingWidgets);
    pendingWidgets.slice(-20).forEach(widget => pushSharedWidget(widget));
    const latest = state.widgets[state.widgets.length - 1];
    setSyncStatus(`Connected as ${state.profile || "Michelle"}. Notes from both phones appear here automatically.`, true);
    if (!quiet && latest?.id && latest.id !== beforeLatest && latest.sender !== state.profile) {
      showLoveNotification(latest, `A new note from ${latest.sender || "your love"}`);
      toast(`new love note from ${latest.sender || "your person"}`);
    }
    return true;
  } catch {
    setSyncStatus("Saved safely on this phone. Shared sync will reconnect when the cloud room is available.", false);
    return false;
  }
}

async function pushSharedWidget(widget) {
  try {
    const response = await fetch(WIDGET_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ widget }) });
    if (!response.ok) throw new Error("sync unavailable");
    const local = state.widgets.find(item => String(item.id) === String(widget.id));
    if (local) local.syncPending = false;
    saveState();
    setSyncStatus(`Sent from ${widget.sender}. It will appear on the other phone.`, true);
  } catch {
    setSyncStatus("Saved on this phone. I will keep trying to send it to the shared shelf.", false);
  }
}

async function deleteSharedWidget(id) {
  try {
    await fetch(WIDGET_API, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
  } catch { /* local deletion still succeeds */ }
}

function setupWidgetSync() {
  if (widgetSyncStarted) return;
  widgetSyncStarted = true;
  fetchSharedWidgets({ quiet: true });
  clearInterval(widgetSyncTimer);
  widgetSyncTimer = setInterval(() => {
    if (document.visibilityState === "visible") fetchSharedWidgets({ quiet: false });
  }, 15000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") fetchSharedWidgets({ quiet: false });
  });
}

function setupHoldOrb() {
  const orb = $("#hold-orb");
  let timer = null;
  let pulseTimer = null;
  const showMessage = () => {
    if (!handMessages.length) return;
    if (!Array.isArray(state.handDeck) || state.handDeck.length !== handMessages.length || state.handCursor >= state.handDeck.length) {
      state.handDeck = shuffledIndexes(handMessages.length, Number(state.lastHandIndex ?? -1));
      state.handCursor = 0;
    }
    const index = state.handDeck[state.handCursor++];
    state.lastHandIndex = index;
    const [title, text] = handMessages[index];
    $("#hand-response-title").textContent = title;
    $("#hand-response-text").textContent = text;
    const card = $("#hand-response");
    card.classList.remove("hidden", "revealed");
    requestAnimationFrame(() => card.classList.add("revealed"));
    $("#daily-line").textContent = "Keep holding. I am matching your heartbeat from here.";
    saveState();
    navigator.vibrate?.([45, 80, 45, 110, 55]);
    burstAt(window.innerWidth * .72, 360, 8);
  };
  const start = () => {
    orb.classList.add("holding");
    orb.querySelector("span").textContent = "stay";
    orb.querySelector("small").textContent = "feel the pulse";
    navigator.vibrate?.([25, 30, 25]);
    pulseTimer = setInterval(() => navigator.vibrate?.(18), 720);
    timer = setTimeout(() => {
      showMessage();
    }, 1450);
  };
  const stop = () => {
    orb.classList.remove("holding");
    orb.querySelector("span").textContent = "hold";
    orb.querySelector("small").textContent = "my hand";
    clearTimeout(timer);
    clearInterval(pulseTimer);
  };
  orb.addEventListener("pointerdown", start);
  orb.addEventListener("pointerup", stop);
  orb.addEventListener("pointerleave", stop);
  orb.addEventListener("pointercancel", stop);
  $("#another-hand-message")?.addEventListener("click", showMessage);
}

function setupInstall() {
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    updatePhoneStatus();
  });
  const install = async () => {
    if (!deferredInstallPrompt) return toast("use browser menu: Add to Home screen");
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    updatePhoneStatus();
  };
  $("#install-btn")?.addEventListener("click", install);
  $("#phone-install")?.addEventListener("click", install);
  updatePhoneStatus();
}

function revealNav(duration = 1800) {
  const nav = $(".tabbar");
  if (!nav || document.body.classList.contains("focus-mode")) return;
  nav.classList.remove("nav-hidden", "nav-peeking");
  clearTimeout(navIdleTimer);
  navIdleTimer = setTimeout(() => nav.classList.add("nav-peeking"), duration);
}

function hideNav() {
  const nav = $(".tabbar");
  if (!nav) return;
  nav.classList.add("nav-hidden");
  nav.classList.remove("nav-peeking");
  clearTimeout(navIdleTimer);
}

function setupSmartNav() {
  const nav = $(".tabbar");
  if (!nav) return;
  lastScrollY = window.scrollY;
  revealNav(2200);

  window.addEventListener("scroll", () => {
    if (document.body.classList.contains("focus-mode")) return;
    const currentY = window.scrollY;
    const delta = currentY - lastScrollY;
    if (Math.abs(delta) < 8) return;
    if (delta > 0 && currentY > 80) {
      hideNav();
    } else {
      revealNav(1800);
    }
    lastScrollY = currentY;
  }, { passive: true });

  window.addEventListener("pointermove", event => {
    if (event.clientY > window.innerHeight - 110) revealNav(2200);
  }, { passive: true });

  window.addEventListener("touchstart", event => {
    const touch = event.touches?.[0];
    if (touch && touch.clientY > window.innerHeight - 130) revealNav(2200);
  }, { passive: true });
}

function setupEvents() {
  document.body.addEventListener("click", event => {
    const open = event.target.closest("[data-open]");
    if (open) openScreen(open.dataset.open);
    const portal = event.target.closest("[data-world-portal]");
    if (portal) openFutureWorld(Number(portal.dataset.worldPortal));
    if (event.target.closest("#bloom-garden,#seed-heart")) bloomGarden();
    const giftBox = event.target.closest(".gift-box");
    if (giftBox) revealGift(giftBox.dataset.gift, giftBox);
    if (event.target.closest("#seal-wish")) sealBirthdayWish();
    if (event.target.closest("#replay-birthday")) replayBirthday();
    const expressive = event.target.closest(".primary-btn,.world-tile,.letter-card,.mood-chip");
    if (expressive) burstAt(event.clientX, event.clientY, expressive.classList.contains("world-tile") ? 6 : 4);
  });
  $$(".mood-chip").forEach(btn => btn.addEventListener("click", () => setMood(btn.dataset.mood)));
  $("#new-comfort").addEventListener("click", () => setMood(selectedMood));
  $("#new-reason").addEventListener("click", nextReason);
  $("#save-text-widget").addEventListener("click", saveTextWidget);
  $("#clear-text-widget").addEventListener("click", () => $("#widget-text").value = "");
  $("#enable-notifications")?.addEventListener("click", requestLoveNotifications);
  $("#send-test-nudge")?.addEventListener("click", sendTestNudge);
  $("#widget-list").addEventListener("click", event => {
    const button = event.target.closest("[data-delete-widget]");
    if (!button) return;
    deleteWidget(button.dataset.deleteWidget);
  });
  $("#clear-doodle").addEventListener("click", () => { strokes = []; redrawCanvas(); });
  $("#undo-doodle").addEventListener("click", () => { strokes.pop(); redrawCanvas(); });
  $("#expand-doodle")?.addEventListener("click", toggleDoodleExpand);
  $("#save-doodle").addEventListener("click", saveDoodle);
  $("#refresh-widgets")?.addEventListener("click", () => fetchSharedWidgets({ quiet: false }));
  $("#start-bubbles").addEventListener("click", startBubbleGame);
  $("#bubble-field")?.addEventListener("pointerdown", event => {
    if (!bubbleRoundActive || event.target.closest(".love-bubble")) return;
    bubbleScore = Math.max(0, bubbleScore - 1);
    bubbleCombo = 0;
    bubbleWrongTaps += 1;
    updateBubbleHud();
  });
  $("#refresh-scores")?.addEventListener("click", fetchBubbleScores);
  $("#next-challenge").addEventListener("click", nextChallenge);
  $("#love-dice").addEventListener("click", rollLoveDice);
  $("#back-button")?.addEventListener("click", goBack);
  $("#start-breathing")?.addEventListener("click", startBreathingCare);
  $$("[data-care-mode]").forEach(button => button.addEventListener("click", () => showCareResponse(button.dataset.careMode)));
  $("#soft-mode")?.addEventListener("click", () => {
    state.softMode = !state.softMode;
    document.body.classList.toggle("soft-mode", state.softMode);
    saveState();
  });
  $("#letter-list").addEventListener("click", event => {
    const card = event.target.closest("[data-letter]");
    if (!card) return;
    const letter = letters[Number(card.dataset.letter)];
    const modal = $("#letter-modal");
    modal.className = `letter-dialog theme-${letter.theme}`;
    $("#modal-title").textContent = letter.title;
    $("#modal-body").innerHTML = `
      <p class="letter-salutation">${escapeHtml(letter.salutation)}</p>
      ${letter.body.map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join("")}
      <p class="letter-closing">${escapeHtml(letter.closing)}</p>
    `;
    document.body.classList.add("focus-mode");
    modal.showModal();
  });
  $("#letter-modal").addEventListener("close", () => {
    document.body.classList.remove("focus-mode");
    revealNav(1800);
  });
  $("#close-letter").addEventListener("click", () => $("#letter-modal").close());
  $("#world-modal")?.addEventListener("close", () => {
    document.body.classList.remove("focus-mode");
    revealNav(1800);
  });
  $("#close-world")?.addEventListener("click", () => $("#world-modal").close());
}

async function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    try { await navigator.serviceWorker.register("./sw.js"); }
    catch { /* local file/server may not support service workers */ }
  }
}

const moonPhaseLines = {
  "New Moon": "The sky is resting tonight, saving its light for later. Even hidden, it's still there. So am I.",
  "Waxing Crescent": "Just a sliver tonight, but it's growing, the same way this feeling never really shrinks.",
  "First Quarter": "Half-lit, half-shadowed, and still whole. That's most days when you're not next to me.",
  "Waxing Gibbous": "Almost full. Almost enough light to find your way to me by, if you needed to.",
  "Full Moon": "Wherever you are tonight, the moon is full and easy to find. Look up. I'm looking too.",
  "Waning Gibbous": "Still bright, just easing back. Like a good day that doesn't want to end yet.",
  "Last Quarter": "Half of it is letting go. The other half is already waiting for the next one to begin.",
  "Waning Crescent": "Barely there tonight, but that's how it goes right before something starts over.",
};

function moonPhaseInfo(date) {
  const synodic = 29.53058867;
  const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14, 0);
  const diffDays = (date.getTime() - knownNewMoon) / 86400000;
  let phase = (diffDays % synodic) / synodic;
  if (phase < 0) phase += 1;
  const names = ["New Moon", "Waxing Crescent", "First Quarter", "Waxing Gibbous", "Full Moon", "Waning Gibbous", "Last Quarter", "Waning Crescent"];
  const emojis = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];
  const index = Math.min(7, Math.floor(phase * 8));
  const name = names[index];
  return { name, emoji: emojis[index], line: moonPhaseLines[name] };
}

function renderMoon() {
  const info = moonPhaseInfo(new Date());
  const emojiEl = $("#moon-emoji");
  const nameEl = $("#moon-phase-name");
  const lineEl = $("#moon-line");
  if (emojiEl) emojiEl.textContent = info.emoji;
  if (nameEl) nameEl.textContent = info.name;
  if (lineEl) lineEl.textContent = info.line;
}

function todayStr(d) {
  d = d || new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function computeStreak(log) {
  if (!log || !log.length) return 0;
  const set = new Set(log);
  let streak = 0;
  const cursor = new Date();
  while (set.has(todayStr(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function trackVisit() {
  const today = todayStr();
  if (!Array.isArray(state.visitLog)) state.visitLog = [];
  if (state.visitLog[state.visitLog.length - 1] !== today) {
    state.visitLog.push(today);
    if (state.visitLog.length > 400) state.visitLog = state.visitLog.slice(-400);
    saveState();
  }
  const streak = computeStreak(state.visitLog);
  const el = $("#streak-line");
  if (!el) return;
  if (streak >= 2) {
    el.hidden = false;
    el.textContent = `🔥 day ${streak} in a row you've come back to me. ${state.visitLog.length} visits and counting.`;
  } else {
    el.hidden = true;
  }
}

function init() {
  document.body.dataset.world = "home";
  trackVisit();
  renderMoon();
  document.body.classList.toggle("soft-mode", state.softMode);
  renderAtlas();
  setMood(selectedMood);
  renderLatestWidget();
  setupHoldOrb();
  setupEvents();
  setupSmartNav();
  setupInstall();
  setupOpeningRitual();
  if (state.hasEnteredUniverse) setupWidgetSync();
  const requestedScreen = new URLSearchParams(location.search).get("open");
  const resumeScreen = requestedScreen || (state.hasEnteredUniverse ? state.lastWorld : "home");
  if (resumeScreen && worlds.some(world => world.id === resumeScreen)) openScreen(resumeScreen, { fromBack: true });
  finishIntro();
  registerServiceWorker();
}

init();
