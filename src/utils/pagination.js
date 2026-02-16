const { ActionRowBuilder, EmbedBuilder, ButtonBuilder, ComponentType } = require('discord.js')

/**
 * interaction.followUp
 * Creates a pagination embed
 * @param {Message} message
 * @param {EmbedBuilder[]} pages
 * @param {ButtonBuilder[]} buttonList
 * @param {any} author
 * @param {number} timeout
 * @returns
 */
const messagepaginationEmbed = async (message, pages, buttonList, author, timeout) => {
    if (!Array.isArray(buttonList) || buttonList.length < 4) throw new Error('Pagination requires at least 4 buttons');
    for (let button of buttonList) {
        if (button.data.style === 5) throw new Error('Link isnt supported.');
    }
    if (!Array.isArray(pages) || pages.length === 0) throw new Error('Pagination requires at least 1 page');
    let page = 0;
    const row = new ActionRowBuilder().addComponents(buttonList);
    const currentPage = await message.reply({
        embeds: [pages[page]],
        components: [row],
        allowedMentions: { repliedUser: false }
    });

    const filter = (i) => i.user.id === author.id;
    const collector = await currentPage.createMessageComponentCollector({ filter, time: timeout });

    collector.on('collect', async (i) => {
        await i.deferUpdate();
        switch (i.customId) {
            case buttonList[0].data.custom_id:
                page = 0;
                break;
            case buttonList[1].data.custom_id:
                page = page > 0 ? --page : pages.length - 1;
                break;
            case buttonList[2].data.custom_id:
                page = page + 1 < pages.length ? ++page : 0;
                break;
            case buttonList[3].data.custom_id:
                page = pages.length - 1;
                break;
            default:
                break;
        }
        await i.editReply({
            embeds: [pages[page]],
            components: [row]
        });
        collector.resetTimer();
    });

    collector.on('end', () => {
        try {
            const disabledRow = new ActionRowBuilder().addComponents(
                buttonList[0].setDisabled(true),
                buttonList[1].setDisabled(true),
                buttonList[2].setDisabled(true),
                buttonList[3].setDisabled(true)
            );
            currentPage.edit({
                embeds: [pages[page]],
                components: [disabledRow]
            }).catch(err => {
              try {
                console.warn('Pagination disable buttons error:', err?.message);
              } catch (e) {}
            });
        } catch (err) {
            console.error('messagepaginationEmbed end handler error:', err && (err.message || err));
        }
    });
    return currentPage;
};

const intpaginationEmbed = async (interaction, pages, buttonList, author, timeout) => {
    if (!Array.isArray(buttonList) || buttonList.length < 4) throw new Error('Pagination requires at least 4 buttons');
    for (let button of buttonList) {
        if (button.data.style === 5) throw new Error('Link isnt supported');
    }
    if (!Array.isArray(pages) || pages.length === 0) throw new Error('Pagination requires at least 1 page');
    let page = 0;
    const row = new ActionRowBuilder().addComponents(buttonList);
    const replyMethod = interaction.deferred ? 'editReply' : 'reply';
    await interaction[replyMethod]({
        embeds: [pages[page]],
        components: [row]
    });
    const currentPage = await interaction.fetchReply();

    const filter = (i) => i.user.id === author.id;
    const collector = await currentPage.createMessageComponentCollector({ filter, time: timeout });

    collector.on('collect', async (i) => {
        await i.deferUpdate();
        switch (i.customId) {
            case buttonList[0].data.custom_id:
                page = 0;
                break;
            case buttonList[1].data.custom_id:
                page = page > 0 ? --page : pages.length - 1;
                break;
            case buttonList[2].data.custom_id:
                page = page + 1 < pages.length ? ++page : 0;
                break;
            case buttonList[3].data.custom_id:
                page = pages.length - 1;
                break;
            default:
                break;
        }
        await i.editReply({
            embeds: [pages[page]],
            components: [row]
        });
        collector.resetTimer();
    });

    collector.on('end', () => {
        try {
            const disabledRow = new ActionRowBuilder().addComponents(
                buttonList[0].setDisabled(true),
                buttonList[1].setDisabled(true),
                buttonList[2].setDisabled(true),
                buttonList[3].setDisabled(true)
            );
            currentPage.edit({
                embeds: [pages[page]],
                components: [disabledRow]
            }).catch(err => {
              try {
                console.warn('Pagination interaction disable buttons error:', err?.message);
              } catch (e) {}
            });
        } catch (err) {
            console.error('intpaginationEmbed end handler error:', err && (err.message || err));
        }
    });
    return currentPage;
};

const queuepaginationEmbed = async (interaction, pages, buttonList, author, timeout) => {
    if (!Array.isArray(pages) || pages.length === 0) {
        pages = [new EmbedBuilder().setColor((typeof interaction !== 'undefined' && interaction?.client?.embedColor) ? interaction.client.embedColor : '#ff0051').setDescription("*No pages to display.*")];
    }
    if (!Array.isArray(buttonList) || buttonList.length < 4) {
        throw new Error('Invalid buttonList provided to queuepaginationEmbed');
    }
    if (buttonList[0].data.style === 5 || buttonList[1].data.style === 5 || buttonList[2].data.style === 5 || buttonList[3].data.style === 5) { throw new Error('Link isnt supported'); }
    let page = 0;
    const row = new ActionRowBuilder().addComponents(buttonList);
    const replyMethod = interaction.deferred ? 'editReply' : 'reply';
    // ensure current page embed exists and is an EmbedBuilder
    if (!pages[page] || typeof pages[page].setFooter !== 'function') {
        pages[page] = new EmbedBuilder().setColor((typeof interaction !== 'undefined' && interaction?.client?.embedColor) ? interaction.client.embedColor : '#ff0051').setDescription(String(pages[page] || '*No content*'));
    }
    // Use the existing interaction response state (deferred/replied) for visibility.
    await interaction[replyMethod]({
        embeds: [pages[page]],
        components: [row]
    });
    const currentPage = await interaction.fetchReply();

    const filter = (i) => i.user.id === author.id;
    const collector = await currentPage.createMessageComponentCollector({ filter, time: timeout });

    collector.on('collect', async (i) => {
        await i.deferUpdate();
        switch (i.customId) {
            case buttonList[0].data.custom_id:
                page = 0;
                break;
            case buttonList[1].data.custom_id:
                page = page > 0 ? --page : pages.length - 1;
                break;
            case buttonList[2].data.custom_id:
                page = page + 1 < pages.length ? ++page : 0;
                break;
            case buttonList[3].data.custom_id:
                page = pages.length - 1;
                break;
            default:
                break;
        }
        if (!pages[page] || typeof pages[page].setFooter !== 'function') {
            pages[page] = new EmbedBuilder().setColor((typeof interaction !== 'undefined' && interaction?.client?.embedColor) ? interaction.client.embedColor : '#ff0051').setDescription(String(pages[page] || '*No content*'));
        }
        await i.editReply({
            embeds: [pages[page]],
            components: [row]
        });
        collector.resetTimer();
    });

    collector.on('end', () => {
        try {
            const disabledRow = new ActionRowBuilder().addComponents(
                buttonList[0].setDisabled(true),
                buttonList[1].setDisabled(true),
                buttonList[2].setDisabled(true),
                buttonList[3].setDisabled(true)
            );
            if (!pages[page] || typeof pages[page].setFooter !== 'function') {
                pages[page] = new EmbedBuilder().setColor((typeof interaction !== 'undefined' && interaction?.client?.embedColor) ? interaction.client.embedColor : '#ff0051').setDescription(String(pages[page] || '*No content*'));
            }
            interaction.editReply({
                embeds: [pages[page]],
                components: [disabledRow]
            }).catch(err => {
              try {
                console.warn('Queue pagination disable buttons error:', err?.message);
              } catch (e) {}
            });
        } catch (err) {
            console.error('queuepaginationEmbed end handler error:', err && (err.message || err));
        }
    });
    return currentPage;
};

module.exports = { messagepaginationEmbed, intpaginationEmbed, queuepaginationEmbed };
