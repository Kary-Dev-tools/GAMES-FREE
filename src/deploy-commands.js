import "dotenv/config";
import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits, ChannelType } from "discord.js";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId) {
  throw new Error("Preencha DISCORD_TOKEN e CLIENT_ID no .env");
}

const commands = [
  new SlashCommandBuilder()
    .setName("fix")
    .setDescription("Fixa o painel de controle completo com todas as funções neste canal.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.bitfield),

  new SlashCommandBuilder()
    .setName("perfil")
    .setDescription("Altera o nome, avatar e banner do bot via arquivos do computador ou links.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.bitfield)
    .addStringOption((opt) =>
      opt.setName("nome").setDescription("Novo nome para o bot (1 a 32 caracteres)").setRequired(false)
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
    )
    .addAttachmentOption((opt) =>
      opt
        .setName("banner_arquivo")
        .setDescription("📁 Escolha o arquivo de banner do seu computador")
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName("banner_link")
        .setDescription("🌐 Ou envie um link direto da imagem de banner")
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
].map((command) => command.toJSON());

const rest = new REST({ version: "10" }).setToken(token);

if (guildId) {
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
  console.log(`✅ ${commands.length} comandos registrados no servidor ${guildId}.`);
} else {
  await rest.put(Routes.applicationCommands(clientId), { body: commands });
  console.log(`✅ ${commands.length} comandos registrados globalmente.`);
}
