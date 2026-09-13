# -*- coding: utf-8 -*-
"""
Source of truth for Our Worlds: every stop in every world, with the search
term used to find that stop its own photograph on Wikimedia Commons.

Seven stops per world instead of four, and a picture for each one, because
four paragraphs and two stock photos is a summary of a place, not a visit.

Run tools/fetch_world_images.py to (re)download the photography, then
tools/build_worlds.py to regenerate the worlds block in content.js.
"""

# slug: (name, eyebrow, intro, [(title, text, image query), ...])
WORLDS = {
"airport-hug": ("The First Airport Hug", "where distance finally loses",
 "The doors slide open and every rehearsed sentence disappears. There is only you, me, the dropped bag, and the kind of hug that makes a whole year of waiting leave the body at once.", [
  ("The last hour of waiting", "I get there early because of course I do. I check the arrivals board like it might change its mind about you.", "airport arrivals board departures"),
  ("The sighting", "I find you in the crowd and forget how walking normally works. You smile, I laugh from pure disbelief, and the room becomes background.", "airport arrivals hall crowd waiting"),
  ("The hug", "Bag hits the floor. Neither of us says anything useful for a while. Somebody probably films us. Let them.", "couple hugging airport reunion"),
  ("The first drive", "You take the passenger seat like it was always yours. Same playlist, but louder now that you are actually in the car.", "car passenger seat window driving evening"),
  ("The first ordinary hour", "We buy nothing important at a shop near mine. Watching you pick out snacks feels like a scene I waited a year for.", "small grocery shop aisle evening"),
  ("Putting your things down", "Your bag opens in my room and suddenly it is our room. Your things on my shelf. I keep looking at them.", "open suitcase bedroom floor"),
  ("The first night in", "No plans, no restaurant, nowhere to be. Just the lamp on and both of us talking until neither of us makes sense.", "cosy bedroom lamp night warm light"),
 ]),

"santorini": ("Santorini in Lilac Light", "white walls, lavender sky",
 "Whitewashed steps, a sea that never stops being blue, and a sunset that turns everything the colour of the inside of a shell. We move slowly here because there is nothing to be late for.", [
  ("Cliffside breakfast", "Fruit, strong coffee, and the whole caldera doing its thing below us. You take a photo of the view. I take one of you.", "Santorini breakfast terrace caldera view"),
  ("The blue domes", "We walk the lanes until we find the ones from every postcard, and they are somehow better in person.", "Santorini blue dome church Oia"),
  ("The wandering hour", "Narrow steps, cats asleep in doorways, no map open. We get pleasantly lost and call it exploring.", "Santorini narrow white alley steps"),
  ("A swim below the cliffs", "The water is colder than it looks and you shriek about it. Ten minutes later you refuse to get out.", "Santorini swimming sea cliffs Aegean"),
  ("A dress for sunset", "You change into the one that catches the light. I run out of vocabulary and just look at you instead.", "Santorini sunset Oia golden hour"),
  ("Dinner above the water", "A small table, too much food, and the sky going from gold to lilac behind your head.", "Greek taverna dinner table sea view evening"),
  ("Midnight balcony", "Everything quiet, one blanket between us, the sea black and moving somewhere down there.", "Santorini night lights caldera"),
 ]),

"maldives": ("Maldives, No Schedule", "a room floating on water",
 "Our room sits on stilts above water so clear it hardly looks real. There is nothing to do here, which is the entire point, and we get very good at it.", [
  ("Water-villa morning", "You open the door straight onto the sea. There are steps down from the deck and no reason not to use them.", "Maldives overwater villa deck steps"),
  ("Breakfast in the water", "Someone floats a tray of breakfast to us. It is ridiculous. We eat all of it.", "floating breakfast tray pool tropical"),
  ("The slow swim", "Warm water, no current, nowhere to swim to. We float and argue gently about nothing.", "turquoise lagoon shallow clear water"),
  ("Fish that ignore us", "Snorkels on. A whole city of fish below carrying on with its day, entirely unbothered by us.", "coral reef tropical fish snorkeling"),
  ("Dinner on the sand", "A table set right on the beach, lanterns pushed into the sand, waves close enough to hear between sentences.", "beach dinner table lanterns sand night"),
  ("Stars with no city", "No streetlights for a hundred miles. The sky is absurd. You go quiet, which is how I know it got you too.", "starry night sky ocean milky way"),
  ("Last swim before the flight", "One more, quickly, still in yesterday's clothes. We are late because of it and neither of us minds.", "tropical beach early morning empty"),
 ]),

"paris": ("Paris After Midnight", "the city when it whispers",
 "Not rushed Paris. Ours begins after dinner, when the streets shine from rain and the city becomes quiet enough for our footsteps to sound like part of the music.", [
  ("The tiny cafe", "You choose the prettier pastry. I claim I only want one bite and immediately become a liar.", "Paris cafe terrace evening"),
  ("A bridge at midnight", "We stop halfway across because you want to look at the water. The city keeps going without us.", "Paris bridge Seine night lights"),
  ("The tower sparkles", "On the hour it does the thing. You have seen it a hundred times online and still gasp. I love that about you.", "Eiffel Tower night illuminated"),
  ("The bookshop still open", "A yellow window at one in the morning. We go in for two minutes and stay for forty.", "Paris bookshop night window lit"),
  ("Streets after rain", "Everything doubled in the wet stone. You walk slower here without noticing you are doing it.", "Paris street wet cobblestones reflection night"),
  ("Walking home", "No taxi. We choose the long way on purpose and neither of us says why.", "Paris street lamp night empty boulevard"),
  ("The last métro we miss", "It goes without us while we are still deciding. Good. Now the night has to keep going.", "Paris metro station night platform"),
 ]),

"kyoto": ("Kyoto Blossom Rain", "petals in your hair",
 "Spring keeps letting go of pink petals around us. We walk beneath old trees, speak more quietly without deciding to, and keep finding small beautiful things tucked beside the path.", [
  ("Temple morning", "We arrive before the crowds. Bells sound somewhere beyond the trees and your hand finds mine inside my coat pocket.", "Kyoto temple morning mist"),
  ("The red gates", "A tunnel of them going up the hill, further than either of us expects. We climb further than we meant to.", "Fushimi Inari torii gates path"),
  ("Tea for two", "We sit by a paper window while steam curls between us. You taste mine. I knew you would.", "Japanese tea house tatami paper window"),
  ("Petal weather", "A gust fills the path with blossoms. I brush one from your hair and leave the prettiest one there.", "cherry blossom petals falling path Kyoto"),
  ("The bamboo hour", "Green light, wind in the tops, the sound of a place breathing. We stop talking for a while.", "Arashiyama bamboo grove path"),
  ("Lantern evening", "The lanes glow gold after dark. We walk slowly because the night deserves our full attention.", "Gion Kyoto lantern street night"),
  ("River, last light", "We sit on the bank with cold drinks and watch the light leave the water.", "Kamo river Kyoto evening riverbank"),
 ]),

"zanzibar": ("Zanzibar Barefoot Morning", "salt, spice, and sunlight",
 "Warm water, warmer air, and a coast that runs on its own time. Everything smells faintly of cloves and the sea, and shoes stop being relevant almost immediately.", [
  ("Sunrise feet", "The tide is far out. We walk on wet sand for what feels like a mile and the sun comes up the whole way.", "Zanzibar beach sunrise low tide"),
  ("Stone Town doors", "Carved wooden doors on every corner, each one older than both of us. You photograph nearly all of them.", "Stone Town Zanzibar carved wooden door"),
  ("Spice market", "You hold cardamom to my nose and I pretend to be an expert. We buy far too much of everything.", "spice market cloves cardamom stall"),
  ("The blue hour swim", "Bath-warm water and nobody else in it. We stay in until our fingers go strange.", "Indian Ocean turquoise shallow beach"),
  ("Dhow at dusk", "A wooden sail against an orange sky. We sit at the front and let the boat do the talking.", "dhow sailing boat sunset Zanzibar"),
  ("Rooftop dinner", "Grilled fish, lime, and the call to prayer drifting over the roofs while we eat.", "Stone Town rooftop restaurant evening"),
  ("Night on the sand", "Warm dark, no wind, the water still going in and out. We stay far later than we planned.", "beach night stars tropical sand"),
 ]),

"switzerland": ("The Swiss Window Seat", "mountains passing like cinema",
 "A slow red train, a window each, and the Alps unrolling outside like something rehearsed. Neither of us gets tired of it, which is the surprising part.", [
  ("Window-seat treaty", "We agree to swap every twenty minutes. Neither of us honours it. It works out anyway.", "train window seat mountain view"),
  ("The first tunnel", "Dark, then suddenly an entire valley. You make the same small sound every time and I wait for it.", "alpine valley from train window"),
  ("A small mountain town", "We get off somewhere unplanned because it looked pretty. It is. We eat there.", "Swiss mountain village chalets"),
  ("Lunch with a view", "Bread, cheese, something warm, and a mountain doing nothing dramatic outside the window.", "alpine restaurant terrace mountain lunch"),
  ("The quiet carriage", "You fall asleep on my shoulder somewhere after the lake. I do not move for forty minutes.", "train carriage interior quiet window light"),
  ("Lake evening", "Still water, mountains upside down in it, cold air that makes standing close a practical decision.", "Swiss lake reflection mountains evening"),
  ("Late arrival", "A small station, our breath visible, and nowhere to be until tomorrow.", "small train station night lights snow"),
 ]),

"bali": ("Bali Hidden Garden", "green doors and flower baths",
 "Everything is green and quietly alive. Water runs somewhere behind the walls, flowers keep turning up in unlikely places, and afternoons here last longer than they should.", [
  ("Breakfast among leaves", "Fruit we cannot identify, coffee we can, and the jungle doing its enormous green thing on all sides.", "Bali breakfast jungle villa terrace"),
  ("The flower bath", "Petals across the whole surface. You are delighted. I take the photo you pretend not to want.", "flower petal bath spa tropical"),
  ("The rice terraces", "Steps of green going down a whole hillside. We walk them badly, in the wrong shoes, laughing.", "Bali rice terraces Tegallalang green"),
  ("Scooter road", "Your arms around me, palm shadows flicking past, both of us going far too slowly to be cool.", "Bali countryside road palms scooter"),
  ("The water temple", "Cold spring water and something serious in the air. We stop being loud without discussing it.", "Bali water temple pool stone"),
  ("Rain on the roof", "It arrives all at once, the way it does here. We stay put and let it be loud.", "tropical rain jungle green downpour"),
  ("Fireflies after dinner", "The garden fills with small moving lights. You whisper for no reason. So do I.", "tropical garden night lanterns"),
 ]),

"cappadocia": ("Cappadocia Before Sunrise", "balloons above the quiet",
 "We get up in the dark for this, and it is worth every minute of the alarm. The valley fills with colour and then with balloons, and nobody speaks above a murmur.", [
  ("The 4:30 alarm", "You threaten violence. You get up anyway. Ten minutes later you are the one hurrying me.", "dark hotel room early morning window"),
  ("The valley in the dark", "Cold air, strange rock shapes, and the sky only just beginning to think about it.", "Cappadocia valley rock formations dawn"),
  ("The sky fills", "First one, then ten, then more than we can count. You hold my arm without looking away.", "Cappadocia hot air balloons sunrise"),
  ("Our own basket", "Off the ground before we are ready. You go completely silent, which from you means everything.", "hot air balloon basket flight above valley"),
  ("Breakfast after wonder", "Eggs, olives, bread, and neither of us able to fully stop grinning about what we just saw.", "Turkish breakfast spread table"),
  ("Cave-room nap", "Thick stone walls, cool dark, the whole day still ahead. We sleep for two hours and regret nothing.", "cave hotel room Cappadocia interior"),
  ("Sunset on the rocks", "Back out for the other end of the day, the whole valley going orange and pink.", "Cappadocia sunset rock valley viewpoint"),
 ]),

"venice": ("Venice After Rain", "reflections under every bridge",
 "The rain stops just as we arrive and the whole city turns into a mirror. Every bridge doubles, every lamp doubles, and getting lost stops being a problem to solve.", [
  ("One shared umbrella", "It is too small for two people. We use it anyway and both get half wet.", "Venice canal rain umbrella"),
  ("Getting beautifully lost", "The map gives up. We turn down whichever alley looks better and it always does.", "Venice narrow alley canal bridge"),
  ("Coffee standing up", "Like the locals, at a counter, quickly, for a fraction of the price. You approve of this system.", "Italian espresso bar counter"),
  ("A quiet gondola", "Touristy and we do not care. Under a low bridge you go quiet and hold my hand tighter.", "Venice gondola canal narrow"),
  ("The square at dusk", "Pigeons, orchestras competing from opposite cafes, and the light going pink on the water.", "St Marks Square Venice evening"),
  ("Tiramisu verdict", "We try it in three places to be scientific. You have strong opinions. I write them down.", "tiramisu dessert cafe table"),
  ("Last vaporetto", "The city sliding past on the water, cold air, your head on my shoulder.", "Venice grand canal night boat lights"),
 ]),

"kenya": ("Nairobi and Diani, Our Kenya Date", "candlelight in Nairobi, bare feet in Diani",
 "Home ground, done properly. A city evening that feels like an occasion, then a coast where nothing is required of us at all.", [
  ("Candlelit Nairobi", "A table booked for a Tuesday for no reason. You in that dress, and me forgetting most of my sentences.", "Nairobi restaurant candlelight dinner"),
  ("The road to Diani", "Windows down, playlist loud, the landscape changing from town to green to salt air.", "Kenya coastal road palms drive"),
  ("First sight of the water", "That specific blue that does not photograph properly. You stop walking when you see it.", "Diani beach white sand turquoise"),
  ("Two loungers, one view", "Books we do not read, drinks that sweat in the heat, hours that stop counting themselves.", "beach loungers palm shade ocean"),
  ("Fresh fish, no cutlery", "Grilled that morning, eaten with our hands at a plastic table. Best meal of the trip and we both know it.", "grilled fish coastal restaurant Kenya"),
  ("Barefoot after sunset", "Warm sand, cold water at the ankles, and the two of us walking much further than intended.", "beach walk sunset footprints sand"),
  ("Night drive back", "Windows down again, quieter now, your hand on my knee and nobody saying much.", "night road headlights driving"),
 ]),

"seychelles": ("Seychelles Secret Cove", "granite, lilies, clear water",
 "Enormous smooth boulders, water you can see straight through, and a beach that appears to have been left off every map on purpose.", [
  ("The hidden path", "A gap in the trees somebody told us about. Ten minutes of scrambling and then nobody else at all.", "jungle path to beach tropical"),
  ("The granite boulders", "Huge, warm from the sun, shaped like something poured rather than placed.", "Seychelles granite boulders beach Anse Source"),
  ("A private picnic", "Bread, cheese, mangoes, and sand in absolutely everything by the end of it.", "beach picnic blanket tropical"),
  ("Water like glass", "You can count your toes in three feet of it. We stand around in the shallows for an hour.", "clear turquoise shallow water beach"),
  ("Reading beside you", "Two books, no talking, your foot against mine. Somehow one of my favourite hours.", "reading book hammock beach shade"),
  ("Last swim", "The light goes gold and we go back in for one more, because leaving felt premature.", "tropical beach golden hour swim"),
  ("The walk back in the dark", "Phone torch, warm air, your hand because the path is uneven and also because.", "tropical path night torch"),
 ]),

"london": ("London Bookshop Rain", "stories, tea, and your hand",
 "Grey outside and warm inside. We duck into places to get out of the rain and end up staying much longer than the weather requires.", [
  ("The note in the book", "I hide one for you on a shelf in the poetry section. You find it faster than I planned.", "old bookshop shelves interior"),
  ("Second-hand stacks", "Towers of them, no discernible system, and the specific smell of old paper you like.", "second hand bookshop stacks books"),
  ("Afternoon tea", "Tiny sandwiches we make fun of and then finish entirely. You take the last scone. Fair enough.", "afternoon tea scones tiered stand"),
  ("Museum wandering", "Big quiet rooms, whispered opinions about paintings, and a bench we sit on for far too long.", "museum gallery interior visitors"),
  ("The rain gets serious", "We give up on the plan and stand in a doorway watching it come down.", "London street rain umbrellas"),
  ("A pub with a fire", "Corner table, something warm, coats steaming gently. Nowhere better to be.", "traditional English pub fireplace interior"),
  ("Rainy bus window", "Top deck, front seats, the whole city sliding past behind water on the glass.", "London double decker bus window rain night"),
 ]),

"rome": ("Rome at Golden Hour", "warm stone and slow evenings",
 "Everything here is the colour of honey by six in the evening. Old stone, small streets, and a city entirely unbothered by being this beautiful.", [
  ("Morning espresso", "Standing at the bar, one shot, thirty seconds, out again. You take to this immediately.", "Italian espresso bar morning Rome"),
  ("A coin and a wish", "Over the shoulder, eyes shut. You will not tell me what you wished for. I have theories.", "Trevi Fountain Rome"),
  ("Ruins at noon", "Two thousand years of stone and you asking better questions than the guide answers.", "Roman Forum ruins columns"),
  ("Pasta lesson", "Flour everywhere, dough behaving badly, and you laughing at my technique for a solid ten minutes.", "fresh pasta making hands flour"),
  ("Gelato, second one", "We said one. We are on our second. We will probably have a third.", "gelato cone Italian street"),
  ("Steps after sunset", "We sit on warm stone with everyone else and watch the sky do the pink thing over the roofs.", "Spanish Steps Rome evening people"),
  ("The long way to dinner", "Through three piazzas we did not need to cross, because you wanted to keep walking.", "Rome piazza evening golden light"),
 ]),

"aurora": ("Northern Lights Cabin", "the sky learning magic",
 "A small wooden cabin, snow to the windows, and a sky that might do something extraordinary tonight. We keep checking. It keeps making us wait.", [
  ("Cabin afternoon", "Firewood, thick socks, and the light already going at three in the afternoon.", "wooden cabin snow winter interior fire"),
  ("Snow walk", "Blue light, absolute silence, and the crunch of two sets of boots.", "snowy forest path winter blue hour"),
  ("The waiting game", "Hot drinks, one eye on the window, checking a forecast neither of us understands.", "cabin window snow night warm light"),
  ("The first green ribbon", "You see it before me and grab my arm hard enough to hurt. Worth it.", "aurora borealis northern lights green sky"),
  ("Under one blanket", "Outside, freezing, refusing to go in while the sky is still doing that.", "northern lights over snow landscape"),
  ("Firelight after", "Back inside, faces cold, hands wrapped around mugs, both slightly stunned.", "fireplace cabin interior warm night"),
  ("Morning, all white", "Snow on everything, sun low and pink on it, and nowhere at all we need to be.", "snowy landscape sunrise pink winter"),
 ]),

"marrakech": ("Marrakech Lantern Night", "rose walls and amber light",
 "Pink walls all day and amber light all evening. The city is loud in the best way, and our courtyard is completely silent the second the door shuts.", [
  ("Courtyard morning", "Mint tea, tiled floor, a fountain going quietly, and the whole city locked outside the door.", "riad courtyard Marrakech tiles fountain"),
  ("The souk", "Narrow, crowded, gorgeous, overwhelming. You navigate it better than I do.", "Marrakech souk market alley lanterns"),
  ("Choosing a keepsake", "One lamp, forty minutes of deliberation, and a negotiation you conduct with total confidence.", "Moroccan lamps metal lanterns shop"),
  ("The blue garden", "Cool, green, unreasonably photogenic. We slow right down inside it.", "Jardin Majorelle blue garden Marrakech"),
  ("Rooftop sunset", "The whole pink city going gold, swifts everywhere, and the call to prayer starting up across it.", "Marrakech rooftop sunset city view"),
  ("Lantern dinner", "Amber light through cut metal, food that keeps arriving, and no interest in leaving.", "Moroccan lanterns dinner table night"),
  ("The square at night", "Smoke, music, a hundred things happening at once. We hold hands so as not to lose each other.", "Jemaa el Fnaa night market Marrakech"),
 ]),

"amalfi": ("Amalfi Lemon Afternoon", "sunlight the color of joy",
 "Cliffs going straight into blue water, lemons the size of your hand, and a coast road that makes you gasp on every second corner.", [
  ("The coastal drive", "Hairpins, sheer drops, and you leaning across me to see the water each time.", "Amalfi coast road cliffs sea"),
  ("The town from above", "Stacked pastel houses going down to a small harbour. It looks invented.", "Positano Amalfi coast town view"),
  ("Lemon garden lunch", "Pasta, lemonade, shade, and a long meal that resets a whole nervous system.", "lemon grove Amalfi terrace"),
  ("The swimming stairs", "Down a hundred steps to a tiny platform on the rocks. Cold, deep, perfect water.", "swimming platform rocks Mediterranean sea"),
  ("A boat for an hour", "Out past the cliffs where the water goes properly dark blue, engine off, just floating.", "small boat Amalfi coast sea cliffs"),
  ("Balcony music", "Someone practising somewhere below, badly, sweetly, while the light goes orange on the water.", "Italian balcony sea view evening"),
  ("Limoncello, cold", "Tiny glasses, far too sweet, and both of us pretending we are used to it.", "limoncello glasses lemons table"),
 ]),

"kitchen": ("Our Tiny Kitchen", "the destination called ordinary",
 "The one I actually want most. Not a view, not a flight, just a small kitchen with both of us in it and nowhere either of us has to be.", [
  ("Sleepy coffee", "You, half awake, holding the mug with both hands. I have wanted this exact scene for a long time.", "morning coffee kitchen window light"),
  ("The grocery run", "Arguing about which pasta shape while blocking an entire aisle. Domestic and perfect.", "grocery shopping basket aisle"),
  ("Dinner experiment", "We follow the recipe loosely and it goes fine. You taste-test everything. Quality control.", "cooking together kitchen pasta home"),
  ("Music between chores", "Something on the speaker, you dancing badly at the sink, me pretending not to watch.", "home kitchen evening warm light"),
  ("Eating on the floor", "The table is covered in something else. The floor works. It always does.", "picnic on floor living room casual meal"),
  ("The refrigerator evidence", "Photos, a bad drawing, one note you left on a Tuesday that I never took down.", "fridge door photos notes magnets"),
  ("Washing up, badly", "You wash, I dry, one of us keeps flicking water. It takes twice as long as it should.", "washing dishes sink kitchen hands"),
 ]),

"bedroom-fort": ("The Sunday Bedroom Fort", "rain outside, us inside",
 "Rain on the window, nothing in the calendar, and a fort constructed with unnecessary seriousness. The whole day happens within about four square metres.", [
  ("Fort construction", "Every blanket in the house is now structural. You are in charge. I am labour.", "blanket fort pillows bedroom"),
  ("Rain on the window", "Grey light, water running down the glass, and absolutely nowhere to be.", "rain on window grey day indoors"),
  ("The snack delivery", "Two trips because I am ambitious. Crumbs immediately become a permanent feature.", "snacks bed tray cosy"),
  ("A movie we barely watch", "Twenty minutes in, we are talking over it. Neither of us knows how it ends.", "watching movie laptop bed blanket"),
  ("The nap that happens", "Not planned. Grey light, warm blankets, both of us out for an hour and a half.", "afternoon nap bed soft light"),
  ("Small talk, big topics", "It starts about nothing and ends somewhere serious, the way it does when there is time.", "cosy bedroom pillows soft lamp"),
  ("Falling asleep nearby", "Lights off, rain still going, your breathing slowing down before mine does.", "dark bedroom night rain window"),
 ]),

"anniversary": ("Twenty-Fifth of February", "our date, made into a place",
 "Not a country. A date, turned into somewhere we can walk around. Everything in here is built out of the day the whole thing started.", [
  ("The anniversary garden", "Everything planted on one date and still going. It gets bigger every year without asking us.", "garden flowers spring blooming path"),
  ("Letters at noon", "We read what we wrote a year ago. Some of it is embarrassing. All of it is true.", "handwritten letters envelopes table"),
  ("The same song", "The one from that week. It has not improved. It never had to.", "record player vinyl warm light"),
  ("A cake, no occasion", "Well, one occasion. Candles anyway, in the afternoon, for no good reason.", "small cake candles table celebration"),
  ("The photo we retake", "Same pose, different year, both of us slightly different. We keep every version.", "polaroid photos hanging string"),
  ("Counting out loud", "Days, months, the number of times we nearly gave up and did not. The last number is zero.", "calendar dates marked notebook"),
  ("The next-year wish", "One each, said out loud, written down, and put somewhere for next February.", "candle wish note paper evening"),
 ]),
}
