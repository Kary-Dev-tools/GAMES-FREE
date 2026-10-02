import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

const PLATFORM_THEMES = {
  steam: {
    name: "Steam",
    emoji: "🔵",
    color: 0x1a9fff,
    footer: "Steam • Resgate e adicione à sua biblioteca!"
  },
  epic: {
    name: "Epic Games Store",
    emoji: "⚫",
    color: 0x0078f2,
    footer: "Epic Games Store • Resgate e o jogo será seu para sempre!"
  }
};

function formatDiscountPrice(price) {
  if (!price || price === "Free" || price === "Grátis") {
    return "**GRÁTIS (100% OFF)**";
  }
  return `~~${price}~~ ➔ **GRÁTIS (100% OFF)**`;
}

function formatEndDate(endDateStr) {
  if (!endDateStr || endDateStr === "N/A") {
    return "⏳ *Por tempo limitado*";
  }

  const date = new Date(endDateStr);
  if (isNaN(date.getTime())) {
    return `⏳ ${endDateStr}`;
  }

  const unix = Math.floor(date.getTime() / 1000);
  return `<t:${unix}:F> (<t:${unix}:R>)`;
}

function truncate(text, max = 500) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 3)}...`;
}

/**
 * Cria o Embed e os Botões de resgate (🌐 SITE e 🤖 APP) para o anúncio de um jogo.
 */
export function buildGameAnnouncement(platform, game, config = {}) {
  const theme = PLATFORM_THEMES[platform] || PLATFORM_THEMES.epic;
  const pConfig = config.platforms?.[platform] || {};
  const webUrl =
    game.webUrl ||
    game.url ||
    (platform === "steam" ? "https://store.steampowered.com/" : "https://store.epicgames.com/");

  const embed = new EmbedBuilder()
    .setColor(pConfig.color || theme.color)
    .setTitle(`${theme.emoji} JOGO GRÁTIS — ${game.title}`)
    .setDescription(truncate(game.description, 450))
    .addFields(
      {
        name: "🕹️ Plataforma",
        value: `**${theme.name}**`,
        inline: true
      },
      {
        name: "💰 Preço",
        value: formatDiscountPrice(game.price),
        inline: true
      },
      {
        name: "⏰ Disponível até",
        value: formatEndDate(game.endDate),
        inline: false
      }
    )
    .setFooter({
      text: theme.footer,
      iconURL: game.thumbnail || pConfig.logoUrl || undefined
    })
    .setTimestamp();

  if (webUrl) {
    embed.setURL(webUrl);
  }

  if (game.thumbnail || pConfig.logoUrl) {
    embed.setThumbnail(game.thumbnail || pConfig.logoUrl);
  }

  if (game.image) {
    embed.setImage(game.image);
  } else if (pConfig.bannerUrl) {
    embed.setImage(pConfig.bannerUrl);
  }

  // Dois botões solicitados: 🌐 SITE e 🤖 APP
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("🌐 SITE")
      .setStyle(ButtonStyle.Link)
      .setURL(webUrl),
    new ButtonBuilder()
      .setLabel("🤖 APP")
      .setStyle(ButtonStyle.Link)
      .setURL(game.appUrl || webUrl)
  );

  return {
    embeds: [embed],
    components: [row]
  };
}

/**
 * Anúncio de teste para validação dos canais.
 */
export function buildTestAnnouncement(platform, config = {}) {
  const fakeGame =
    platform === "steam"
      ? {
          id: "test_steam",
          title: "Cyberpunk 2077 (Exemplo Steam)",
          description:
            "Este é um anúncio de teste para verificar se o envio no canal da Steam está funcionando perfeitamente!",
          price: "R$ 199,90",
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          image: "https://cdn.cloudflare.steamstatic.com/steam/apps/1091500/header.jpg",
          thumbnail: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Steam_icon_logo.svg/512px-Steam_icon_logo.svg.png",
          webUrl: "https://store.steampowered.com/app/1091500",
          appUrl: "http://localhost:3865/app?platform=steam&id=1091500&web=https%3A%2F%2Fstore.steampowered.com%2Fapp%2F1091500"
        }
      : {
          id: "test_epic",
          title: "System Shock 2 (Exemplo Epic Games)",
          description:
            "Este é um anúncio de teste para verificar se o envio no canal da Epic Games está funcionando perfeitamente!",
          price: "R$ 80,99",
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          image: "https://cdn1.epicgames.com/spt-assets/690ff600d5134d9ab12c96862ed5257a/system-shock-2-25th-anniversary-remaster-1e28j.jpg",
          thumbnail: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Epic_Games_logo.svg/512px-Epic_Games_logo.svg.png",
          webUrl: "https://store.epicgames.com/pt-BR/p/system-shock-2-25th-anniversary-remaster-cb94d9",
          appUrl: "http://localhost:3865/app?platform=epic&slug=system-shock-2-25th-anniversary-remaster-cb94d9&web=https%3A%2F%2Fstore.epicgames.com%2Fpt-BR%2Fp%2Fsystem-shock-2-25th-anniversary-remaster-cb94d9"
        };

  return buildGameAnnouncement(platform, fakeGame, config);
}
