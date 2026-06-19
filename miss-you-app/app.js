const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const STORE_KEY = "moonpie-miss-you-v9";
const defaultState = { mood: "soft", widgets: [], openedReasons: [], softMode: false, lastWorld: "letters", bestBubbleScore: 0, challengeIndex: 0 };
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

const worlds = [
  { id: "garden", icon: "🌸", title: "Birthday Garden", sub: "tree, lilies, bouquet", count: 3, tone: "garden" },
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
  { id: "birthday", icon: "🎂", title: "Birthday Wish", sub: "save this one for last", count: 1, tone: "birthday" },
  { id: "doodles", icon: "✍️", title: "Widget Studio", sub: "write, draw, send comfort", count: 2, tone: "create" },
  { id: "games", icon: "🎮", title: "Love Arcade", sub: "tap tiny feelings", count: 6, tone: "game" },
  { id: "care", icon: "🫶", title: "Emergency Care", sub: "when missing gets heavy", count: 5, tone: "care" }
];

const comfortNotes = {
  soft: [
    "Come closer in your head. I am probably smiling at my phone somewhere, thinking about the same girl.",
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
    title: "The Night I Knew",
    tab: "first spark",
    theme: "moon",
    preview: "For the quiet moment when love stopped being a maybe and became a place.",
    salutation: "My Moonpie,",
    body: [
      "I do not think love always announces itself loudly. Sometimes it slips into an ordinary conversation and sits there like it has always belonged.",
      "That is how it happened with you. You were talking about something simple, maybe something small from your day, and I caught myself wanting to keep listening forever. Not because the topic was dramatic. Because it was you. Because your voice made even the normal parts of life feel worth staying for.",
      "I remember thinking that if the future had a sound, I wanted it to sound like you half laughing, half explaining something, while I sit there pretending I am not completely gone for you.",
      "That night did not feel like a movie scene. It felt softer than that. It felt like recognition. Like some part of me looked up and said, there she is."
    ],
    closing: "Still choosing that moment, still choosing you."
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
      "When you miss me, I hope you remember that I am not somewhere forgetting you. I carry you into my day in tiny ways. I think of you when something sweet happens. I think of you when I am tired. I think of you when the room goes quiet and my heart starts looking for home.",
      "So stay here for a moment. Let this letter be my hand on your cheek. I love you. I am here. We are still us."
    ],
    closing: "Come back to this whenever the missing feels heavy."
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
      "If I could keep one sound in my pocket for every hard day, I would choose your laugh. Not the polite one. The real one. The one that makes me feel like I have won something I did not know I was hoping for."
    ],
    closing: "Call me in your heart. I will answer there too."
  },
  {
    title: "Your Birthday Letter",
    tab: "save this one",
    theme: "birthday",
    preview: "For the day the world became luckier because you arrived in it.",
    salutation: "Happy birthday, Michelle,",
    body: [
      "Today is not just the day you were born. It is the day every person who gets to love you became possible. It is the beginning of your laugh, your softness, your stubborn little heart, your dreams, your voice, your way of making ordinary things feel warm.",
      "I wish I could place flowers in your hands for real. I wish I could watch your face while you read this. I wish I could make the whole day gentle around you, like the world knows it is carrying someone precious.",
      "You deserve more than a message. You deserve a room full of lilies, a sky full of pink light, a cake with wishes that come true, and a love that does not make you wonder if you are too much.",
      "You are not too much. You are my favorite kind of everything. My Moonpie. My Princess. My babyy. My person in the softest part of my chest.",
      "I hope this year gives you proof after proof that you are loved, protected, chosen, and seen. I hope it brings you closer to the life you dream about. I hope it brings you closer to me."
    ],
    closing: "Make a wish. I am wishing for you too."
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
      "You do not have to perform for my love. You do not have to be easy every day. You do not have to be cheerful before you are ready. I do not only want the polished version of you. I want the real you, the sleepy you, the unsure you, the clingy you, the brave you, the quiet you.",
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
    salutation: "My precious girl,",
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
    preview: "For when she wonders why this place exists at all.",
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
  ["8:12 AM", "I wake up before you and fail at not staring."],
  ["9:00 AM", "Coffee, breakfast, and you stealing the better bite."],
  ["11:30 AM", "A walk with no destination. My hand keeps finding yours."],
  ["2:00 PM", "A little market. Flowers. Something ridiculous we buy because it made you smile."],
  ["5:40 PM", "Golden hour photos. I pretend I only need one. I take fifty."],
  ["8:30 PM", "Dinner somewhere soft-lit where the food is good but you are still the view."],
  ["11:58 PM", "Almost midnight. Still us. No rushing. No leaving."]
];

const places = [
  ["Airport Arrival", "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=900&q=80", "The doors open, you look around, and the whole world narrows to one hug."],
  ["Santorini", "https://images.unsplash.com/photo-1533105079780-92b9be482077?w=900&q=80", "White terraces, lilac sky, and me taking too many pictures of you."],
  ["The Maldives", "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=900&q=80", "No schedule. Water everywhere. You wake up and I stop noticing the ocean."],
  ["Paris at Midnight", "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=900&q=80", "The tower sparkles and I pretend I did not arrange it for you."],
  ["Our Tiny Kitchen", "https://images.unsplash.com/photo-1556911220-bff31c812dba?w=900&q=80", "Coffee, sleepy hair, stealing bites, arguing lovingly about the last piece."]
];

const songs = [
  ["Sleep Well", "d4vd", "For the soft nights when missing each other gets too loud."],
  ["Best Part", "Daniel Caesar ft. H.E.R.", "Because you are exactly that: the part my day keeps waiting for."],
  ["Those Eyes", "New West", "A song for tiny things, private jokes, and the ordinary ways love proves itself."],
  ["Until I Found You", "Stephen Sanchez", "Ridiculous-romantic in the correct birthday way."],
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
  ["If she opens this at night", "Tell her: I am probably missing her too. The dark just makes it easier to hear."],
  ["If she is waiting for a reply", "Tell her: silence is not absence. Sometimes I am just living the day that leads me back to her."],
  ["If she wants my hand", "Tell her: put your palm on the screen. I know it is silly. Do it anyway."],
  ["If she feels far", "Tell her: far is a measurement. Us is a decision."],
  ["If goodbye hurt", "Tell her: goodbyes are proof that hello still matters."]
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
  ["1", "Put one hand on your chest and take three slower breaths than you want to."],
  ["2", "Drink water. Tiny rule. I am bossy because I love you."],
  ["3", "Send me one honest sentence if you can: 'I miss you and need softness.'"],
  ["4", "Open one letter. Do not rush it. Let me love you at reading speed."],
  ["5", "If it is late, sleep. Missing me does not require staying awake as proof."]
];

const challenges = [
  ["Voice-note dare", "Send one voice note where you say exactly what you miss, no making it neat."],
  ["Photo scavenger hunt", "Find something pink, something soft, and something that reminds you of us. Send all three."],
  ["Two-minute date", "Start a timer. For two minutes, both of you text only tiny future plans."],
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

function openScreen(name) {
  state.lastWorld = name;
  saveState();
  document.body.dataset.world = name;
  $$(".screen").forEach(s => s.classList.toggle("active", s.id === `screen-${name}`));
  $$(".tab").forEach(t => t.classList.toggle("active", t.dataset.open === name));
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (name === "doodles") requestAnimationFrame(resizeCanvas);
  if (name === "garden") requestAnimationFrame(resizeGardenTree);
  revealNav(2600);
}

function setMood(mood) {
  selectedMood = mood;
  state.mood = mood;
  saveState();
  $$(".mood-chip").forEach(btn => btn.classList.toggle("active", btn.dataset.mood === mood));
  $("#comfort-note").textContent = pick(comfortNotes[mood]);
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
  $("#poem-list").innerHTML = poems.map(([title, body]) => `
    <article class="poem-card premium-card">
      <p class="card-label">after midnight</p>
      <h3>${title}</h3>
      <pre>${body}</pre>
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
  $("#place-rail").innerHTML = places.map(([name, img, text]) => `
    <article class="place-card">
      <div class="place-img" style="background-image:url('${img}')"></div>
      <div>
        <p class="card-label">future coordinate</p>
        <h3>${name}</h3>
        <p>${text}</p>
      </div>
    </article>
  `).join("");
}

function renderSongs() {
  $("#song-list").innerHTML = songs.map(([name, artist, note], i) => `
    <article class="song-card premium-card" style="--r:${[-1.5,1,-.5,1.8,-1,1.2,-1.7][i % 7]}deg">
      <div class="song-art">♪</div>
      <div>
        <p class="card-label">track ${String(i + 1).padStart(2, "0")}</p>
        <h3>${name}</h3>
        <strong>${artist}</strong>
        <p>${note}</p>
      </div>
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
  $("#reason-text").textContent = pick(reasons);
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

  while (petals.length < 680 && guard < 16000) {
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

  return petals;
}

function resizeGardenTree() {
  if (!gardenTreeCanvas) return;
  const rect = gardenTreeCanvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
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

function drawHeartPetal(ctx, x, y, size, rotation, color, alpha, scale = 1) {
  if (alpha <= 0) return;
  const s = size * scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(s, s);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
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
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
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
      drawHeartPetal(ctx, x, y, petal.size, petal.rot + wind * .016, petal.color, .1 + appear * .9, .28 + appear * .8);
      if (petal.shine && appear > .82) {
        drawHeartPetal(ctx, x - 1.5, y - 1.8, petal.size * .38, petal.rot, "#fff0f4", (appear - .82) * 1.2, .75);
      }
    });
  }

  ctx.restore();
}

function setupGardenTree() {
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

  function tick(now) {
    gardenProgress = easeInOut((now - start) / duration);
    drawGardenTree(gardenProgress);
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
    toast("the garden bloomed for her");
  }, GARDEN_BLOOM_DURATION - 1200);
}

function renderBirthday() {
  $("#birthday-wish").innerHTML = `
    <div class="birthday-stage" data-birthday-stage="candles">
      <p class="card-label">step 1</p>
      <div class="cake-mini cake-lit" aria-label="birthday cake with candles"><span></span><span></span><span></span></div>
      <h2>Blow the candles, Michelle.</h2>
      <p>Take one tiny breath. Pretend I am beside you counting down badly because I am too excited.</p>
      <button class="primary-btn wide" id="blow-candles" type="button">blow the candles</button>
    </div>

    <div class="birthday-stage hidden" data-birthday-stage="wish">
      <p class="card-label">step 2</p>
      <div class="wish-moon">🌙</div>
      <h2>Now make a wish.</h2>
      <p>Write it here or keep it secret. Either way, I am rooting for every soft thing your heart asks for.</p>
      <textarea id="birthday-wish-text" rows="3" maxlength="180" placeholder="my wish is..."></textarea>
      <button class="primary-btn wide" id="seal-wish" type="button">seal my wish</button>
    </div>

    <div class="birthday-stage hidden" data-birthday-stage="letter">
      <p class="card-label">wish sealed</p>
      <div class="birthday-envelope">💌</div>
      <h2>Happy birthday, Michelle.</h2>
      <p class="birthday-letter">You deserve more than a page. You deserve a little universe that stays on your phone, waits quietly, and opens whenever missing me gets loud.</p>
      <p class="birthday-letter">My Moonpie. My Princess. My babyy. I love you in every screen, every letter, every future place, every silly widget, and every ordinary day we have not reached yet.</p>
      <p class="birthday-letter">Whatever you wished for, I hope life is gentle enough to bring it close. And if your wish has anything to do with us, I am already walking toward it.</p>
      <button class="secondary-btn wide" id="replay-birthday" type="button">replay the birthday magic</button>
    </div>
  `;
}

function renderCare() {
  $("#care-list").innerHTML = careSteps.map(([n, text]) => `
    <article class="care-step"><span>${n}</span><p>${text}</p></article>
  `).join("");
}

function renderGames() {
  const challenge = challenges[state.challengeIndex % challenges.length];
  $("#challenge-title").textContent = challenge[0];
  $("#challenge-text").textContent = challenge[1];
  $("#bubble-score").textContent = state.bestBubbleScore ? `best ${state.bestBubbleScore}` : "0";
}

let bubbleScore = 0;
let bubbleTimer = null;
let bubbleStop = null;

function startBubbleGame() {
  const field = $("#bubble-field");
  if (!field) return;
  clearInterval(bubbleTimer);
  clearTimeout(bubbleStop);
  field.innerHTML = "";
  bubbleScore = 0;
  $("#bubble-score").textContent = "0";
  $("#start-bubbles").textContent = "pop them, Moonpie";
  bubbleTimer = setInterval(spawnBubble, 520);
  bubbleStop = setTimeout(endBubbleGame, 20000);
  burstAt(window.innerWidth / 2, window.innerHeight / 2, 14);
}

function spawnBubble() {
  const field = $("#bubble-field");
  const bubble = document.createElement("button");
  bubble.className = "love-bubble";
  bubble.type = "button";
  bubble.textContent = pick(bubbleEmojis);
  bubble.style.left = `${8 + Math.random() * 78}%`;
  bubble.style.setProperty("--rise", `${7.5 + Math.random() * 3.2}s`);
  bubble.style.setProperty("--wiggle", `${(Math.random() - .5) * 70}px`);
  const pop = event => popBubble(bubble, event);
  bubble.addEventListener("pointerdown", pop, { once: true });
  bubble.addEventListener("click", pop, { once: true });
  field.appendChild(bubble);
  setTimeout(() => bubble.remove(), 11000);
}

function popBubble(bubble, event) {
  if (!bubble || bubble.dataset.popped === "true") return;
  event?.preventDefault?.();
  bubble.dataset.popped = "true";
  bubbleScore += 1;
  $("#bubble-score").textContent = String(bubbleScore);
  const rect = bubble.getBoundingClientRect();
  burstAt(event?.clientX || rect.x + rect.width / 2, event?.clientY || rect.y + rect.height / 2, 7);
  bubble.remove();
}

function endBubbleGame() {
  clearInterval(bubbleTimer);
  bubbleTimer = null;
  $("#start-bubbles").textContent = "start 20 second round";
  state.bestBubbleScore = Math.max(state.bestBubbleScore || 0, bubbleScore);
  saveState();
  toast(`score: ${bubbleScore}. best: ${state.bestBubbleScore}`);
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
}

function showBirthdayStage(stage) {
  $$("[data-birthday-stage]").forEach(panel => {
    panel.classList.toggle("hidden", panel.dataset.birthdayStage !== stage);
  });
}

function blowCandles() {
  const cake = $(".cake-mini");
  cake?.classList.remove("cake-lit");
  cake?.classList.add("cake-blown");
  burstAt(window.innerWidth / 2, 250, 10);
  toast("make a wish, birthday girl");
  setTimeout(() => showBirthdayStage("wish"), 700);
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
  toast("candles relit");
}

function renderWidgets() {
  const list = $("#widget-list");
  if (!state.widgets.length) {
    list.innerHTML = `<article class="saved-widget"><strong>No widgets saved yet.</strong><p>Make one tiny thing she can reopen when missing you gets loud.</p></article>`;
    return;
  }
  list.innerHTML = state.widgets.map((widget, index) => ({ ...widget, index })).slice().reverse().map(w => `
    <article class="saved-widget">
      <button class="delete-widget" type="button" data-delete-widget="${w.id || w.createdAt || w.index}" aria-label="delete widget">delete</button>
      ${w.type === "doodle" ? `<img src="${w.value}" alt="saved handwritten widget">` : `<p>${escapeHtml(w.value)}</p>`}
      <time>${new Date(w.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</time>
    </article>
  `).join("");
}

function renderLatestWidget() {
  const latest = state.widgets[state.widgets.length - 1];
  const box = $("#latest-widget");
  if (!latest) {
    box.innerHTML = `<div class="card-label">latest widget</div><p>No widget yet. Write or draw one for future-her.</p>`;
    return;
  }
  box.innerHTML = `<div class="card-label">latest widget</div>${latest.type === "doodle" ? `<img src="${latest.value}" alt="latest doodle">` : `<p>${escapeHtml(latest.value)}</p>`}`;
}

let canvas, ctx, strokes = [], activeStroke = null;

function setupCanvas() {
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
  state.widgets.push({ id: `doodle-${createdAt}`, type: "doodle", value: canvas.toDataURL("image/png"), createdAt });
  strokes = [];
  redrawCanvas();
  saveState();
  renderWidgets();
  renderLatestWidget();
  showLoveNotification(state.widgets[state.widgets.length - 1], "Handwritten widget saved");
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
  state.widgets.push({ id: `text-${createdAt}`, type: "text", value: text, createdAt });
  $("#widget-text").value = "";
  saveState();
  renderWidgets();
  renderLatestWidget();
  showLoveNotification(state.widgets[state.widgets.length - 1], "Love widget saved");
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
    data: { url: "./?v=28" }
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

function exportPacket() {
  const packet = btoa(unescape(encodeURIComponent(JSON.stringify({ widgets: state.widgets }))));
  navigator.clipboard?.writeText(packet).then(() => toast("packet copied")).catch(() => {
    $("#import-data").value = packet;
    toast("packet placed in the box");
  });
}

function importPacket() {
  try {
    const raw = $("#import-data").value.trim();
    const data = JSON.parse(decodeURIComponent(escape(atob(raw))));
    if (!Array.isArray(data.widgets)) throw new Error("bad packet");
    const imported = data.widgets.map((widget, index) => ({
      ...widget,
      id: widget.id || `imported-${Date.now()}-${index}`,
      createdAt: widget.createdAt || Date.now()
    }));
    state.widgets = [...state.widgets, ...imported].slice(-40);
    $("#import-data").value = "";
    saveState();
    renderWidgets();
    renderLatestWidget();
    showLoveNotification(imported[imported.length - 1], "New love widget arrived");
    toast("packet imported");
  } catch {
    toast("that packet did not work");
  }
}

function setupHoldOrb() {
  const orb = $("#hold-orb");
  let timer = null;
  const start = () => {
    orb.classList.add("holding");
    navigator.vibrate?.([25, 30, 25]);
    timer = setTimeout(() => {
      $("#daily-line").textContent = "There. My hand is in yours for this minute. Stay as long as you need, my love.";
      toast("still here");
    }, 850);
  };
  const stop = () => {
    orb.classList.remove("holding");
    clearTimeout(timer);
  };
  orb.addEventListener("pointerdown", start);
  orb.addEventListener("pointerup", stop);
  orb.addEventListener("pointerleave", stop);
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
    if (event.target.closest("#bloom-garden,#seed-heart")) bloomGarden();
    if (event.target.closest("#blow-candles")) blowCandles();
    if (event.target.closest("#seal-wish")) sealBirthdayWish();
    if (event.target.closest("#replay-birthday")) replayBirthday();
    const expressive = event.target.closest(".primary-btn,.world-tile,.letter-card,.mood-chip");
    if (expressive) burstAt(event.clientX, event.clientY, expressive.classList.contains("world-tile") ? 6 : 4);
  });
  $$(".mood-chip").forEach(btn => btn.addEventListener("click", () => setMood(btn.dataset.mood)));
  $("#new-comfort").addEventListener("click", () => setMood(selectedMood));
  $("#new-reason").addEventListener("click", () => $("#reason-text").textContent = pick(reasons));
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
  $("#export-data").addEventListener("click", exportPacket);
  $("#import-packet").addEventListener("click", importPacket);
  $("#start-bubbles").addEventListener("click", startBubbleGame);
  $("#next-challenge").addEventListener("click", nextChallenge);
  $("#love-dice").addEventListener("click", rollLoveDice);
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
}

async function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    try { await navigator.serviceWorker.register("./sw.js"); }
    catch { /* local file/server may not support service workers */ }
  }
}

function init() {
  document.body.dataset.world = "home";
  document.body.classList.toggle("soft-mode", state.softMode);
  renderAtlas();
  setMood(selectedMood);
  renderLetters();
  renderPoems();
  renderNotices();
  renderDay();
  renderPlaces();
  renderSongs();
  renderPromises();
  renderDistance();
  renderReasons();
  renderMemory();
  renderBirthday();
  renderCare();
  renderGames();
  renderWidgets();
  renderLatestWidget();
  setupCanvas();
  setupGardenTree();
  setupHoldOrb();
  setupEvents();
  setupSmartNav();
  setupInstall();
  const requestedScreen = new URLSearchParams(location.search).get("open");
  if (requestedScreen && worlds.some(world => world.id === requestedScreen)) openScreen(requestedScreen);
  finishIntro();
  registerServiceWorker();
}

init();
