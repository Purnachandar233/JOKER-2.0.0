const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports = {
    name: "quiz",
    category: "fun",
    description: "Take a fun quiz challenge!",
    execute: async (message, args, client, prefix) => {
        const questions = [
            {
                question: "What is the capital of France?",
                options: ["London", "Paris", "Berlin", "Madrid"],
                correct: 1
            },
            {
                question: "What is 5 + 3?",
                options: ["6", "7", "8", "9"],
                correct: 2
            },
            {
                question: "Which planet is the largest?",
                options: ["Mars", "Saturn", "Jupiter", "Neptune"],
                correct: 2
            },
            {
                question: "What is the smallest prime number?",
                options: ["0", "1", "2", "3"],
                correct: 2
            },
            {
                question: "Which of these is a programming language?",
                options: ["Python", "Coffee", "Milk", "Bread"],
                correct: 0
            },
            {
                question: "What year did World War II end?",
                options: ["1943", "1944", "1945", "1946"],
                correct: 2
            },
            {
                question: "How many continents are there?",
                options: ["5", "6", "7", "8"],
                correct: 2
            },
            {
                question: "What is the chemical symbol for Gold?",
                options: ["Go", "Gd", "Au", "Ag"],
                correct: 2
            }
        ];

        let score = 0;
        let questionIndex = 0;

        const playQuiz = async () => {
            return new Promise((resolve) => {
                const q = questions[questionIndex];

                const quizEmbed = new EmbedBuilder()
                    .setColor(client.embedColor || '#e74c3c')
                    .setTitle("Quiz Challenge")
                    .setDescription(q.question)
                    .addFields(
                        { name: "Progress", value: `${questionIndex + 1}/${questions.length}`, inline: false },
                        { name: "Score", value: `${score}`, inline: false }
                    )
const row = new ActionRowBuilder();
                q.options.forEach((option, index) => {
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`quiz_${index}`)
                            .setLabel(`${String.fromCharCode(65 + index)}) ${option}`)
                            .setStyle(ButtonStyle.Primary)
                    );
                });

                message.channel.send({ embeds: [quizEmbed], components: [row] }).then(msg => {
                    const filter = (i) => i.customId.startsWith('quiz_');
                    const collector = msg.createMessageComponentCollector({ filter, time: 20000, max: 1 });

                    collector.on('collect', async (interaction) => {
                        if (interaction.user.id !== message.author.id) {
                            await interaction.reply({ content: `Only <@${message.author.id}> can use these buttons.`, ephemeral: true }).catch(() => {});
                            return;
                        }

                        const selectedOption = parseInt(interaction.customId.split('_')[1]);
                        const correct = selectedOption === q.correct;

                        if (correct) {
                            score++;
                        }

                        const resultEmbed = new EmbedBuilder()
                            .setColor(correct ? '#2ecc71' : '#e74c3c')
                            .setTitle(correct ? "✅ Correct!" : "❌ Wrong!")
                            .addFields(
                                { name: "Your Answer", value: q.options[selectedOption], inline: true },
                                { name: "Correct Answer", value: q.options[q.correct], inline: true },
                                { name: "Score", value: `${score}/${questions.length}`, inline: false }
                            );

                        interaction.update({ embeds: [resultEmbed], components: [] }).then(() => {
                            resolve();
                        });
                    });

                    collector.on('end', (collected) => {
                        if (collected.size === 0) {
                            msg.edit({ content: "Question skipped due to inactivity.", components: [] });
                            resolve();
                        }
                    });
                });
            });
        };

        while (questionIndex < questions.length) {
            await playQuiz();
            questionIndex++;
            if (questionIndex < questions.length) {
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        const percentage = Math.floor((score / questions.length) * 100);
        let rank = "😢 F";
        if (percentage >= 90) rank = "🏆 A+";
        else if (percentage >= 80) rank = "🌟 A";
        else if (percentage >= 70) rank = "👍 B";
        else if (percentage >= 60) rank = "📚 C";
        else if (percentage >= 50) rank = "⚠️ D";

        const finalEmbed = new EmbedBuilder()
            .setColor('#f39c12')
            .setTitle("Quiz Complete!")
            .addFields(
                { name: "Final Score", value: `${score}/${questions.length}`, inline: true },
                { name: "Percentage", value: `${percentage}%`, inline: true },
                { name: "Grade", value: rank, inline: false }
            );

        message.channel.send({ embeds: [finalEmbed] });
    }
};
