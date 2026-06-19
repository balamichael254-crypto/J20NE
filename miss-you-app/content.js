(function () {
  const photo = id => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1100&q=78`;
  const flickr = (tags, lock) => `https://loremflickr.com/1100/820/${tags}?lock=${lock}`;
  const romanticGallery = (hero, tags, seed) => [
    hero ? photo(hero) : flickr(`${tags},couple`, seed),
    flickr(`${tags},romantic,couple`, seed + 1),
    flickr(`${tags},love,together`, seed + 2)
  ];

  const galleries = {
    airport: ["photo-1436491865332-7a61a109cc05", "photo-1529074963764-98f45c47344b", "photo-1483450388369-9ed95738483c"],
    islands: ["photo-1514282401047-d79a71a590e8", "photo-1507525428034-b723cf961d3e", "photo-1540202404-a2f29016b523"],
    europe: ["photo-1533105079780-92b9be482077", "photo-1502602898657-3e91760cbb34", "photo-1523906834658-6e24ef2386f9"],
    garden: ["photo-1528360983277-13d401cdc186", "photo-1490750967868-88aa4486c946", "photo-1501004318641-b39e6451bec6"],
    mountains: ["photo-1500534314209-a25ddb2bd429", "photo-1464822759023-fed622ff2c3b", "photo-1483347756197-71ef80e95f73"],
    city: ["photo-1522083165195-3424ed129620", "photo-1513635269975-59663e0ac1ad", "photo-1529260830199-42c24126f198"],
    warm: ["photo-1597212618440-806262de4f6b", "photo-1533104816931-20fa691ff6ca", "photo-1533669955142-6a73332af4db"],
    home: ["photo-1556911220-bff31c812dba", "photo-1522771739844-6a9f6d5f14af", "photo-1493663284031-b7e3aefcae8e"]
  };

  const world = (name, eyebrow, intro, gallery, moments, palette) => ({
    name, eyebrow, intro, palette,
    photos: gallery.map(item => String(item).startsWith("http") ? item : photo(item)),
    moments
  });

  const worlds = [
    world("The First Airport Hug", "where distance finally loses", "The doors slide open and every rehearsed sentence disappears. There is only you, me, the dropped bag, and the kind of hug that makes a whole year of waiting leave the body at once.", romanticGallery(null, "airport,reunion,hug", 250), [
      ["The sighting", "I find you in the crowd and forget how walking normally works. You smile, I laugh from pure disbelief, and the room becomes background."],
      ["The hug", "No polite little greeting. I hold you until both of us stop feeling like people who live inside a screen."],
      ["The first drive", "Your hand stays in mine between the seats. We keep looking at each other because being real is still surprising."],
      ["The first ordinary hour", "We buy water, argue about snacks, and discover that even airport traffic feels romantic when goodbye is not waiting at the end of it."]
    ], "rose"),
    world("Santorini in Lilac Light", "white walls, lavender sky", "We wake where the sea holds every shade of blue, but sunset belongs to lilac. I take too many pictures of you, then put the phone away because no photograph can keep the way you look when the light turns soft.", romanticGallery("photo-1533105079780-92b9be482077", "santorini,sunset", 260), [
      ["Cliffside breakfast", "Warm bread, fruit, coffee, and your sleepy face across a tiny table above the water."],
      ["The wandering hour", "We follow narrow white lanes with no map, choosing every turn by whichever doorway has the prettiest flowers."],
      ["A dress for sunset", "You wear something that moves in the wind. I spend the whole evening pretending the sky is what has me speechless."],
      ["Midnight balcony", "Bare feet, one blanket, and the sound of the sea below us while we talk about the life waiting after the holiday."]
    ], "lilac"),
    world("Maldives, No Schedule", "a room floating on water", "Here the day has no sharp edges. The floor is warm, the water is clear, and time is measured by swims, fruit, naps, kisses, and whether your hair is still wet.", romanticGallery("photo-1514282401047-d79a71a590e8", "maldives,beach", 270), [
      ["Water-villa morning", "We open the curtains and the ocean is already at the door. You step outside before breakfast because waiting would be ridiculous."],
      ["The slow swim", "No race and nowhere to reach. We float beside each other, fingers touching whenever the water drifts us apart."],
      ["Dinner on the sand", "Lanterns, bare feet, and a table close enough to the tide that the sea keeps trying to join us."],
      ["Stars with no city", "We lie outside after midnight and choose constellations badly. I name one Moonpie and refuse correction."]
    ], "pearl"),
    world("Paris After Midnight", "the city when it whispers", "Not rushed Paris. Ours begins after dinner, when the streets shine from rain and the city becomes quiet enough for our footsteps to sound like part of the music.", romanticGallery("photo-1502602898657-3e91760cbb34", "paris,eiffel", 280), [
      ["The tiny cafe", "You choose the prettier pastry. I claim I only want one bite and immediately become a liar."],
      ["A bridge at midnight", "We stop above the river without needing a reason. The lights shake on the water and I kiss your forehead slowly."],
      ["The tower sparkles", "I watch your face instead. Paris has had enough attention; this moment belongs to you."],
      ["Walking home", "Our hands are cold, our feet hurt, and neither of us wants a taxi because the walk is still part of the date."]
    ], "blush"),
    world("Kyoto Blossom Rain", "petals in your hair", "Spring keeps letting go of pink petals around us. We walk beneath old trees, speak more quietly without deciding to, and keep finding small beautiful things tucked beside the path.", romanticGallery("photo-1528360983277-13d401cdc186", "kyoto,cherry-blossom", 290), [
      ["Temple morning", "We arrive before the crowds. Bells sound somewhere beyond the trees and your hand finds mine inside my coat pocket."],
      ["Tea for two", "We sit by a paper window while steam curls between us. You taste mine. I knew you would."],
      ["Petal weather", "A gust fills the path with blossoms. I brush one from your hair and leave the prettiest one there."],
      ["Lantern evening", "The lanes glow gold after dark. We walk slowly because the night deserves our full attention."]
    ], "petal"),
    world("Zanzibar Barefoot Morning", "salt, spice, and sunlight", "The morning starts with the sea and ends somewhere inside a market full of color. Everything is warm: the sand, the bread, the air, and your shoulder against mine.", romanticGallery("photo-1507525428034-b723cf961d3e", "zanzibar,beach", 300), [
      ["Sunrise feet", "We walk where the water keeps erasing our footprints, leaving only the ones we are still making."],
      ["Spice market", "We smell everything, buy too much fruit, and choose a tiny gift that will always mean this day."],
      ["Dhow at dusk", "The sail catches the last light while the island becomes a line behind us. You lean into me when the wind rises."],
      ["Rooftop dinner", "Music drifts up from the street. We share grilled seafood and keep stealing from each other's plates."]
    ], "coral"),
    world("The Swiss Window Seat", "mountains passing like cinema", "We take the slow train on purpose. Snow, lakes, villages, and green valleys move past the glass while your head rests on my shoulder and our snacks slowly disappear.", romanticGallery("photo-1530122037265-a5f1f91d3b99", "switzerland,train,mountains", 310), [
      ["Window-seat treaty", "You get the window. I get the privilege of watching your face change every time the view becomes impossible."],
      ["A small mountain town", "We get off without a plan, find hot chocolate, and walk until our cheeks are cold."],
      ["The quiet carriage", "You fall asleep for twenty minutes. I stay still even when my arm complains because this is exactly where I want you."],
      ["Lake evening", "The mountains turn violet in the water. We sit on the edge of the dock and say almost nothing."]
    ], "mist"),
    world("New York Winter Lights", "cold hands, warm city", "The city moves fast, so we make our own slow pocket inside it. Your scarf is too cute, my hand is your heater, and every window is dressed like it knew you were coming.", romanticGallery("photo-1522083165195-3424ed129620", "new-york,winter", 320), [
      ["Coffee rescue", "We step into the first warm cafe we see, thaw our fingers around cups, and draw tiny hearts in the fogged window."],
      ["Bookstore hiding", "We choose one book for each other and write secret notes inside the covers."],
      ["Lights after dark", "The whole avenue glows. You look up, and I get the ridiculous feeling the city did all this for your birthday."],
      ["Late-night pizza", "Fancy plans end with us laughing over a slice that is too hot. Perfect."]
    ], "winter"),
    world("Bali Hidden Garden", "green doors and flower baths", "We disappear behind carved doors into a garden that feels invented. Water runs over stone, flowers float everywhere, and the morning smells like rain and frangipani.", romanticGallery("photo-1533669955142-6a73332af4db", "bali,flower-bath", 330), [
      ["Breakfast among leaves", "Fruit, warm pancakes, and birds that sound like they have been hired for atmosphere."],
      ["The flower bath", "Lilies and rose petals drift around you. I sit nearby and wonder how the room is coping with this much beauty."],
      ["Scooter road", "We move through rice fields slowly, stopping whenever the view asks us to."],
      ["Rain on the roof", "A tropical shower keeps us inside. We make tea and let the day become softer than planned."]
    ], "leaf"),
    world("Cappadocia Before Sunrise", "balloons above the quiet", "We wake while the world is still dark, wrap ourselves in layers, and climb to the roof. Then color begins lifting into the sky, one balloon at a time.", romanticGallery("photo-1528181304800-259b08848526", "cappadocia,balloons", 340), [
      ["The 4:30 alarm", "We complain together, dress badly, and become instantly awake when the first balloon flame glows in the valley."],
      ["The sky fills", "Hundreds rise in the pink morning. I stand behind you with my arms around your waist so we can watch as one shape."],
      ["Breakfast after wonder", "Warm bread tastes better after seeing something impossible."],
      ["Cave-room nap", "We return under thick blankets and sleep until the day forgives the early alarm."]
    ], "sunrise"),
    world("Venice After Rain", "reflections under every bridge", "Rain empties the lanes and polishes the stone. The city becomes silver, lilac, and gold, with little boats cutting through reflections that look painted.", romanticGallery("photo-1523906834658-6e24ef2386f9", "venice,gondola", 350), [
      ["One shared umbrella", "It is technically too small. That is fine. It keeps us close and gives us an excuse to laugh at our wet shoulders."],
      ["Getting beautifully lost", "Every alley seems wrong until it opens beside water. Then it was obviously the right one."],
      ["A quiet gondola", "No performance. Just the sound of the oar, rain dripping from balconies, and you leaning back against me."],
      ["Tiramisu verdict", "We order one to share and immediately regret not ordering two."]
    ], "rain"),
    world("Nairobi, Our Date Day", "a whole day close to home", "Not every dream needs a passport. We make a full little holiday out of the city: flowers, food, music, a long drive, and the relief of finally being in the same place.", romanticGallery("photo-1611348586804-61bf6c080437", "nairobi,date", 360), [
      ["Flowers first", "I arrive with lilies because beginning any other way would feel incorrect."],
      ["Lunch that takes hours", "We order slowly, talk through every course, and let the waiter wonder if we plan to move in."],
      ["Golden-hour drive", "Windows down, your playlist on, the city changing color around us."],
      ["No rushed goodbye", "We sit a little longer after arriving because I promised myself our real days would not feel like countdowns."]
    ], "homegold"),
    world("Seychelles Secret Cove", "granite, lilies, clear water", "We find a small curve of beach between smooth rocks and claim it for the afternoon. The water is glassy, the shade is cool, and nobody needs anything from us.", romanticGallery("photo-1540202404-a2f29016b523", "seychelles,beach", 370), [
      ["The hidden path", "We carry a towel, fruit, and too much excitement through palms until the water appears."],
      ["A private picnic", "Mango, cold drinks, sandwiches, and sand absolutely everywhere."],
      ["Reading beside you", "We each open a book, read three pages, then start talking again because silence with you is never an obligation."],
      ["Last swim", "We say one more five times. The sun lowers and the water turns lavender."]
    ], "shell"),
    world("London Bookshop Rain", "stories, tea, and your hand", "Rain gives us permission to spend the day indoors. We move from bookshop to cafe to museum, carrying one umbrella and a growing stack of things we chose for each other.", romanticGallery("photo-1513635269975-59663e0ac1ad", "london,bookshop,rain", 380), [
      ["The note in the book", "I slip a sentence onto the title page before giving it to you: read this whenever you need another voice beside mine."],
      ["Afternoon tea", "Tiny sandwiches become an event. You choose the prettiest cake and I support this excellent decision."],
      ["Museum wandering", "We pick our favorite painting in every room and invent stories for the people inside them."],
      ["Rainy bus window", "Upstairs, front seat, city lights on wet glass, your head tucked against me."]
    ], "book"),
    world("Rome at Golden Hour", "warm stone and slow evenings", "Rome feels sunlit even after the sun leaves. We walk between fountains and old walls, stopping for photographs, cold drinks, and kisses in streets that have seen every kind of love.", romanticGallery("photo-1552832230-c0197dd311b5", "rome,golden-hour", 390), [
      ["Morning espresso", "You make a face at how small the cup is. I make a face at how quickly you steal a sip of mine."],
      ["A coin and a wish", "We each make one at the fountain and refuse to say it. I suspect both wishes contain the same two people."],
      ["Pasta lesson", "Flour everywhere, serious concentration, and one shape that looks nothing like the teacher's."],
      ["Steps after sunset", "We sit while the city glows below, tired in the happiest possible way."]
    ], "terracotta"),
    world("Northern Lights Cabin", "the sky learning magic", "Outside is snow and impossible color. Inside is warm wood, thick socks, soup on the stove, and a window wide enough to let the entire sky join us.", romanticGallery("photo-1483347756197-71ef80e95f73", "northern-lights,cabin", 400), [
      ["Cabin afternoon", "We cook badly, dance in socks, and keep checking the sky like impatient children."],
      ["The first green ribbon", "You call my name from the window. We run outside without enough layers because wonder has terrible planning skills."],
      ["Under one blanket", "The lights move above us while I hold you from behind and try to remember every second accurately."],
      ["Firelight after", "Back inside, cheeks cold, hands warm, both of us too awake to sleep."]
    ], "aurora"),
    world("Marrakech Lantern Night", "rose walls and amber light", "The city is color layered over sound. We wander through courtyards, tiled rooms, spice stalls, and rooftop lanterns until the night feels like a story told just to us.", romanticGallery("photo-1597212618440-806262de4f6b", "marrakech,lanterns", 410), [
      ["Courtyard morning", "Orange juice, patterned tiles, a fountain, and sunlight moving slowly across the walls."],
      ["Choosing a keepsake", "We search the market for one small object that will sit in our future home and remember this day for us."],
      ["Rooftop sunset", "The call to prayer moves through the city while the sky turns dusty pink."],
      ["Lantern dinner", "Warm bread, shared plates, cinnamon, candlelight, and your face glowing across the table."]
    ], "amber"),
    world("Amalfi Lemon Afternoon", "sunlight the color of joy", "The road curls above the sea and every balcony grows flowers. We spend the afternoon between lemon trees, striped umbrellas, cold drinks, and views that keep interrupting our conversation.", romanticGallery("photo-1533104816931-20fa691ff6ca", "amalfi,lemon,coast", 420), [
      ["The coastal drive", "I pretend to focus on the road while you keep pointing out views that deserve immediate stopping."],
      ["Lemon garden lunch", "Pasta, lemonade, shade, and the kind of long meal that resets a whole nervous system."],
      ["The swimming stairs", "We descend too many steps, jump into clear water, and agree the climb back can be future-us's problem."],
      ["Balcony music", "At night we leave the doors open, play something soft, and sway more than dance."]
    ], "lemon"),
    world("Our Tiny Kitchen", "the destination called ordinary", "This one matters as much as every passport stamp. It is our kitchen, our mugs, your things beside mine, and the quiet miracle of not needing a call to share the same room.", romanticGallery("photo-1556911220-bff31c812dba", "couple,cooking,kitchen", 430), [
      ["Sleepy coffee", "You appear wrapped in something soft while I am halfway through making your drink exactly how you like it."],
      ["Dinner experiment", "We choose a recipe, ignore one instruction, make a mess, and eat it proudly anyway."],
      ["Music between chores", "A song catches us while the dishes wait. We dance for one minute and let the water run."],
      ["The refrigerator evidence", "Photos, tiny notes, a shopping list, and proof everywhere that two lives have learned to overlap."]
    ], "cream"),
    world("The Sunday Bedroom Fort", "rain outside, us inside", "Blankets become walls, pillows become architecture, and Sunday becomes a country with only two citizens. Nothing impressive happens. That is why I want it so much.", romanticGallery("photo-1522771739844-6a9f6d5f14af", "couple,cozy,bedroom", 440), [
      ["Fort construction", "We take it far too seriously and disagree about structural pillow placement."],
      ["The snack delivery", "Everything arrives on one tray because leaving the fort repeatedly would violate its laws."],
      ["A movie we barely watch", "We pause to talk, rewind, get distracted, and eventually accept that the plot is not the point."],
      ["Falling asleep nearby", "No countdown to hang up. No screen going dark. Just your breathing changing while I am still there."]
    ], "cloud"),
    world("Twenty-Fifth of February", "our date, made into a place", "Imagine a world where the calendar always reads 25 February. Lilies bloom in every doorway, the sky stays tender, and every path leads back to the moment we chose to call ours.", romanticGallery("photo-1490750967868-88aa4486c946", "anniversary,lilies,couple", 450), [
      ["The anniversary garden", "We plant one lily for every year and leave room for the years still coming."],
      ["Letters at noon", "We exchange one page each: what I loved this year, what I learned about you, what I promise next."],
      ["The same song", "We play one song that belongs to us and let memory fill in the parts no recording holds."],
      ["The next-year wish", "Before midnight we each name one ordinary thing we want to be doing together by the next 25 February."]
    ], "anniversary")
  ];

  const poems = [
    ["Instructions for Missing Me", "Free verse", `When the room becomes too large,\ndo not argue with the ache.\nGive it a chair.\nLet it sit beside you.\n\nPut one hand where your heartbeat\nkeeps doing its faithful little work.\nThat rhythm has crossed every mile\nwithout asking permission.\n\nOpen the window if the night is gentle.\nSay my name once, quietly.\nNot because distance is magic,\nbut because love is a kind of listening.\n\nThen breathe in for four.\nHold for the length of one forehead kiss.\nBreathe out until your shoulders remember\nthey were never meant to carry everything.\n\nI am not in the room, my love,\nbut I have left tenderness everywhere:\nin this page, in tomorrow,\nin the next hello already walking toward you.`],
    ["Sonnet for an Ordinary Morning", "Fourteen-line sonnet", `I do not only want the postcard view,\nthe ocean suite, the lanterns, or the flight.\nI want the kettle waking next to you,\nyour sleepy protest at the morning light.\n\nI want the shopping list upon the door,\nthe socks that somehow wander from their pair,\nthe question of what we are eating for\na dinner made more slowly because you are there.\n\nLet other poems ask the stars to move.\nMy grandest dream is smaller, warm, and near:\na thousand common mornings used to prove\nthat home is simply any place you appear.\n\nIf forever needs a shape that I can see,\nlet it be breakfast, you across from me.`],
    ["Villanelle for the Miles Between", "Villanelle", `The miles can count themselves; I will count you.\nThe calls, the laughs, the nights we did not leave.\nNo map has ever known what love can do.\n\nThe evening joins us, lilac and blue,\nand every quiet hour asks me to believe.\nThe miles can count themselves; I will count you.\n\nA screen goes dark, but what we said stays true.\nI keep your sweetness close, my babyy, and breathe.\nNo map has ever known what love can do.\n\nI build our future out of things we knew:\nyour voice, my name, the tenderness we weave.\nThe miles can count themselves; I will count you.\n\nOne day an airport door will let us through,\nand I will hold the girl I never want to leave.\nNo map has ever known what love can do.\n\nUntil that day, when missing fills the view,\nremember how completely I choose you and believe.\nThe miles can count themselves; I will count you.\nNo map has ever known what love can do.`],
    ["Moonpie, in Five Small Rooms", "Sequence", `I. THE CALL\nYour hello opens a door\nand I walk through smiling,\nalready happier because it is you.\n\nII. THE LAUGH\nA bright thing escapes you.\nMy whole day turns its face\ntoward the girl I love.\n\nIII. THE SILENCE\nNeither of us speaks.\nStill, I feel close to you,\nmy babyy resting beside my heart.\n\nIV. THE GOODNIGHT\nWe stretch one minute\nuntil it almost becomes forever,\nbecause neither of us wants to leave.\n\nV. THE MORNING\nI wake and find you\nalready waiting in my first thought,\nmy sweetest habit, my Moonpie.`],
    ["Prose Poem with a Kitchen Light", "Prose poem", `One day there will be a kitchen light we forget to turn off. It will spill under the doorway while we lie in bed discussing something that could have waited until morning. There will be two cups in the sink, one chair holding your clothes, music paused halfway through a song, and no airport between us. I will know which silence means you are tired and which means come closer. You will know I am listening even when I am searching for the right words. Nothing about the room will look miraculous to anyone else. That will be the miracle. Love will have stopped visiting and started living there.`],
    ["A Ghazal of Your Name", "Ghazal-inspired couplets", `Every soft place in me answers to your name.\nEven the moon turns when the night says your name.\n\nI have tried calling distance a temporary thing,\nbut my hands become impatient and write your name.\n\nThe future sends postcards with no return address:\na kitchen, an airport, a door marked with your name.\n\nIf sorrow arrives, let it find us holding steady.\nThere is shelter in the loving way I say your name.\n\nMy babyy, if the whole sky asks what prayer I repeat:\nonly you, only my Moonpie, only Michelle, your name.`],
    ["Twenty-Fifth", "Anniversary poem", `February kept one day\nand wrapped it gently in lilac.\n\nThe twenty-fifth arrived\nwith ordinary hours,\nyet somehow every clock\nlearned the shape of us.\n\nNow I carry that date\nlike a pressed pink flower:\ndelicate and beautiful,\nstrong enough to survive\nevery page that follows.\n\nYears from now\nI want to open the calendar,\nfind our small number waiting,\nand kiss my beautiful girl\nnot through a screen,\nnot through a wish,\nbut in the warm, lived-in air\nof the life we kept choosing.`],
    ["Lily Theology", "Lyrical ode", `I think lilies know something\nabout becoming visible.\n\nThey begin as a closed sentence,\na green promise held tightly,\nthen loosen one pale petal\nafter another\nuntil the whole room understands.\n\nThat is how I have loved you.\nNot all at once, perhaps,\nbut more honestly each day.\n\nA new tenderness opening.\nA new future showing its color.\nA new part of me saying,\nhere, take the light I was saving.\n\nIf I could send you a field,\nevery lily would lean your way.`],
    ["After the Call Ends", "Blank verse", `The room returns too quickly after us.\nA little screen goes dark. The walls remember\nthey are only walls. I hear the quiet\ncollecting all the places you had filled.\n\nBut love is not the call. It is the warmth\nthat stays behind, the sentence I replay,\nthe way I carry your unfinished laugh\ninto the next small duty of my day.\n\nI miss you, yes. I will not make it small.\nYet missing is not emptiness alone.\nIt is the outline made by something present,\nthe proof my heart has learned another home.`],
    ["The Future Uses Your Voice", "Love letter poem", `When I imagine tomorrow,\nit does not arrive silently.\n\nIt sounds like you\ncalling for me from another room,\nand me answering too quickly\nbecause I still love hearing that you need me.\n\nIt sounds like music on a Sunday,\nwater running in the kitchen,\nyour laugh interrupting my complaint,\nmy name made sweeter by your sleepy voice.\n\nI thought music was my favorite sound.\nThen I heard you, babyy.\nNow every future room I dream of\nis waiting to be filled with your voice.`],
    ["Small Astronomy", "Constellation poem", `There are stars we see\nlong after their light begins traveling.\n\nPerhaps love is also this:\nsomething bright crossing distance,\narriving faithfully\nafter the moment that made it.\n\nSo when a message from me\nfinds you late at night,\nknow it began earlier:\nin a thought while walking,\nin a smile at my phone,\nin the sudden wish\nto tell you everything.\n\nYou are not waiting in darkness.\nYou are standing where my light arrives.`],
    ["Birthday Benediction", "Blessing", `May this year be gentle with your softness\nand generous with your beautiful heart.\n\nMay doors open without making you beg.\nMay rest find you before exhaustion does.\nMay every mirror tell the truth:\nyou are gorgeous, precious, and deeply loved.\n\nMay your dreams become addresses,\nkeys, tickets, mornings,\nand photographs of us that we can touch.\n\nMay you never mistake a difficult day\nfor a difficult life.\nMay you always know exactly where my love is,\nwrapped around you, calling you babyy.\n\nAnd when the candles become smoke,\nmay the wish you keep secret\nalready be running toward you,\njust as I am.`]
  ];

  const extraLetters = [
    { title: "For the Day You Feel Too Much", tab: "open when it all spills over", theme: "safe", preview: "A full letter for the moments when your feelings arrive faster than words.", salutation: "My sweet girl,", body: [
      "If today made everything feel too close to the surface, you do not have to tidy yourself before coming to me. You do not need a perfect explanation. You can arrive confused, tired, quiet, tearful, clingy, or angry. I would rather meet the honest version of your heart than a polished version that had to suffer alone.",
      "Feelings are not evidence that you are difficult to love. They are messages from a part of you asking to be noticed. Sometimes the message is I am tired. Sometimes it is I need reassurance. Sometimes it is simply please stay near me while this passes. None of those requests make you too much.",
      "I may not always know the exact sentence that fixes the moment. I do know how I want to respond. I want to listen before defending, understand before solving, and make room before asking you to become smaller. Love should not punish honesty.",
      "So breathe, Moonpie. Tell me one piece at a time. If words will not come, send me a dot, a heart, a voice note with silence in it. I will know you are reaching. I will reach back.",
      "You are allowed to have weather. I am not only here for your sunny days."
    ], closing: "Come as you are. I love the whole sky." },
    { title: "What I Mean When I Say Forever", tab: "not a dramatic word", theme: "kitchen", preview: "Forever translated into groceries, patience, repair, and ordinary choosing.", salutation: "Moonpie,", body: [
      "When I say forever, I do not mean one endless romantic moment. I mean thousands of changing moments, some beautiful, some boring, some difficult, and the decision to keep treating what we have as precious inside all of them.",
      "I mean learning how you need to be spoken to when you are hurt. I mean apologizing without trying to win. I mean remembering what makes your mornings easier, which food comforts you, when you need advice, and when advice is the last thing you want.",
      "I mean practical love. Flights booked. Calls returned. Plans made. Promises supported by calendars and effort. I want our love to have hands and feet, not only beautiful sentences.",
      "I also mean laughter in the middle of responsibility. Dancing while dinner cooks. Sending you a ridiculous picture from the next room. Keeping our private language alive even when life gets busy.",
      "Forever is not something I expect time to build for us. It is something I want to build with you, one honest day at a time."
    ], closing: "My favorite long-term plan is still you." },
    { title: "For Your Quiet Achievements", tab: "I saw that too", theme: "stars", preview: "For the wins nobody clapped for loudly enough.", salutation: "My brilliant girl,", body: [
      "I want to celebrate the things that do not come with certificates. The day you got up even though your heart felt heavy. The conversation you handled with more grace than anyone noticed. The boundary you tried to set. The task you finished while carrying ten invisible thoughts.",
      "I notice growth that does not photograph well. You pause where you once reacted. You keep going where you once doubted yourself. You choose softness without surrendering your strength. Those changes matter.",
      "Please do not wait for the world to announce that you are becoming someone remarkable. You already are. Progress is often quiet because it is happening inside the rooms where only you know how hard the work was.",
      "I am proud of your ambition, but I am also proud of your survival, your tenderness, your rest, and every small return to yourself.",
      "Tonight, let one achievement be enough. You do not have to turn your whole life around before you deserve to feel proud."
    ], closing: "I am clapping for the parts nobody saw." },
    { title: "Read This After an Argument", tab: "us before pride", theme: "voice", preview: "A promise to choose repair without pretending hurt never happened.", salutation: "My love,", body: [
      "If we have hurt each other, I do not want this letter to rush you past what you feel. Love is not pretending everything is fine because conflict is uncomfortable. Your hurt deserves to be understood, and mine deserves words that do not become weapons.",
      "What I want us to remember is that the problem is not automatically you and it is not automatically me. Often it is a misunderstanding, a fear, a tired moment, or an unmet need standing between us and making itself look bigger than our care.",
      "I want to come back when we are calmer. I want to say what I meant, hear what landed, apologize for what was careless, and change more than the wording. Repair should leave evidence.",
      "Even when I need space, I do not want space to feel like abandonment. Even when I disagree, I do not want disagreement to make you question whether you are loved.",
      "We can be imperfect and still be safe with each other. We can learn. We can return."
    ], closing: "I choose understanding over winning." },
    { title: "The Home I Want to Make with You", tab: "a room-by-room promise", theme: "lilies", preview: "Not only a house. A feeling built carefully around both of us.", salutation: "My future home,", body: [
      "I want our home to feel like exhaling. Not perfect, not always tidy, not untouched by stress, but safe enough that neither of us has to perform calmness to deserve kindness.",
      "I want flowers somewhere, even if they are in an old jar. I want photographs that are slightly crooked because we hung them ourselves. I want a kitchen that knows our late-night snacks and a couch that has learned the shape of us sitting too close.",
      "I want your dreams to have room there. A corner for your work, shelves for what you love, silence when you need it, music when you do not. I do not want you to fit inside my life. I want us to make a life that fits both of us.",
      "On difficult days, I want the door to mean you made it back to someone who is on your side. On ordinary days, I want us to notice how lucky ordinary has become.",
      "The address will matter less than the way we treat each other inside it."
    ], closing: "Where you are loved gently, there is home." },
    { title: "A Letter from Our Future", tab: "postmarked someday", theme: "airport", preview: "Written as if the waiting ended and future-us sent something back.", salutation: "Dear younger us,", body: [
      "You were right to keep going. I know some nights made the distance feel permanent. It was not. I am writing from the kitchen you kept imagining. Michelle is in the next room, humming without realizing it. There are two mugs on the counter.",
      "The airport hug was messier than planned. Someone cried first and neither of you remembers who. The first week together felt both new and strangely familiar, like stepping into a room you had visited in dreams.",
      "Not everything became easy. Real life brought schedules, misunderstandings, tiredness, and decisions. But you learned that closeness is not the absence of difficulty. It is having someone beside you while you face it.",
      "You still call her Moonpie. She still makes that little protest when you have to leave the room at the wrong moment. The ordinary life you wanted is here, and it is even better because you remember what it cost to reach.",
      "So make the next call. Send the honest message. Book what can be booked. Keep building the bridge."
    ], closing: "With love from the life you did not give up on." }
  ];

  const notices = [
    "How your voice becomes softer when you are almost asleep but still do not want the call to end.",
    "How beautiful, cute, sexy, hot, and completely amazing you are.",
    "How your real laugh arrives in layers and makes me feel like I have won the entire day.",
    "The tiny protest in your voice when I say I have to go. I hear the love inside it.",
    "How you remember details people mention once and make them feel quietly important later.",
    "The way your face changes when music reaches the exact part you were waiting for.",
    "How you can be soft without being weak, and strong without making softness disappear.",
    "The brave way you keep caring even after life has given you reasons to guard yourself.",
    "How your silence has different meanings, and how I keep wanting to learn each one correctly.",
    "The way you say my name when you miss me, when you are amused, and when you need reassurance. They are three different songs.",
    "How you try to make other people comfortable, even when you are the one who needs tenderness.",
    "The specific warmth you bring into a conversation just by deciding to stay a little longer.",
    "How your beautiful mind can turn one little thought into a whole universe, and how I love being invited into it.",
    "The softness hidden inside your stubbornness. You hold on hard to what matters.",
    "How you make future plans sound less like fantasy and more like directions we can follow.",
    "The way you listen for what I mean, not only what I manage to say.",
    "The pause before you say something vulnerable, as if your heart checks the room before stepping out.",
    "The way tiredness makes you honest and somehow even more precious to me.",
    "How you care in practical ways: checking, remembering, asking, returning.",
    "The little shift in your energy when something is wrong, even before you give it words.",
    "How you deserve flowers on ordinary days, not only dates printed in bold on a calendar.",
    "The way your joy makes me want to protect the moment without interrupting it.",
    "How you can turn a normal call into the part of the day I remember most.",
    "The questions you ask when you are genuinely curious, and the focus in your voice while you listen.",
    "How you keep pieces of our conversations and bring them back when I thought they had floated away.",
    "The version of you that needs extra reassurance. I do not love her less. I want to hold her closer.",
    "How I always want to remind you that you are the most amazing and most beautiful girl in this whole 12,756-kilometre-wide world.",
    "How you are smart, really funny, really cute, and simply the best person to be with.",
    "How even your complaints can become part of our private comedy.",
    "The fact that your presence makes waiting rooms, traffic, and quiet evenings feel like shared life.",
    "How you keep growing without becoming unrecognizable to the tender person you have always been.",
    "The way you deserve to be chosen clearly, not left guessing at the edges of someone's effort.",
    "How your birthday feels important to me because the world had to make you before I could love you.",
    "The expressions I have not seen in person yet and already cannot wait to memorize.",
    "How your hand will fit inside mine for the first time and somehow feel remembered.",
    "The calm that sometimes arrives simply because your name appeared on my screen.",
    "How you are allowed to change your mind, take your time, and still be worthy of patient love.",
    "The way your dreams deserve logistics, support, calendars, and somebody asking how they can help.",
    "How I still find new things to notice, which means loving you has no boring final chapter.",
    "You, without comparison. There is nobody else I am trying to turn you into."
  ];

  const reasons = [
    "Your real laugh changes the temperature of my whole day.", "You make ordinary conversations feel worth remembering.", "Your kindness is practical, not performative.", "You listen for what I mean, not only what I say.", "Your sleepy voice feels like being trusted.",
    "You keep choosing softness without surrendering your strength.", "You remember tiny details and return them as care.", "Your eyes become gentler when you are happy.", "You make me want to speak more honestly.", "You can make a screen feel briefly like a room we share.",
    "You are curious in a way that makes the world feel larger.", "You care about doing things well because your heart is sincere.", "You have a quiet resilience that deserves more credit.", "Your sense of humor finds light without denying what is hard.", "You make future plans sound possible.",
    "You let me see the unpolished parts of you.", "You make reassurance feel like a language worth learning.", "Your stubbornness protects the things you love.", "You are beautiful when you forget anyone might be looking.", "You make my name sound different from everyone else.",
    "You bring warmth into places without asking for attention.", "You are thoughtful about people who may never know how much thought you gave them.", "You make me want to build, not only promise.", "You can be playful and profound inside the same conversation.", "You make silence feel accompanied.",
    "Your birthday matters because it began every version of you I get to love.", "You make distance feel temporary even when it is painful.", "You are not afraid to dream beyond what is immediately available.", "You keep growing while remaining tender.", "You have a voice I could recognize in any room.",
    "You make me look forward to ordinary mornings.", "You are worth planning flights, dates, and futures around.", "You make care feel specific instead of vague.", "You challenge me to become gentler and clearer.", "You deserve flowers, and loving you makes me want to keep bringing them.",
    "You make late nights feel shorter.", "You have survived things without letting them define every room in you.", "You know how to make small joy feel important.", "You make me want to celebrate your quiet wins.", "You are still yourself in a world that keeps asking people to perform.",
    "You make home feel like a person before it becomes a place.", "You trust me with feelings that deserve careful hands.", "You can make one hello repair a difficult hour.", "You make me curious about the life we have not lived yet.", "You are the person I want to tell good news first.",
    "You are also the person I want beside me when the news is hard.", "You make tenderness feel brave.", "You make me understand why people write letters.", "You are worth slowing down for.", "You make my imagination keep building rooms with two cups in them.",
    "You have a softness that is yours, not something the world gave permission for.", "You make me want to remember dates and details correctly.", "You can be clingy with me; I love being wanted by you.", "You make affection feel natural, not rehearsed.", "You are honest in the moments that matter.",
    "You make me want to repair quickly instead of protecting my pride.", "You have dreams I want to support with real effort.", "You make laughter show up in serious days.", "You make me want photographs and also moments too good to interrupt for one.", "You carry love in your questions.",
    "You make the future kitchen feel as exciting as any island.", "You deserve to wake without wondering whether you are chosen.", "You make my phone feel less like a device and more like a doorway.", "You have expressions I cannot wait to learn in person.", "You make me want to hold a hug longer than socially reasonable.",
    "You are patient with the process of us.", "You make waiting difficult because the destination matters so much.", "You have a way of becoming my first thought without trying.", "You make goodnight feel like a promise to return.", "You care even when you are tired.",
    "You notice when my energy changes too.", "You make mutual understanding feel possible.", "You can be dramatic with me; I love the evidence that you care.", "You make me want to protect joy, not control it.", "You are allowed to need, and I want to be someone safe to need.",
    "You make ordinary language fail in interesting ways.", "You are the reason Moonpie became my favorite word.", "You make anniversaries feel like little countries we invented.", "You deserve a love with follow-through.", "You make me want to turn paragraphs into plane tickets.",
    "You can change your mind and still remain deeply lovable.", "You make me want to ask better questions.", "You have a heart worth understanding slowly.", "You make distance reveal how much presence matters.", "You turn missing into proof that something beautiful is here.",
    "You make me want to know your routines, not only your highlights.", "You are someone I want beside me while doing separate things.", "You make sharing food, blankets, and time sound sacred.", "You deserve to be loved on the days you do not feel impressive.", "You make me want to bring calm, not confusion.",
    "You are not interchangeable with anybody.", "You make me want to be proud of us in public and careful with us in private.", "You have a future I want to witness up close.", "You make me believe a long distance can still lead somewhere real.", "You are my favorite person to imagine coming home to.",
    "You make love feel like attention.", "You make attention feel like devotion.", "You make devotion feel like daily practice.", "You are the person this whole little universe was built to hold.", "You are you, and that remains the reason underneath every other reason."
  ];

  const memories = [
    ["The first safe feeling", "It was not dramatic. I simply noticed that I could speak without arranging every sentence first. Something in me unclenched around you, and I wanted to stay there."],
    ["The calls that ran late", "We kept finding one more thing to say. Neither of us wanted to be responsible for ending the small room our voices had made."],
    ["The little protests", "That soft no when I have to go carries more tenderness than a perfect speech. It tells me my presence has weight in your day."],
    ["The future conversations", "We speak about kitchens, flights, mornings, and visits with enough detail that the future already has furniture."],
    ["The private language", "Moonpie. Princess. Babyy. Small names that became doors into a place only we know how to enter."],
    ["The first difficult honesty", "The moment we stopped trying to look effortless and chose truth instead. Love became less polished and more real."],
    ["The reassurance loops", "The times one of us needed to hear the same thing again. Repetition did not make the love less true; it made patience visible."],
    ["Songs becoming ours", "A track starts as someone else's music, then one late call changes it. Now the first notes carry a whole room back to me."],
    ["The sleepy goodnights", "Words becoming slower, voices becoming softer, both of us stretching the ending because tomorrow felt too far away."],
    ["The screenshots I keep", "Tiny pieces of conversation that would look ordinary to anyone else. To me they are evidence of us becoming us."],
    ["The day 2502 became a key", "A date became more than numbers. It became a way back into our story, a small code that says this belongs to us."],
    ["The first imagined airport", "Before any ticket, we had already pictured the doors, the searching crowd, and the hug. Hope rehearsed the scene for us."],
    ["The ordinary check-ins", "Did you eat? Are you home? How are you really? Love wearing practical clothes and showing up without needing applause."],
    ["The moments you stayed", "Not every important memory is a grand event. Some are simply the times leaving would have been easier and you stayed present."],
    ["This little universe", "A collection of code, flowers, words, and impossible intentions, all trying to become one simple thing: somewhere you can feel my care when I am far away."]
  ];

  const handMessages = [
    ["I felt you reach for me.", "Keep holding. Match the slow pulse under your thumb. For this minute, there is nowhere else you need to be."],
    ["Come closer, Moonpie.", "Imagine my palm against yours and my other hand around your shoulders. Let your jaw soften. I am listening."],
    ["You do not have to explain yet.", "Hold first. Breathe first. Words can arrive after your body remembers it is safe to be cared for."],
    ["Here is the truth, clearly.", "I love you. I am not disappearing. A quiet phone is not an empty heart. You are still held in my day."],
    ["Borrow my calm.", "Inhale slowly. Keep the air for one second. Exhale like you are setting down something heavy in my hands."],
    ["The distance did not win today.", "You reached across it and found me here. Every reach is part of the bridge we are building."],
    ["Stay for three heartbeats.", "One for where we began. One for where we are. One for the room where I finally get to hold your actual hand."],
    ["Nothing is required from you now.", "No brave face, no perfect reply, no immediate solution. Just be loved for a minute."],
    ["I would choose your hand in every crowd.", "At the airport, on a street, under a blanket, in our kitchen. My hand will keep learning where yours is."],
    ["You found the hidden hug.", "This is the part where I pull you in, kiss your forehead, and wait until your breathing changes."],
    ["I am on your side.", "Even when the day is confusing, even when we need to talk, even when feelings are messy. I want us against the problem."],
    ["One day this will not be pretend.", "You will reach sideways and find me. Until then, I will keep leaving pieces of my hand in places like this."]
  ];

  const songs = [
    ["Best Part", "Daniel Caesar feat. H.E.R.", "Because you are exactly that: the part my day keeps waiting for.", "1RMJOxR6GRPsBHL8qeC2ux"],
    ["Until I Found You", "Stephen Sanchez", "Big, old-fashioned devotion for the days subtlety is not invited.", "0T5iIrXA4p5GsubkhuBIKV"],
    ["Those Eyes", "New West", "For tiny gestures, private jokes, and the ordinary ways love proves itself.", "2psRActEWsTlYYd7EDoyVR"],
    ["Japanese Denim", "Daniel Caesar", "Warm silence, late calls, and the wish for more time in the same room.", "1boXOL0ua7N2iCOUVI1p9F"],
    ["Melting", "Kali Uchis", "For being dramatically, helplessly soft about you.", "2kSb3wYSOV996xA2NSmpck"],
    ["Still With You", "Jungkook", "A rainy-window song for presence that survives being apart.", "0eFMbKCRw8KByXyWBw8WO7"]
  ];

  const twentyWorlds = worlds.filter(item => item.name !== "New York Winter Lights");
  window.MOONPIE_EXPANSION = { worlds: twentyWorlds, poems, extraLetters, notices, reasons, memories, handMessages, songs };
})();
