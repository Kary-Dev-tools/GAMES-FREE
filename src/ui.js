import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from "discord.js";

/**
 * Painel completo de controle do bot (usado em /configurar e /fix)
 */
export function buildConfigPanel(config) {
  const steam = config.platforms.steam;
  const epic = config.platforms.epic;

  const embed = new EmbedBuilder()
    .setColor(0x00d26a)
    .setTitle("🎮 PAINEL DE CONTROLE — GAMES FREE")
    .setDescription(
      "Painel central para gerenciamento das publicações automáticas da **Steam** e **Epic Games**, além da personalização de **Nome, Avatar e Banner** do bot."
    )
    .addFields(
      {
        name: "🟦 Canal da Steam",
        value: steam.channelId ? `<#${steam.channelId}>` : "⚠️ *Não configurado*",
        inline: true
      },
      {
        name: "🟪 Canal da Epic Games",
        value: epic.channelId ? `<#${epic.channelId}>` : "⚠️ *Não configurado*",
        inline: true
      },
      {
        name: "⏱️ Verificação Automática",
        value: `A cada **${config.checkIntervalMinutes} minutos**`,
        inline: false
      }
    )
    .setFooter({ text: "GAMES FREE • Use os botões abaixo para configurar." })
    .setTimestamp();

  // Linha 1: Canais e Teste
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("cfg_set_steam")
      .setLabel("Canal Steam")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("🟦"),
    new ButtonBuilder()
      .setCustomId("cfg_set_epic")
      .setLabel("Canal Epic")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("🟪"),
    new ButtonBuilder()
      .setCustomId("cfg_run_test")
      .setLabel("Testar Envio")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🧪")
  );

  // Linha 2: Personalização com 2 Opções (🌐 LINK e 📁 EXPLORADOR)
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("cfg_profile_link")
      .setLabel("🌐 Perfil por Link")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("cfg_avatar_file")
      .setLabel("📁 Avatar (Explorador)")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("cfg_banner_file")
      .setLabel("📁 Banner (Explorador)")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("cfg_refresh")
      .setLabel("🔄 Atualizar")
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row1, row2] };
}

/**
 * Seletor de canal de texto para uma plataforma
 */
export function buildChannelSelect(platform) {
  const isSteam = platform === "steam";
  const select = new ChannelSelectMenuBuilder()
    .setCustomId(`select_channel_${platform}`)
    .setPlaceholder(`Selecione o canal para ${isSteam ? "Steam" : "Epic Games"}`)
    .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);

  const row = new ActionRowBuilder().addComponents(select);

  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("cfg_back")
      .setLabel("Voltar ao Painel")
      .setStyle(ButtonStyle.Secondary)
  );

  return {
    content: `📢 Selecione o canal de texto onde os anúncios da **${isSteam ? "Steam" : "Epic Games"}** serão enviados:`,
    embeds: [],
    components: [row, backRow]
  };
}

/**
 * Modal para configurar o perfil do bot via 🌐 LINK (Nome, Avatar e Banner)
 */
export function buildProfileModal(currentName = "") {
  return new ModalBuilder()
    .setCustomId("modal_profile_link")
    .setTitle("🌐 Configurar Perfil por Link")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("bot_name")
          .setLabel("Nome do Bot")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setValue(currentName)
          .setMaxLength(32)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("bot_avatar")
          .setLabel("URL da Foto de Perfil (Avatar)")
          .setPlaceholder("https://exemplo.com/avatar.png")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(500)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("bot_banner")
          .setLabel("URL do Banner do Perfil")
          .setPlaceholder("https://exemplo.com/banner.png")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(500)
      )
    );
}
