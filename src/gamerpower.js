const BASE = "https://www.gamerpower.com/api/giveaways";

const platformMap = {
  steam: "steam",
  epic: "epic-games-store"
};

export async function fetchFreeGames(platform) {
  const apiPlatform = platformMap[platform];
  if (!apiPlatform) throw new Error(`Plataforma inválida: ${platform}`);

  const url = new URL(BASE);
  url.searchParams.set("platform", apiPlatform);
  url.searchParams.set("type", "game");

  const response = await fetch(url, {
    headers: { "User-Agent": "FreeGamesDiscordBot/1.0" },
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    throw new Error(`GamerPower respondeu HTTP ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) return [];

  return data.map(normalizeGiveaway).filter(Boolean);
}

function normalizeGiveaway(item) {
  if (!item || !item.id || !item.title) return null;

  return {
    id: String(item.id),
    title: String(item.title),
    description: String(item.description || "Jogo gratuito por tempo limitado."),
    image: item.image || item.thumbnail || null,
    thumbnail: item.thumbnail || item.image || null,
    url: item.open_giveaway_url || item.giveaway_url || item.gamerpower_url || null,
    gamerpowerUrl: item.gamerpower_url || null,
    worth: item.worth || null,
    published: item.published_date || null,
    endDate: item.end_date || null,
    platforms: item.platforms || "",
    type: item.type || "Game"
  };
}
