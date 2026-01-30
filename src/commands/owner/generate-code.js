const { EmbedBuilder } = require("discord.js");
const redeemCode = require("../../schema/redemcode.js");

module.exports = {
    name: "generate-code",
    category: "owner",
    aliases: ["gen-code", "gencode", "gcu"],
    description: "Generates a redeem code for server or user premium (4-digit numeric code)",
    owneronly: true,
    execute: async (message, args, client, prefix) => {
        let ok = client.emoji.ok;
        let no = client.emoji.no;

        // Parse arguments
        const typeArg = args[0]?.toLowerCase();
        const timeArg = args[1]?.toLowerCase() || 'permanent';

        // Validate code type
        if (!typeArg || !['user', 'server', 'guild'].includes(typeArg)) {
            return message.reply(`${no} | Usage: \`${prefix}generate-code <user|server> [time]\`\n\nExamples:\n\`${prefix}generate-code user permanent\`\n\`${prefix}generate-code server 7d\`\n\nTime formats: 30m, 2h, 7d, 1y, or permanent`);
        }

        // Parse validity time
        let expiry = null;
        let durationText = 'Permanent';
        
        if (timeArg !== 'permanent') {
            const match = timeArg.match(/^(\d+)([mhdy])$/);
            if (!match) {
                return message.reply(`${no} | Invalid time format. Use: 30m, 2h, 7d, 1y, or permanent`);
            }

            const amount = parseInt(match[1]);
            const unit = match[2];
            let milliseconds = 0;

            switch (unit) {
                case 'm': // minutes
                    milliseconds = amount * 60 * 1000;
                    durationText = `${amount} minute${amount > 1 ? 's' : ''}`;
                    break;
                case 'h': // hours
                    milliseconds = amount * 60 * 60 * 1000;
                    durationText = `${amount} hour${amount > 1 ? 's' : ''}`;
                    break;
                case 'd': // days
                    milliseconds = amount * 24 * 60 * 60 * 1000;
                    durationText = `${amount} day${amount > 1 ? 's' : ''}`;
                    break;
                case 'y': // years
                    milliseconds = amount * 365 * 24 * 60 * 60 * 1000;
                    durationText = `${amount} year${amount > 1 ? 's' : ''}`;
                    break;
            }

            expiry = Date.now() + milliseconds;
        }

        // Generate 4-digit numeric code
        const code = `JOKER-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;

        try {
            await redeemCode.create({
                Code: code,
                Expiry: expiry,
                Permanent: timeArg === 'permanent',
                Usage: 1,
                Type: typeArg === 'server' || typeArg === 'guild' ? 'guild' : 'user'
            });

            const targetType = typeArg === 'server' || typeArg === 'guild' ? 'Server/Guild Premium' : 'User Premium';

            const embed = new EmbedBuilder()
                .setColor(0xff0051)
                .setTitle("Premium Code Generated")
                .setDescription(`**Code**: \`${code}\`\n**Type**: ${targetType}\n**Duration**: ${durationText}`)
                .setFooter({ text: "Use /redeem or !redeem to redeem this code" });

            // Send to DM with fallback to channel
            try {
                await message.author.send({ embeds: [embed] });
                if (message.guild) message.channel.send(`${ok} Generated code: \`${code}\` (${durationText}). Sent to your DMs.`);
            } catch {
                message.channel.send({ embeds: [embed] });
            }

            console.log(`[CODE] Generated ${targetType} code ${code} for ${durationText}`);
        } catch (error) {
            console.error("Error creating redeem code:", error);
            message.reply(`${no} | Error creating code: ${error.message}`);
        }
    }
};
