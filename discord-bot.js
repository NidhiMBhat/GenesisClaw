import "dotenv/config";
import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";
import { runPipeline } from "./pipeline.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ── Bot Ready ──────────────────────────────
client.once("ready", () => {
  console.log(`[discord] GenesisClaw bot online as ${client.user.tag}`);
});

// ── Message Handler ────────────────────────
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // !analyze <abstract>
  if (message.content.startsWith("!analyze")) {
    const abstract = message.content.replace("!analyze", "").trim();

    if (!abstract || abstract.length < 50) {
      return message.reply(
        "❌ Please provide an abstract (min 50 chars).\n`!analyze Your abstract text here...`"
      );
    }

    const thinking = await message.reply("🔍 Running GenesisClaw pipeline...");

    try {
      const result = await runPipeline(abstract, []);

      if (result.status === "no_gaps") {
        return thinking.edit("⚠️ No research gaps found in this abstract.");
      }

      // Build embed for each plan
      for (const p of result.plans) {
        const embed = new EmbedBuilder()
          .setColor(0x00ffcc)
          .setTitle(`🧬 GenesisClaw — Gap Found`)
          .addFields(
            { name: "📌 Gap", value: p.gap_text, inline: false },
            { name: "🎯 Confidence", value: p.gap_confidence, inline: true },
            { name: "🏗️ Architecture Layers", value: `${p.plan.architecture?.length || 0}`, inline: true },
            { name: "👥 Roles", value: p.plan.roles?.map(r => r.role_title).join(", ") || "N/A", inline: false },
            { name: "🤖 Recommended Models", value: p.plan.deployment?.recommended_models?.join(", ") || "N/A", inline: false },
            { name: "📱 On-Device Compatible", value: p.plan.deployment?.on_device_compatible ? "✅ Yes" : "❌ No", inline: true }
          )
          .setFooter({ text: `GenesisClaw • ${result.meta.duration_ms}ms` })
          .setTimestamp();

        await message.channel.send({ embeds: [embed] });
      }

      await thinking.edit(`✅ Done! Found **${result.gaps.length}** gap(s), generated **${result.plans.length}** plan(s).`);

    } catch (err) {
      await thinking.edit(`❌ Pipeline failed: ${err.message}`);
    }
  }

  // !gaps <abstract> — gaps only, no planning
  if (message.content.startsWith("!gaps")) {
    const abstract = message.content.replace("!gaps", "").trim();
    if (!abstract) return message.reply("Usage: `!gaps Your abstract here...`");

    const thinking = await message.reply("🔍 Extracting gaps...");

    try {
      const { extractGaps } = await import("./gap-extractor.js");
      const gaps = await extractGaps(abstract);

      if (!gaps.length) return thinking.edit("⚠️ No gaps found.");

      const text = gaps.map((g, i) =>
        `**${i + 1}.** ${g.gap_text}\n🔑 Keywords: ${g.keywords.join(", ")} | Confidence: ${g.confidence}`
      ).join("\n\n");

      await thinking.edit(`📋 **Gaps Found:**\n\n${text}`);
    } catch (err) {
      await thinking.edit(`❌ Error: ${err.message}`);
    }
  }

  // !leaderboard — last 5 runs
  if (message.content.startsWith("!leaderboard")) {
    try {
      const { readFileSync, existsSync } = await import("fs");
      const p = "./leaderboard.json";
      if (!existsSync(p)) return message.reply("📭 No runs yet.");

      const entries = JSON.parse(readFileSync(p, "utf8")).slice(0, 5);
      if (!entries.length) return message.reply("📭 No runs yet.");

      const text = entries.map((e, i) =>
        `**${i + 1}.** ${e.top_gap?.slice(0, 60)}...\n⏱️ ${e.duration_ms}ms | Gaps: ${e.gaps_found} | Models: ${e.recommended_models?.join(", ")}`
      ).join("\n\n");

      message.reply(`🏆 **Last ${entries.length} Runs:**\n\n${text}`);
    } catch (err) {
      message.reply(`❌ ${err.message}`);
    }
  }

  // !help
  if (message.content === "!help") {
    message.reply(`
**GenesisClaw Commands:**
\`!analyze <abstract>\` — Full pipeline (gaps + plans)
\`!gaps <abstract>\`    — Extract gaps only
\`!leaderboard\`        — Last 5 pipeline runs
\`!help\`               — This message
    `);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);