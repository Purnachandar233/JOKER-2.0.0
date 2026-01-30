const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");
const User = require("../../schema/User.js")
const prettyMiliSeconds = require("pretty-ms");
const day = require("dayjs");
const Premium = require("../../schema/Premium.js")
module.exports = {
    name: "profile",
    category: "special",
    description: "Gives Your or other's profile",
    owneronly: false,
    wl : true,
    execute: async (message, args, client, prefix) => {
        let owner = client.emoji.owner
        let dev = client.emoji.developer
        let bug = client.emoji.bughunter
        let sup = client.emoji.supporter
        let prem = client.emoji.premium
        let staff = client.emoji.staff
        let manager = client.emoji.manager
        let partner = client.emoji.partner
        let booster = client.emoji.booster

        let cache = []
        let member = message.mentions.members.first() || message.guild.members.cache.get(args[0]) || message.member;
        let data = await User.findOne({ userId: member.id });
        if (!data) data = await User.create({ userId: member.id });

        if(data.badge.owner) cache.push(`${owner} Owner`)
        if(data.badge.dev) cache.push(`${dev} Verified Bot Developer`)
        if(data.badge.supporter) cache.push(`${sup} Supporter`)
        if(data.badge.bug) cache.push(`${bug} Bug Hunter`)
        if(data.badge.premium) cache.push(`${prem} Premium User`)
        if(data.badge.manager) cache.push(`${manager} Manager`)
        if(data.badge.partner) cache.push(`${partner} Partnered Member`)
        if(data.badge.staff) cache.push(`${staff} Staff Member`)
        if(data.badge.booster) cache.push(`${booster} Server Booster`)

        if(cache.length === 0) cache.push(`you have no achievements in ${client.user.username}! Don't Worry [click here](https://discord.gg/pCj2UBbwST) to buy premium and get some achievements in ${client.user.username}..! `)

        const isPremium = await Premium.findOne({ Id: member.id, Type: 'user' });
        let cache1 = []

        if (isPremium && isPremium.Permanent) {
            cache1.push(`Validity : Permanent Subscription`)
        }

        if (isPremium && !isPremium.Permanent) {
            if (isPremium.Expire > Date.now()) {
                cache1.push(`Validity : ${prettyMiliSeconds(isPremium.Expire - Date.now())}`)
            } else {
                await isPremium.deleteOne();
                cache1.push(`Expired On : ${day(isPremium.Expire).format('DD/MM/YYYY')}`)
            }
        }

        if (!isPremium) {
            cache1.push(`You don't have any active user premium subscription. [Click here](https://discord.gg/pCj2UBbwST) to buy one.`)
        }

        let cache2 = []
        const voteok = client.topgg ? await client.topgg.hasVoted(member.id).catch(() => false) : false;
        if(!voteok) cache2.push(`**Not Voted** You Can't use any premium command as you didn't voted for Joker Music on [Top.gg](https://top.gg/bot/898941398538158080/vote)`)
        if(voteok) cache2.push(`**Voted** You can use all premium commands for 12 hours.`)

        const profile = new EmbedBuilder()
            .setColor(0xff0051)
            .setAuthor({ name: `Joker Music Profile Of ${member.user.username}` })
            .addFields(
                { name: "Commands used", value: `${data.count}` },
                { name: `Achievements of ${member.user.username}`, value: cache.join("\n") },
                { name: "Premium Status", value: cache1.join("\n") },
                { name: "Has Voted?", value: cache2.join("\n") }
            );
        message.channel.send({ embeds: [profile] });
    }
}
