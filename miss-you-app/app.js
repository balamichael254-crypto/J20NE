const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const expansion = window.MOONPIE_EXPANSION || {};

// "Michelle" / "Michael" only ever exist as internal profile identifiers now -
// they route the shared vault, the leaderboard, and widget sync, but nothing
// on screen should ever print them literally. Every display of a name goes
// through here. (vault.js keeps its own copy of this map for the same reason.)
const PROFILE_NICK = { Michelle: "Moonpie", Michael: "Sunstone" };
const nickOf = name => PROFILE_NICK[name] || name;

const STORE_KEY = "moonpie-miss-you-v9";
const defaultState = { mood: "soft", widgets: [], widgetCloudMigrated: false, openedReasons: [], softMode: false, lastWorld: "home", hasEnteredUniverse: false, bestBubbleScore: 0, bubbleBestByProfile: {}, challengeIndex: 0, profile: "Michelle", reasonDeck: [], reasonCursor: 0, lastReasonIndex: -1, lastComfortByMood: {}, handDeck: [], handCursor: 0, visitLog: [], giftMemory: {}, watchSaved: [], watchSeen: [], lockOpened: false, bouquetItems: [] };
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

// `section` decides which hub grid a room shows up in - "atlas" for anything
// browsable/playable (letters, games, content), "us" for the shared/private
// relationship space (vault, memories, garden, distance, gifts). Care and
// Home aren't listed here at all: they're main tabs in their own right now,
// not tiles inside another hub. See the tabbar in index.html for the four
// main pages this maps onto.
const worlds = [
  { id: "garden", icon: "🌸", title: "Love Garden", sub: "tree, lilies, bouquet", count: 3, tone: "garden", photo: "./assets/flowers/hero-lily.webp", section: "us" },
  { id: "letters", icon: "💌", title: "Letters", sub: "open one slowly", count: 10, tone: "letter", photo: "./assets/mood/notebook-4.webp", section: "atlas" },
  { id: "poems", icon: "🪷", title: "Poems", sub: "written after midnight", count: 5, tone: "poem", photo: "./assets/mood/moon-sky-1.webp", section: "atlas" },
  { id: "notices", icon: "🗒️", title: "Tiny Things", sub: "I notice everything", count: 12, tone: "notice", photo: "./assets/mood/jar-note-4.webp", section: "atlas" },
  { id: "day", icon: "☀️", title: "One Perfect Day", sub: "come live it with me", count: 8, tone: "day", photo: "./assets/mood/bunny-morning-hero.webp", section: "atlas" },
  { id: "places", icon: "🌍", title: "Our Worlds", sub: "places waiting for us", count: 12, tone: "place", photo: "./assets/worlds/santorini-1.webp", section: "atlas" },
  { id: "songs", icon: "🎵", title: "Songs That Are You", sub: "listen while you read", count: 7, tone: "song", photo: "./assets/mood/vinyl-2.webp", section: "atlas" },
  { id: "promises", icon: "🌸", title: "Promises", sub: "kept here for you", count: 9, tone: "promise", photo: "./assets/mood/bunny-lily-4.webp", section: "atlas" },
  { id: "distance", icon: "🛰️", title: "While Apart", sub: "two dots, one thread", count: 6, tone: "distance", photo: "./assets/mood/moon-back-4.webp", section: "us" },
  { id: "reasons", icon: "💗", title: "100 Reasons", sub: "pluck one from the sky", count: 100, tone: "reason", photo: "./assets/mood/bunny-glow-4.webp", section: "atlas" },
  { id: "memory", icon: "📸", title: "Our Little World", sub: "the bits I keep", count: 9, tone: "memory", photo: "./assets/mood/polaroid-2.webp", section: "us" },
  { id: "birthday", icon: "🎁", title: "A Few Small Gifts", sub: "open one whenever", count: 8, tone: "birthday", photo: "./assets/mood/bunny-daisy-4.webp", section: "us" },
  { id: "doodles", icon: "✍️", title: "Widget Studio", sub: "write, draw, send comfort", count: 2, tone: "create", photo: "./assets/mood/lav-jar-2.webp", section: "atlas" },
  { id: "games", icon: "🎮", title: "Love Arcade", sub: "arcade, sudoku, puzzles", count: 9, tone: "game", photo: "./assets/mood/drink-4.webp", section: "atlas" },
  { id: "watchlist", icon: "🎬", title: "Watchlist", sub: "movies for both of us", count: 60, tone: "watchlist", photo: "./assets/mood/bunny-sleep-1.webp", section: "atlas" },
  { id: "lock", icon: "🔒", title: "Our Lock", sub: "you already know the number", count: 1, tone: "lock", photo: "./assets/mood/jar-note-4.webp", section: "us" },
  { id: "galaxy", icon: "🌌", title: "Our Galaxy", sub: "make a wish and watch it land", count: 1, tone: "galaxy", photo: "./assets/mood/moon-sky-2.webp", section: "us" }
];

const comfortNotes = {
  soft: [
    "Come closer in your head. I am probably smiling at my phone somewhere, thinking about you too.",
    "You do not have to be brave for this minute. Let me be the soft place. Breathe in. I love you. Breathe out. Still yours.",
    "Distance is loud, but it is not bigger than us. It is just the room between two people already walking toward each other.",
    "Nothing about this minute needs fixing. You are allowed to just be soft here for a while.",
    "I keep a version of you in my head that never actually leaves. She is here right now, keeping me company.",
    "This is a good, quiet kind of missing. The kind that means the thing you're missing is worth it."
  ],
  heavy: [
    "If today feels too much, do only the next tiny thing. Drink water. Unclench your jaw. Let my love be simple for you.",
    "Missing me is not proof that something is wrong. It is proof that what we have is real enough to leave an ache.",
    "I would sit beside you through the whole heavy thing if I could. Since I cannot, let this be my hand on your shoulder.",
    "You do not have to carry today gracefully. You just have to carry it. That's enough for me.",
    "Heavy days end. This one will too. I'm not going anywhere in the meantime.",
    "Let today be hard without it meaning anything is wrong between us. It's just a hard day. We've survived worse."
  ],
  sleepy: [
    "Put the phone near you. Imagine my voice getting quieter and quieter until the room feels safe. Goodnight, Moonpie.",
    "You are allowed to sleep before replying. I will still be here. Morning-you deserves rest too.",
    "Close your eyes for ten seconds. I am not disappearing. I am tucked into tomorrow, waiting.",
    "Sleep is not you giving up on the day. It's you trusting there will be another one, with me in it.",
    "Let the missing get quiet too. It can rest when you rest.",
    "I'll still be exactly this yours when you wake up. Nothing about that changes overnight."
  ],
  clingy: [
    "Be clingy. I like being loved by you in the specific, dramatic, adorable way only you can manage.",
    "If I were there, I would let you steal my hoodie, my arm, half the blanket, and probably my entire heart again.",
    "You can miss me loudly here. This app was literally built for that. Come be ridiculous. I am yours.",
    "There is no such thing as too much when it's you missing me. Say it as many times as you need to.",
    "I want the clingy version of you. I built you a whole app to have somewhere to put it.",
    "Ask for the reassurance. Ask twice. I will keep saying yes."
  ]
};

const letters = [
  {
    title: "Read This One First",
    tab: "before all the others",
    theme: "lilies",
    preview: "The one I wrote before the pretty ones, so it sits where you cannot miss it.",
    salutation: "My Princess,",
    body: [
      "I am putting this one at the top so it is the first thing you find. We are both about to start college, both about to get busier than we have ever been. New schedules, new pressure, new people, new versions of ourselves we have not met yet. I know some days there will barely be room to breathe, let alone talk. I want to say this now, while things are still calm enough for me to say it properly, so it is already true before the chaos gets here.",
      "This is a vow, not just a nice sentence. Whatever college throws at me, whatever it costs to keep up, I am choosing you. Not once. Every single day, on purpose, like it is the first decision I make when I wake up. When I am exhausted and behind on everything and have nothing impressive to offer you that day, I am still choosing you. That part does not move.",
      "I will still try, even on the days trying is hard. If I get distracted by deadlines and disappear for a bit, I will come back. If I get something wrong, I will notice and fix it instead of pretending I did not. I am not promising I will be perfect at this. I am promising I will keep showing up for it, semester after semester, until showing up for you is just the shape of my life.",
      "And whatever else changes, you are still Daddy's little Princess. That is not something you have to earn back after a bad week or a missed call. It does not expire because we are both tired or both far away or both drowning in coursework. Come to me stressed. Come to me behind on sleep. Come to me needing more than you think you are allowed to need. I am still right here, choosing you.",
      "So this is me, before either of our schedules gets impossible, telling you exactly where I stand. Busy is not the same as gone. Tired is not the same as done. I am choosing you today, and I am going to keep choosing you, long after the two of us stop counting."
    ],
    closing: "Still choosing you. Every single day of it."
  },
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
    title: "The Letter I Keep For No Reason",
    tab: "save this one",
    theme: "birthday",
    preview: "For a completely ordinary day, because I get to call you mine.",
    salutation: "My Moonpie,",
    body: [
      "There is no occasion for this one. No date on the calendar told me to write it. I just wanted a whole page to say what I already know every day: I am the luckiest person alive because you chose to be mine.",
      "I wish I could place flowers in your hands for real. I wish I could watch your face while you read this. I wish I could make an ordinary Tuesday feel gentle around you, like the world knows it is carrying someone precious.",
      "You deserve more than a message. You deserve a room full of lilies, a sky full of pink light, and a love that does not make you wonder if you are too much.",
      "You are not too much. You are my favorite kind of everything. My Moonpie. My Princess. My babyy. My person in the softest part of my chest.",
      "So here's to no occasion at all, Moonpie. Here's to every ordinary one of these we get, near or far, until there is no more distance left to close."
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
    salutation: "My Moonpie,",
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

// Base list plus whatever content.js knows (that one carries real Spotify
// track ids). Merged and deduped by title so nothing written twice gets
// dropped, and songs.js only has to be extended in one of the two places.
const baseSongs = [
  ["Sleep Well", "d4vd", "For the soft nights when missing each other gets too loud.", null, "soft"],
  ["Those Eyes", "New West", "A song for tiny things, private jokes, and the ordinary ways love proves itself.", null, "soft"],
  ["Until I Found You", "Stephen Sanchez", "Ridiculous-romantic in the correct way.", null, "big"],
  ["Melting", "Kali Uchis", "For the moments where all I can do is be dramatically in love with you.", null, "big"],
  ["Japanese Denim", "Daniel Caesar", "For late calls, warm silence, and wanting more time.", null, "soft"],
  ["Glue Song", "beabadoobee", "Because you stuck, Moonpie. Beautifully, inconveniently, permanently.", null, "fun"],
  ["Just the Two of Us", "Bill Withers", "Older than both of us and still exactly right.", null, "soft"],
  ["Sunday Best", "Surfaces", "A whole song about being someone's good mood. That's you, to me.", null, "fun"],
  ["I Wanna Be Yours", "Arctic Monkeys", "Weird, devoted, and somehow the most romantic sentence I know.", null, "big"],
  ["Adore You", "Harry Styles", "For when 'I like you' is not nearly enough volume.", null, "fun"],
  ["Golden Hour", "JVKE", "The kind of song that makes an ordinary evening feel cinematic.", null, "soft"],
  ["Die For You", "The Weeknd", "Dramatic on purpose. Some feelings deserve the drama."],
];
const songs = (() => {
  const byTitle = new Map(baseSongs.map(entry => [entry[0].toLowerCase(), entry]));
  (expansion.songs || []).forEach(([title, artist, note, spotifyId]) => {
    const key = title.toLowerCase();
    const existing = byTitle.get(key);
    // content.js carries the real Spotify ids; keep our note if we already
    // had one for this title, but always take the id if we were missing it
    byTitle.set(key, existing ? [existing[0], existing[1], existing[2], spotifyId || existing[3], existing[4]] : [title, artist, note, spotifyId]);
  });
  return [...byTitle.values()];
})();

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

// One suggestion shown at a time via #new-one-thing, cycled through
// pickFresh so the full set gets seen before anything repeats, rather than
// all eight sitting on the page as a numbered list every single visit.
const careSteps = [
  ["Come closer", "Put one hand on your chest and one on your stomach. Take four gentle breaths while imagining my hand resting over yours."],
  ["Tell me the true thing", "You never have to package your feelings neatly for me. Send: 'Babyy, I need you close today.' That is already enough."],
  ["Let your body feel safer", "Drink some water, loosen your shoulders, unclench your jaw, and find the softest thing within reach."],
  ["Borrow my voice", "Open Every Night With You or Your Voice and read it slowly. Every sentence is me sitting beside you for a minute."],
  ["Make the room gentler", "Lower one bright light, play one of our songs, and let this lilac little universe stay open beside you."],
  ["Give the ache somewhere to go", "Write one tiny widget, draw a heart, or leave me the exact sentence you wish I could hear right now."],
  ["Choose one future", "Open Our Worlds and pick where we are going tonight. Imagine the first ten minutes there together."],
  ["Rest without proving anything", "If it is late, let yourself sleep. You never have to stay awake to prove you miss me. I will still love you in the morning."]
];
function nextOneThing() { return pickFresh(careSteps, "lastOneThingIndex"); }

// Three takes per feeling instead of one fixed script, so tapping "I miss you
// badly" for the fortieth time does not read back the exact words it read on
// the first. Picked with the same never-twice-in-a-row rule as everything
// else on this screen (see pickFresh).
const careResponses = {
  missing: [
    ["💗", "I miss you too, babyy.", "Do not fight the feeling. Come sit with me here. Picture my arms around you, my cheek against your hair, and the first long airport hug waiting for us. Send me one tiny note if you want me to know this moment found you."],
    ["💗", "Good. I want you to miss me.", "It means some part of you is still reaching for me across all this distance. That is not a weakness, that is loyalty with nowhere to go yet. Let it be loud for a minute. I am reaching back."],
    ["💗", "This is the hard part, not the whole story.", "Missing me this much is the cost of loving someone worth the wait. It will not always feel this sharp. Tell me one thing you wish I was there to see right now."]
  ],
  reassurance: [
    ["🌸", "You are still my girl.", "Nothing about a quiet hour, a delayed reply, or a difficult mood changes how beautiful and important you are to me. You do not need to earn the answer again. I love you, I choose you, and you will always be my little babyy."],
    ["🌸", "Say it again, I will hear it again.", "You are not too much for needing to hear this more than once. I would tell you a thousand times and mean it a thousand times. You are safe with me, exactly as often as you need to check."],
    ["🌸", "Nothing has changed. Not one thing.", "Whatever spiral got you here, it is lying to you. My side has not moved. I am not one bad day, one slow reply, or one hard week away from anywhere but here, choosing you."]
  ],
  overwhelmed: [
    ["🪷", "Only the next tiny thing.", "You do not have to solve the whole day right now. Put both feet down. Name three things you can see, two things you can feel, and one sound near you. Then drink a little water. I am proud of you for making this minute gentler."],
    ["🪷", "You do not have to hold all of it at once.", "Set down whatever you are carrying that is not actually due today. One task, one breath, one minute. That is the whole assignment right now."],
    ["🪷", "It is allowed to just be a lot.", "You do not need a reason big enough to justify feeling this way. It is a lot because it is a lot. Let this minute be smaller than the rest of the day, even if nothing else shrinks yet."]
  ],
  sleep: [
    ["💕", "Let the night hold you softly.", "You are allowed to stop for today. Put the phone close, lower the light, and imagine me whispering goodnight until your breathing becomes slow. I am not disappearing while you sleep. I will still be yours in the morning."],
    ["💕", "Your brain is just doing its job badly.", "Restless nights are not a sign something is wrong, they are just your mind refusing to clock out on time. Give it something boring to hold instead: count my texts, replay one memory slowly, from the start."],
    ["💕", "I am not going anywhere while you sleep.", "You do not have to stay up to make sure I am real. I will still be exactly this yours when you open your eyes. Let yourself go first tonight."]
  ]
};
function nextCareResponse(mode) {
  const list = careResponses[mode];
  return list ? pickFresh(list, `lastCareResponse:${mode}`) : null;
}

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
// songs is merged with expansion.songs above, at declaration - not spliced
// here, or this would throw the merge away and leave only content.js's list.
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

function rnd(min, max) {
  return min + Math.random() * (max - min);
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

// Two more comfort generators, deliberately different in KIND from the rescue
// note above rather than just more lines in the same box: one redirects
// (something small to actually do), one is Poo's voice instead of mine. The
// "never the same twice in a row" picker is shared so none of the three
// generators on this screen can repeat back to back.
function pickFresh(list, stateKey) {
  const previous = Number(state[stateKey] ?? -1);
  const choices = list.map((_, i) => i).filter(i => i !== previous);
  const index = pick(choices.length ? choices : [0]);
  state[stateKey] = index;
  return list[index];
}

const tinyMissions = [
  "Look out the nearest window and name three colors you actually see, not the ones you'd guess.",
  "Send me the weirdest fact you currently know, no context needed.",
  "Make the ugliest face you can manage and take the photo. You don't have to send it. But you can.",
  "Reorganize one small thing near you - a drawer, a playlist, your camera roll's first row.",
  "Write down one thing, however small, you're actually looking forward to.",
  "Stand up. Stretch both arms as high as they go. Hold it for five seconds like you mean it.",
  "Find the nearest soft thing and hold it for ten seconds. Pillow, blanket, sleeve, doesn't matter.",
  "Name one thing you did today that past-you would be proud of. It can be tiny.",
  "Drink actual water. Not tea, not coffee. Water. Then come back.",
  "Text me one memory that made you smile this week, unprompted.",
  "Open your camera roll and find the most ridiculous photo of me. Look at it for a second.",
  "Pick one song, play thirty seconds of it, and just listen - not as background noise, actually listen.",
];

const pooComfortLines = [
  "Poo says: she's not gone, she's just doing a phone thing. You're still her whole favourite.",
  "Poo says: I've been sitting right here the entire time you were worrying. I'm very patient.",
  "Poo says: missing someone this much just means you picked a good one. Rare, that.",
  "Poo says: I would personally bite the distance if biting worked on distance.",
  "Poo says: she talks about you like you're the best thing she's ever found. I've heard it a lot.",
  "Poo says: come sit with me a second. We can miss her together, it's less heavy that way.",
  "Poo says: I'm small and purple and even I know this feeling passes. Hang on.",
  "Poo says: she left the light on for you, metaphorically. Also I'm the light. I'm fine with that.",
  "Poo says: nobody in this whole app doubts that she's coming back to you. Not even the moon.",
  "Poo says: I'm told I give excellent hugs for something with no arms that work properly. Want one?",
];

function nextMission() { return pickFresh(tinyMissions, "lastMissionIndex"); }
function nextPooLine() { return pickFresh(pooComfortLines, "lastPooLineIndex"); }

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
  if (document.body.classList.contains("app-locked")) return;
  // real photographed petals from bloom.js, not an emoji shower
  if (window.Bloom) window.Bloom.confetti(window.innerWidth / 2, window.innerHeight * 0.3, 14);
}

function ensureScreenRendered(name) {
  if (renderedScreens.has(name)) return;
  const renderers = {
    garden: () => { setupGardenTree(); setupBouquetBuilder(); },
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
    watchlist: renderWatchlist,
    lock: renderLock,
    galaxy: renderGalaxy,
    doodles: () => { renderWidgets(); setupCanvas(); },
    us: initHearthOnce
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
  // Leaving the arcade tears the chosen game down. Sudoku holds a timer,
  // jigsaw holds object URLs and a drag listener on document; neither should
  // outlive the screen they belong to.
  if (name !== "games") unmountGame();
  // The galaxy canvas runs its own continuous rAF loop - that has to stop
  // the instant she leaves the screen (not just when she navigates away
  // from the app entirely), or it keeps drawing at full rate behind whatever
  // she opens next. Mounting fresh on entry rather than once ever also means
  // it always fits the container's current size instead of a stale one.
  if (name === "galaxy") window.MoonpieGalaxy?.mount($("#galaxy-stage"));
  else window.MoonpieGalaxy?.unmount();
  if (name === "us") refreshHearth();
  if (name === "songs") {
    $$(".spotify-card iframe[data-src]").forEach(frame => {
      if (!frame.getAttribute("src")) frame.setAttribute("src", frame.dataset.src);
    });
  }
  if (changed) flowerPageTransition();
  revealNav(2600);
}

/* ============================================================================
   The arcade games. Each module exposes { mount(el), unmount() } and paints
   its own DOM into #game-stage, so only one is ever live and switching is a
   real teardown rather than a hidden div. The chosen game is remembered so
   she comes back to the one she was playing.
   ========================================================================= */
const GAME_MODULES = {
  sudoku: () => window.MoonpieSudoku,
  jigsaw: () => window.MoonpieJigsaw,
  memory: () => window.MoonpieMemory,
};
let activeGame = null;

function unmountGame() {
  if (!activeGame) return;
  try { GAME_MODULES[activeGame]?.()?.unmount?.(); } catch (error) { console.warn("game unmount", error); }
  activeGame = null;
  const stage = $("#game-stage");
  if (stage) { stage.innerHTML = ""; stage.classList.remove("open"); }
  $$(".game-pick").forEach(b => { b.classList.remove("active"); b.setAttribute("aria-selected", "false"); });
}

function mountGame(id) {
  const module = GAME_MODULES[id]?.();
  const stage = $("#game-stage");
  if (!stage) return;
  // Tapping the game you are already playing closes it, so the picker is a
  // toggle rather than a one-way door.
  if (activeGame === id) { unmountGame(); state.lastGame = ""; saveState(); return; }
  unmountGame();
  if (!module?.mount) {
    stage.innerHTML = '<p class="game-stage-missing">That one did not load. Pull the app down to refresh and try again.</p>';
    stage.classList.add("open");
    return;
  }
  activeGame = id;
  state.lastGame = id;
  saveState();
  stage.classList.add("open");
  try {
    module.mount(stage);
  } catch (error) {
    console.warn("game mount", error);
    activeGame = null;
    stage.innerHTML = '<p class="game-stage-missing">That one did not want to open. Try another?</p>';
    return;
  }
  const button = $(`.game-pick[data-game="${id}"]`);
  if (button) { button.classList.add("active"); button.setAttribute("aria-selected", "true"); }
  requestAnimationFrame(() => stage.scrollIntoView({ behavior: "smooth", block: "start" }));
}

function initGamePicker() {
  $$(".game-pick").forEach(button => {
    button.addEventListener("click", () => mountGame(button.dataset.game));
  });
}

/* ============================================================================
   Watchlist. Browse by genre, then two taps that matter: save it for later,
   or mark it already seen. Both lists are just arrays of film ids in state,
   so they sync with everything else and survive the catalogue growing.

   A film can be in exactly one list at a time. Marking something seen pulls
   it off the watchlist, because that is what finishing a film means, and
   leaving it in both would make the counts lie.
   ========================================================================= */
// Real posters, real trailers, and the whole TMDB catalogue instead of a
// list we wrote by hand and would have had to keep extending. api/movies.js
// proxies TMDB so the key never reaches the client. If that endpoint is not
// configured yet (no TMDB_API_KEY set on Vercel) or the network is down, we
// fall back to a small curated offline list from movies.js so the screen
// never just breaks.
let wlView = "browse";
let wlGenre = "all";
let wlQuery = "";
let wlPage = 1;
let wlTotalPages = 1;
let wlResults = [];
let wlLoading = false;
let wlGenresCache = null;
let wlOffline = false;
let wlSearchTimer = null;
let wlRequestToken = 0;

// A few curated genres up front (the ones she will actually reach for), the
// rest of TMDB's real list after. Icons are cosmetic guesses by name; a
// genre with no guess just gets a plain film icon rather than nothing.
const WL_GENRE_ICONS = {
  Romance: "\u{1F495}", Comedy: "\u{1F602}", Thriller: "\u{1F52A}", Horror: "\u{1F47B}",
  Animation: "\u{1F338}", Action: "\u{1F4A5}", "Science Fiction": "\u{1F30C}", Drama: "\u{1F3AD}",
  Family: "\u{1F9F8}", Adventure: "\u{1F9ED}", Fantasy: "\u{1F9DA}", Mystery: "\u{1F575}\u{FE0F}",
  Crime: "\u{1F575}\u{FE0F}", Documentary: "\u{1F3A5}", Music: "\u{1F3B5}", War: "\u{2694}\u{FE0F}",
  History: "\u{1F4DC}", Western: "\u{1F920}", "TV Movie": "\u{1F4FA}"
};
const WL_CURATED_GENRES = [
  { id: "all", name: "Everything", icon: "✨" },
  { id: "comfort", name: "Comfort", icon: "\u{1F9F8}" },
  { id: "korean", name: "Korean & Asian", icon: "\u{1F3EE}" }
];

async function wlApi(params) {
  const query = new URLSearchParams(params).toString();
  const result = await fetch(`../api/movies?${query}`);
  if (!result.ok) throw new Error(`movies api ${result.status}`);
  return result.json();
}

function wlRuntime(mins) {
  if (!mins) return "";
  const h = Math.floor(mins / 60), m = mins % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

// A film lives in one list at a time - marking something seen pulls it off
// the watchlist, because that is what finishing a film means, and leaving it
// in both would make the counts lie. Stores a small snapshot object (not
// just an id) so the Watchlist/Seen tabs work fully offline.
function wlToggle(listKey, movie) {
  const other = listKey === "watchSaved" ? "watchSeen" : "watchSaved";
  const list = Array.isArray(state[listKey]) ? state[listKey] : (state[listKey] = []);
  const at = list.findIndex(m => m.id === movie.id);
  if (at >= 0) list.splice(at, 1);
  else {
    list.push({ id: movie.id, title: movie.title, year: movie.year, poster: movie.poster, rating: movie.rating });
    const otherList = Array.isArray(state[other]) ? state[other] : (state[other] = []);
    const otherAt = otherList.findIndex(m => m.id === movie.id);
    if (otherAt >= 0) otherList.splice(otherAt, 1);
  }
  saveState();
  wlRenderCounts();
  wlRenderGrid();
}

// Every id that comes off a data-* attribute arrives as a string, but TMDB
// ids are numbers - normalize once here rather than re-deriving this rule
// at every comparison site.
function wlParseId(raw) {
  if (typeof raw !== "string") return raw;
  return raw.startsWith("local-") ? raw : Number(raw);
}
function wlIsSaved(id) { const key = wlParseId(id); return (state.watchSaved || []).some(m => m.id === key); }
function wlIsSeen(id) { const key = wlParseId(id); return (state.watchSeen || []).some(m => m.id === key); }

// Full-bleed poster card, title and rating on a scrim over the art, save/seen
// as small circular icons that float on the poster - the streaming-app
// pattern, not text stacked in a box under a small thumbnail. The old layout
// gave the poster maybe a third of the card; this gives it all of it, which
// is the actual point of having real poster art to show.
function wlCardHtml(movie) {
  const saved = wlIsSaved(movie.id);
  const seen = wlIsSeen(movie.id);
  const poster = movie.poster
    ? `<img src="${escapeHtml(movie.poster)}" alt="" loading="lazy" decoding="async">`
    : `<div class="wl-poster-fallback" aria-hidden="true">\u{1F3AC}</div>`;
  return `
    <article class="wl-card${seen ? " is-seen" : ""}" data-wl-open="${movie.id}">
      <div class="wl-poster">
        ${poster}
        <div class="wl-icon-col">
          <button class="wl-icon-btn wl-save${saved ? " on" : ""}" data-wl-save="${movie.id}" type="button"
            aria-pressed="${saved}" aria-label="${saved ? "remove from" : "add to"} watchlist">&#9825;</button>
          <button class="wl-icon-btn wl-seen${seen ? " on" : ""}" data-wl-seen="${movie.id}" type="button"
            aria-pressed="${seen}" aria-label="${seen ? "unmark" : "mark"} as already watched">&#10003;</button>
        </div>
        ${seen ? `<span class="wl-seen-ribbon">watched</span>` : ""}
        <div class="wl-scrim">
          <h3>${escapeHtml(movie.title)}</h3>
          <p class="wl-scrim-meta">${movie.year ? escapeHtml(movie.year) : ""}${movie.rating ? ` &middot; ★ ${movie.rating}` : ""}</p>
        </div>
      </div>
    </article>
  `;
}

function wlFindShown(id) {
  const key = wlParseId(id);
  return wlResults.find(m => m.id === key) || (state.watchSaved || []).find(m => m.id === key) || (state.watchSeen || []).find(m => m.id === key);
}

function wlRenderCounts() {
  $("#wl-count-saved").textContent = (state.watchSaved || []).length;
  $("#wl-count-seen").textContent = (state.watchSeen || []).length;
}

function wlRenderGrid() {
  const listEl = $("#wl-list");
  if (!listEl) return;
  let shown;
  if (wlView === "saved") shown = state.watchSaved || [];
  else if (wlView === "seen") shown = state.watchSeen || [];
  else shown = wlResults;

  const empty = $("#wl-empty");
  if (!shown.length && !wlLoading) {
    empty.textContent = wlView === "saved"
      ? "Nothing saved yet. Go and heart a few, then come back when you cannot decide."
      : wlView === "seen"
        ? "Nothing ticked off yet. Tick the ones you have already seen so I stop suggesting them."
        : wlQuery
          ? `Nothing found for "${wlQuery}". Try a different spelling?`
          : "Nothing in here yet.";
    empty.classList.remove("hidden");
  } else {
    empty.classList.add("hidden");
  }
  listEl.innerHTML = shown.map(wlCardHtml).join("");

  const more = $("#wl-load-more");
  if (more) more.classList.toggle("hidden", wlView !== "browse" || wlPage >= wlTotalPages || !shown.length);
}

function wlRenderGenres() {
  const bar = $("#wl-genres");
  if (!bar) return;
  bar.classList.toggle("hidden", wlView !== "browse");
  if (wlView !== "browse") return;
  const real = (wlGenresCache || []).map(g => ({ id: String(g.id), name: g.name, icon: WL_GENRE_ICONS[g.name] || "\u{1F3AC}" }));
  const all = [...WL_CURATED_GENRES, ...real];
  bar.innerHTML = all.map(g =>
    `<button class="wl-genre${wlGenre === g.id ? " active" : ""}" data-wl-genre="${g.id}" type="button">${g.icon} ${escapeHtml(g.name)}</button>`
  ).join("");
}

async function wlLoadPage(reset) {
  if (wlLoading) return;
  wlLoading = true;
  const myToken = ++wlRequestToken;
  const status = $("#wl-status");
  if (status) { status.textContent = "finding more..."; status.classList.remove("hidden"); }
  try {
    const data = wlQuery
      ? await wlApi({ op: "search", q: wlQuery, page: wlPage })
      : await wlApi({ op: "discover", genre: wlGenre, page: wlPage });
    if (myToken !== wlRequestToken) return; // a newer request already landed
    wlOffline = false;
    wlTotalPages = data.totalPages || 1;
    wlResults = reset ? data.results : [...wlResults, ...data.results];
    wlRenderGrid();
  } catch (error) {
    if (myToken !== wlRequestToken) return;
    console.warn("watchlist fetch", error);
    if (reset && !wlResults.length) wlLoadOfflineFallback();
  } finally {
    if (myToken === wlRequestToken) {
      wlLoading = false;
      if (status) status.classList.add("hidden");
    }
  }
}

// Only used if api/movies is not configured yet or the network is down, so
// the screen still shows something instead of an empty page.
// Maps the handful of real TMDB genre ids the curated chips can produce back
// to the offline list's own slugs, so a genre tap still does something
// sensible while the live catalogue is unreachable.
const WL_OFFLINE_GENRE_MAP = { 10749: "romance", 35: "comedy", 53: "thriller", 27: "horror", 16: "animation", 28: "action", 878: "scifi", 18: "drama" };

function wlLoadOfflineFallback() {
  wlOffline = true;
  const catalogue = window.MOONPIE_MOVIES || { films: [] };
  let films = catalogue.films;
  if (wlGenre !== "all") {
    const slug = WL_OFFLINE_GENRE_MAP[wlGenre] || wlGenre; // "comfort"/"korean" pass through as-is
    films = films.filter(f => f.g === slug);
  }
  if (wlQuery) {
    const q = wlQuery.toLowerCase();
    films = films.filter(f => f.title.toLowerCase().includes(q));
  }
  wlResults = films.map(f => ({
    id: `local-${f.id}`, title: f.title, year: String(f.year), overview: f.why,
    poster: null, rating: null, mins: f.mins
  }));
  wlTotalPages = 1;
  wlRenderGrid();
  const empty = $("#wl-empty");
  if (empty && wlResults.length) {
    empty.textContent = "Could not reach the live catalogue right now - showing our built-in picks instead.";
    empty.classList.remove("hidden");
  }
}

function wlResetAndLoad() {
  wlPage = 1;
  wlResults = [];
  wlLoadPage(true);
}

async function wlOpenDetail(id) {
  const modal = $("#wl-modal");
  const body = $("#wl-modal-body");
  if (!modal || !body) return;
  const known = wlFindShown(id);
  body.innerHTML = `<p class="wl-modal-loading">loading...</p>`;
  modal.showModal();

  if (String(id).startsWith("local-") || wlOffline) {
    const saved = wlIsSaved(id), seen = wlIsSeen(id);
    body.innerHTML = `
      <h2>${escapeHtml(known?.title || "")}</h2>
      <p class="wl-modal-meta">${escapeHtml(known?.year || "")}${known?.mins ? ` &middot; ${wlRuntime(known.mins)}` : ""}</p>
      <p>${escapeHtml(known?.overview || "")}</p>
      <p class="wl-modal-note">Trailers need the live catalogue to be connected. This one is from our built-in list.</p>
      <div class="wl-modal-actions">
        <button class="secondary-btn wl-modal-save${saved ? " on" : ""}" type="button" data-wl-save="${id}">${saved ? "remove from watchlist" : "add to watchlist"}</button>
        <button class="secondary-btn wl-modal-seen${seen ? " on" : ""}" type="button" data-wl-seen="${id}">${seen ? "unmark as watched" : "mark as watched"}</button>
      </div>
    `;
    return;
  }

  try {
    const detail = await wlApi({ op: "detail", id });
    const saved = wlIsSaved(detail.id), seen = wlIsSeen(detail.id);
    body.innerHTML = `
      ${detail.backdrop ? `<img class="wl-modal-backdrop" src="${escapeHtml(detail.backdrop)}" alt="" loading="lazy">` : ""}
      <h2>${escapeHtml(detail.title)}${detail.year ? ` <span class="wl-year">${escapeHtml(detail.year)}</span>` : ""}</h2>
      <p class="wl-modal-meta">${detail.runtime ? wlRuntime(detail.runtime) + " &middot; " : ""}${escapeHtml((detail.genres || []).join(", "))}${detail.rating ? ` &middot; ★ ${detail.rating}` : ""}</p>
      <p>${escapeHtml(detail.overview || "")}</p>
      ${detail.trailerKey
        ? `<div class="wl-trailer"><iframe src="https://www.youtube.com/embed/${encodeURIComponent(detail.trailerKey)}" title="Trailer" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`
        : `<p class="wl-modal-note">No trailer found for this one.</p>`}
      <div class="wl-modal-actions">
        <button class="secondary-btn wl-modal-save${saved ? " on" : ""}" type="button" data-wl-save="${detail.id}">${saved ? "remove from watchlist" : "add to watchlist"}</button>
        <button class="secondary-btn wl-modal-seen${seen ? " on" : ""}" type="button" data-wl-seen="${detail.id}">${seen ? "unmark as watched" : "mark as watched"}</button>
      </div>
    `;
    // keep the freshest snapshot (poster/rating can differ from the grid card)
    if (!wlResults.some(m => m.id === detail.id)) wlResults.push(detail);
  } catch (error) {
    console.warn("watchlist detail", error);
    body.innerHTML = `<p class="wl-modal-note">Could not load details right now.</p>`;
  }
}

function renderWatchlist() {
  wlRenderCounts();
  wlRenderGenres();
  if (!wlGenresCache) {
    wlApi({ op: "genres" }).then(data => { wlGenresCache = data.genres || []; wlRenderGenres(); }).catch(() => {});
  }
  wlResetAndLoad();
}

function initWatchlist() {
  const screen = $("#screen-watchlist");
  if (!screen) return;
  // one delegated listener: the grid re-renders constantly, so per-button
  // listeners would leak on every toggle
  screen.addEventListener("click", event => {
    const save = event.target.closest("[data-wl-save]");
    if (save) { event.stopPropagation(); const m = wlFindShown(save.dataset.wlSave); if (m) wlToggle("watchSaved", m); return refreshWlModalButtons(save.dataset.wlSave); }
    const seen = event.target.closest("[data-wl-seen]");
    if (seen) { event.stopPropagation(); const m = wlFindShown(seen.dataset.wlSeen); if (m) wlToggle("watchSeen", m); return refreshWlModalButtons(seen.dataset.wlSeen); }
    const genre = event.target.closest("[data-wl-genre]");
    if (genre) { wlGenre = genre.dataset.wlGenre; wlQuery = ""; const search = $("#wl-search"); if (search) search.value = ""; wlRenderGenres(); wlResetAndLoad(); return; }
    const tab = event.target.closest("[data-wl-view]");
    if (tab) { wlView = tab.dataset.wlView; $$(".wl-tab").forEach(t => { const on = t.dataset.wlView === wlView; t.classList.toggle("active", on); t.setAttribute("aria-selected", String(on)); }); wlRenderGenres(); wlRenderGrid(); return; }
    const more = event.target.closest("#wl-load-more");
    if (more) { wlPage += 1; return wlLoadPage(false); }
    const open = event.target.closest("[data-wl-open]");
    if (open) return wlOpenDetail(open.dataset.wlOpen);
  });

  const search = $("#wl-search");
  search?.addEventListener("input", () => {
    clearTimeout(wlSearchTimer);
    wlSearchTimer = setTimeout(() => {
      wlQuery = search.value.trim();
      wlResetAndLoad();
    }, 380);
  });

  $("#wl-modal-close")?.addEventListener("click", () => $("#wl-modal")?.close());
}

// After toggling save/seen from inside the open detail modal, update its own
// buttons in place rather than closing it.
function refreshWlModalButtons(id) {
  const modal = $("#wl-modal");
  if (!modal?.open) return;
  const saveBtn = modal.querySelector(`[data-wl-save="${id}"]`);
  const seenBtn = modal.querySelector(`[data-wl-seen="${id}"]`);
  if (saveBtn) { const on = wlIsSaved(id); saveBtn.classList.toggle("on", on); saveBtn.textContent = on ? "remove from watchlist" : "add to watchlist"; }
  if (seenBtn) { const on = wlIsSeen(id); seenBtn.classList.toggle("on", on); seenBtn.textContent = on ? "unmark as watched" : "mark as watched"; }
}

/* ============================================================================
   Our Lock. A real padlock, not a text-input pretending to be one: the
   combination is the app's own anniversary number (2502, the same one the
   entry gate checks) so this reads as "you already know this," and turning
   it correctly physically swings the shackle open via the CSS transition on
   #lock-shackle-g, rather than just swapping a "locked" label for "unlocked".
   ========================================================================= */
const LOCK_COMBO = [2, 5, 0, 2];
const LOCK_REVEAL_TEXT = "You cracked it. Of course you did, it was always going to be that date. That morning changed the shape of my whole life and I did not even know it yet. Every number I use for anything that matters is some version of yours now, hidden in plain sight so only you would ever find it. I built this whole ridiculous little app just to have a place small enough to keep you in, and this felt like the right place to put the part I do not say often enough. You are the answer I keep landing on, on purpose, every single time.";

let lockDigits = [0, 0, 0, 0];

function lockReelHtml(i) {
  return `
    <div class="lock-reel">
      <button class="lock-arrow" data-lock-dir="1" data-lock-index="${i}" type="button" aria-label="turn dial ${i + 1} up">
        <svg viewBox="0 0 24 24" fill="none"><path d="M6 15l6-6 6 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="lock-window"><span class="lock-digit" data-lock-slot="${i}">0</span></div>
      <button class="lock-arrow" data-lock-dir="-1" data-lock-index="${i}" type="button" aria-label="turn dial ${i + 1} down">
        <svg viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>
  `;
}

function lockUpdateDisplay() {
  lockDigits.forEach((d, i) => {
    const el = $(`.lock-digit[data-lock-slot="${i}"]`);
    if (el) el.textContent = String(d);
  });
}

function lockShowUnlocked(celebrate) {
  $("#lock-svg")?.classList.add("unlocked");
  const status = $("#lock-status");
  if (status) status.textContent = "open. it was always going to be that number.";
  const reveal = $("#lock-reveal");
  const text = $("#lock-reveal-text");
  if (text) text.textContent = LOCK_REVEAL_TEXT;
  reveal?.classList.remove("hidden");
  if (celebrate) {
    const rect = $("#lock-svg")?.getBoundingClientRect();
    window.Bloom?.confetti(rect ? rect.left + rect.width / 2 : innerWidth / 2, rect ? rect.top + rect.height / 2 : innerHeight * 0.3, 40);
    window.Poo?.react?.("love");
  }
}

function lockCheckCombo() {
  if (lockDigits.every((d, i) => d === LOCK_COMBO[i])) {
    if (!state.lockOpened) { state.lockOpened = true; saveState(); }
    lockShowUnlocked(true);
  }
}

function lockTurn(index, dir) {
  if (state.lockOpened) return; // already open - the dials are just a keepsake now
  lockDigits[index] = (lockDigits[index] + dir + 10) % 10;
  lockUpdateDisplay();
  lockCheckCombo();
}

function renderLock() {
  const reels = $("#lock-reels");
  if (!reels) return;
  reels.innerHTML = LOCK_COMBO.map((_, i) => lockReelHtml(i)).join("");

  if (state.lockOpened) {
    // she solved it before - land already open with the note in place,
    // rather than making her redo a puzzle that isn't a puzzle anymore
    lockDigits = [...LOCK_COMBO];
    lockUpdateDisplay();
    lockShowUnlocked(false);
  } else {
    lockDigits = [0, 0, 0, 0];
    lockUpdateDisplay();
  }

  reels.addEventListener("click", event => {
    const btn = event.target.closest("[data-lock-dir]");
    if (!btn) return;
    lockTurn(Number(btn.dataset.lockIndex), Number(btn.dataset.lockDir));
  });
}

/* ============================================================================
   Build-your-own bouquet. Real pointer-drag, not a fixed photo: a tray of
   lily cutouts she drags into a paper-wrap drop zone, repositions afterward,
   and taps to remove - the same three gestures a real florist counter would
   give you, done with Pointer Events so touch and mouse need no separate
   code path. Placement persists in state.bouquetItems.
   ========================================================================= */
const BOUQUET_DRAG_THRESHOLD = 6; // px of movement before a touch counts as a drag, not a tap

function bouquetClamp(v) { return v < -8 ? -8 : v > 108 ? 108 : v; }

function bouquetPlacedNode(item) {
  const el = document.createElement("div");
  el.className = `bouquet-placed${item.kind === "bow" ? " bow-placed" : ""}`;
  el.dataset.bouquetId = item.id;
  el.style.left = `${item.x}%`;
  el.style.top = `${item.y}%`;
  el.style.transform = `rotate(${item.rot}deg)`;
  el.innerHTML = item.kind === "bow" ? "&#127872;" : `<img src="${escapeHtml(item.src)}" alt="">`;
  return el;
}

function bouquetSyncHint() {
  const wrap = $("#bouquet-vase");
  wrap?.classList.toggle("has-items", (state.bouquetItems || []).length > 0);
}

function bouquetAddItem(kind, src, xPercent, yPercent) {
  const item = { id: `b${Date.now()}${(Math.random() * 1000) | 0}`, kind, src, x: bouquetClamp(xPercent), y: bouquetClamp(yPercent), rot: rnd(-14, 14) };
  (state.bouquetItems || (state.bouquetItems = [])).push(item);
  saveState();
  const node = bouquetPlacedNode(item);
  node.classList.add("placing-in");
  $("#bouquet-vase")?.appendChild(node);
  bouquetSyncHint();
  bindBouquetPlacedDrag(node);
}

function bouquetRemoveItem(id) {
  const node = $(`.bouquet-placed[data-bouquet-id="${id}"]`);
  if (node) {
    node.classList.add("removing");
    setTimeout(() => node.remove(), 220);
  }
  state.bouquetItems = (state.bouquetItems || []).filter(i => i.id !== id);
  saveState();
  bouquetSyncHint();
}

function bouquetPercentFromPoint(clientX, clientY) {
  const rect = $("#bouquet-vase").getBoundingClientRect();
  return { x: ((clientX - rect.left) / rect.width) * 100, y: ((clientY - rect.top) / rect.height) * 100 };
}

function bouquetPointInVase(clientX, clientY) {
  const rect = $("#bouquet-vase")?.getBoundingClientRect();
  if (!rect) return false;
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}

// Dragging an existing stem: move it live while the pointer is down, but
// only if it actually moved - a plain tap removes it instead, so the same
// gesture set works for both "rearrange" and "take it back out."
function bindBouquetPlacedDrag(node) {
  node.addEventListener("pointerdown", event => {
    event.preventDefault();
    const id = node.dataset.bouquetId;
    const startX = event.clientX, startY = event.clientY;
    let moved = false;
    // capture can fail on older mobile webviews (and, harmlessly, on
    // synthetic pointer events) - without the try/catch that failure was
    // uncaught and skipped attaching the move/up listeners entirely, which
    // silently broke both dragging and tap-to-remove at once
    try { node.setPointerCapture(event.pointerId); } catch { /* fall through - listeners below still work without capture */ }

    const onMove = moveEvent => {
      const dx = moveEvent.clientX - startX, dy = moveEvent.clientY - startY;
      if (!moved && Math.hypot(dx, dy) > BOUQUET_DRAG_THRESHOLD) { moved = true; node.classList.add("dragging"); }
      if (!moved) return;
      const pos = bouquetPercentFromPoint(moveEvent.clientX, moveEvent.clientY);
      node.style.left = `${bouquetClamp(pos.x)}%`;
      node.style.top = `${bouquetClamp(pos.y)}%`;
    };
    const onUp = upEvent => {
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerup", onUp);
      node.classList.remove("dragging");
      if (moved) {
        const pos = bouquetPercentFromPoint(upEvent.clientX, upEvent.clientY);
        const item = (state.bouquetItems || []).find(i => i.id === id);
        if (item) { item.x = bouquetClamp(pos.x); item.y = bouquetClamp(pos.y); saveState(); }
      } else {
        bouquetRemoveItem(id);
      }
    };
    node.addEventListener("pointermove", onMove);
    node.addEventListener("pointerup", onUp);
  });
}

// Dragging a fresh pick out of the tray: it does not become a real placed
// item until it is actually released over the wrap - released anywhere else
// and it simply never existed, no half-added state to clean up.
function bindBouquetTrayPick(button) {
  button.addEventListener("pointerdown", event => {
    event.preventDefault();
    const kind = button.dataset.bouquetKind;
    const src = button.dataset.bouquetSrc;
    const ghost = document.createElement("div");
    ghost.className = `bouquet-ghost${kind === "bow" ? " bow-ghost" : ""}`;
    ghost.innerHTML = kind === "bow" ? "&#127872;" : `<img src="${escapeHtml(src)}" alt="">`;
    document.body.appendChild(ghost);
    const moveGhost = (x, y) => { ghost.style.left = `${x - 30}px`; ghost.style.top = `${y - 30}px`; };
    moveGhost(event.clientX, event.clientY);
    try { button.setPointerCapture(event.pointerId); } catch { /* see the matching note in bindBouquetPlacedDrag */ }

    const onMove = moveEvent => moveGhost(moveEvent.clientX, moveEvent.clientY);
    const onUp = upEvent => {
      button.removeEventListener("pointermove", onMove);
      button.removeEventListener("pointerup", onUp);
      ghost.remove();
      if (bouquetPointInVase(upEvent.clientX, upEvent.clientY)) {
        const pos = bouquetPercentFromPoint(upEvent.clientX, upEvent.clientY);
        bouquetAddItem(kind, src, pos.x, pos.y);
      }
    };
    button.addEventListener("pointermove", onMove);
    button.addEventListener("pointerup", onUp);
  });
}

function setupBouquetBuilder() {
  const vase = $("#bouquet-vase");
  if (!vase) return;
  $$(".bouquet-pick").forEach(bindBouquetTrayPick);
  $("#bouquet-clear")?.addEventListener("click", () => {
    (state.bouquetItems || []).slice().forEach(item => bouquetRemoveItem(item.id));
  });
  // hydrate whatever she left here last time
  (state.bouquetItems || []).forEach(item => {
    const node = bouquetPlacedNode(item);
    vase.appendChild(node);
    bindBouquetPlacedDrag(node);
  });
  bouquetSyncHint();
}

/* ============================================================================
   Our Galaxy screen wiring. The particle system itself lives entirely in
   galaxy.js (mounted/unmounted by openScreen, see the note there) - this is
   just the one button on top of it, wired once like every other renderer.
   ========================================================================= */
function renderGalaxy() {
  $("#galaxy-wish")?.addEventListener("click", () => {
    const button = $("#galaxy-wish");
    if (!button || button.disabled) return;
    button.disabled = true;
    button.textContent = "watching it land...";
    window.MoonpieGalaxy?.makeAWish(() => {
      const rect = $("#galaxy-stage")?.getBoundingClientRect();
      window.Bloom?.confetti(
        rect ? rect.left + rect.width / 2 : innerWidth / 2,
        rect ? rect.top + rect.height / 2 : innerHeight * 0.3,
        30
      );
      window.Poo?.react?.("love");
      button.textContent = "make another wish";
      button.disabled = false;
    });
  });
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
  applyHeroScene();
}

/* ============================================================================
   The home hero - a real photo, not a gradient, and which photo depends on
   when she opens the app AND how she says she's feeling. A "night" scene at
   9am would feel like the app doesn't know what day it is; a cheerful
   daytime porch scene when she's just told it she feels heavy would feel
   actively tone-deaf. Mood (when she's set one) always wins over the clock.
   ============================================================================ */
const HERO_SCENES = {
  morning: {
    img: "./assets/mood/hero-morning.webp",
    kicker: "good morning, my favourite person",
    line: "Coffee first. Then come find me here - I left a note for you.",
  },
  day: {
    img: "./assets/mood/hero-day.webp",
    kicker: "hi, wherever you are right now",
    line: "However today is going, this little world is still right here.",
  },
  evening: {
    img: "./assets/mood/hero-evening.webp",
    kicker: "the day is finally slowing down",
    line: "Come sit for a minute. I saved the soft part of the day for you.",
  },
  night: {
    img: "./assets/mood/hero-night.webp",
    kicker: "still thinking of you before I sleep",
    line: "If you're up too, come be sleepy with me for a second.",
  },
};

// mood -> forced scene. Anything not listed here (soft, or no mood set yet)
// just follows the actual clock instead of overriding it.
const MOOD_SCENE_OVERRIDE = { sleepy: "night", heavy: "evening" };

function timeOfDayScene(hour = new Date().getHours()) {
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "day";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

function applyHeroScene() {
  const hero = $("#home-hero");
  if (!hero) return;
  const key = MOOD_SCENE_OVERRIDE[state.mood] || timeOfDayScene();
  const scene = HERO_SCENES[key];
  hero.style.setProperty("--hero-img", `url('${scene.img}')`);
  $("#hero-kicker").textContent = scene.kicker;
  $("#hero-line").textContent = scene.line;
}

function worldTileHtml(world, i) {
  return `
    <button class="world-tile tone-${world.tone}" data-open="${world.id}" type="button" style="--i:${i};background-image:url('${world.photo}')">
      <span class="world-icon">${world.icon}</span>
      <span class="world-copy">
        <strong>${world.title}</strong>
        <small>${world.sub}</small>
      </span>
      <span class="world-count">${world.count}</span>
    </button>
  `;
}

// The four rooms the quick tiles on Home already link to. Home must not
// print them a third time.
const HOME_QUICK_IDS = ["letters", "places", "care", "birthday"];

/* Home used to list every room, which meant the first screen was Atlas and
   Us reprinted end to end. It now shows three rooms chosen from the date, so
   Home is a suggestion rather than a catalogue, and it is different tomorrow.
   Deterministic from the day, so it does not reshuffle on every render. */
function roomsForToday(count = 3) {
  const pool = worlds.filter(w => !HOME_QUICK_IDS.includes(w.id));
  const now = new Date();
  const day = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
  const picks = [];
  for (let n = 0; picks.length < Math.min(count, pool.length); n++) {
    // 7 is coprime with most pool sizes, so consecutive days walk the pool
    // instead of landing on the same few rooms.
    const world = pool[(day * 7 + n) % pool.length];
    if (!picks.includes(world)) picks.push(world);
  }
  return picks;
}

function renderAtlas() {
  // Three hubs, three different jobs: Home suggests, Atlas holds things to
  // do, Us holds what the two of them keep. No room appears in more than one.
  $("#home-worlds").innerHTML = roomsForToday().map(worldTileHtml).join("");
  $("#atlas-grid").innerHTML = worlds.filter(w => w.section === "atlas").map(worldTileHtml).join("");
  const usGrid = $("#us-grid");
  if (usGrid) usGrid.innerHTML = worlds.filter(w => w.section === "us").map(worldTileHtml).join("");
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
    <button class="envelope theme-${letter.theme}" type="button" data-letter="${i}" aria-label="${escapeHtml(letter.title)} - tap to unseal">
      <span class="envelope-flap" aria-hidden="true"></span>
      <span class="envelope-seal" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span>
      <span class="envelope-tab">${escapeHtml(letter.tab)}</span>
      <span class="envelope-body">
        <strong>${escapeHtml(letter.title)}</strong>
        <small>${escapeHtml(letter.preview)}</small>
        <em>tap to unseal</em>
      </span>
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

// Places she has actually stepped into, by name (stable across a reorder or
// addition to the list, unlike an index would be).
function visitedWorldNames() {
  return Array.isArray(state.worldsVisited) ? state.worldsVisited : [];
}
function markWorldVisited(name) {
  const visited = visitedWorldNames();
  if (!visited.includes(name)) {
    visited.push(name);
    state.worldsVisited = visited;
    saveState();
  }
}

function renderPlaces() {
  const list = futureWorlds.length ? futureWorlds : places.map(([name, image, intro]) => ({ name, intro, eyebrow: "future coordinate", photos: [image], moments: [] }));
  const visited = visitedWorldNames();

  // A progress line, so this screen is a place she is getting through
  // together rather than a static gallery that looks identical forever.
  const progress = $("#places-progress");
  if (progress) {
    const seen = list.filter(place => visited.includes(place.name)).length;
    progress.textContent = seen === 0
      ? `${list.length} worlds waiting. Pick the first one.`
      : seen === list.length
        ? `You have opened every world. I am already building more.`
        : `${seen} of ${list.length} worlds opened together.`;
  }

  // A different one leads the rail each day, so the first thing she sees
  // here does not stay frozen on visit one forever.
  const day = Math.floor(Date.now() / 86400000);
  const featuredIndex = list.length ? day % list.length : 0;

  $("#place-rail").innerHTML = list.map((place, index) => {
    const seen = visited.includes(place.name);
    return `
    <button class="world-portal${seen ? " is-visited" : ""}${index === featuredIndex ? " is-featured" : ""}" type="button" data-world-portal="${index}">
      <img src="${escapeHtml(place.photos[0])}" alt="${escapeHtml(place.name)}" loading="${index < 2 ? "eager" : "lazy"}" fetchpriority="${index < 2 ? "high" : "low"}" decoding="async" width="960" height="720" onerror="this.closest('.world-portal').classList.add('image-unavailable');this.remove()">
      <span class="world-portal-copy">
        <span class="portal-number">${index === featuredIndex ? "tonight&rsquo;s pick" : "world " + String(index + 1).padStart(2, "0")}</span>
        <h3>${escapeHtml(place.name)}</h3>
        <p>${escapeHtml(place.eyebrow)}</p>
        <small>${seen ? "visited &middot; " : ""}${place.photos.length} scenes &middot; ${place.moments.length} moments</small>
      </span>
      ${seen ? '<span class="world-portal-check" aria-hidden="true">&#10003;</span>' : ""}
    </button>
  `;
  }).join("");
}

function openFutureWorld(index) {
  const place = futureWorlds[index];
  if (!place) return;
  markWorldVisited(place.name);
  renderPlaces();
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

function songCardHtml([name, artist, note, spotifyId], i) {
  return `
    <article class="song-card spotify-card premium-card">
      <div class="song-note">
        <p class="card-label">track ${String(i + 1).padStart(2, "0")}</p>
        <h3>${escapeHtml(name)}</h3>
        <strong>${escapeHtml(artist)}</strong>
        <p>${escapeHtml(note)}</p>
      </div>
      ${spotifyId ? `<iframe title="Play ${escapeHtml(name)} on Spotify" data-src="https://open.spotify.com/embed/track/${encodeURIComponent(spotifyId)}?utm_source=generator&theme=0" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>` : ""}
    </article>
  `;
}

function renderSongs() {
  // A featured pick up top, stable for the whole day and different tomorrow -
  // so opening this screen twice in an hour doesn't reshuffle it, but coming
  // back next week finds something new leading the list.
  const day = Math.floor(Date.now() / 86400000);
  const featuredIndex = day % songs.length;
  const featured = songs[featuredIndex];
  const rest = songs.filter((_, i) => i !== featuredIndex);
  $("#song-featured").innerHTML = `
    <p class="card-label">playing for you tonight</p>
    ${songCardHtml(featured, featuredIndex).replace('class="song-card spotify-card premium-card"', 'class="song-card spotify-card premium-card song-featured-card"')}
  `;
  $("#song-list").innerHTML = rest.map(songCardHtml).join("");
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
  renderGardenCaptions();
  if (gardenTreeCanvas) return;
  gardenTreeCanvas = $("#garden-tree-canvas");
  if (!gardenTreeCanvas) return;
  gardenTreeCtx = gardenTreeCanvas.getContext("2d");
  gardenPetals = buildGardenPetals();
  resizeGardenTree();
  window.addEventListener("resize", resizeGardenTree);
  // Already bloomed on a previous visit: skip the sprout state and the tap
  // prompt, and paint the full tree immediately.
  if (state.gardenBloomed) {
    $("#garden-stage")?.classList.add("bloomed");
    $(".home-garden")?.classList.add("bloomed");
    gardenProgress = 1;
    requestAnimationFrame(() => drawGardenTree(1));
  }
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
  // The whole point of a garden is that it does not need re-planting every
  // time you walk past it. Once bloomed, it stays bloomed.
  state.gardenBloomed = true;
  saveState();
}

// Captions under the tree that acknowledge how long it has actually been
// growing, instead of saying the same "tap the heart" sentence on visit 40
// that it said on visit 1.
const gardenAges = [
  { min: 0,   line: "Still a seed. One tap and it starts growing." },
  { min: 1,   line: "It bloomed once, and it is staying that way. This tree does not wilt." },
  { min: 30,  line: "A month of this tree standing here for you. It has not moved, and it is not going to." },
  { min: 90,  line: "Three months in and the roots are the whole point now, not the bloom." },
  { min: 180, line: "Half a year of this exact tree, in this exact spot, still full of hearts." },
  { min: 365, line: "A year of a tree that only ever grew one way: toward you." }
];
function gardenAgeLine() {
  const days = daysTogether();
  let line = gardenAges[0].line;
  for (const stage of gardenAges) if (days >= stage.min) line = stage.line;
  return line;
}

const bouquetLines = [
  "Pink lilies, roses, soft ribbon, and the closest I can get to placing flowers in your hands from here.",
  "I keep picking the same flowers because they are the ones that made me think of you the first time.",
  "One day I get to actually hand you this bouquet instead of a photo of it. That day is on the calendar in my head."
];
const roseLines = [
  "The deep red kind, the ones that look almost too velvet to be real.",
  "Roses are supposed to be the obvious choice. I am not embarrassed about being obvious for you.",
  "This one is for the version of romance that does not need to be original to be true."
];
function renderGardenCaptions() {
  const bouquetCopy = $("#bouquet-copy");
  const roseCopy = $("#rose-copy");
  if (bouquetCopy) bouquetCopy.textContent = pickFresh(bouquetLines, "lastBouquetLine");
  if (roseCopy) roseCopy.textContent = pickFresh(roseLines, "lastRoseLine");
  const age = $("#garden-age-line");
  if (age) age.textContent = gardenAgeLine();
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
    html = `<p class="card-label">from Poo</p><p>She heard about it too. Go say hi to her.</p>`;
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

// Three letters instead of one, cycled the same never-twice-running way as
// everything else, so sealing a wish for the tenth time hands back different
// words instead of the same paragraph she has already memorized.
const birthdayLetters = [
  [
    "You deserve more than a page. You deserve a little universe that stays on your phone, waits quietly, and opens whenever missing me gets loud.",
    "My Moonpie. My Princess. My babyy. I love you in every screen, every letter, every future place, every silly widget, and every ordinary day we have not reached yet.",
    "Whatever you wished for, I hope life is gentle enough to bring it close. And if your wish has anything to do with us, I am already walking toward it."
  ],
  [
    "I built this whole thing because a text felt too small for what I am trying to say to you, and it turns out even this is not quite big enough.",
    "You are the reason I check my phone hoping, not anxious. That is a small difference that changed my whole day, every day, since you.",
    "Keep wishing. I am collecting every one of them, quietly, for the version of us that gets to hand them all back at once."
  ],
  [
    "Somewhere in the time it took you to make that wish, I was probably thinking about you too. That is just what happens now.",
    "I do not need the occasion to mean this. Any Tuesday works. This one just happened to be the Tuesday you opened the app.",
    "Whatever you wished for tonight, put it next to the others. We are building a very long list of things I intend to make happen."
  ]
];
function nextBirthdayLetter() { return pickFresh(birthdayLetters, "lastBirthdayLetter"); }

function renderBirthday() {
  $("#birthday-wish").innerHTML = `
    <div class="birthday-stage" data-birthday-stage="wish">
      <p class="card-label">no occasion needed</p>
      <div class="wish-moon">🌙</div>
      <h2>Make a wish, Moonpie.</h2>
      <p>Write it here or keep it secret. Either way, I am rooting for every soft thing your heart asks for.</p>
      <textarea id="birthday-wish-text" rows="3" maxlength="180" placeholder="my wish is..."></textarea>
      <button class="primary-btn wide" id="seal-wish" type="button">seal my wish</button>
    </div>

    <div class="birthday-stage hidden" data-birthday-stage="letter">
      <p class="card-label">wish sealed</p>
      <div class="birthday-envelope">💌</div>
      <h2>This one's for you, Moonpie.</h2>
      <div id="birthday-letter-body"></div>
      <button class="secondary-btn wide" id="replay-birthday" type="button">make another wish</button>
    </div>
  `;
}

function renderCare() {
  const [title, text] = nextOneThing();
  $("#one-thing-title").textContent = title;
  $("#one-thing-note").textContent = text;
}

/* ============================================================================
   "Us" - the meadow at dusk. Everything here is IN the scene: a heart you
   tap, a lantern you open, numbers scattered like fireflies. No card grid.
   ============================================================================ */

const COUNTER_API = "../api/counter?room=moonpie-counters-2504";
const DAILY_API = "../api/daily-question?room=moonpie-daily-2504";
const ANNIVERSARY = new Date("2025-02-25T00:00:00");

function daysTogether() {
  return Math.max(0, Math.floor((Date.now() - ANNIVERSARY.getTime()) / 86400000));
}

function scatterFireflies() {
  const host = $("#hearth-fireflies");
  if (!host || host.dataset.seeded) return;
  host.dataset.seeded = "1";
  const n = 16;
  let html = "";
  for (let i = 0; i < n; i++) {
    const x = 6 + Math.random() * 88;
    const y = 8 + Math.random() * 72;
    const dur = 6 + Math.random() * 7;
    const glowDur = 2 + Math.random() * 3;
    const delay = Math.random() * -10;
    html += `<span class="hearth-fly" style="left:${x}%;top:${y}%;animation-duration:${dur}s,${glowDur}s;animation-delay:${delay}s,${delay}s"></span>`;
  }
  host.innerHTML = html;
}

function initHearthOnce() {
  scatterFireflies();

  const heart = $("#thinking-heart");
  heart?.addEventListener("click", async () => {
    heart.classList.remove("tapped");
    void heart.offsetWidth;
    heart.classList.add("tapped");
    const ripple = document.createElement("span");
    ripple.className = "hearth-ripple";
    $(".hearth")?.appendChild(ripple);
    setTimeout(() => ripple.remove(), 1150);
    burstAt(window.innerWidth / 2, heart.getBoundingClientRect().top + 40, 5);
    window.Poo?.react?.("love");

    try {
      const res = await fetch(COUNTER_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "thinking-of-you" }),
      });
      if (res.ok) {
        const { value } = await res.json();
        $("#thinking-count").textContent = `${value} times, between the two of you`;
      }
    } catch { /* the tap still felt like something even if the count didn't sync */ }

    if (window.MoonpiePush) {
      const me = window.MoonpiePush.myProfile();
      window.MoonpiePush.send(`${nickOf(me)} is thinking of you`, "Just tapped the heart. That's all.");
    }
  });

  $("#lantern")?.addEventListener("click", openLanternSheet);
  $("#lantern-close")?.addEventListener("click", closeLanternSheet);
  $("#lantern-sheet")?.addEventListener("click", e => { if (e.target.id === "lantern-sheet") closeLanternSheet(); });
  $("#lantern-submit")?.addEventListener("click", submitLanternAnswer);
}

function renderHearthStats() {
  const host = $("#hearth-stats");
  if (!host) return;
  const streak = typeof computeStreak === "function" && Array.isArray(state.visitLog)
    ? computeStreak(state.visitLog) : 0;
  const stats = [
    [daysTogether(), "days together"],
    [streak, "day streak"],
    [state.widgets?.length || 0, "notes exchanged"],
  ];
  host.innerHTML = stats.map(([n, label]) =>
    `<div class="hearth-stat"><b>${n}</b><span>${escapeHtml(label)}</span></div>`).join("");
}

async function refreshHearth() {
  renderHearthStats();
  try {
    const res = await fetch(`${COUNTER_API}&key=thinking-of-you`, { cache: "no-store" });
    if (res.ok) {
      const { value } = await res.json();
      $("#thinking-count").textContent = value > 0 ? `${value} times, between the two of you` : "be the first to tap it";
    }
  } catch { $("#thinking-count").textContent = " "; }

  const lantern = $("#lantern");
  const me = window.MoonpiePush?.myProfile?.() || "Michelle";
  try {
    const res = await fetch(`${DAILY_API}&me=${encodeURIComponent(me)}`, { cache: "no-store" });
    if (!res.ok) throw new Error("unavailable");
    const data = await res.json();
    state.dailyQuestion = data;
    if (lantern) lantern.dataset.state = data.otherAnswer ? "revealed" : data.myAnswer ? "answered" : "closed";
  } catch {
    state.dailyQuestion = null;
  }
}

function openLanternSheet() {
  const sheet = $("#lantern-sheet");
  const data = state.dailyQuestion;
  if (!sheet || !data) { toast("couldn't reach today's question"); return; }

  $("#lantern-question").textContent = data.question;
  $("#lantern-day-label").textContent = "today's question";

  const form = $("#lantern-answer-form"), waiting = $("#lantern-waiting"), reveal = $("#lantern-reveal");
  form.classList.toggle("hidden", !!data.myAnswer);
  waiting.classList.toggle("hidden", !(data.myAnswer && !data.otherAnswer));
  reveal.classList.toggle("hidden", !(data.myAnswer && data.otherAnswer));

  if (data.myAnswer) {
    $("#lantern-my-answer").textContent = data.myAnswer;
    $("#lantern-waiting-note").textContent = data.otherAnswered
      ? "they answered too - open again in a moment"
      : "waiting for them to answer too...";
  }
  if (data.myAnswer && data.otherAnswer) {
    const me = window.MoonpiePush?.myProfile?.() || "Michelle";
    $("#lantern-my-label").textContent = `${nickOf(me)} said`;
    $("#lantern-their-label").textContent = `${nickOf(window.MoonpiePush?.otherProfile?.(me) || "Michael")} said`;
    $("#lantern-reveal-mine").textContent = data.myAnswer;
    $("#lantern-reveal-theirs").textContent = data.otherAnswer;
  }

  sheet.hidden = false;
  requestAnimationFrame(() => sheet.classList.add("show"));
  document.body.classList.add("focus-mode");
}

function closeLanternSheet() {
  const sheet = $("#lantern-sheet");
  if (!sheet) return;
  sheet.classList.remove("show");
  document.body.classList.remove("focus-mode");
  setTimeout(() => { sheet.hidden = true; }, 260);
}

async function submitLanternAnswer() {
  const answer = $("#lantern-answer")?.value.trim();
  if (!answer) return toast("write something first");
  const me = window.MoonpiePush?.myProfile?.() || "Michelle";
  try {
    const res = await fetch(DAILY_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ me, answer }),
    });
    if (!res.ok) throw new Error("failed");
    const data = await res.json();
    state.dailyQuestion = data;
    $("#lantern").dataset.state = data.otherAnswer ? "revealed" : "answered";
    $("#lantern-answer").value = "";
    burstAt(window.innerWidth / 2, window.innerHeight * 0.7, 10);
    openLanternSheet();
  } catch {
    toast("couldn't seal that answer - try again in a moment");
  }
}

// What actually reaches the other phone when a care-mode button is tapped -
// short and specific to the feeling, not the generic-alarm "new message"
// most apps would send.
const careNudges = {
  missing: ["missing you", "just told the app the missing is loud right now."],
  reassurance: ["needs to hear it", "wants reassurance. say the thing."],
  overwhelmed: ["everything feels heavy", "is overwhelmed right now."],
  sleep: ["can't settle", "is having trouble settling down tonight."],
};

function showCareResponse(mode) {
  const response = nextCareResponse(mode);
  if (!response) return;
  $$("[data-care-mode]").forEach(button => button.classList.toggle("active", button.dataset.careMode === mode));
  $("#care-response").innerHTML = `<span>${response[0]}</span><h3>${escapeHtml(response[1])}</h3><p>${escapeHtml(response[2])}</p>`;
  burstAt(window.innerWidth / 2, Math.min(window.innerHeight * .62, 520), 8);
  if (window.Poo) window.Poo.react("shy");

  const nudge = careNudges[mode];
  if (nudge && window.MoonpiePush) {
    const me = window.MoonpiePush.myProfile();
    window.MoonpiePush.send(`${nickOf(me)} is ${nudge[0]}`, nickOf(me) + " " + nudge[1]);
    // fire-and-forget by design (see push.js) - worded as an attempt, not a
    // guarantee, since a missing subscription or unconfigured push fails
    // silently on purpose rather than blocking this screen on a network call
    toast(`Letting ${nickOf(window.MoonpiePush.otherProfile(me))} know, if nudges are on.`);
  }
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
  // real photographed lilies, scattered and drifting - the emoji garden that
  // used to sit here read as clip-art against the photography
  for (let i = 0; i < 7; i++) {
    const piece = document.createElement("img");
    piece.src = `./assets/flowers/lily-${1 + (i % 6)}.webp`;
    piece.alt = "";
    piece.className = `opening-flower flower-path-${i % 4}`;
    piece.style.left = `${2 + (i * 15.5) % 88}%`;
    piece.style.top = `${5 + (i % 4) * 23}%`;
    piece.style.width = `${52 + (i % 3) * 26}px`;
    piece.style.setProperty("--delay", `${-1 * (i % 6) * .55}s`);
    piece.style.setProperty("--drift", `${(i % 2 ? 1 : -1) * (48 + i * 6)}px`);
    piece.style.setProperty("--spin", `${(i % 2 ? 1 : -1) * (9 + i * 3)}deg`);
    field.appendChild(piece);
  }
}

function completeBouquetUnwrap() {
  const button = $("#unwrap-bouquet");
  if (window.Bloom) {
    const r = button?.getBoundingClientRect();
    window.Bloom.confetti(r ? r.left + r.width / 2 : innerWidth / 2, r ? r.top + r.height / 2 : innerHeight / 2, 46);
  }
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
  // a different bouquet each visit - she should never untie the same one twice
  const wrapped = $("#wrapped-bouquet");
  if (wrapped) {
    const n = 1 + Math.floor(Math.random() * 6);
    wrapped.src = `./assets/flowers/bouquet-${n}.webp`;
  }
  $("#unwrap-bouquet")?.addEventListener("click", completeBouquetUnwrap);
  $("#enter-universe")?.addEventListener("click", enterUniverse);
}

function sealBirthdayWish() {
  const wish = $("#birthday-wish-text")?.value.trim();
  const body = $("#birthday-letter-body");
  if (body) body.innerHTML = nextBirthdayLetter().map(p => `<p class="birthday-letter">${escapeHtml(p)}</p>`).join("");
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
      <span class="shared-widget-sender">from ${escapeHtml(nickOf(w.sender) || "one of us")}</span>
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
  box.innerHTML = `<div class="card-label">latest widget · from ${escapeHtml(nickOf(latest.sender) || "one of us")}</div>${latest.type === "doodle" ? `<img src="${latest.value}" alt="latest doodle">` : `<p>${escapeHtml(latest.value)}</p>`}`;
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
  if (result === "granted") {
    const subscribed = await window.MoonpiePush?.subscribe();
    toast(subscribed ? "nudges allowed - they'll reach your phone now" : "nudges allowed on this device, but couldn't connect to the other phone yet");
  } else {
    toast("nudges not allowed yet");
  }
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
    setSyncStatus(`Connected as ${nickOf(state.profile) || "Moonpie"}. Notes from both phones appear here automatically.`, true);
    if (!quiet && latest?.id && latest.id !== beforeLatest && latest.sender !== state.profile) {
      showLoveNotification(latest, `A new note from ${nickOf(latest.sender) || "your love"}`);
      toast(`new love note from ${nickOf(latest.sender) || "your person"}`);
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
    setSyncStatus(`Sent from ${nickOf(widget.sender)}. It will appear on the other phone.`, true);
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
    const poo = event.target.closest("[data-poo]");
    if (poo) {
      if (window.Poo) window.Poo.open();
      return;
    }
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
  $("#new-mission")?.addEventListener("click", () => {
    $("#mission-note").textContent = nextMission();
    saveState();
    burstAt(window.innerWidth / 2, window.innerHeight * 0.5, 6);
  });
  $("#new-poo-line")?.addEventListener("click", () => {
    $("#poo-says-note").textContent = nextPooLine();
    saveState();
    window.Poo?.react?.("curious");
  });
  $("#new-one-thing")?.addEventListener("click", () => {
    const [title, text] = nextOneThing();
    $("#one-thing-title").textContent = title;
    $("#one-thing-note").textContent = text;
    saveState();
    burstAt(window.innerWidth / 2, window.innerHeight * 0.5, 6);
  });
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
    if (!card || card.classList.contains("opening")) return;
    const letter = letters[Number(card.dataset.letter)];
    // the flap lifts and the seal breaks before the letter itself appears -
    // a beat of "unsealing" instead of instantly popping a modal open
    card.classList.add("opening");
    const rect = card.getBoundingClientRect();
    burstAt(rect.left + rect.width / 2, rect.top + 18, 8);
    setTimeout(() => {
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
      setTimeout(() => card.classList.remove("opening"), 400);
    }, 420);
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
  initGamePicker();
  initWatchlist();
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
