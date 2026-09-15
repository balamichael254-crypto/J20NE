const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const expansion = window.MOONPIE_EXPANSION || {};

// "Michelle" / "Michael" only ever exist as internal profile identifiers now -
// they route the shared vault, the leaderboard, and widget sync, but nothing
// on screen should ever print them literally. Every display of a name goes
// through here. (vault.js keeps its own copy of this map for the same reason.)
const PROFILE_NICK = { Michelle: "Moonpie", Michael: "Sunstone" };
const nickOf = name => PROFILE_NICK[name] || name;

/* ---------------------------------------------------------------------------
   Two sides.

   This app is a gift in both directions. Whoever unlocked it is "me"; the
   other one is "them". Everything the app says about the two of us - the
   greeting, the streak, who a letter is being sent to, whose score is whose
   - runs through here, so on her phone it speaks to Moonpie about Sunstone
   and on his it speaks to Sunstone about Moonpie. It used to assume the
   reader was always her, which meant he came back three days running and
   was congratulated for her streak.

   The written content is deliberately NOT flipped. The twelve letters, the
   hundred reasons and the songs were written by one of us for the other,
   and they stay addressed the way they were written, the same way a letter
   in a drawer still has a name on it when the person who wrote it reads it
   back.
   ------------------------------------------------------------------------ */
function meId() { return state.profile === "Michael" ? "Michael" : "Michelle"; }
function themId() { return meId() === "Michael" ? "Michelle" : "Michael"; }
function myName() { return nickOf(meId()); }
function theirName() { return nickOf(themId()); }
function readerIsHer() { return meId() === "Michelle"; }

/* Markup carries both readings inline rather than needing a template:
     data-voice-name="me|them"         prints the right nickname
     data-voice-hers / data-voice-his  swaps a whole line
   One pass at boot and again whenever the profile changes. */
function applyVoice(root = document) {
  $$("[data-voice-name]", root).forEach(el => {
    el.textContent = el.dataset.voiceName === "them" ? theirName() : myName();
  });
  $$("[data-voice-hers]", root).forEach(el => {
    el.textContent = readerIsHer()
      ? el.dataset.voiceHers
      : (el.dataset.voiceHis || el.dataset.voiceHers);
  });
  document.body.dataset.side = readerIsHer() ? "hers" : "his";
}

const STORE_KEY = "moonpie-miss-you-v9";
const defaultState = { mood: "soft", widgets: [], widgetCloudMigrated: false, openedReasons: [], softMode: false, lastWorld: "home", hasEnteredUniverse: false, bestBubbleScore: 0, bubbleBestByProfile: {}, challengeIndex: 0, profile: "Michelle", reasonDeck: [], reasonCursor: 0, lastReasonIndex: -1, lastComfortByMood: {}, handDeck: [], handCursor: 0, visitLog: [], giftMemory: {}, watchSaved: [], watchSeen: [], lockOpened: false, bouquetItems: [], bouquetWrap: "kraft", bouquetRecipe: 0, signedPromises: [], localDailyAnswers: {}, worldPicks: {}, worldNext: "", openedLetters: [] };
let state = loadState();
let selectedMood = state.mood || "soft";
let deferredInstallPrompt = null;
let gardenTreeCanvas = null;
let gardenTreeCtx = null;
let gardenPetals = [];
let gardenProgress = 0.16;
let gardenAnimationFrame = null;
let gardenIdleFrame = null;
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
  ["If goodbye hurt", "Goodbyes are proof that our next hello still matters."],
  ["If the time zones feel unfair", "One of us is always awake thinking about the other. That's not nothing."],
  ["If you counted the days without meaning to", "So did I. I just didn't tell you which number I was on."],
  ["If today felt like it dragged", "Every dragging day is one fewer between now and the one where you don't have to miss me."]
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
    letters: () => { renderLetters(); renderLetterInbox(); },
    compose: renderComposer,
    poems: renderPoems,
    notices: renderNotices,
    day: renderDay,
    places: renderPlaces,
    songs: renderSongs,
    promises: renderPromises,
    distance: () => { renderDistance(); initSignalThread(); },
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
  if (name === "garden") requestAnimationFrame(() => { resizeGardenTree(); startGardenIdleSway(); });
  else stopGardenIdleSway();
  if (name === "games") fetchBubbleScores();
  // Leaving the arcade tears the chosen game down. Sudoku holds a timer,
  // jigsaw holds object URLs and a drag listener on document; neither should
  // outlive the screen they belong to.
  if (name !== "games") unmountGame();
  if (name !== "day") stopDayClock();
  // The galaxy canvas runs its own continuous rAF loop - that has to stop
  // the instant she leaves the screen (not just when she navigates away
  // from the app entirely), or it keeps drawing at full rate behind whatever
  // she opens next. Mounting fresh on entry rather than once ever also means
  // it always fits the container's current size instead of a stale one.
  if (name === "galaxy") window.MoonpieGalaxy?.mount($("#galaxy-stage"));
  else window.MoonpieGalaxy?.unmount();
  if (name === "us") refreshHearth();
  if (name === "letters") renderLetterInbox();
  window.dispatchEvent(new CustomEvent("moonpie:screen", { detail: name }));
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

// Where a title can actually be watched, from TMDB's JustWatch data for our
// region, plus a plain search as the fallback when nothing carries it here.
// Deliberately links out to the services that hold the rights rather than
// into a piracy app.
function wlWatchHtml(detail) {
  const watch = detail.watch || {};
  const providers = watch.providers || [];
  const query = encodeURIComponent(`${detail.title} ${detail.year || ""} watch online`.trim());
  const searchUrl = `https://www.google.com/search?q=${query}`;

  if (!providers.length) {
    return `
      <div class="wl-watch">
        <p class="card-label">where to watch</p>
        <p class="wl-watch-none">Nothing lists it for Kenya right now.</p>
        <a class="secondary-btn wl-watch-search" href="${searchUrl}" target="_blank" rel="noopener noreferrer">look it up</a>
      </div>`;
  }
  return `
    <div class="wl-watch">
      <p class="card-label">where to watch${watch.region && watch.region !== "KE" ? " (" + escapeHtml(watch.region) + ")" : ""}</p>
      <div class="wl-watch-logos">
        ${providers.map(p => `
          <span class="wl-provider" title="${escapeHtml(p.name)}">
            ${p.logo ? `<img src="${escapeHtml(p.logo)}" alt="${escapeHtml(p.name)}" loading="lazy" onerror="this.remove()">` : ""}
            <small>${escapeHtml(p.name)}</small>
          </span>`).join("")}
      </div>
      ${watch.link
        ? `<a class="primary-btn wide wl-watch-open" href="${escapeHtml(watch.link)}" target="_blank" rel="noopener noreferrer">open it</a>`
        : `<a class="secondary-btn wl-watch-search" href="${searchUrl}" target="_blank" rel="noopener noreferrer">look it up</a>`}
    </div>`;
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
      ${wlWatchHtml(detail)}
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

/* Every stem is tied at one point near the bottom of the wrap, the way a
   real bouquet is. That single fact is what was missing: flowers dropped at
   arbitrary angles with no stems read as stickers on paper, while the same
   flowers with stems converging on a tie read as an armful of flowers. */
const BOUQUET_TIE = { x: 50, y: 88 };   // the neck of the wrap, under the ribbon

/* The paper it gets wrapped in. Five, because "make me a bouquet" with one
   fixed wrap is a colouring book with one crayon. */
const BOUQUET_WRAPS = [
  { id: "kraft",  label: "kraft"  },
  { id: "blush",  label: "blush"  },
  { id: "lilac",  label: "lilac"  },
  { id: "sage",   label: "sage"   },
  { id: "lace",   label: "lace"   },
];

function bouquetWrapId() {
  const id = state.bouquetWrap;
  return BOUQUET_WRAPS.some(w => w.id === id) ? id : "kraft";
}

function applyBouquetWrap() {
  const shape = $("#bouquet-vase");
  if (!shape) return;
  BOUQUET_WRAPS.forEach(w => shape.classList.toggle(`wrap-${w.id}`, w.id === bouquetWrapId()));
}

function renderBouquetWraps() {
  const host = $("#bouquet-wraps");
  if (!host) return;
  host.innerHTML = BOUQUET_WRAPS.map(w =>
    `<button class="bouquet-wrap-pick wrap-${w.id}${bouquetWrapId() === w.id ? " is-on" : ""}"
       type="button" data-bouquet-wrap="${w.id}" aria-label="wrap it in ${w.label}"><span></span>${w.label}</button>`
  ).join("");
  applyBouquetWrap();
}


function bouquetStemAngle(item) {
  // point the bloom away from the tie, so heads fan outward off the stems
  const angle = Math.atan2(item.y - BOUQUET_TIE.y, item.x - BOUQUET_TIE.x) * 180 / Math.PI;
  return angle + 90;
}

function bouquetRenderStems() {
  const svg = $("#bouquet-stems");
  if (!svg) return;
  const stems = (state.bouquetItems || []).filter(item => item.kind !== "bow");
  svg.innerHTML = stems.map(item => {
    // a slight bow outward, so a stem is a stem and not a drawn rod
    const midX = (BOUQUET_TIE.x + item.x) / 2 + (item.x - BOUQUET_TIE.x) * 0.18;
    const midY = (BOUQUET_TIE.y + item.y) / 2 + 5;
    // run it past the tie and down into the paper, so it is cut off by the
    // wrap rather than ending in mid air just above it
    const green = STEM_GREENS[item.id.charCodeAt(item.id.length - 1) % STEM_GREENS.length];
    const width = item.kind === "filler" || item.kind === "daisy" ? 0.8
                : item.kind === "sunflower" ? 1.7 : 1.2;
    return `<path d="M ${BOUQUET_TIE.x} 100 L ${BOUQUET_TIE.x} ${BOUQUET_TIE.y} Q ${midX} ${midY} ${item.x} ${item.y}"
      fill="none" stroke="${green}" stroke-width="${width}" stroke-linecap="round" opacity=".86"/>`;
  }).join("");
}

/* real stems in one bunch are never the same green */
const STEM_GREENS = ["#4f7a44", "#5d8a4e", "#436b3b", "#6b9558", "#3c6236"];

function bouquetClamp(v) { return v < -8 ? -8 : v > 108 ? 108 : v; }
/* blooms stay above the paper. Without this she could drop a lily at the
   bottom of the box, where the wrap is drawn over it, and it would simply
   vanish. */
function bouquetClampX(v) { return v < -4 ? -4 : v > 104 ? 104 : v; }
function bouquetClampY(v) { return v < -8 ? -8 : v > 70 ? 70 : v; }

function bouquetPlacedNode(item) {
  const el = document.createElement("div");
  el.className = `bouquet-placed kind-${item.kind}${item.kind === "bow" ? " bow-placed" : ""}`;
  el.dataset.bouquetId = item.id;
  el.style.left = `${item.x}%`;
  el.style.top = `${item.y}%`;
  el.style.transform = `rotate(${item.kind === "bow" ? item.rot : bouquetStemAngle(item) + item.rot * 0.25}deg)`;
  el.innerHTML = item.kind === "bow" ? "&#127872;" : `<img src="${escapeHtml(item.src)}" alt="">`;
  // every stem sways on its own clock, so a full bouquet moves like one
  // rather than pulsing in unison
  el.style.setProperty("--sway-delay", `${(item.id.charCodeAt(item.id.length - 1) % 20) * 0.17}s`);
  el.style.setProperty("--sway-span", `${2.8 + (item.id.charCodeAt(1) % 7) * 0.32}s`);
  return el;
}

function bouquetSyncHint() {
  const wrap = $("#bouquet-vase");
  wrap?.classList.toggle("has-items", (state.bouquetItems || []).length > 0);
  bouquetRenderStems();
}

function bouquetAddItem(kind, src, xPercent, yPercent) {
  const item = { id: `b${Date.now()}${(Math.random() * 1000) | 0}`, kind, src, x: bouquetClampX(xPercent), y: bouquetClampY(yPercent), rot: rnd(-14, 14) };
  (state.bouquetItems || (state.bouquetItems = [])).push(item);
  saveState();
  const node = bouquetPlacedNode(item);
  node.classList.add("just-placed");
  setTimeout(() => node.classList.remove("just-placed"), 620);
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

/* ---------------------------------------------------------------------------
   Arranging.

   Dropping stems one at a time is the fun way, but it is not the only way,
   and a bouquet dropped by hand at eleven at night tends to come out as a
   pile. "arrange it" ties her one: it picks a recipe she has not had yet if
   the wrap is empty, and then lays every stem out the way a florist builds a
   round bouquet - focal flowers in the middle, filler around them, greenery
   breaking the outline - so it is a different bouquet each time she asks.
   ------------------------------------------------------------------------ */
const BOUQUET_SOURCES = {
  lily:          ["./assets/flowers/lily-3.webp", "./assets/flowers/lily-5.webp",
                  "./assets/flowers/cut-lily-white.webp"],
  calla:         ["./assets/flowers/cut-lily-calla.webp", "./assets/flowers/cut-lily-calla-2.webp"],
  rose:          ["./assets/flowers/cut-rose.webp", "./assets/flowers/cut-rose-red-2.webp",
                  "./assets/flowers/cut-rose-pink.webp"],
  tulip:         ["./assets/flowers/cut-tulip.webp", "./assets/flowers/cut-tulip-pink.webp"],
  peony:         ["./assets/flowers/cut-peony.webp"],
  ranunculus:    ["./assets/flowers/cut-ranunculus.webp"],
  anemone:       ["./assets/flowers/cut-anemone.webp"],
  chrysanthemum: ["./assets/flowers/cut-chrysanthemum.webp"],
  daisy:         ["./assets/flowers/cut-daisy.webp"],
  carnation:     ["./assets/flowers/cut-carnation.webp"],
  sunflower:     ["./assets/flowers/cut-sunflower.webp"],
  hydrangea:     ["./assets/flowers/cut-hydrangea.webp"],
  greenery:      ["./assets/flowers/cut-eucalyptus.webp"],
  filler:        ["./assets/flowers/cut-babysbreath.webp"],
};

/* how far back in the bunch a kind belongs: high numbers go to the middle */
const BOUQUET_DEPTH = {
  lily: 5, calla: 5, sunflower: 5, peony: 4, hydrangea: 4, rose: 4,
  anemone: 3, chrysanthemum: 3, ranunculus: 3, carnation: 3, tulip: 3,
  daisy: 2, filler: 1, greenery: 0, bow: -1,
};

const BOUQUET_RECIPES = [
  { wrap: "blush", note: "stargazers, the way they came the first time",
    stems: ["lily","lily","lily","lily","lily","filler","filler","greenery","greenery","greenery"] },
  { wrap: "lace", note: "all white: callas, lilies and nothing shouting",
    stems: ["calla","calla","calla","lily","lily","chrysanthemum","filler","filler","greenery","greenery"] },
  { wrap: "lilac", note: "a soft one: peonies, ranunculus, a lot of greenery",
    stems: ["peony","peony","ranunculus","ranunculus","lily","hydrangea","filler","greenery","greenery","greenery"] },
  { wrap: "kraft", note: "a garden bunch, picked rather than bought",
    stems: ["rose","rose","tulip","tulip","daisy","daisy","anemone","carnation","filler","greenery","greenery"] },
  { wrap: "sage", note: "the loud one, for a day that needs it",
    stems: ["sunflower","sunflower","sunflower","tulip","tulip","daisy","chrysanthemum","greenery","greenery","greenery"] },
  { wrap: "blush", note: "a dozen roses, because sometimes that is the answer",
    stems: ["rose","rose","rose","rose","rose","rose","filler","filler","greenery","greenery"] },
  { wrap: "lilac", note: "anemones and callas, the strange elegant one",
    stems: ["anemone","anemone","calla","calla","ranunculus","peony","filler","greenery","greenery"] },
  { wrap: "blush", note: "everything, because why pick",
    stems: ["lily","calla","rose","peony","tulip","sunflower","daisy","anemone","hydrangea","filler","greenery"] },
];

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/* Even packing across a dome. Phyllotaxis is what a hand-tied bouquet
   actually approximates, so the spacing comes out right without anything
   landing on top of anything else. */
function bouquetDomeSpot(index, total) {
  const r = Math.sqrt((index + 0.5) / total);
  const angle = index * GOLDEN_ANGLE;
  return {
    x: 50 + Math.cos(angle) * r * 33,
    // outer stems sit a touch lower, which is what makes it a dome sitting in
    // paper rather than a circle floating above it
    y: 33 + Math.sin(angle) * r * 19 + r * 7,
  };
}

function bouquetArrange() {
  let items = (state.bouquetItems || []).filter(i => i.kind !== "bow");
  const bows = (state.bouquetItems || []).filter(i => i.kind === "bow");

  let note = "";
  if (!items.length) {
    const index = (Number(state.bouquetRecipe) || 0) % BOUQUET_RECIPES.length;
    const recipe = BOUQUET_RECIPES[index];
    state.bouquetRecipe = index + 1;
    state.bouquetWrap = recipe.wrap;
    note = recipe.note;
    items = recipe.stems.map((kind, n) => {
      const sources = BOUQUET_SOURCES[kind] || BOUQUET_SOURCES.lily;
      return {
        id: `b${Date.now()}${n}${(Math.random() * 100) | 0}`,
        kind, src: sources[n % sources.length], x: 50, y: 40, rot: rnd(-14, 14),
      };
    });
  }

  // middle of the bunch first, so the focal flowers get the small radii
  items.sort((a, b) => (BOUQUET_DEPTH[b.kind] ?? 2) - (BOUQUET_DEPTH[a.kind] ?? 2));
  items.forEach((item, index) => {
    const spot = bouquetDomeSpot(index, items.length);
    item.x = bouquetClampX(spot.x + rnd(-2, 2));
    item.y = bouquetClampY(spot.y + rnd(-2, 2));
    item.rot = rnd(-16, 16);
  });

  state.bouquetItems = items.concat(bows);
  saveState();
  applyBouquetWrap();
  renderBouquetWraps();
  bouquetRepaint(true);
  return note;
}

/* tear the placed stems down and put them back from state */
function bouquetRepaint(animate) {
  const stage = $("#bouquet-vase");
  if (!stage) return;
  $$(".bouquet-placed").forEach(node => node.remove());
  (state.bouquetItems || []).forEach((item, index) => {
    const node = bouquetPlacedNode(item);
    if (animate) {
      // they land one after another, not all at once
      node.style.animationDelay = `${index * 0.055}s`;
      node.classList.add("just-placed");
      setTimeout(() => { node.classList.remove("just-placed"); node.style.animationDelay = ""; }, 700 + index * 55);
    }
    stage.appendChild(node);
    bindBouquetPlacedDrag(node);
  });
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
      const nx = bouquetClampX(pos.x), ny = bouquetClampY(pos.y);
      node.style.left = `${nx}%`;
      node.style.top = `${ny}%`;
      // the stem follows the bloom while it is being moved, and the head
      // keeps facing away from the tie
      const item = (state.bouquetItems || []).find(i => i.id === id);
      if (item) {
        item.x = nx; item.y = ny;
        if (item.kind !== "bow") {
          node.style.transform = `rotate(${bouquetStemAngle(item) + item.rot * 0.25}deg)`;
        }
        bouquetRenderStems();
      }
    };
    const onUp = upEvent => {
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerup", onUp);
      node.classList.remove("dragging");
      if (moved) {
        const pos = bouquetPercentFromPoint(upEvent.clientX, upEvent.clientY);
        const item = (state.bouquetItems || []).find(i => i.id === id);
        if (item) { item.x = bouquetClampX(pos.x); item.y = bouquetClampY(pos.y); saveState(); }
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
  renderBouquetWraps();
  $("#bouquet-wraps")?.addEventListener("click", event => {
    const pick = event.target.closest("[data-bouquet-wrap]");
    if (!pick) return;
    state.bouquetWrap = pick.dataset.bouquetWrap;
    saveState();
    renderBouquetWraps();
  });
  $("#bouquet-arrange")?.addEventListener("click", () => {
    const note = bouquetArrange();
    if (note) toast(note);
  });

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

/* Every envelope in the app is built here.

   There were three copies of this markup - the twelve letters, the composer
   preview and her inbox - and they had already drifted apart from each
   other. The stamp is a real photograph now (assets/paper/stamp-*.webp,
   built by tools/build_stationery.py from the same travel photos as Our
   Worlds), so there is a file per stamp and only one list of which exist. */
const LETTER_STAMPS = ["lilies", "airport", "birthday", "kitchen", "moon",
                       "safe", "stars", "voice", "kyoto", "santorini",
                       "venice", "maldives", "kenya", "zanzibar"];

function stampSrc(name) {
  const id = LETTER_STAMPS.includes(name) ? name : "lilies";
  return `./assets/paper/stamp-${id}.webp`;
}

/* ============================================================================
   How a letter is folded.

   Every letter in here opened the same way: one envelope, one flap, one
   animation, sixteen times. Changing the paper colour under it does not make
   it a different letter, it makes it the same letter in a different shirt.

   Before envelopes were mass produced in the 1800s, a letter WAS its own
   envelope, and how you folded it was part of what you were saying. The
   field that studies this is called letterlocking (Dambrogio and Smith's
   work at MIT and Yale catalogues hundreds of formats). A letter sewn shut
   with thread and booby-trapped so it tore if opened wrong is a different
   object from one tied in a love knot, and both are different from a heart
   folded out of the page it is written on.

   So there are seven folds here, and each one comes apart its own way:

     envelope   the flap falls back and the sheet rises out of the pocket
     heart      two lobes open, then the square unfolds from its corners
     knot       a woven tab pulls free and the paper unrolls in two stages
     scroll     the ribbon unties and the roll runs down the screen
     accordion  concertina panels fan out one after another
     dagger     sewn shut: cut the thread first, then pry the flap
     pleat      folded so half of it is hidden, and the hidden half unfolds

   The dagger one is the only one that asks for something back: you have to
   drag across the stitching to cut it before it will open, the way the real
   format made a reader work for it.
   ========================================================================= */
const LETTER_FOLDS = {
  envelope:  { tag: "sealed with wax",            openMs: 620 },
  heart:     { tag: "folded into a heart",        openMs: 980 },
  knot:      { tag: "tied in a love knot",        openMs: 880 },
  scroll:    { tag: "rolled and tied",            openMs: 960 },
  accordion: { tag: "folded like a concertina",   openMs: 900 },
  dagger:    { tag: "sewn shut",                  openMs: 1050, cut: true },
  pleat:     { tag: "folded to hide half of it",  openMs: 940 },
};
const FOLD_ORDER = ["envelope", "heart", "knot", "scroll", "accordion", "dagger", "pleat"];

/* A letter keeps the same fold forever - it is part of which letter it is,
   not a surprise that changes between visits. Content can name one; anything
   that does not gets one from its position, so the list never shows the same
   fold twice in a row. */
function foldFor(letter, index) {
  if (letter?.fold && LETTER_FOLDS[letter.fold]) return letter.fold;
  return FOLD_ORDER[index % FOLD_ORDER.length];
}

/* --------------------------------------------------------------- markup */

function foldInnerHtml(fold, opts) {
  const stamp = stampSrc(opts.stamp || opts.theme);
  const to = escapeHtml(opts.to || "");
  const tab = escapeHtml(opts.tab || "");
  const seal = escapeHtml(opts.initial || "M");

  if (fold === "heart") {
    // a square of paper folded corner to corner, with the two lobes of the
    // heart on top. The lobes swing away, then the corners drop.
    return `
      <span class="fold-heart">
        <span class="heart-lobe left"></span>
        <span class="heart-lobe right"></span>
        <span class="heart-body"></span>
        <span class="heart-corner tl"></span>
        <span class="heart-corner tr"></span>
        <span class="heart-corner bl"></span>
        <span class="heart-corner br"></span>
        <span class="heart-ink">${to}</span>
      </span>`;
  }

  if (fold === "knot") {
    return `
      <span class="fold-knot">
        <span class="knot-sheet"></span>
        <span class="knot-band"></span>
        <span class="knot-tab" aria-hidden="true"></span>
        <span class="knot-ink">${to}</span>
        <span class="knot-hint">pull the tab</span>
      </span>`;
  }

  if (fold === "scroll") {
    return `
      <span class="fold-scroll">
        <span class="scroll-paper"></span>
        <span class="scroll-roll top"></span>
        <span class="scroll-roll bottom"></span>
        <span class="scroll-ribbon"></span>
        <span class="scroll-ink">${to}</span>
      </span>`;
  }

  if (fold === "accordion") {
    return `
      <span class="fold-accordion">
        ${"<i></i>".repeat(7)}
        <span class="acc-ink">${to}</span>
      </span>`;
  }

  if (fold === "dagger") {
    // the historical booby-trapped lock: sewn shut, then sealed. The stitch
    // is a real target - dragging across it is what opens this one.
    return `
      <span class="fold-dagger">
        <span class="dagger-sheet"></span>
        <span class="dagger-flap"></span>
        <svg class="dagger-thread" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
          <path d="M6 20 L18 8 L30 32 L42 8 L54 32 L66 8 L78 32 L94 20"/>
        </svg>
        <span class="dagger-wax">${seal}</span>
        <span class="dagger-ink">${to}</span>
        <span class="dagger-hint">drag across the stitching</span>
      </span>`;
  }

  if (fold === "pleat") {
    return `
      <span class="fold-pleat">
        ${"<i></i>".repeat(6)}
        <span class="pleat-ink">${to}</span>
      </span>`;
  }

  // the envelope, which is still the right answer for a lot of them
  return `
    <span class="env-stack">
      <span class="env-back" aria-hidden="true"></span>
      <span class="env-letter" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
      <span class="env-front" aria-hidden="true"></span>
      <img class="env-stamp" src="${stamp}" alt="" aria-hidden="true">
      <span class="env-postmark" aria-hidden="true">OURS<br>25 FEB</span>
      <span class="env-tab">${tab}</span>
      <span class="env-to">${to}</span>
      <span class="env-flap" aria-hidden="true"><i></i></span>
      <span class="env-seal" aria-hidden="true">${seal}</span>
    </span>`;
}

function envelopeHtml(opts) {
  const fold = opts.fold || "envelope";
  return `
    ${foldInnerHtml(fold, opts)}
    <span class="env-caption">
      <strong>${escapeHtml(opts.title || "")}</strong>
      ${opts.preview ? `<small>${escapeHtml(opts.preview)}</small>` : ""}
      <em>${escapeHtml(opts.cta || LETTER_FOLDS[fold].tag)}</em>
    </span>`;
}

/* ------------------------------------------------------------- unfolding */

/* The dagger fold will not open until the thread is cut. One drag across the
   stitching does it - pointer events, so a finger and a mouse are the same
   code, and the stitch redraws as it parts rather than just vanishing. */
function armThreadCutting(card) {
  const thread = card.querySelector(".dagger-thread");
  if (!thread || thread.dataset.armed) return;
  thread.dataset.armed = "1";
  let from = null;
  const start = event => {
    from = event.clientX;
    try { thread.setPointerCapture(event.pointerId); } catch { /* not always allowed */ }
  };
  const move = event => {
    if (from === null) return;
    if (Math.abs(event.clientX - from) < 42) return;
    from = null;
    card.classList.add("thread-cut");
    window.Poo?.react?.("excited");
    // the letter opens on its own once it is actually cut
    setTimeout(() => card.click(), 420);
  };
  const end = () => { from = null; };
  thread.addEventListener("pointerdown", start);
  thread.addEventListener("pointermove", move);
  thread.addEventListener("pointerup", end);
  thread.addEventListener("pointercancel", end);
}

function renderLetters() {
  // These twelve were written by Sunstone for Moonpie. They keep her name on
  // the envelope whoever opens the app, the way a letter in a drawer does.
  const me = nickOf("Michelle"), them = nickOf("Michael");
  $("#letter-list").innerHTML = letters.map((letter, i) => {
    const fold = foldFor(letter, i);
    return `
    <button class="envelope theme-${letter.theme} fold-is-${fold}" type="button" data-letter="${i}"
            data-fold="${fold}" aria-label="${escapeHtml(letter.title)} - ${LETTER_FOLDS[fold].tag}">
      ${envelopeHtml({
        fold,
        theme: letter.theme,
        tab: letter.tab,
        to: `for ${me}`,
        initial: them.charAt(0),
        title: letter.title,
        preview: letter.preview,
      })}
    </button>`;
  }).join("");
  // the sewn one has to be cut before it will open
  $$("#letter-list .fold-is-dagger").forEach(armThreadCutting);
}

/* ---------------------------------------------------------------------------
   Writing the letter out.

   A letter that is simply there when the envelope opens is a block of text
   on a page. A letter that appears the way it was written - a word at a
   time, with the pen still on the paper - is somebody writing to you. That
   single difference is most of what the good letter sites are doing, and it
   costs one animation frame loop.

   Pacing is by total length rather than per character, so a four paragraph
   letter and a one paragraph letter both finish in about the same seven
   seconds and nothing ever leaves her waiting. Tapping the paper finishes
   it immediately, and reduced motion skips it entirely.
   ------------------------------------------------------------------------ */
const handwriting = { raf: 0, host: null, nodes: [], texts: [] };

function handwriteFinish() {
  if (!handwriting.host) return;
  cancelAnimationFrame(handwriting.raf);
  handwriting.nodes.forEach((node, i) => {
    node.textContent = handwriting.texts[i];
    node.classList.remove("writing-now");
  });
  handwriting.host.classList.remove("is-writing");
  handwriting.raf = 0;
  handwriting.host = null;
}

function handwrite(host, blocks) {
  handwriteFinish();
  if (!host) return;
  host.innerHTML = blocks.map(b =>
    `<p class="${b.cls || "letter-line"}"></p>`).join("");
  const nodes = Array.from(host.querySelectorAll("p"));
  const texts = blocks.map(b => String(b.text || ""));
  const total = texts.reduce((n, t) => n + t.length, 0);
  if (!total) return;

  if (window.matchMedia("(prefers-reduced-motion:reduce)").matches) {
    nodes.forEach((node, i) => { node.textContent = texts[i]; });
    return;
  }

  handwriting.host = host;
  handwriting.nodes = nodes;
  handwriting.texts = texts;
  host.classList.add("is-writing");

  /* Paced by the clock, not by the frame.

     Writing a fixed number of characters per frame looks right at 60fps and
     falls apart everywhere else: a backgrounded tab, a phone in low power
     mode or a browser throttling animation frames drops to a couple of
     frames a second, and the letter that should take seven seconds takes
     several minutes. Deriving the position from elapsed time instead means
     it finishes in seven seconds however few frames it gets to use. */
  const DURATION = 7000;
  const started = performance.now();
  const step = () => {
    const elapsed = performance.now() - started;
    const target = Math.min(total, Math.ceil(total * (elapsed / DURATION)));
    let seen = 0;
    for (let i = 0; i < nodes.length; i++) {
      const text = texts[i];
      const shown = Math.max(0, Math.min(text.length, target - seen));
      if (nodes[i].textContent.length !== shown) nodes[i].textContent = text.slice(0, shown);
      // the pen is on whichever line is still filling
      nodes[i].classList.toggle("writing-now", shown > 0 && shown < text.length);
      seen += text.length;
    }
    if (target < total) {
      handwriting.raf = requestAnimationFrame(step);
    } else {
      nodes.forEach(node => node.classList.remove("writing-now"));
      handwriting.raf = 0;
      handwriting.host = null;
      host.classList.remove("is-writing");
    }
  };
  handwriting.raf = requestAnimationFrame(step);
}

/* ============================================================================
   Poems: a notebook, not a list.

   Twelve poems as twelve stacked cards means she scrolls past eleven of them
   to reach the twelfth, and a poem read while scrolling past it is not read.
   A poem wants one page and nothing else on it.

   So it is a real notebook. One poem to a page, in handwriting on the same
   photographed paper the letters use, and the page turns - a rotateY around
   the spine with the sheet's own weight behind it. Turn by tapping the corner
   or dragging the page across, the way you would with paper.
   ========================================================================= */
let poemPage = 0;

function poemPageHtml(poem, i, total) {
  // content.js carries [title, form, body]; the originals in app.js are just
  // [title, body]. Taking the last element as the body handles both, which
  // matters because reading it as [title, body] printed the form line where
  // the poem should be and dropped the poem entirely.
  const title = poem[0];
  const form = poem.length > 2 ? poem[1] : "";
  const body = poem[poem.length - 1];
  const lines = String(body).split("\n");
  return `
    <article class="nb-page" data-page="${i}" style="z-index:${total - i}">
      <div class="nb-face">
        <span class="nb-rule" aria-hidden="true"></span>
        <p class="nb-num">${String(i + 1).padStart(2, "0")} of ${total}</p>
        <h3>${escapeHtml(title)}</h3>
        ${form ? `<p class="nb-form">${escapeHtml(form)}</p>` : ""}
        <div class="nb-body">${lines.map(line =>
          `<span>${escapeHtml(line) || "&nbsp;"}</span>`).join("")}</div>
        <span class="nb-corner" aria-hidden="true"></span>
      </div>
      <div class="nb-back" aria-hidden="true"></div>
    </article>`;
}

function paintPoemPages() {
  const total = poems.length;
  $$(".nb-page").forEach(page => {
    const i = Number(page.dataset.page);
    const turned = i < poemPage;
    page.classList.toggle("is-turned", turned);
    // turned pages stack up on the left in the order they were turned;
    // untouched ones keep the original stack with the current one on top
    page.style.zIndex = turned ? i : total - i;
  });
  const label = $("#poem-count");
  if (label) label.textContent = `${Math.min(poemPage + 1, total)} / ${total}`;
  const prev = $("#poem-prev"), next = $("#poem-next");
  if (prev) prev.disabled = poemPage === 0;
  if (next) next.disabled = poemPage >= total - 1;
}

function turnPoem(delta) {
  const next = poemPage + delta;
  if (next < 0 || next > poems.length - 1) return;
  poemPage = next;
  paintPoemPages();
}

function renderPoems() {
  const host = $("#notebook-pages");
  if (!host) return;
  host.innerHTML = poems.map((poem, i) => poemPageHtml(poem, i, poems.length)).join("");
  paintPoemPages();
  bindPoemDrag(host);
}

/* Dragging the page. A horizontal drag past a threshold turns it; anything
   shorter springs back, so a scroll down the screen never turns a page by
   accident. */
function bindPoemDrag(host) {
  if (host.dataset.bound) return;
  host.dataset.bound = "1";
  let startX = null, startY = null;
  host.addEventListener("pointerdown", event => {
    startX = event.clientX; startY = event.clientY;
  });
  host.addEventListener("pointerup", event => {
    if (startX === null) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    startX = startY = null;
    if (Math.abs(dx) < 46 || Math.abs(dy) > Math.abs(dx)) return;
    turnPoem(dx < 0 ? 1 : -1);
  });
  host.addEventListener("pointercancel", () => { startX = startY = null; });
}

function initPoems() {
  $("#poem-prev")?.addEventListener("click", () => turnPoem(-1));
  $("#poem-next")?.addEventListener("click", () => turnPoem(1));
  // tapping the page itself turns it forward, the corner included
  $("#notebook-pages")?.addEventListener("click", event => {
    if (event.target.closest(".nb-corner")) turnPoem(1);
  });
}



/* ============================================================================
   One Perfect Day.

   Twelve rows of "time, then a sentence" is a bus timetable. The whole point
   of this screen is that it is a DAY - it starts at 7:42 in the morning and
   ends two minutes before midnight - and none of that was on screen.

   So the day actually runs now. The sky behind it moves from dawn through
   noon and golden hour into night as she scrolls, the sun climbs and sets
   along an arc, stars come out for the last few hours, and every stop knows
   what time of day it belongs to. Scrolling from the top to the bottom of
   this screen is sixteen hours passing.

   All of it hangs off one number: --day-t, zero at 7:42am and one at 11:58pm.
   The sky layers cross-fade on it, the sun is positioned by it, and each card
   carries its own so it can be tinted to its own hour.
   ========================================================================= */

/* "9:15 PM" -> minutes since midnight */
function dayMinutes(label) {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(label).trim());
  if (!match) return 0;
  let hour = Number(match[1]) % 12;
  if (/pm/i.test(match[3])) hour += 12;
  return hour * 60 + Number(match[2]);
}

/* Where a stop sits in this particular day, 0 at the first stop and 1 at the
   last. Not "fraction of 24 hours": the day starts when we wake up. */
function dayFraction(label) {
  const first = dayMinutes(dayPlan[0][0]);
  const last = dayMinutes(dayPlan[dayPlan.length - 1][0]);
  const span = Math.max(1, last - first);
  return Math.min(1, Math.max(0, (dayMinutes(label) - first) / span));
}

/* ============================================================================
   100 Reasons: a jar you pull one out of.

   This was a card with a line of text and a button labelled "another reason".
   Pressing a button to receive a sentence is a slot machine, and the hundred
   reasons underneath it were a wall of numbered chips nobody reads.

   It is a jar of folded paper slips now. Tap it, one comes up out of the
   mouth, unfolds in the air, and that is the reason. The ones already pulled
   pile up beside the jar so a hundred of them is something she can see
   getting smaller, which a counter never is.

   The deck logic underneath is the one that was already there: shuffled, no
   repeats until all hundred are gone.
   ========================================================================= */
function reasonsPulled() {
  return Array.isArray(state.openedReasons) ? state.openedReasons : [];
}

function paintReasonJar() {
  const pulled = reasonsPulled().length;
  const total = reasons.length;
  const jar = $("#reason-jar");
  // the slips inside thin out as the jar empties
  if (jar) jar.style.setProperty("--fill", String(Math.max(0, 1 - pulled / total)));
  const count = $("#reason-count");
  if (count) {
    count.textContent = pulled >= total
      ? `all ${total}. you have read every one.`
      : `${pulled} of ${total} pulled`;
  }
  const pile = $("#reason-pile");
  if (pile) {
    // only the last dozen are drawn; a hundred folded slips is a mess and
    // the point is just that the pile is growing
    const recent = reasonsPulled().slice(-12);
    pile.innerHTML = recent.map((_, i) =>
      `<span class="reason-slip-done" style="--i:${i}"></span>`).join("");
  }
}

function pullReason() {
  const card = $("#reason-slip");
  if (!card || card.classList.contains("is-pulling")) return;

  const index = nextReason();               // the existing shuffled deck
  const list = reasonsPulled();
  if (!list.includes(index)) {
    state.openedReasons = list.concat(index);
    saveState();
  }

  card.classList.remove("is-open");
  card.classList.add("is-pulling");
  window.Poo?.react?.("excited");
  // it leaves the jar folded and opens once it is clear of the mouth
  setTimeout(() => card.classList.add("is-open"), 330);
  setTimeout(() => {
    card.classList.remove("is-pulling");
    paintReasonJar();
  }, 900);
}

function renderReasons() {
  const slip = $("#reason-slip");
  if (slip && !$("#reason-text").textContent) nextReason();
  paintReasonJar();
}

/* ============================================================================
   Promises: signed, not listed.

   A promise typed in a row of a list is a bullet point. A promise is supposed
   to be a thing somebody put their name to, so each one is a small
   certificate with a seal and a signature line, and she can countersign it.
   Signing is kept, so the ones she has agreed to stay signed.
   ========================================================================= */
function signedPromises() {
  return Array.isArray(state.signedPromises) ? state.signedPromises : [];
}

function renderPromises() {
  const signed = signedPromises();
  $("#promise-list").innerHTML = promises.map((promise, i) => `
    <article class="promise-cert${signed.includes(i) ? " is-signed" : ""}" data-promise="${i}"
             style="--r:${((i * 7) % 5) - 2}deg">
      <span class="cert-rule" aria-hidden="true"></span>
      <p class="cert-number">no. ${String(i + 1).padStart(2, "0")}</p>
      <p class="cert-body">${escapeHtml(promise)}</p>
      <div class="cert-foot">
        <span class="cert-sign">
          <b>${escapeHtml(nickOf("Michael"))}</b>
          <small>who wrote it</small>
        </span>
        <span class="cert-seal" aria-hidden="true">&#10084;</span>
        <button class="cert-sign cert-countersign" type="button" data-sign="${i}">
          <b>${signed.includes(i) ? escapeHtml(myName()) : "sign here"}</b>
          <small>${signed.includes(i) ? "held to it" : "tap to countersign"}</small>
        </button>
      </div>
    </article>
  `).join("");
}

function countersignPromise(index) {
  const list = signedPromises();
  if (list.includes(index)) return;
  state.signedPromises = list.concat(index);
  saveState();
  const card = $(`[data-promise="${index}"]`);
  card?.classList.add("is-signing");
  setTimeout(() => {
    renderPromises();
    $(`[data-promise="${index}"]`)?.classList.add("is-signed");
  }, 520);
  window.Poo?.react?.("happy");
}

/* ============================================================================
   Tiny Things: a board, not a list.

   Forty things noticed about somebody, rendered as forty identical rows, is
   a spreadsheet of affection. They are sticky notes on a board now, in four
   paper colours, each pinned at its own angle, and the one she taps comes
   forward to be read.
   ========================================================================= */
function renderNotices() {
  $("#notice-list").innerHTML = notices.map((notice, i) => `
    <button class="sticky" type="button" data-sticky="${i}"
            style="--r:${((i * 13) % 7) - 3}deg;--c:${i % 4}">
      <span class="sticky-pin" aria-hidden="true"></span>
      <span class="sticky-num">${String(i + 1).padStart(2, "0")}</span>
      <p>${escapeHtml(notice)}</p>
    </button>
  `).join("");
}

/* ============================================================================
   Our Little World: a wall, not a feed.

   Fifteen memories with an emoji standing in for a photograph. There are a
   hundred and sixty real photographs already in this app, so these hang on a
   string as actual prints, pegged up, and the one she taps comes off the
   line to be read.
   ========================================================================= */
const MEMORY_PHOTOS = [
  "./assets/mood/window-scene-1.webp", "./assets/worlds/paris-1.webp",
  "./assets/mood/moon-sky-1.webp", "./assets/worlds/airport-hug-1.webp",
  "./assets/mood/flower-jar-1.webp", "./assets/worlds/kyoto-1.webp",
  "./assets/mood/window-rain-4.webp", "./assets/worlds/santorini-1.webp",
  "./assets/mood/hero-evening.webp", "./assets/worlds/venice-1.webp",
  "./assets/mood/lav-jar-2.webp", "./assets/worlds/amalfi-1.webp",
  "./assets/mood/moon-sky-2.webp", "./assets/worlds/maldives-1.webp",
  "./assets/mood/hero-night.webp",
];

function renderMemory() {
  $("#memory-list").innerHTML = memories.map(([title, text], i) => `
    <button class="print" type="button" data-print="${i}"
            style="--r:${((i * 11) % 7) - 3}deg;--drop:${(i % 3) * 9}px">
      <span class="print-peg" aria-hidden="true"></span>
      <span class="print-photo">
        <img src="${MEMORY_PHOTOS[i % MEMORY_PHOTOS.length]}" alt="" loading="lazy"
             onerror="this.closest('.print-photo').classList.add('no-photo');this.remove()">
      </span>
      <span class="print-cap">${escapeHtml(title)}</span>
      <span class="print-note">${escapeHtml(text)}</span>
    </button>
  `).join("");
}

function initAtlasSections() {
  $("#reason-jar")?.addEventListener("click", pullReason);
  $("#new-reason")?.addEventListener("click", pullReason);
  $("#promise-list")?.addEventListener("click", event => {
    const button = event.target.closest("[data-sign]");
    if (button) countersignPromise(Number(button.dataset.sign));
  });
  // one note or print is forward at a time, so tapping another puts the last
  // one back rather than leaving a pile of opened things on the board
  const lift = (host, cls) => host?.addEventListener("click", event => {
    const item = event.target.closest(`.${cls}`);
    if (!item) return;
    const wasOpen = item.classList.contains("is-lifted");
    $$(`.${cls}.is-lifted`).forEach(el => el.classList.remove("is-lifted"));
    if (!wasOpen) item.classList.add("is-lifted");
  });
  lift($("#notice-list"), "sticky");
  lift($("#memory-list"), "print");
}

function renderDay() {
  const host = $("#day-timeline");
  if (!host) return;
  host.innerHTML = dayPlan.map(([time, text], i) => {
    const t = dayFraction(time);
    return `
      <article class="day-stop" style="--t:${t.toFixed(3)}" data-t="${t.toFixed(3)}">
        <span class="day-stop-dot" aria-hidden="true"></span>
        <time>${escapeHtml(time)}</time>
        <p>${escapeHtml(text)}</p>
      </article>`;
  }).join("");
  startDayClock();
}

/* The sky follows whichever stop is nearest the middle of the screen, so it
   tracks reading position rather than raw scroll offset - the card she is
   actually looking at is the hour the sky is showing. */
let dayClockRaf = 0;
function startDayClock() {
  stopDayClock();
  const screen = $("#screen-day");
  const stops = $$(".day-stop");
  if (!screen || !stops.length) return;

  let last = -1;
  const tick = () => {
    const middle = window.innerHeight * 0.45;
    let best = stops[0], bestGap = Infinity;
    for (const stop of stops) {
      const box = stop.getBoundingClientRect();
      const gap = Math.abs(box.top + box.height / 2 - middle);
      if (gap < bestGap) { bestGap = gap; best = stop; }
    }
    // ease between neighbours instead of snapping, so the sky drifts
    const box = best.getBoundingClientRect();
    const own = Number(best.dataset.t);
    const index = stops.indexOf(best);
    const above = box.top + box.height / 2 < middle;
    const neighbour = stops[index + (above ? 1 : -1)];
    let t = own;
    if (neighbour) {
      const span = Math.max(1, box.height + 22);
      const lean = Math.min(1, bestGap / span) * 0.5;
      t = own + (Number(neighbour.dataset.t) - own) * lean;
    }
    if (Math.abs(t - last) > 0.001) {
      screen.style.setProperty("--day-t", t.toFixed(4));
      last = t;
    }
    stops.forEach(stop => stop.classList.toggle("is-now", stop === best));
    dayClockRaf = requestAnimationFrame(tick);
  };
  dayClockRaf = requestAnimationFrame(tick);
}

function stopDayClock() {
  if (dayClockRaf) cancelAnimationFrame(dayClockRaf);
  dayClockRaf = 0;
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

  // Whatever she pinned as "the one we do next" gets pulled out of the rail
  // and shown as a plan in progress, with the stops she actually picked -
  // so the screen has somewhere it is going, not just twenty doors.
  const nextHost = $("#place-next");
  if (nextHost) {
    const pinned = list.find(place => place.name === state.worldNext);
    if (!pinned) {
      nextHost.innerHTML = "";
    } else {
      const picks = worldPicks(pinned.name);
      const chosen = picks.slice().sort((a, b) => a - b).map(i => pinned.moments[i]).filter(Boolean);
      nextHost.innerHTML = `
        <article class="world-next-card" style="background-image:url('${escapeHtml(pinned.photos[0])}')">
          <div class="world-next-inner">
            <p class="card-label">the one we do next</p>
            <h3>${escapeHtml(pinned.name)}</h3>
            ${chosen.length
              ? `<ul class="world-next-picks">${chosen.map(([title]) => `<li>${escapeHtml(title)}</li>`).join("")}</ul>`
              : `<p class="world-next-empty">No stops picked yet. Open it and choose the ones you want.</p>`}
            <button class="tiny-button world-next-open" type="button" data-world-portal="${list.indexOf(pinned)}">open it</button>
          </div>
        </article>
      `;
    }
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
      <span class="portal-number">${index === featuredIndex ? "tonight&rsquo;s pick" : "world " + String(index + 1).padStart(2, "0")}</span>
      <span class="world-portal-copy">
        <h3>${escapeHtml(place.name)}</h3>
        <p>${escapeHtml(place.eyebrow)}</p>
        <small>${state.worldNext === place.name ? "next up &middot; " : ""}${worldPicks(place.name).length
          ? `${worldPicks(place.name).length} stops you picked`
          : `a whole day, ${place.moments.length} stops`}</small>
      </span>
      ${seen ? '<span class="world-portal-check" aria-hidden="true">&#10003;</span>' : ""}
    </button>
  `;
  }).join("");
}

/* ============================================================================
   Our Worlds. The moments in content.js already run in a day's order - Kyoto
   opens at a temple in the morning and ends under lanterns - but they were
   rendered as identical numbered blocks labelled "experience 01", which
   flattened a whole day into a wall of paragraphs. These read them back as
   what they are: an itinerary you walk down, hour by hour, with the place's
   own photographs set into it, and every stop something she can actually
   claim rather than only read.
   ========================================================================= */
// Seven labels for seven stops, so a full world maps one to one instead of
// rounding two stops onto the same hour.
const WORLD_DAY_ARC = ["first light", "mid morning", "late morning", "early afternoon", "golden hour", "after dark", "very late"];
// Three of these worlds are nocturnal end to end - Paris After Midnight opens
// after dinner, the aurora cabin can't happen at noon, Marrakech is a lantern
// night - so the dawn arc would put "first light" on a world whose own name
// says midnight.
//
// This is a list rather than a keyword test on purpose. Sniffing the prose
// for words like "sunset" looked clever and was wrong: Santorini's intro
// mentions a sunset, so its BREAKFAST got labelled "after dinner".
const WORLD_NIGHT_ARC = ["after dinner", "dusk", "late evening", "near midnight", "past midnight", "the small hours", "almost dawn"];
const NIGHT_WORLDS = new Set(["paris", "aurora", "marrakech"]);

function worldArcFor(place) {
  return NIGHT_WORLDS.has(place.slug) ? WORLD_NIGHT_ARC : WORLD_DAY_ARC;
}

function worldTimeLabel(place, index, total) {
  const arc = worldArcFor(place);
  if (total <= 1) return arc[0];
  // stretch the arc across however many moments this world happens to have,
  // so a 3-stop day and a 6-stop day both run start to finish
  const slot = Math.round((index / (total - 1)) * (arc.length - 1));
  return arc[Math.min(slot, arc.length - 1)];
}

// Read-only: rendering asks for pick counts on every tile, and creating the
// array here would write twenty empty ones into saved state just for drawing
// the screen.
function worldPicks(name) {
  const picks = state.worldPicks && state.worldPicks[name];
  return Array.isArray(picks) ? picks : [];
}

// The writable one, used only when she actually picks something
function worldPicksMutable(name) {
  if (!state.worldPicks || typeof state.worldPicks !== "object") state.worldPicks = {};
  if (!Array.isArray(state.worldPicks[name])) state.worldPicks[name] = [];
  return state.worldPicks[name];
}

function toggleWorldPick(name, momentIndex) {
  const picks = worldPicksMutable(name);
  const at = picks.indexOf(momentIndex);
  if (at >= 0) picks.splice(at, 1); else picks.push(momentIndex);
  saveState();
  return at < 0;   // true when it was just added
}

function setWorldNext(name) {
  state.worldNext = state.worldNext === name ? "" : name;
  saveState();
  return state.worldNext === name;
}

function worldMomentHtml(place, [title, text, hasPhoto], i, total) {
  const picked = worldPicks(place.name).includes(i);
  // Stops carry their own photograph at assets/worlds/<slug>/NN.webp. The
  // build marks which of those actually exist (see tools/build_worlds.py) so
  // a stop whose photo has not been fetched renders as text rather than as a
  // lazy image reserving space it will later give back.
  const src = hasPhoto && place.slug
    ? `./assets/worlds/${place.slug}/${String(i).padStart(2, "0")}.webp`
    : (i === Math.min(2, total - 1) && place.photos[1] ? place.photos[1] : "");
  const photo = src
    ? `<img class="world-step-photo" src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async" width="900" height="563" onerror="this.remove()">`
    : "";
  return `
    <article class="world-step${picked ? " is-picked" : ""}">
      <span class="world-step-time">${escapeHtml(worldTimeLabel(place, i, total))}</span>
      <div class="world-step-body">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(text)}</p>
        ${photo}
        <button class="world-pick" type="button" data-world-pick="${i}" aria-pressed="${picked}">
          <span aria-hidden="true">${picked ? "&#9829;" : "&#9825;"}</span>${picked ? "you want this one" : "I want this one"}
        </button>
      </div>
    </article>
  `;
}

function worldPickSummary(place) {
  const n = worldPicks(place.name).length;
  if (!n) return "Tap the stops you want most and I'll build the day around them.";
  if (n === place.moments.length) return "You picked the whole day. Noted, and honestly, same.";
  return `${n} of ${place.moments.length} stops picked. I'm keeping the list.`;
}

function renderWorldModalBody(place) {
  const isNext = state.worldNext === place.name;
  const total = place.moments.length;
  $("#world-modal-body").innerHTML = `
    <section class="world-hero" style="background-image:url('${escapeHtml(place.photos[0])}')">
      <div><p class="card-label">${escapeHtml(place.eyebrow)}</p><h2>${escapeHtml(place.name)}</h2><p>One of the futures I keep imagining with you.</p></div>
    </section>
    <p class="world-intro">${escapeHtml(place.intro)}</p>
    <p class="world-pick-summary" id="world-pick-summary">${escapeHtml(worldPickSummary(place))}</p>
    <div class="world-day">${place.moments.map((m, i) => worldMomentHtml(place, m, i, total)).join("")}</div>
    <button class="primary-btn wide world-next-btn${isNext ? " is-on" : ""}" id="world-set-next" type="button">
      ${isNext ? "this is the one we do next" : "make this the one we do next"}
    </button>
  `;
}

function openFutureWorld(index) {
  const place = futureWorlds[index];
  if (!place) return;
  markWorldVisited(place.name);
  renderPlaces();
  const modal = $("#world-modal");
  renderWorldModalBody(place);

  const body = $("#world-modal-body");
  body.onclick = event => {
    const pick = event.target.closest("[data-world-pick]");
    if (pick) {
      const added = toggleWorldPick(place.name, Number(pick.dataset.worldPick));
      renderWorldModalBody(place);
      renderPlaces();
      if (added) {
        const rect = pick.getBoundingClientRect();
        burstAt(rect.left + rect.width / 2, rect.top, 5);
      }
      return;
    }
    if (event.target.closest("#world-set-next")) {
      const on = setWorldNext(place.name);
      renderWorldModalBody(place);
      renderPlaces();
      if (on) {
        window.Poo?.react?.("excited");
        toast(`${place.name} it is. That one's next.`);
      }
    }
  };

  document.body.classList.add("focus-mode");
  modal.showModal();
  flowerPageTransition();
}

/* ============================================================================
   Songs That Are You: a player, rather than a list of players.

   This screen was a column of Spotify embeds. A Spotify embed does not play
   to somebody who is not signed in to Spotify on that device - it shows the
   artwork and puts the song behind a login, and on a phone with the app
   installed it tries to hand off instead. So a playlist that could not be
   played, which is the one thing a playlist has to do.

   It is one real audio player now. Album art and a thirty second preview
   come from api/music.js (Apple's keyless search endpoint), the deck plays
   straight through and advances on its own, and the full track is one tap
   away for whoever wants the whole thing. The note for each song sits with
   it, because the note is the actual point of this screen.
   ========================================================================= */
const MUSIC_API = "../api/music";

/* Lookups are stable forever and cost a round trip, so they are remembered
   between visits. A miss is remembered too, otherwise a song Apple does not
   carry re-asks on every single visit. */
const musicCache = (() => {
  const KEY = "moonpie-music-v1";
  let map = {};
  try { map = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { map = {}; }
  return {
    get: key => map[key],
    set(key, value) {
      map[key] = value;
      try { localStorage.setItem(KEY, JSON.stringify(map)); } catch { /* private mode */ }
    },
  };
})();

async function musicLookup(title, artist) {
  const key = `${title}|${artist}`.toLowerCase();
  const cached = musicCache.get(key);
  if (cached !== undefined) return cached;
  try {
    const query = new URLSearchParams({ title, artist: artist || "" });
    const result = await fetch(`${MUSIC_API}?${query}`);
    const found = result.ok ? await result.json() : null;
    musicCache.set(key, found);
    return found;
  } catch {
    return null;   // offline: the notes still read, there is just no sound
  }
}

const player = {
  audio: null,
  index: -1,
  loading: false,
  deck: [],
};

function playerAudio() {
  if (player.audio) return player.audio;
  const audio = new Audio();
  audio.preload = "none";
  audio.addEventListener("timeupdate", paintPlayerProgress);
  audio.addEventListener("ended", () => playSongAt(player.index + 1));
  audio.addEventListener("play", paintPlayerState);
  audio.addEventListener("pause", paintPlayerState);
  player.audio = audio;
  return audio;
}

function paintPlayerProgress() {
  const audio = player.audio;
  const fill = $("#player-progress-fill");
  if (!audio || !fill) return;
  const ratio = audio.duration ? audio.currentTime / audio.duration : 0;
  fill.style.width = `${Math.min(100, ratio * 100)}%`;
  const elapsed = $("#player-elapsed");
  if (elapsed) elapsed.textContent = formatClock(audio.currentTime);
}

function formatClock(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function paintPlayerState() {
  const playing = player.audio && !player.audio.paused;
  const button = $("#player-toggle");
  if (button) {
    button.dataset.playing = playing ? "yes" : "no";
    button.setAttribute("aria-label", playing ? "pause" : "play");
  }
  $$(".song-row").forEach(row => {
    const on = Number(row.dataset.songIndex) === player.index;
    row.classList.toggle("is-playing", on && playing);
    row.classList.toggle("is-current", on);
  });
}

async function playSongAt(index) {
  if (!player.deck.length) return;
  const wrapped = ((index % player.deck.length) + player.deck.length) % player.deck.length;
  const song = player.deck[wrapped];
  player.index = wrapped;
  player.loading = true;
  paintNowPlaying(song, null);

  const found = await musicLookup(song[0], song[1]);
  player.loading = false;
  // she may have tapped another track while this one was still resolving
  if (player.index !== wrapped) return;
  paintNowPlaying(song, found);
  if (!found?.preview) { paintPlayerState(); return; }

  const audio = playerAudio();
  audio.src = found.preview;
  audio.currentTime = 0;
  try { await audio.play(); } catch { /* autoplay blocked until she taps */ }
  paintPlayerState();
}

function paintNowPlaying(song, found) {
  const [title, artist, note] = song;
  const art = $("#player-art");
  if (art) {
    if (found?.artwork) {
      art.style.backgroundImage = `url("${found.artwork}")`;
      art.classList.remove("is-empty");
    } else if (!found) {
      art.classList.add("is-empty");
    }
  }
  const set = (sel, text) => { const el = $(sel); if (el) el.textContent = text; };
  set("#player-title", title);
  set("#player-artist", artist);
  set("#player-note", note);
  set("#player-total", found?.preview ? "0:30" : "");
  const status = $("#player-status");
  if (status) {
    status.textContent = player.loading ? "finding it..."
      : found?.preview ? "thirty second preview"
      : "no preview for this one, but the words still count";
  }
  const link = $("#player-link");
  if (link) {
    link.hidden = !found?.link;
    if (found?.link) link.href = found.link;
  }
  paintPlayerState();
}

function togglePlayer() {
  const audio = player.audio;
  if (player.index < 0) return playSongAt(0);
  if (!audio || !audio.src) return playSongAt(player.index);
  if (audio.paused) audio.play().catch(() => {}); else audio.pause();
}

function songRowHtml([title, artist, note], i) {
  return `
    <button class="song-row" type="button" data-song-index="${i}">
      <span class="song-row-num">${String(i + 1).padStart(2, "0")}</span>
      <span class="song-row-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <span class="song-row-text">
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(artist)}</small>
        <em>${escapeHtml(note)}</em>
      </span>
    </button>`;
}

function renderSongs() {
  // The deck leads with a different song each day, so opening this twice in
  // an hour finds the same one and coming back next week does not.
  const day = Math.floor(Date.now() / 86400000);
  const lead = day % songs.length;
  player.deck = songs.slice(lead).concat(songs.slice(0, lead));

  const list = $("#song-list");
  if (list) list.innerHTML = player.deck.map(songRowHtml).join("");

  if (player.index < 0) paintNowPlaying(player.deck[0], undefined);
  else paintPlayerState();
}

function initSongPlayer() {
  $("#player-toggle")?.addEventListener("click", togglePlayer);
  $("#player-prev")?.addEventListener("click", () => playSongAt(player.index - 1));
  $("#player-next")?.addEventListener("click", () => playSongAt(player.index + 1));
  $("#song-list")?.addEventListener("click", event => {
    const row = event.target.closest("[data-song-index]");
    if (row) playSongAt(Number(row.dataset.songIndex));
  });
  // scrubbing the preview
  $("#player-progress")?.addEventListener("click", event => {
    const audio = player.audio;
    if (!audio?.duration) return;
    const box = event.currentTarget.getBoundingClientRect();
    audio.currentTime = ((event.clientX - box.left) / box.width) * audio.duration;
  });
  // leaving the screen stops the music; nothing should keep playing from a
  // screen she has walked away from
  window.addEventListener("moonpie:screen", event => {
    if (event.detail !== "songs") player.audio?.pause();
  });
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

// While Apart used to be five static cards and two motionless dots - nothing
// on the screen actually did anything. This is the fix: a real thread with a
// button that sends an actual signal to the other phone, with a shared count
// so it accumulates into something instead of disappearing the moment you
// tap it.
const SIGNAL_API = "../api/counter?room=moonpie-counters-2504";

function playSignalPulse() {
  const pulse = $("#signal-pulse");
  if (!pulse) return;
  pulse.classList.remove("firing");
  void pulse.offsetWidth;
  pulse.classList.add("firing");
}

async function initSignalThread() {
  const button = $("#send-signal");
  const countEl = $("#signal-count");
  if (!button) return;

  try {
    const res = await fetch(`${SIGNAL_API}&key=distance-signal`, { cache: "no-store" });
    if (res.ok) {
      const { value } = await res.json();
      if (countEl) countEl.textContent = value > 0 ? `${value} signals sent across the distance so far` : "be the first to send one today";
    }
  } catch { /* leave the default copy - the button still works locally either way */ }

  button.addEventListener("click", async () => {
    playSignalPulse();
    if (window.Poo) window.Poo.react("love");
    burstAt(window.innerWidth / 2, $("#signal-thread")?.getBoundingClientRect().bottom || window.innerHeight * 0.3, 6);

    try {
      const res = await fetch(SIGNAL_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "distance-signal" }),
      });
      if (res.ok) {
        const { value } = await res.json();
        if (countEl) countEl.textContent = `${value} signals sent across the distance so far`;
      }
    } catch { /* the pulse still played - the count just won't have moved this time */ }

    if (window.MoonpiePush) {
      const me = window.MoonpiePush.myProfile();
      window.MoonpiePush.send(`a signal from ${nickOf(me)}`, "just sent something across the distance to you");
    }
  });
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
  // split into a back layer and a front layer rather than one flat pile of
  // colour - the deep reds sit behind and smaller, the bright pinks in front
  // and larger, which is what turns a scatter of hearts into a canopy with
  // actual volume to it
  const backColors = ["#8d0d21", "#a91029", "#c9142f", "#b81338"];
  const frontColors = ["#ff355d", "#ff5b7e", "#ff799a", "#f6a7bb", "#ffc3cf", "#d92d68"];
  const petals = [];
  let guard = 0;

  while (petals.length < 560 && guard < 14000) {
    guard += 1;
    const x = rand() * 2.62 - 1.31;
    const y = rand() * 2.44 - 1.18;
    const heart = Math.pow(x * x + y * y - 1, 3) - x * x * Math.pow(y, 3);
    if (heart > 0) continue;

    const edgeBias = Math.pow(rand(), .72);
    const depth = rand();                       // 0 = deepest in the canopy, 1 = nearest the eye
    const back = depth < .42;
    petals.push({
      depth,
      x: 160 + x * (104 - edgeBias * 7) + (rand() - .5) * 12,
      y: 152 - y * (92 - edgeBias * 5) + (rand() - .5) * 10,
      fromX: 156 + (rand() - .5) * 38,
      fromY: 318 - rand() * 78,
      size: (back ? 3.4 + rand() * 5.2 : 5 + rand() * 7.8),
      rot: (rand() - .5) * 1.8,
      color: back
        ? backColors[Math.floor(rand() * backColors.length)]
        : frontColors[Math.floor(rand() * frontColors.length)],
      delay: rand() * .52,
      shine: !back && rand() > .78
    });
  }

  const branchCanopy = [
    [78, 151], [94, 187], [111, 219], [246, 129], [231, 163], [212, 202],
    [114, 98], [126, 129], [207, 70], [198, 105], [146, 64], [180, 54],
    [95, 232], [118, 250], [244, 212], [222, 233]
  ];
  // branch-tip clusters sit nearest the eye, so they take the front palette
  branchCanopy.forEach(([anchorX, anchorY], branchIndex) => {
    for (let i = 0; i < 8; i += 1) {
      petals.push({
        depth: .72 + rand() * .28,
        x: anchorX + (rand() - .5) * 34,
        y: anchorY + (rand() - .5) * 30,
        fromX: 158 + (rand() - .5) * 24,
        fromY: 320 - rand() * 58,
        size: 5.2 + rand() * 7.2,
        rot: (rand() - .5) * 1.9,
        color: frontColors[(branchIndex + i) % frontColors.length],
        delay: .12 + rand() * .44,
        shine: rand() > .58
      });
    }
  });

  // paint back to front, so the deep reds are genuinely behind the bright
  // pinks instead of interleaved at random
  petals.sort((a, b) => a.depth - b.depth);
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
  // Two winds: a slow one that moves the whole canopy together, and a faster
  // one that breaks it up per petal. The old single wind was multiplied down
  // to ~0.4 canvas units of travel, which is sub-pixel once the canvas is
  // scaled - technically animating, visibly frozen.
  const t = performance.now();
  const gust = Math.sin(t / 2600) * 0.55 + Math.sin(t / 1100) * 0.45;   // -1..1, never quite repeating
  const wind = gust * 6.5;

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

  // Ground first, so the tree is standing ON something instead of floating.
  // The shadow widens as the canopy fills out - a tree with more above it
  // casts more below it, and that link is most of what sells the depth.
  const rooted = easeOutCubic(progress / .42);
  if (rooted > 0) {
    const shadowW = (52 + 34 * clamp01((progress - .46) / .54)) * rooted;
    const soil = ctx.createRadialGradient(159, 368, 2, 159, 368, shadowW);
    soil.addColorStop(0, "rgba(74,44,20,.34)");
    soil.addColorStop(1, "rgba(74,44,20,0)");
    ctx.fillStyle = soil;
    ctx.beginPath();
    ctx.ellipse(159, 368, shadowW, 11 * rooted, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(96,62,32,.5)";
    ctx.beginPath();
    ctx.ellipse(159, 366, 27 * rooted, 6.5 * rooted, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const trunkProgress = rooted;
  // three passes on the trunk: a dark side, the body, then a lit edge, so it
  // reads as a round trunk rather than a flat brown stroke
  drawCurve(ctx, [[154, 365], [150, 296], [147, 207], [161, 48]], trunkProgress, 21, "#5d3415");
  drawCurve(ctx, [[158, 365], [154, 296], [151, 207], [164, 48]], trunkProgress, 19, "#7a471f");
  drawCurve(ctx, [[164, 363], [160, 294], [158, 204], [169, 58]], trunkProgress, 8, "rgba(198,144,88,.5)");

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
      // petals higher in the canopy catch more of the gust than ones down by
      // the trunk, which is what makes it read as wind rather than a jitter
      const catchWind = (1 - clamp01((petal.y - 40) / 300)) * (0.45 + petal.depth * 0.75);
      const x = petal.fromX + (petal.x - petal.fromX) * appear
        + (wind * catchWind + Math.sin(t / 700 + index * 0.7) * 1.6 * catchWind) * appear;
      const y = petal.fromY + (petal.y - petal.fromY) * appear
        - Math.sin(appear * Math.PI) * 22
        + Math.sin(t / 900 + index) * 0.9 * catchWind * appear;
      drawHeartPetal(ctx, x, y, petal.size, petal.rot + wind * .03 * catchWind, petal.color, .1 + appear * .9, .28 + appear * .8, petal.shine);
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
  // don't keep repainting a canvas nobody is looking at
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      if (document.body.dataset.world === "garden") startGardenIdleSway();
    } else {
      stopGardenIdleSway();
    }
  });
  // Already bloomed on a previous visit: skip the sprout state and the tap
  // prompt, and paint the full tree immediately.
  if (state.gardenBloomed) {
    $("#garden-stage")?.classList.add("bloomed");
    $(".home-garden")?.classList.add("bloomed");
    gardenProgress = 1;
    requestAnimationFrame(() => { drawGardenTree(1); startGardenIdleSway(); });
  }
}

/* Once the bloom animation finished, the tree used to freeze into a single
   painted frame and never move again - drawGardenTree() computes its wind
   sway from performance.now(), so the sway only ever existed while something
   was repainting. This keeps a slow repaint going while the garden is on
   screen, so the canopy actually breathes instead of being a still image of
   a tree. Stopped the moment she leaves the screen (see openScreen). */
function startGardenIdleSway() {
  if (gardenIdleFrame || !gardenTreeCanvas) return;
  if (gardenProgress < 1) return;                       // still sprouting; the bloom loop owns the canvas
  if (document.hidden) return;                          // nothing to repaint for; visibilitychange restarts it
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { drawGardenTree(1); return; }
  let lastPaint = -Infinity;
  const tick = now => {
    if (now - lastPaint >= 40) { drawGardenTree(1); lastPaint = now; }   // ~25fps is plenty for a slow sway
    gardenIdleFrame = requestAnimationFrame(tick);
  };
  gardenIdleFrame = requestAnimationFrame(tick);
}

function stopGardenIdleSway() {
  if (!gardenIdleFrame) return;
  cancelAnimationFrame(gardenIdleFrame);
  gardenIdleFrame = null;
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
      startGardenIdleSway();   // hand the canvas over to the slow ambient sway
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

const roseLines = [
  "Deep red, almost too velvet to be real.",
  "The obvious choice. I'm not embarrassed about that.",
  "This is the one I'd actually hand you first."
];
function renderGardenCaptions() {
  const roseCopy = $("#rose-copy");
  if (roseCopy) roseCopy.textContent = pickFresh(roseLines, "lastRoseLine");
  const age = $("#garden-age-line");
  if (age) age.textContent = gardenAgeLine();
}

// Actual compliments about her, not vibes about a day or a room - something
// a person could read and know exactly what quality of hers earned it.
const girlfriendDayCompliments = [
  "You're the most beautiful person I have ever looked at, and I've had a lot of practice looking.",
  "You're smarter than almost everyone in every room you walk into, and you never once make anyone feel small for it.",
  "Your laugh is my favorite sound, full stop, no close second.",
  "You are so much stronger than you give yourself credit for. I've watched you carry things that would flatten most people.",
  "You're funnier than you think you are. Some of the hardest I've laughed this year was at something you said without even trying.",
  "You love people so completely it should be studied. I've never met anyone as generous with their heart as you.",
  "You are, without exaggeration, the most beautiful girl I have ever seen. That has not changed once since the day I met you.",
  "Your mind works in a way I find endlessly interesting. I could listen to how you think about things forever.",
  "You are brave in a quiet way most people never notice. I notice.",
  "You have the kind of warmth that makes people feel safe around you. I felt it before I even knew what it was.",
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
  compliment: { label: "in my voice", list: girlfriendDayCompliments },
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
const ANNIVERSARY = new Date("2026-02-25T00:00:00");

// Same UTC-day-number question rotation as api/daily-question.js, so that if
// the server round trip fails for any reason - unconfigured Supabase, a cold
// network, or just this device being offline for a minute - she still gets
// an actual question today instead of a dead "couldn't reach it" toast. The
// only thing lost offline is seeing the other phone's answer; her own answer
// still saves locally and she still gets to sit with the question.
const LOCAL_DAILY_QUESTIONS = [
  "What's a tiny thing I did recently that you haven't told me made you happy?",
  "If we had the whole day with no plans, what would you actually want to do?",
  "What's a memory of us you've been thinking about lately?",
  "What's something you're proud of yourself for this week?",
  "What's one thing about me you'd tell a stranger if they asked why you love me?",
  "What's a small comfort you wish you had right now?",
  "If you could teleport somewhere with me for one hour, where?",
  "What's something you've never told me because it felt too small to mention?",
  "What made you laugh today, even a little?",
  "What's a song that's been stuck in your head, and does it remind you of anything?",
  "What's one thing you're looking forward to, however far off?",
  "What's a habit of mine you secretly find endearing?",
  "If today had a color, what would it be and why?",
  "What's something you want to get better at, together or alone?",
  "What's the last thing that made you feel completely at ease?",
  "What's a food you're craving right now that you'd want to share with me?",
  "What's one thing from your childhood you want me to understand better?",
  "What's something small I could do this week that would mean a lot?",
  "What's a place that felt like home, even briefly?",
  "What's a fear you don't talk about much?",
  "What's your current favourite way to waste time?",
  "What's a compliment you received that you still think about?",
  "If we designed our future kitchen right now, what's the one thing it has to have?",
  "What's something you learned about yourself this year?",
  "What's a moment today you'd want to press pause on and stay in?",
  "What's a question you wish I'd ask you more often?",
  "What's something that's been on your mind you haven't said out loud yet?",
  "What's a smell or sound that instantly calms you down?",
  "What's the most 'us' thing that's happened recently?",
  "What's one thing you want to promise yourself this month?"
];
function localDailyQuestion() {
  const dayNumber = Math.floor(Date.now() / 86400000);
  const day = new Date(dayNumber * 86400000).toISOString().slice(0, 10);
  const question = LOCAL_DAILY_QUESTIONS[dayNumber % LOCAL_DAILY_QUESTIONS.length];
  const savedAnswer = (state.localDailyAnswers || {})[day] || null;
  return { day, question, myAnswer: savedAnswer, otherAnswer: null, otherAnswered: false, offline: true };
}

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
    state.dailyQuestion = localDailyQuestion();
    if (lantern) lantern.dataset.state = state.dailyQuestion.myAnswer ? "answered" : "closed";
  }
}

function openLanternSheet() {
  const sheet = $("#lantern-sheet");
  // state.dailyQuestion is only ever null before the first refreshHearth()
  // call has had a chance to run - refreshHearth always fills it, from the
  // server or from localDailyQuestion() as a fallback, so a real question is
  // shown even when the server round trip fails.
  const data = state.dailyQuestion || localDailyQuestion();
  if (!sheet) return;

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
    // The server couldn't take it - still let her seal the answer locally
    // rather than losing it. She just won't see the other side's answer
    // until the connection actually works.
    const day = state.dailyQuestion?.day || localDailyQuestion().day;
    if (!state.localDailyAnswers || typeof state.localDailyAnswers !== "object") state.localDailyAnswers = {};
    state.localDailyAnswers[day] = answer;
    saveState();
    state.dailyQuestion = localDailyQuestion();
    $("#lantern").dataset.state = "answered";
    $("#lantern-answer").value = "";
    burstAt(window.innerWidth / 2, window.innerHeight * 0.7, 10);
    openLanternSheet();
    toast("saved on this phone - it'll sync once the connection is back");
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
    const locket = $("#entry-locket");
    if (input.value !== "2502") {
      $("#passkey-error").textContent = "That date did not open it. Think of the day that became ours.";
      input.value = "";
      input.focus();
      // the locket rattles on its chain rather than the whole card shaking
      locket?.classList.remove("is-wrong");
      requestAnimationFrame(() => locket?.classList.add("is-wrong"));
      setTimeout(() => locket?.classList.remove("is-wrong"), 600);
      return;
    }
    state.profile = selectedProfile;
    saveState();
    $("#passkey-error").textContent = "";
    // let the locket actually open before the gate leaves, so the click is
    // the reward for the right date rather than a screen swap
    locket?.classList.add("is-open");
    setTimeout(() => {
      $("#entry-gate")?.classList.add("leaving");
      $("#birthday-opening")?.classList.remove("hidden");
      setTimeout(() => $("#entry-gate")?.remove(), 650);
    }, 900);
  });
  // The arrival bouquet is lilies, every time. It used to rotate through
  // bouquet-1..6, which are mixed arrangements with roses in them - her
  // flower is the stargazer lily, so the one that arrives is all lilies.
  // (tools/build_lily_bouquet.py composes it from the lily cut-outs.)
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
  // the jar owns pulling a reason now; it binds in initAtlasSections
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
    const fold = card.dataset.fold || "envelope";
    // the sewn one is the only fold that asks for something back: it stays
    // shut until the thread has actually been cut
    if (LETTER_FOLDS[fold]?.cut && !card.classList.contains("thread-cut")) {
      toast("this one is sewn shut. cut the stitching first");
      return;
    }
    // the fold comes apart before the letter appears, and they take different
    // lengths of time to do it
    card.classList.add("opening");
    const rect = card.getBoundingClientRect();
    burstAt(rect.left + rect.width / 2, rect.top + 18, 8);
    setTimeout(() => {
      const modal = $("#letter-modal");
      modal.className = `letter-dialog theme-${letter.theme}`;
      $("#modal-title").textContent = letter.title;
      handwrite($("#modal-body"), [
        { text: letter.salutation, cls: "letter-salutation" },
        ...letter.body.map(paragraph => ({ text: paragraph, cls: "letter-line" })),
        { text: letter.closing, cls: "letter-closing" },
      ]);
      document.body.classList.add("focus-mode");
      modal.showModal();
      setTimeout(() => {
        card.classList.remove("opening", "thread-cut");
      }, 400);
    }, LETTER_FOLDS[fold]?.openMs || 620);
  });
  $("#letter-modal").addEventListener("close", () => {
    handwriteFinish();
    document.body.classList.remove("focus-mode");
    revealNav(1800);
  });
  $("#close-letter").addEventListener("click", () => $("#letter-modal").close());
  // tapping the paper while it is being written finishes it, for when she
  // has read it before and does not want to sit through the pen again
  $("#letter-sheet")?.addEventListener("click", event => {
    if (event.target.closest(".modal-close")) return;
    handwriteFinish();
  });
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
  if (streak < 2) { el.hidden = true; return; }
  el.hidden = false;
  // the visit log lives on this phone, so the streak is always the streak of
  // whoever is holding it. It used to be written as though that were always
  // her, which congratulated him for her run of days.
  el.textContent = readerIsHer()
    ? `\u{1F525} day ${streak} in a row you've come back to me. ${state.visitLog.length} visits and counting.`
    : `\u{1F525} day ${streak} in a row you've come back to her. ${state.visitLog.length} visits and counting.`;
}

/* ============================================================================
   The letter composer: write one, dress it, seal it, send it.

   Four steps rather than one form, because the steps are the point. A letter
   you had to choose paper for and press wax onto is a different object from
   a message box with a send button, even when the words are identical.

   Delivery rides the existing widget shelf (api/widgets.js, type "letter"),
   so it syncs to the other phone the same way notes already do, and a push
   tells them it landed. It arrives sealed - they choose when to open it.
   ========================================================================= */

/* The paper she writes on is photographed, not a gradient: one real sheet of
   handmade paper duotoned six ways (tools/build_stationery.py), so every one
   of them still has the fibres and flecks of the sheet it came from. Ruled
   and grid are drawn over that paper rather than instead of it. */
const COMPOSE_PAPERS = [
  { id: "cream",   label: "cream",   sheet: "cream",    ink: "#4b3a6b" },
  { id: "blush",   label: "blush",   sheet: "blush",    ink: "#6b2f52" },
  { id: "lilac",   label: "lilac",   sheet: "lilac",    ink: "#4b3a6b" },
  { id: "sage",    label: "sage",    sheet: "sage",     ink: "#33513c" },
  { id: "sand",    label: "sand",    sheet: "sand",     ink: "#5e4326" },
  { id: "ruled",   label: "ruled",   sheet: "cream",    ink: "#3c3560", rule: "ruled" },
  { id: "grid",    label: "grid",    sheet: "cream",    ink: "#3c3560", rule: "grid" },
  { id: "midnight",label: "midnight",sheet: "midnight", ink: "#f3ecff" },
];

function paperStyle(paper) {
  return `background-image:url("./assets/paper/sheet-${paper.sheet}.webp");` +
         `background-size:340px auto;color:${paper.ink}`;
}

const COMPOSE_FONTS = [
  { id: "caveat",  label: "Caveat",  css: '"Caveat","Dancing Script",cursive', size: "1.32rem" },
  { id: "indie",   label: "Indie",   css: '"Indie Flower",cursive',            size: "1.14rem" },
  { id: "gloria",  label: "Gloria",  css: '"Gloria Hallelujah",cursive',       size: "1.02rem" },
  { id: "shadows", label: "Shadows", css: '"Shadows Into Light",cursive',      size: "1.22rem" },
  { id: "typed",   label: "Typed",   css: '"Quicksand",sans-serif',            size: "1rem" },
];

const COMPOSE_STICKERS = ["\u{1F338}", "\u{1F49C}", "\u{2B50}", "\u{1F98B}", "\u{1F380}",
                          "\u{1F319}", "\u{1F36F}", "\u{1F343}", "\u{2728}", "\u{1F9F8}"];

const COMPOSE_ENVELOPES = ["lilies", "moon", "birthday", "kitchen", "airport"];
/* she picks which of our places goes on it */
const COMPOSE_STAMPS = ["lilies", "moon", "birthday", "airport", "kyoto",
                        "santorini", "venice", "maldives", "kenya", "zanzibar"];

const COMPOSE_TEMPLATES = [
  ["Just because", "No reason for this one. I was thinking about you and it got loud enough that I had to write it down."],
  ["When you miss me", "Open this when the distance gets heavy. I am writing it on a day when I miss you too, so you know it was not theoretical."],
  ["Something I never said", "There is a thing I have been carrying around and never said out loud, so I am putting it here instead."],
];

const composeState = {
  step: 0,
  to: "", body: "", from: "",
  paper: "cream", font: "caveat", stickers: [],
  envelope: "lilies", stamp: "lilies",
};

const COMPOSE_STEPS = ["write", "style", "seal", "send"];
const COMPOSE_STEP_NAMES = ["Write", "Paper", "Seal", "Send"];

function composePaper() { return COMPOSE_PAPERS.find(p => p.id === composeState.paper) || COMPOSE_PAPERS[0]; }
function composeFont() { return COMPOSE_FONTS.find(f => f.id === composeState.font) || COMPOSE_FONTS[0]; }

function openComposer() {
  composeState.step = 0;
  if (!composeState.to) composeState.to = `Dear ${theirName()},`;
  if (!composeState.from) composeState.from = `Always, ${myName()}`;
  openScreen("compose");
  renderComposer();
}

function renderComposer() {
  const step = composeState.step;
  $$("[data-compose-pane]").forEach(pane => {
    pane.classList.toggle("hidden", pane.dataset.composePane !== COMPOSE_STEPS[step]);
  });
  $("#compose-step-label").textContent = `Step ${step + 1} of 4 · ${COMPOSE_STEP_NAMES[step]}`;
  $$("#compose-steps .compose-dots i").forEach((dot, i) => dot.classList.toggle("on", i <= step));

  $("#compose-prev").hidden = step === 0;
  $("#compose-next").hidden = step === COMPOSE_STEPS.length - 1;

  // keep the fields in sync with state when stepping back into them
  const to = $("#compose-to"), body = $("#compose-body"), from = $("#compose-from");
  if (to && document.activeElement !== to) to.value = composeState.to;
  if (body && document.activeElement !== body) body.value = composeState.body;
  if (from && document.activeElement !== from) from.value = composeState.from;
  applyComposeSheetStyle();

  if (step === 1) renderComposeStyleStep();
  if (step === 2) renderComposeSealStep();
  if (step === 3) renderComposeFinal();
}

function applyComposeSheetStyle() {
  const sheet = $("#compose-sheet");
  if (!sheet) return;
  const paper = composePaper(), font = composeFont();
  sheet.style.cssText = paperStyle(paper);
  sheet.dataset.rule = paper.rule || "";
  sheet.style.setProperty("--letter-ink", paper.ink);
  sheet.style.fontFamily = font.css;
  sheet.style.fontSize = font.size;
}

function chipHtml(attr, value, inner, on) {
  return `<button class="compose-chip${on ? " is-on" : ""}" type="button" data-${attr}="${escapeHtml(String(value))}">${inner}</button>`;
}

function renderComposeStyleStep() {
  $("#compose-papers").innerHTML = COMPOSE_PAPERS.map(p =>
    chipHtml("paper", p.id,
      `<span class="chip-swatch" style="${paperStyle(p)};background-size:cover"></span>${escapeHtml(p.label)}`,
      composeState.paper === p.id)).join("");

  $("#compose-fonts").innerHTML = COMPOSE_FONTS.map(f =>
    chipHtml("font", f.id,
      `<span style="font-family:${f.css}">${escapeHtml(f.label)}</span>`,
      composeState.font === f.id)).join("");

  $("#compose-stickers").innerHTML = COMPOSE_STICKERS.map(s =>
    chipHtml("sticker", s, `<span class="chip-sticker">${s}</span>`,
      composeState.stickers.includes(s))).join("");

  renderComposePreview($("#compose-preview-style"));
}

function composeStickerLayer() {
  // scattered rather than lined up, so they read as stuck on by hand
  return composeState.stickers.map((s, i) => {
    const top = 8 + ((i * 37) % 72);
    const left = i % 2 ? 78 - ((i * 13) % 16) : 4 + ((i * 11) % 14);
    const rot = ((i * 47) % 40) - 20;
    return `<span class="letter-sticker" style="top:${top}%;left:${left}%;rotate:${rot}deg">${s}</span>`;
  }).join("");
}

function composeLetterHtml() {
  const paper = composePaper(), font = composeFont();
  return `
    <article class="letter-paper" data-rule="${paper.rule || ""}" style="${paperStyle(paper)};font-family:${font.css};font-size:${font.size}">
      ${composeStickerLayer()}
      <p class="letter-paper-to">${escapeHtml(composeState.to || "")}</p>
      <p class="letter-paper-body">${escapeHtml(composeState.body || "...").replace(/\n/g, "<br>")}</p>
      <p class="letter-paper-from">${escapeHtml(composeState.from || "")}</p>
    </article>`;
}

function renderComposePreview(host) {
  if (host) host.innerHTML = composeLetterHtml();
}

function renderComposeSealStep() {
  $("#compose-envelopes").innerHTML = COMPOSE_ENVELOPES.map(t =>
    chipHtml("envelope", t, `<span class="chip-env theme-${t}"></span>${escapeHtml(t)}`,
      composeState.envelope === t)).join("");
  $("#compose-stamps").innerHTML = COMPOSE_STAMPS.map(name =>
    chipHtml("stamp", name,
      `<img class="chip-stamp" src="${stampSrc(name)}" alt="">`,
      composeState.stamp === name)).join("");

  $("#compose-envelope-preview").innerHTML = composeEnvelopeHtml("a letter for you");
}

function composeEnvelopeHtml(title) {
  return `
    <div class="envelope theme-${composeState.envelope}" aria-hidden="true">
      ${envelopeHtml({
        theme: composeState.envelope,
        stamp: composeState.stamp,
        tab: `from ${myName()}`,
        to: `for ${theirName()}`,
        initial: myName().charAt(0),
        title,
        cta: `sealed, waiting for ${theirName()}`,
      })}
    </div>`;
}

function renderComposeFinal() {
  $("#compose-final").innerHTML = composeEnvelopeHtml("a letter for you");
  const ready = composeState.body.trim().length > 0;
  $("#compose-send").disabled = !ready;
  $("#compose-send-hint").textContent = ready
    ? `It arrives on ${theirName()}'s phone sealed. They choose when to open it.`
    : "Write something first, then you can send it.";
}

async function sendComposedLetter() {
  const body = composeState.body.trim();
  if (!body) return toast("write something first");
  const me = meId();
  const status = $("#compose-status");
  const button = $("#compose-send");
  button.disabled = true;
  if (status) { status.hidden = false; status.textContent = "sealing..."; }

  const letter = {
    to: composeState.to, body, from: composeState.from,
    paper: composeState.paper, font: composeState.font,
    stickers: composeState.stickers.slice(),
    envelope: composeState.envelope, stamp: composeState.stamp,
  };
  const widget = {
    id: `letter-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "letter",
    value: JSON.stringify(letter),
    sender: me,
    createdAt: Date.now(),
  };

  try {
    const result = await fetch(WIDGET_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ widget }),
    });
    if (!result.ok) throw new Error(`widgets ${result.status}`);

    // keep a local copy too, so it shows up here without waiting for a sync
    state.widgets = Array.isArray(state.widgets) ? state.widgets : [];
    state.widgets.push(widget);
    saveState();

    if (window.MoonpiePush) {
      window.MoonpiePush.send(`${nickOf(me)} sent you a letter`, "It is sealed. Open it when you want to.");
    }
    if (status) status.textContent = "sent. it is on their phone now.";
    flowerConfetti(38);
    window.Poo?.react?.("love");
    composeState.body = "";
    composeState.stickers = [];
    setTimeout(() => { openScreen("letters"); renderLetterInbox(); }, 1400);
  } catch (error) {
    console.warn("send letter", error);
    if (status) status.textContent = "could not send it just now. your words are still here, try again in a moment.";
    button.disabled = false;
  }
}

/* --------------------------------------------------- letters that arrived */

function receivedLetters() {
  const me = window.MoonpiePush?.myProfile?.() || "Michelle";
  return (state.widgets || [])
    .filter(w => w && w.type === "letter" && w.sender !== me)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

function renderLetterInbox() {
  const host = $("#letter-inbox");
  if (!host) return;
  const mine = receivedLetters();
  if (!mine.length) { host.innerHTML = ""; return; }

  host.innerHTML = `<p class="card-label inbox-label">just for you</p>` + mine.map(w => {
    let letter = {};
    try { letter = JSON.parse(w.value) || {}; } catch { letter = {}; }
    const opened = (state.openedLetters || []).includes(w.id);
    const from = nickOf(w.sender || "Michael");
    return `
      <button class="envelope theme-${escapeHtml(letter.envelope || "lilies")}${opened ? " is-opened" : ""}"
              type="button" data-inbox-letter="${escapeHtml(w.id)}">
        ${envelopeHtml({
          theme: letter.envelope || "lilies",
          stamp: letter.stamp,
          tab: `from ${from}`,
          to: `for ${myName()}`,
          initial: from.charAt(0),
          title: opened ? "a letter you have read" : "a letter arrived",
          cta: opened ? "read it again" : "tap to unseal",
        })}
      </button>`;
  }).join("");
}

function openReceivedLetter(id) {
  const widget = (state.widgets || []).find(w => w.id === id);
  if (!widget) return;
  let letter = {};
  try { letter = JSON.parse(widget.value) || {}; } catch { letter = {}; }

  const paper = COMPOSE_PAPERS.find(p => p.id === letter.paper) || COMPOSE_PAPERS[0];
  const font = COMPOSE_FONTS.find(f => f.id === letter.font) || COMPOSE_FONTS[0];
  const stickers = (letter.stickers || []).map((s, i) => {
    const top = 8 + ((i * 37) % 72);
    const left = i % 2 ? 78 - ((i * 13) % 16) : 4 + ((i * 11) % 14);
    const rot = ((i * 47) % 40) - 20;
    return `<span class="letter-sticker" style="top:${top}%;left:${left}%;rotate:${rot}deg">${s}</span>`;
  }).join("");

  // reuses the existing letter dialog (#modal-title / #modal-body)
  const modal = $("#letter-modal");
  modal.className = `letter-dialog theme-${letter.envelope || "lilies"}`;
  $("#modal-title").textContent = `from ${nickOf(widget.sender || "Michael")}`;
  $("#modal-body").innerHTML = `
    <article class="letter-paper is-open" data-rule="${paper.rule || ""}"
             style="${paperStyle(paper)};font-family:${font.css};font-size:${font.size}">
      ${stickers}
      <div class="letter-paper-text"></div>
    </article>`;
  // hers arrives the same way the twelve do: written out rather than printed
  handwrite($("#modal-body .letter-paper-text"), [
    { text: letter.to || "", cls: "letter-paper-to" },
    ...String(letter.body || "").split(/\n{2,}/).map(t => ({ text: t.replace(/\n/g, " "), cls: "letter-line" })),
    { text: letter.from || "", cls: "letter-paper-from" },
  ]);
  document.body.classList.add("focus-mode");
  modal.showModal();

  state.openedLetters = Array.isArray(state.openedLetters) ? state.openedLetters : [];
  if (!state.openedLetters.includes(id)) {
    state.openedLetters.push(id);
    saveState();
    renderLetterInbox();
  }
}

function initComposer() {
  $("#open-composer")?.addEventListener("click", openComposer);
  $("#compose-back")?.addEventListener("click", () => openScreen("letters"));

  $("#compose-next")?.addEventListener("click", () => {
    if (composeState.step === 0 && !$("#compose-body").value.trim()) return toast("write something first");
    composeState.step = Math.min(COMPOSE_STEPS.length - 1, composeState.step + 1);
    renderComposer();
  });
  $("#compose-prev")?.addEventListener("click", () => {
    composeState.step = Math.max(0, composeState.step - 1);
    renderComposer();
  });

  ["compose-to", "compose-body", "compose-from"].forEach(id => {
    $(`#${id}`)?.addEventListener("input", event => {
      const key = id === "compose-to" ? "to" : id === "compose-body" ? "body" : "from";
      composeState[key] = event.target.value;
    });
  });

  $("#compose-templates")?.addEventListener("click", () => {
    const [title, text] = pick(COMPOSE_TEMPLATES);
    composeState.body = text;
    $("#compose-body").value = text;
    toast(`template: ${title}`);
  });

  // one delegated listener for every chip in every step
  $("#screen-compose")?.addEventListener("click", event => {
    const paper = event.target.closest("[data-paper]");
    if (paper) { composeState.paper = paper.dataset.paper; return renderComposer(); }
    const font = event.target.closest("[data-font]");
    if (font) { composeState.font = font.dataset.font; return renderComposer(); }
    const sticker = event.target.closest("[data-sticker]");
    if (sticker) {
      const s = sticker.dataset.sticker;
      const at = composeState.stickers.indexOf(s);
      if (at >= 0) composeState.stickers.splice(at, 1);
      else if (composeState.stickers.length < 6) composeState.stickers.push(s);
      else toast("six is plenty");
      return renderComposer();
    }
    const env = event.target.closest("[data-envelope]");
    if (env) { composeState.envelope = env.dataset.envelope; return renderComposer(); }
    const stamp = event.target.closest("[data-stamp]");
    if (stamp) { composeState.stamp = stamp.dataset.stamp; return renderComposer(); }
  });

  $("#compose-send")?.addEventListener("click", sendComposedLetter);

  $("#letter-inbox")?.addEventListener("click", event => {
    const button = event.target.closest("[data-inbox-letter]");
    if (!button) return;
    button.classList.add("opening");
    setTimeout(() => {
      button.classList.remove("opening");
      openReceivedLetter(button.dataset.inboxLetter);
    }, 620);
  });
}

/* Signing out.

   Not a logout in the account sense - there are no accounts here, and the
   two of us share one passcode. It puts the gate back and forgets which
   side of the app this phone was reading as, which is what you actually
   want when you hand the phone over or when one of us opens it on the
   other's device by mistake. Everything saved on the phone stays saved. */
function signOut() {
  state.hasEnteredUniverse = false;
  state.lockOpened = false;
  saveState();
  location.reload();
}

function init() {
  document.body.dataset.world = "home";
  applyVoice();
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
  initSongPlayer();
  initPoems();
  initAtlasSections();
  initComposer();
  initWatchlist();
  $("#sign-out")?.addEventListener("click", signOut);
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
