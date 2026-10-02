import "dotenv/config";
import fs from "node:fs";
import {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  SlashCommandBuilder,
  ChannelType,
  MessageFlags
} from "discord.js";
import { fetchEpicGames, fetchSteamGames } from "./games.js";
import { getConfig, saveConfig, wasAnnounced, markAnnounced } from "./storage.js";
import { buildGameAnnouncement, buildTestAnnouncement } from "./embeds.js";
import { buildConfigPanel, buildChannelSelect, buildProfileModal } from "./ui.js";
import { startAppLauncherServer } from "./server.js";
import { openWindowsFilePicker } from "./file-picker.js";

const token = process.env.DISCORD_TOKEN;
if (!token) throw new Error("DISCORD_TOKEN não foi definido no arquivo .env");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

function isAdmin(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
}

/**
 * Tenta detectar canais apropriados de texto caso não tenham sido configurados.
 */
async function autoDetectChannels(guild) {
  const config = getConfig();
  let changed = false;

  try {
    const channels = await guild.channels.fetch();
    const textChannels = channels.filter(
      (c) => c && (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement)
    );

    if (!config.platforms.steam.channelId) {
      const steamCh = textChannels.find((c) => c.name.toLowerCase().includes("steam"));
      if (steamCh) {
        config.platforms.steam.channelId = steamCh.id;
        changed = true;
        console.log(`[AutoDetect] Canal da Steam definido automaticamente: #${steamCh.name}`);
      }
    }

    if (!config.platforms.epic.channelId) {
      const epicCh = textChannels.find((c) => c.name.toLowerCase().includes("epic"));
      if (epicCh) {
        config.platforms.epic.channelId = epicCh.id;
        changed = true;
        console.log(`[AutoDetect] Canal da Epic Games definido automaticamente: #${epicCh.name}`);
      }
    }

    if (changed) {
      saveConfig(config);
    }
  } catch (err) {
    console.error("Erro na detecção automática de canais:", err.message);
  }
}

/**
 * Publica um jogo no canal configurado.
 */
async function announceGame(guild, platform, game, force = false) {
  const config = getConfig();
  const p = config.platforms[platform];

  if (!p?.enabled || !p?.channelId) {
    return { sent: false, reason: "disabled-or-no-channel" };
  }

  if (!force && wasAnnounced(platform, game.id)) {
    return { sent: false, reason: "already-announced" };
  }

  const channel = await guild.channels.fetch(p.channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    return { sent: false, reason: "channel-not-found" };
  }

  const payload = buildGameAnnouncement(platform, game, config);
  const mention = p.roleId ? `<@&${p.roleId}>` : undefined;

  await channel.send({
    content: mention,
    ...payload,
    allowedMentions: p.roleId ? { roles: [p.roleId] } : { parse: [] }
  });

  if (!force) {
    markAnnounced(platform, game.id);
  }

  return { sent: true };
}

/**
 * Realiza a verificação e anúncio de jogos em um servidor.
 */
async function checkGuild(guild, force = false) {
  const config = getConfig();
  const results = { steam: 0, epic: 0 };

  // Busca e envia jogos da Epic Games
  if (config.platforms.epic.enabled && config.platforms.epic.channelId) {
    try {
      const epicGames = await fetchEpicGames();
      for (const game of epicGames) {
        const res = await announceGame(guild, "epic", game, force);
        if (res.sent) results.epic++;
      }
    } catch (err) {
      console.error("[Epic] Erro ao anunciar jogos:", err.message);
    }
  }

  // Busca e envia jogos da Steam
  if (config.platforms.steam.enabled && config.platforms.steam.channelId) {
    try {
      const steamGames = await fetchSteamGames();
      for (const game of steamGames) {
        const res = await announceGame(guild, "steam", game, force);
        if (res.sent) results.steam++;
      }
    } catch (err) {
      console.error("[Steam] Erro ao anunciar jogos:", err.message);
    }
  }

  return results;
}

/**
 * Aplica alterações de perfil no bot LOCALMENTE no servidor (per-guild).
 * Usa guild.members.me para alterar nickname e avatar apenas naquele servidor.
 * OBS: Discord não suporta banner per-guild, então banner foi removido.
 */
async function applyProfileChanges(guild, { name, avatar }) {
  const changes = [];
  const me = guild.members.me;

  if (!me) {
    return ["⚠️ Não foi possível encontrar o bot neste servidor."];
  }

  if (name && name.trim()) {
    try {
      await me.setNickname(name.trim());
      changes.push(`• Apelido alterado neste servidor para: **${name.trim()}**`);
    } catch (err) {
      changes.push(`⚠️ Apelido: ${err.message}`);
    }
  }

  if (avatar) {
    try {
      await me.setAvatar(avatar);
      changes.push("• Foto de perfil (avatar) atualizada neste servidor com sucesso!");
    } catch (err) {
      changes.push(`⚠️ Avatar: ${err.message}`);
    }
  }

  return changes;
}

/**
 * Registra os comandos slash diretamente na API do Discord.
 */
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("fix")
      .setDescription("Fixa o painel de controle completo com todas as funções neste canal.")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.bitfield),

    new SlashCommandBuilder()
      .setName("perfil")
      .setDescription("Altera o apelido e avatar do bot localmente neste servidor.")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.bitfield)
      .addStringOption((opt) =>
        opt.setName("nome").setDescription("Novo apelido para o bot neste servidor (1 a 32 caracteres)").setRequired(false)
      )
      .addAttachmentOption((opt) =>
        opt
          .setName("avatar_arquivo")
          .setDescription("📁 Escolha o arquivo de foto de perfil (avatar) do seu computador")
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName("avatar_link")
          .setDescription("🌐 Ou envie um link direto da imagem de avatar")
          .setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName("jogos")
      .setDescription("Mostra os jogos gratuitos ativos agora na Epic Games e Steam.")
      .addStringOption((opt) =>
        opt
          .setName("plataforma")
          .setDescription("Filtrar por plataforma")
          .setRequired(false)
          .addChoices(
            { name: "🟪 Epic Games Store", value: "epic" },
            { name: "🟦 Steam", value: "steam" },
            { name: "🎮 Ambas", value: "all" }
          )
      ),

    new SlashCommandBuilder()
      .setName("anunciar")
      .setDescription("Publica os jogos grátis nos canais oficiais da Steam e Epic.")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.bitfield)
      .addBooleanOption((opt) =>
        opt
          .setName("forcar")
          .setDescription("Reenviar mesmo que o jogo já tenha sido postado anteriormente?")
          .setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName("configurar")
      .setDescription("Configura os canais onde os jogos serão enviados automaticamente.")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.bitfield)
      .addChannelOption((opt) =>
        opt
          .setName("canal_steam")
          .setDescription("Canal de texto para anúncios de jogos da Steam")
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setRequired(false)
      )
      .addChannelOption((opt) =>
        opt
          .setName("canal_epic")
          .setDescription("Canal de texto para anúncios de jogos da Epic Games")
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setRequired(false)
      )
      .addRoleOption((opt) =>
        opt
          .setName("cargo_notificacao")
          .setDescription("Cargo que será mencionado nos anúncios (opcional)")
          .setRequired(false)
      )
  ].map((c) => c.toJSON());

  try {
    const guildId = process.env.GUILD_ID;
    if (guildId) {
      const guild = client.guilds.cache.get(guildId);
      if (guild) {
        await guild.commands.set(commands);
        console.log(`✅ Comandos registrados instantaneamente no servidor "${guild.name}"!`);
      }
    } else {
      await client.application.commands.set(commands);
      console.log("✅ Comandos registrados globalmente!");
    }
  } catch (err) {
    console.error("Falha ao registrar comandos:", err.message);
  }
}

// ==================== EVENTOS DO CLIENTE ====================

client.once("clientReady", async () => {
  console.log(`\n==========================================`);
  console.log(`🤖 Bot online como: ${client.user.tag}`);
  console.log(`🏠 Servidores conectados: ${client.guilds.cache.size}`);
  console.log(`==========================================\n`);

  // Inicia o servidor HTTP local para despachar a abertura no app e servir o site WEB
  startAppLauncherServer();

  // Registra slash commands automaticamente
  await registerCommands();

  // Executa checagem e envio inicial em todos os servidores
  for (const guild of client.guilds.cache.values()) {
    await autoDetectChannels(guild);
    console.log(`🔍 Verificando jogos gratuitos para o servidor "${guild.name}"...`);
    const res = await checkGuild(guild, false);
    console.log(`📢 Anúncios enviados: Epic [${res.epic}], Steam [${res.steam}]`);
  }

  // Intervalo periódico automático
  const intervalMinutes = Math.max(1, getConfig().checkIntervalMinutes || 10);
  console.log(`⏱️ Verificação automática ativa a cada ${intervalMinutes} minutos.\n`);

  setInterval(async () => {
    try {
      for (const guild of client.guilds.cache.values()) {
        await checkGuild(guild, false);
      }
    } catch (err) {
      console.error("Erro no ciclo automático de verificação:", err.message);
    }
  }, intervalMinutes * 60_000);
});

client.on("interactionCreate", async (interaction) => {
  try {
    // 1. Slash Commands
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;

      // /fix
      if (commandName === "fix") {
        if (!isAdmin(interaction)) {
          return interaction.reply({
            content: "❌ Você precisa da permissão **Gerenciar Servidor** para fixar o painel.",
            flags: MessageFlags.Ephemeral
          });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const channel = interaction.channel;

        if (!channel || !channel.isTextBased()) {
          return interaction.editReply({ content: "❌ Este canal não suporta mensagens." });
        }

        const panelPayload = buildConfigPanel(getConfig());
        const pinnedMsg = await channel.send(panelPayload);

        try {
          await pinnedMsg.pin();
        } catch (pinErr) {
          console.warn("Não foi possível fixar a mensagem com pin:", pinErr.message);
        }

        return interaction.editReply({
          content: `📌 **Painel de Controle Fixado com sucesso neste canal!**\nUse os botões na mensagem fixada acima para gerenciar o bot a qualquer momento.`
        });
      }

      // /perfil
      if (commandName === "perfil") {
        if (!isAdmin(interaction)) {
          return interaction.reply({
            content: "❌ Você precisa da permissão **Gerenciar Servidor** para alterar o perfil do bot.",
            flags: MessageFlags.Ephemeral
          });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const nome = interaction.options.getString("nome");
        const avatarFile = interaction.options.getAttachment("avatar_arquivo");
        const avatarLink = interaction.options.getString("avatar_link");

        const avatarSource = avatarFile?.url || avatarLink;

        const changes = await applyProfileChanges(interaction.guild, {
          name: nome,
          avatar: avatarSource
        });

        if (changes.length === 0) {
          return interaction.editReply({
            content: "ℹ️ Nenhuma opção de nome ou avatar foi enviada."
          });
        }

        return interaction.editReply({
          content: `✅ **Perfil do bot atualizado neste servidor!**\n\n${changes.join("\n")}`
        });
      }

      // /jogos
      if (commandName === "jogos") {
        await interaction.deferReply();
        const filter = interaction.options.getString("plataforma") || "all";
        const config = getConfig();

        let epicGames = [];
        let steamGames = [];

        if (filter === "epic" || filter === "all") {
          epicGames = await fetchEpicGames();
        }
        if (filter === "steam" || filter === "all") {
          steamGames = await fetchSteamGames();
        }

        const all = [
          ...epicGames.map((g) => ({ platform: "epic", data: g })),
          ...steamGames.map((g) => ({ platform: "steam", data: g }))
        ];

        if (all.length === 0) {
          return interaction.editReply({
            content: "😕 Nenhum jogo gratuito foi encontrado no momento."
          });
        }

        const first = all[0];
        const firstPayload = buildGameAnnouncement(first.platform, first.data, config);
        await interaction.editReply(firstPayload);

        for (let i = 1; i < all.length; i++) {
          const item = all[i];
          const payload = buildGameAnnouncement(item.platform, item.data, config);
          await interaction.followUp(payload);
        }
        return;
      }

      // /anunciar
      if (commandName === "anunciar") {
        if (!isAdmin(interaction)) {
          return interaction.reply({
            content: "❌ Você precisa da permissão **Gerenciar Servidor** para usar este comando.",
            flags: MessageFlags.Ephemeral
          });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const force = interaction.options.getBoolean("forcar") || false;
        const res = await checkGuild(interaction.guild, force);

        return interaction.editReply({
          content: `✅ Verificação concluída!\n\n📢 **Resultados:**\n• 🟪 Epic Games: **${res.epic}** anúncio(s) enviado(s)\n• 🟦 Steam: **${res.steam}** anúncio(s) enviado(s)`
        });
      }

      // /configurar
      if (commandName === "configurar") {
        if (!isAdmin(interaction)) {
          return interaction.reply({
            content: "❌ Você precisa da permissão **Gerenciar Servidor** para configurar o bot.",
            flags: MessageFlags.Ephemeral
          });
        }

        const steamChannel = interaction.options.getChannel("canal_steam");
        const epicChannel = interaction.options.getChannel("canal_epic");
        const role = interaction.options.getRole("cargo_notificacao");

        if (steamChannel || epicChannel || role) {
          const config = getConfig();
          const changes = [];

          if (steamChannel) {
            config.platforms.steam.channelId = steamChannel.id;
            changes.push(`• Canal da Steam: <#${steamChannel.id}>`);
          }
          if (epicChannel) {
            config.platforms.epic.channelId = epicChannel.id;
            changes.push(`• Canal da Epic Games: <#${epicChannel.id}>`);
          }
          if (role) {
            config.platforms.steam.roleId = role.id;
            config.platforms.epic.roleId = role.id;
            changes.push(`• Cargo de Notificação: <@&${role.id}>`);
          }

          saveConfig(config);

          return interaction.reply({
            content: `✅ **Configurações atualizadas com sucesso!**\n\n${changes.join("\n")}`,
            flags: MessageFlags.Ephemeral
          });
        }

        return interaction.reply({
          ...buildConfigPanel(getConfig()),
          flags: MessageFlags.Ephemeral
        });
      }
    }

    // 2. Botões Interativos
    if (interaction.isButton()) {
      const id = interaction.customId;

      if (!isAdmin(interaction)) {
        return interaction.reply({ content: "❌ Sem permissão.", flags: MessageFlags.Ephemeral });
      }

      if (id === "cfg_set_steam") {
        return interaction.update(buildChannelSelect("steam"));
      }

      if (id === "cfg_set_epic") {
        return interaction.update(buildChannelSelect("epic"));
      }

      if (id === "cfg_back" || id === "cfg_refresh") {
        return interaction.update(buildConfigPanel(getConfig()));
      }

      // 🌐 Perfil por Link
      if (id === "cfg_profile_link") {
        return interaction.showModal(buildProfileModal(client.user.username));
      }

      // 📁 Avatar pelo Explorador de Arquivos do Windows
      if (id === "cfg_avatar_file") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await interaction.editReply({
          content: "📁 **Abrindo o Explorador de Arquivos no seu computador...**\nSelecione o arquivo da imagem para a foto de perfil (avatar) neste servidor."
        });

        const selectedFilePath = await openWindowsFilePicker("Selecione a Imagem para o Avatar do Bot");

        if (!selectedFilePath) {
          return interaction.followUp({
            content: "⚠️ Nenhuma imagem foi selecionada ou a seleção foi cancelada no Explorador de Arquivos.\n\n*Dica: Você também pode usar o comando `/perfil` anexando o arquivo diretamente pelo Discord.*",
            flags: MessageFlags.Ephemeral
          });
        }

        try {
          const imageBuffer = fs.readFileSync(selectedFilePath);
          await interaction.guild.members.me.setAvatar(imageBuffer);
          return interaction.followUp({
            content: `✅ **Avatar atualizado neste servidor com sucesso a partir do arquivo:**\n\`${selectedFilePath}\``,
            flags: MessageFlags.Ephemeral
          });
        } catch (fileErr) {
          return interaction.followUp({
            content: `❌ Falha ao aplicar o avatar do arquivo: ${fileErr.message}`,
            flags: MessageFlags.Ephemeral
          });
        }
      }

      // ℹ️ Banner per-guild não é suportado pela API do Discord.
      // O botão de banner foi removido do painel de controle.

      // 🧪 Testar Envio
      if (id === "cfg_run_test") {
        await interaction.deferUpdate();
        const config = getConfig();
        let sentCount = 0;

        if (config.platforms.steam.channelId) {
          const ch = await interaction.guild.channels.fetch(config.platforms.steam.channelId).catch(() => null);
          if (ch?.isTextBased()) {
            await ch.send(buildTestAnnouncement("steam", config));
            sentCount++;
          }
        }

        if (config.platforms.epic.channelId) {
          const ch = await interaction.guild.channels.fetch(config.platforms.epic.channelId).catch(() => null);
          if (ch?.isTextBased()) {
            await ch.send(buildTestAnnouncement("epic", config));
            sentCount++;
          }
        }

        return interaction.followUp({
          content: sentCount > 0
            ? `✅ Mensagem de teste enviada com sucesso em **${sentCount}** canal(is)!`
            : "❌ Nenhum canal configurado válido para envio do teste.",
          flags: MessageFlags.Ephemeral
        });
      }
    }

    // 3. Menus de Seleção de Canais
    if (interaction.isChannelSelectMenu()) {
      if (!isAdmin(interaction)) {
        return interaction.reply({ content: "❌ Sem permissão.", flags: MessageFlags.Ephemeral });
      }

      const id = interaction.customId;
      const selectedChannelId = interaction.values[0];
      const config = getConfig();

      if (id === "select_channel_steam") {
        config.platforms.steam.channelId = selectedChannelId;
        saveConfig(config);
        return interaction.update({
          content: `✅ Canal da **Steam** atualizado para <#${selectedChannelId}>!`,
          embeds: [],
          components: []
        });
      }

      if (id === "select_channel_epic") {
        config.platforms.epic.channelId = selectedChannelId;
        saveConfig(config);
        return interaction.update({
          content: `✅ Canal da **Epic Games** atualizado para <#${selectedChannelId}>!`,
          embeds: [],
          components: []
        });
      }
    }

    // 4. Submissão do Modal de Perfil por Link
    if (interaction.isModalSubmit()) {
      if (!isAdmin(interaction)) {
        return interaction.reply({ content: "❌ Sem permissão.", flags: MessageFlags.Ephemeral });
      }

      if (interaction.customId === "modal_profile_link") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const name = interaction.fields.getTextInputValue("bot_name");
        const avatar = interaction.fields.getTextInputValue("bot_avatar");

        const changes = await applyProfileChanges(interaction.guild, {
          name,
          avatar: avatar?.trim() || null
        });

        if (changes.length === 0) {
          return interaction.editReply({ content: "ℹ️ Nenhuma alteração foi realizada." });
        }

        return interaction.editReply({
          content: `✅ **Perfil atualizado neste servidor com sucesso!**\n\n${changes.join("\n")}`
        });
      }
    }
  } catch (err) {
    console.error("Erro ao processar interação:", err);
    const msg = `❌ Ocorreu um erro: ${err.message}`;
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => {});
    } else {
      await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
});

client.login(token);
