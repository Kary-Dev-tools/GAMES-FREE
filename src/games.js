/**
 * Módulo de busca e resolução de jogos gratuitos oficiais da Epic Games Store e Steam.
 */

const EPIC_FREE_GAMES_URL =
  "https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=pt-BR&country=BR&allowCountries=BR";
const GAMERPOWER_BASE_URL = "https://www.gamerpower.com/api/giveaways";

export const PLATFORM_LOGOS = {
  steam: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Steam_icon_logo.svg/512px-Steam_icon_logo.svg.png",
  epic: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Epic_Games_logo.svg/512px-Epic_Games_logo.svg.png"
};

/**
 * Cria um link TinyURL para protocol URIs (suportado pelo protocolo Steam)
 */
async function createTinyUrl(targetUri) {
  try {
    const res = await fetch(
      "https://tinyurl.com/api-create.php?url=" + encodeURIComponent(targetUri),
      { signal: AbortSignal.timeout(3000) }
    );
    const text = await res.text();
    if (text.startsWith("http")) return text;
  } catch {}
  return null;
}

/**
 * Extrai o slug correto e oficial da página de produto da Epic Games Store.
 */
function getEpicSlug(el) {
  // 1. Prioridade máxima: mappings de páginas de produto da loja
  const offerHome = el.offerMappings?.find((m) => m.pageType === "productHome")?.pageSlug;
  if (offerHome) return offerHome;

  if (el.offerMappings?.[0]?.pageSlug) return el.offerMappings[0].pageSlug;

  const catalogHome = el.catalogNs?.mappings?.find((m) => m.pageType === "productHome")?.pageSlug;
  if (catalogHome) return catalogHome;

  if (el.catalogNs?.mappings?.[0]?.pageSlug) return el.catalogNs.mappings[0].pageSlug;

  // 2. Slugs do produto caso existam
  if (el.productSlug) return el.productSlug;

  return el.urlSlug || el.id;
}

/**
 * Busca jogos gratuitos oficiais da Epic Games Store (100% OFF / Free to keep).
 */
export async function fetchEpicGames() {
  try {
    const res = await fetch(EPIC_FREE_GAMES_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      signal: AbortSignal.timeout(12000)
    });

    if (!res.ok) {
      throw new Error(`Epic Games API respondeu com status HTTP ${res.status}`);
    }

    const json = await res.json();
    const elements = json.data?.Catalog?.searchStore?.elements || [];
    const now = new Date();
    const games = [];

    for (const el of elements) {
      // Verifica promoções ativas com 100% de desconto
      const promoOffers = el.promotions?.promotionalOffers?.[0]?.promotionalOffers || [];
      const activePromo = promoOffers.find((p) => {
        if (p.discountSetting?.discountPercentage !== 0) return false;
        const start = new Date(p.startDate);
        const end = new Date(p.endDate);
        return now >= start && now <= end;
      });

      if (!activePromo) continue;

      const slug = getEpicSlug(el);
      const images = el.keyImages || [];
      const wide =
        images.find((i) => i.type === "OfferImageWide" || i.type === "DieselStoreFrontWide")?.url ||
        images.find((i) => i.type === "featuredMedia")?.url;
      const thumb =
        images.find((i) => i.type === "Thumbnail" || i.type === "OfferImageTall")?.url;

      const originalPrice =
        el.price?.totalPrice?.fmtPrice?.originalPrice && el.price.totalPrice.fmtPrice.originalPrice !== "0"
          ? el.price.totalPrice.fmtPrice.originalPrice
          : null;

      const webUrl = `https://store.epicgames.com/pt-BR/p/${slug}`;
      const appUrl = `http://localhost:3865/app?platform=epic&slug=${encodeURIComponent(slug)}&web=${encodeURIComponent(webUrl)}`;

      games.push({
        id: `epic_${el.id}`,
        rawId: el.id,
        title: el.title,
        description: el.description || "Jogo gratuito disponível para resgate na Epic Games Store.",
        image: wide || thumb || images[0]?.url || null,
        thumbnail: PLATFORM_LOGOS.epic,
        url: webUrl,
        webUrl,
        appUrl,
        price: originalPrice,
        startDate: activePromo.startDate,
        endDate: activePromo.endDate,
        platform: "epic",
        platformName: "Epic Games Store"
      });
    }

    return games;
  } catch (err) {
    console.error("[Epic Games] Erro ao buscar jogos gratuitos:", err.message);
    return [];
  }
}

/**
 * Consulta a API oficial de busca da Steam Store para encontrar o App oficial.
 */
async function resolveSteamApp(title) {
  try {
    const cleanTitle = title
      .replace(/\(Steam\)/gi, "")
      .replace(/Key Giveaway/gi, "")
      .replace(/Giveaway/gi, "")
      .trim();

    const searchUrl =
      "https://store.steampowered.com/api/storesearch/?term=" +
      encodeURIComponent(cleanTitle) +
      "&l=brazilian&cc=br";

    const res = await fetch(searchUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;

    const data = await res.json();
    const item = data.items?.[0];
    if (!item || !item.id) return null;

    return {
      appId: item.id,
      name: item.name,
      webUrl: `https://store.steampowered.com/app/${item.id}`,
      image: `https://cdn.cloudflare.steamstatic.com/steam/apps/${item.id}/header.jpg`
    };
  } catch {
    return null;
  }
}

/**
 * Busca jogos gratuitos da Steam (filtrando para a loja oficial da Steam).
 */
export async function fetchSteamGames() {
  try {
    const url = new URL(GAMERPOWER_BASE_URL);
    url.searchParams.set("platform", "steam");
    url.searchParams.set("type", "game");

    const res = await fetch(url, {
      headers: { "User-Agent": "FreeGamesDiscordBot/2.0" },
      signal: AbortSignal.timeout(12000)
    });

    if (!res.ok) {
      throw new Error(`GamerPower API respondeu com status HTTP ${res.status}`);
    }

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const games = [];
    for (const item of data) {
      if (!item || !item.id || !item.title) continue;

      // Resolve o app oficial diretamente na Steam Store
      const officialApp = await resolveSteamApp(item.title);
      const appId = officialApp?.appId;

      // Garantia: se tiver appId da Steam, NUNCA usa links de terceiros (Alienware, etc.)
      const webUrl = appId
        ? `https://store.steampowered.com/app/${appId}`
        : "https://store.steampowered.com/";

      // Protocolo do app Steam
      const steamProtocolUri = appId ? `steam://store/${appId}` : "steam://open/games";
      const tinyUrl = await createTinyUrl(steamProtocolUri);
      const appUrl =
        tinyUrl ||
        `http://localhost:3865/app?platform=steam&id=${appId || ""}&web=${encodeURIComponent(webUrl)}`;

      games.push({
        id: `steam_${item.id}`,
        rawId: String(item.id),
        appId: appId || null,
        title: officialApp?.name || item.title,
        description: item.description || "Jogo gratuito disponível na Steam.",
        image: officialApp?.image || item.image || item.thumbnail || null,
        thumbnail: PLATFORM_LOGOS.steam,
        url: webUrl,
        webUrl,
        appUrl,
        price: item.worth && item.worth !== "N/A" ? item.worth : null,
        startDate: item.published_date || null,
        endDate: item.end_date && item.end_date !== "N/A" ? item.end_date : null,
        platform: "steam",
        platformName: "Steam"
      });
    }

    return games;
  } catch (err) {
    console.error("[Steam] Erro ao buscar jogos gratuitos:", err.message);
    return [];
  }
}

/**
 * Busca jogos para uma plataforma específica ('steam' ou 'epic') ou ambas.
 */
export async function fetchFreeGames(platform) {
  if (platform === "epic") return fetchEpicGames();
  if (platform === "steam") return fetchSteamGames();

  const [epic, steam] = await Promise.all([fetchEpicGames(), fetchSteamGames()]);
  return { epic, steam };
}
