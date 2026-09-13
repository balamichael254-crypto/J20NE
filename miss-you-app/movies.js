/* ============================================================================
   Moonpie watchlist catalogue.

   A browsing list, not a database: title, year, a one-line reason it is worth
   her time, and a runtime so she can pick something that fits the gap she
   actually has. Genres are the top-level filter because that is how she picks.

   Exposes window.MOONPIE_MOVIES = { genres, films }.
   Every film's `g` is a genre id from `genres`. Ids are slugs of title + year,
   so a saved list survives this file being reordered or added to.
   ========================================================================= */
(function () {
  const genres = [
    { id: "romance",   label: "Romance",         icon: "\u{1F495}" },
    { id: "comfort",   label: "Comfort",         icon: "\u{1F9F8}" },
    { id: "comedy",    label: "Funny",           icon: "\u{1F602}" },
    { id: "thriller",  label: "Thriller",        icon: "\u{1F32A}\u{FE0F}" },
    { id: "horror",    label: "Scary",           icon: "\u{1F47B}" },
    { id: "animation", label: "Animated",        icon: "\u{1F338}" },
    { id: "action",    label: "Action",          icon: "\u{1F4A5}" },
    { id: "scifi",     label: "Sci-fi",          icon: "\u{1F30C}" },
    { id: "drama",     label: "Drama",           icon: "\u{1F3AD}" },
    { id: "korean",    label: "K-drama & Asian", icon: "\u{1F3EE}" }
  ];

  /* [title, year, genre, minutes, why] */
  const raw = [
    ["Past Lives", 2023, "romance", 105, "Two people who might have been everything, twenty years apart. Bring tissues."],
    ["Before Sunrise", 1995, "romance", 101, "One night, one city, two people talking. Still the best date movie ever made."],
    ["Before Sunset", 2004, "romance", 80, "Nine years later, and somehow even better than the first."],
    ["La La Land", 2016, "romance", 128, "Gorgeous, and it will wreck you in the last five minutes."],
    ["Pride and Prejudice", 2005, "romance", 129, "The hand flex. That is the whole review."],
    ["The Notebook", 2004, "romance", 123, "You already know. Watch it anyway when you want to cry on purpose."],
    ["About Time", 2013, "romance", 123, "Time travel used entirely for love and ordinary days. Quietly devastating."],
    ["Call Me by Your Name", 2017, "romance", 132, "A whole summer in Italy and a last scene you will think about for weeks."],
    ["Eternal Sunshine of the Spotless Mind", 2004, "romance", 108, "What if you could delete someone. Turns out you would not want to."],
    ["10 Things I Hate About You", 1999, "romance", 97, "The best of the teen romances and it is not close."],
    ["Your Name", 2016, "romance", 106, "Two strangers keep waking up in each other's lives. Beautiful and aching."],
    ["Portrait of a Lady on Fire", 2019, "romance", 122, "Every frame is a painting, and the ending will ruin you."],

    ["Paddington 2", 2017, "comfort", 103, "Genuinely one of the kindest films ever made. Perfect for a bad day."],
    ["Chef", 2014, "comfort", 114, "Food, a road trip, a dad and his kid. Low stakes, high warmth."],
    ["Little Miss Sunshine", 2006, "comfort", 101, "A broken family in a yellow van. Funny and soft at once."],
    ["The Grand Budapest Hotel", 2014, "comfort", 99, "Pink, symmetrical and very silly. Comfort food for the eyes."],
    ["Julie and Julia", 2009, "comfort", 123, "Cooking, Paris, and Meryl Streep. Nothing bad happens."],
    ["School of Rock", 2003, "comfort", 108, "Pure joy. Impossible to be in a bad mood afterwards."],
    ["Sing Street", 2016, "comfort", 106, "Boy starts a band to impress a girl, and the soundtrack slaps."],
    ["Amelie", 2001, "comfort", 122, "A Paris that does not exist and a girl quietly fixing everyone's life."],

    ["Superbad", 2007, "comedy", 113, "Stupid in the best way, and still quotable."],
    ["Booksmart", 2019, "comedy", 102, "Two overachievers try to have one night of fun. Sharp and sweet."],
    ["Bridesmaids", 2011, "comedy", 125, "The dress shop scene. That is all I will say."],
    ["The Nice Guys", 2016, "comedy", 116, "Ryan Gosling screaming. Deeply underrated."],
    ["Palm Springs", 2020, "comedy", 90, "A time loop at a wedding. Funnier and sadder than it has any right to be."],
    ["Game Night", 2018, "comedy", 100, "A game night goes very wrong. Genuinely clever."],
    ["Jojo Rabbit", 2019, "comedy", 108, "Should not work. Absolutely works."],
    ["Hunt for the Wilderpeople", 2016, "comedy", 101, "A kid and a grumpy man lost in the bush. You will love them both."],

    ["Parasite", 2019, "thriller", 132, "Starts as a comedy and ends somewhere else entirely. Watch it knowing nothing."],
    ["Gone Girl", 2014, "thriller", 149, "Do not put this one on during a bad relationship day."],
    ["Prisoners", 2013, "thriller", 153, "Heavy, tense, brilliant. Save it for when you have the energy."],
    ["Knives Out", 2019, "thriller", 130, "A murder mystery that is actually fun. Great with snacks."],
    ["Nightcrawler", 2014, "thriller", 117, "Gyllenhaal at his most unsettling."],
    ["Seven", 1995, "thriller", 127, "The ending is famous for a reason."],
    ["Zodiac", 2007, "thriller", 157, "A slow burn about obsession. Long, but it flies."],
    ["Uncut Gems", 2019, "thriller", 135, "Stressful from minute one. Not for a night you are already anxious."],

    ["Get Out", 2017, "horror", 104, "Scary and very smart. Even if you do not do horror, do this one."],
    ["A Quiet Place", 2018, "horror", 90, "Almost no dialogue. You will hold your breath the whole time."],
    ["Hereditary", 2018, "horror", 127, "Genuinely upsetting. Only if you are in the mood to be shaken."],
    ["The Conjuring", 2013, "horror", 112, "Proper jump scares. Best watched holding someone."],
    ["Train to Busan", 2016, "horror", 118, "Zombies on a train, and it will make you cry. Yes, really."],
    ["It Follows", 2014, "horror", 100, "The premise alone will keep you up. Incredible soundtrack."],

    ["Spirited Away", 2001, "animation", 125, "The best animated film ever made. I will not be arguing."],
    ["Howl's Moving Castle", 2004, "animation", 119, "Cosy, strange and romantic. The perfect rainy day film."],
    ["Spider-Man: Into the Spider-Verse", 2018, "animation", 117, "Looks like nothing else, and it is genuinely thrilling."],
    ["Coco", 2017, "animation", 105, "You will cry. Everyone cries."],
    ["Kiki's Delivery Service", 1989, "animation", 103, "A young witch moves to a new city. Gentle and lovely."],
    ["Klaus", 2019, "animation", 96, "A Christmas film that sneaks up on you."],
    ["The Tale of the Princess Kaguya", 2013, "animation", 137, "Looks like a watercolour. Quietly heartbreaking."],
    ["Wolfwalkers", 2020, "animation", 103, "Stunningly drawn. Watch it on the biggest screen you have."],

    ["Mad Max: Fury Road", 2015, "action", 120, "Two hours of one chase and it never gets boring."],
    ["John Wick", 2014, "action", 101, "He is very upset about the dog. Rightly so."],
    ["The Raid", 2011, "action", 101, "The fight choreography is unreal."],
    ["Mission: Impossible - Fallout", 2018, "action", 147, "The best pure action film of the last decade."],
    ["Top Gun: Maverick", 2022, "action", 130, "Somehow better than the original. Great on a big screen."],
    ["Everything Everywhere All at Once", 2022, "action", 139, "Chaotic, funny, and secretly about mothers and daughters."],

    ["Arrival", 2016, "scifi", 116, "Aliens arrive and it turns out to be about time and grief. Beautiful."],
    ["Interstellar", 2014, "scifi", 169, "Long, loud, and the docking scene is worth it on its own."],
    ["Blade Runner 2049", 2017, "scifi", 164, "Slow and gorgeous. Best with no distractions."],
    ["Her", 2013, "scifi", 126, "A man falls for an operating system. Far sadder than that sounds."],
    ["Edge of Tomorrow", 2014, "scifi", 113, "Groundhog Day with aliens, and way more fun than expected."],
    ["Dune", 2021, "scifi", 155, "Enormous. Watch it loud."],

    ["Whiplash", 2014, "drama", 106, "About drumming, technically. Actually terrifying."],
    ["The Shawshank Redemption", 1994, "drama", 142, "You have probably seen it. It still holds."],
    ["Moonlight", 2016, "drama", 111, "Three chapters of one life. Extraordinarily tender."],
    ["Lady Bird", 2017, "drama", 94, "A girl and her mother fighting because they love each other. Very real."],
    ["Manchester by the Sea", 2016, "drama", 137, "Devastating. Do not put this on casually."],
    ["CODA", 2021, "drama", 111, "Sad in places, but it lands somewhere warm."],
    ["Aftersun", 2022, "drama", 102, "Quiet, and then it hits you an hour after it ends."],

    ["Decision to Leave", 2022, "korean", 138, "A detective falls for a suspect. Elegant and strange."],
    ["Oldboy", 2003, "korean", 120, "A classic, and genuinely disturbing. Know that going in."],
    ["The Handmaiden", 2016, "korean", 145, "Twisty, beautiful, very adult. Not one for family movie night."],
    ["Burning", 2018, "korean", 148, "Slow and unsettling. It stays with you."],
    ["Shoplifters", 2018, "korean", 121, "A family held together by choice. Gentle, and then gutting."],
    ["Drive My Car", 2021, "korean", 179, "Very long, very quiet, very worth it."],
    ["In the Mood for Love", 2000, "korean", 98, "Two neighbours, almost. The most beautiful film about restraint."],
    ["Miss Granny", 2014, "korean", 124, "A grandmother wakes up young again. Funny and surprisingly moving."]
  ];

  const slug = (title, year) =>
    title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + year;

  const films = raw.map(([title, year, g, mins, why]) => ({
    id: slug(title, year), title, year, g, mins, why
  }));

  window.MOONPIE_MOVIES = { genres, films };
})();
