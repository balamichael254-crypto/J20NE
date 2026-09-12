const crypto = require("crypto");

const TABLE = "moonpie_daily_answers";
const PROFILES = ["Michelle", "Michael"];

// Picked by day number, not stored per-room - every couple using this code
// would see the same question on the same day, which is fine here since it's
// one private deployment for two specific people. Long enough to not repeat
// for about four months before it cycles.
const QUESTIONS = [
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
  "What's one thing you want to promise yourself this month?",
];

const json = (response, status, body) => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
};

const readBody = request => {
  if (!request.body) return {};
  if (typeof request.body === "string") { try { return JSON.parse(request.body); } catch { return {}; } }
  return request.body;
};

// UTC day number, deliberately - both phones need to land on the SAME
// question without asking each other which day it is. The tradeoff: the
// question changes at UTC midnight everywhere, which won't always line up
// with either person's local midnight. Good enough for a once-a-day prompt;
// not trying to be a per-timezone scheduler.
function dayInfo() {
  const dayNumber = Math.floor(Date.now() / 86400000);
  const day = new Date(dayNumber * 86400000).toISOString().slice(0, 10);
  const question = QUESTIONS[dayNumber % QUESTIONS.length];
  return { day, question };
}

module.exports = async function handler(request, response) {
  const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return json(response, 503, { error: "shared storage is not connected" });

  const room = String(request.query?.room || "moonpie-daily-2504").slice(0, 80);
  const roomHash = crypto.createHash("sha256").update(room).digest("hex").slice(0, 24);
  const endpoint = `${supabaseUrl}/rest/v1/${TABLE}`;
  const supabaseFetch = async (url, options = {}) => {
    const result = await fetch(url, {
      ...options,
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json", ...options.headers },
    });
    if (!result.ok) throw new Error(`supabase request failed: ${result.status} ${(await result.text()).slice(0, 200)}`);
    return result.status === 204 ? null : result.json();
  };

  const { day, question } = dayInfo();

  const loadState = async me => {
    const q = new URLSearchParams({ room_hash: `eq.${roomHash}`, day: `eq.${day}`, select: "profile,answer" });
    const rows = await supabaseFetch(`${endpoint}?${q}`);
    const mine = rows.find(r => r.profile === me);
    const theirs = rows.find(r => r.profile !== me);
    return {
      day, question,
      myAnswer: mine ? mine.answer : null,
      otherAnswered: !!theirs,
      // the other person's answer is only ever included once you've also
      // answered - the whole point is neither of you sees the other's
      // answer before committing to your own
      otherAnswer: mine && theirs ? theirs.answer : null,
    };
  };

  try {
    if (request.method === "GET") {
      const me = String(request.query?.me || "");
      if (!PROFILES.includes(me)) return json(response, 400, { error: "missing or invalid 'me'" });
      return json(response, 200, await loadState(me));
    }

    if (request.method === "POST") {
      const { me, answer } = readBody(request);
      if (!PROFILES.includes(me)) return json(response, 400, { error: "missing or invalid 'me'" });
      const clean = String(answer || "").trim().slice(0, 400);
      if (!clean) return json(response, 400, { error: "empty answer" });
      await supabaseFetch(`${endpoint}?on_conflict=room_hash,day,profile`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ room_hash: roomHash, day, profile: me, answer: clean, created_at: Date.now() }),
      });
      return json(response, 201, await loadState(me));
    }

    response.setHeader("Allow", "GET, POST");
    return json(response, 405, { error: "method not allowed" });
  } catch (error) {
    console.error("daily question failed", error);
    return json(response, 503, { error: "couldn't reach today's question" });
  }
};
