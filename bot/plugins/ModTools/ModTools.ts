import {CommandTree, Handler, RichEmbed, TreeTypes} from "../../Handler";
import {Channel, Guild, GuildChannel, Message, PartialMessage, Role, Snowflake, TextChannel} from "discord.js";
import {WebPlugin} from "../../../web/WagYourBotWeb";

class LogChannel extends CommandTree<ModToolsData> {
    constructor() {
        super("logchannel", [], "set the logging channel.");
    }

    buildCommandTree(): void {
        this.then("set")
            .then("channel", {type: TreeTypes.CHANNEL}, async (args, remainingContent, member, guild, channel, message, handler) => {
                const chnl = guild.channels.resolve(args.channel);
                if (chnl && chnl.type !== "voice") {
                    const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                    data.logChannel = chnl.id;
                    await handler.database.setGuildPluginData(guild.id, this.plugin.name, data);
                    channel.send(new RichEmbed().setTitle("Log Channel").setDescription(`Log Channel set to ${chnl}.`));
                } else {
                    channel.send(new RichEmbed().setTitle("Log Channel").setDescription(`Channel \`${args.channel}\` not found!`));
                }
            }).or()
        .or("disable", {}, async (args, remainingContent, member, guild, channel, message, handler) => {
            const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
            data.logChannel = undefined;
            await handler.database.setGuildPluginData(guild.id, this.plugin.name, data);
            channel.send(new RichEmbed().setTitle("Log Channel").setDescription(`Log Channel removed.`));
        });
    }
}

class LogMessageEdits extends CommandTree<ModToolsData> {
    constructor() {
        super("logmessageedits", [], "should the log channel include edits and removed messages");
    }

    buildCommandTree() {
        this.then("true", {}, async (args, remainingContent, member, guild, channel, message, handler) => {
            const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
            data.logChanges = true;
            channel.send(new RichEmbed().setTitle("LogMessageEdits").setDescription(`Now logging edits and deleted messages in <#${data.logChannel}>`));
        })
        .or("false", {}, async (args, remainingContent, member, guild, channel, message, handler) => {
            const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
            data.logChanges = false;
            channel.send(new RichEmbed().setTitle("LogMessageEdits").setDescription(`No longer logging edits and deleted messages in <#${data.logChannel}>`));
        })
        .defaultEval(async (args, remainingContent, member, guild, channel, message, handler) => {
            const data = await handler.database.getGuildPluginData(<string>guild?.id, this.plugin.name, this.plugin.data);
            data.logChanges = !data.logChanges;
            channel.send(new RichEmbed().setTitle("LogMessageEdits").setDescription(`No longer logging edits and deleted messages in <#${data.logChannel}>`));
        })
    }

}

class MuteRole extends CommandTree<ModToolsData> {
    constructor() {
        super("muterole", [], "set the role for the mute command.");
    }

    buildCommandTree() {
        this.then("role", {type: TreeTypes.ROLE}, async (args, remainingContent, member, guild, channel, message, handler) => {
            const role = await guild.roles.fetch(args.role);
            if (role) {
                const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                data.logChannel = role.id;
                await handler.database.setGuildPluginData(guild.id, this.plugin.name, data);
                channel.send(new RichEmbed().setTitle("Log Channel").setDescription(`Log Channel set to ${role}.`));
                this.updateMuteRole(guild, role);
            } else {
                channel.send(new RichEmbed().setTitle("Mute Role").setDescription(`Role \`${args.role}\` not found!`));
            }
        })
    }

    updateMuteRole(guild: Guild, role: Role) {
        for (const chnl of guild.channels.cache.values()) {
            chnl.createOverwrite(role, {SEND_MESSAGES: false});
        }
    }
}

class Warn extends CommandTree<ModToolsData> {
    constructor() {
        super("warn", [], "warn users of their bad deeds.");
    }

    buildCommandTree(): void {
        this.then("user", {type: TreeTypes.USER})
            .then("reason", {type: /.+/}, async (args, remainingContent, member, guild, channel, message, handler) => {
            const user = await guild.members.fetch(args.user);
            if (user) {
                const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                const warning = new RichEmbed().setTitle("Warn").setDescription(`${user} (${user.user.tag})`).addField("Reason", args.reason);
                await channel.send({content: user, embed: warning});
                if (data.logChannel) {
                    (<null|TextChannel>guild.channels.resolve(data.logChannel))?.send(warning.addField("By", member));
                }
            } else {
                channel.send(new RichEmbed().setTitle("Warn").setDescription(`Failed to find user for \`${args.user}\``));
            }
        });
    }
}

class Mute extends CommandTree<ModToolsData> {
    constructor() {
        super("mute", [], "mute a user for their bad deeds.");
    }

    buildCommandTree() {
        this.then("user", {type: TreeTypes.USER})
            .then("reason", {type: /.+/}, async (args, remainingContent, member, guild, channel, message, handler) => {
                const user = await guild.members.fetch(args.user);
                if (user) {
                    const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                    const role = await guild.roles.fetch(<Snowflake>data.muteRole);
                    if (data.muteRole && role) {
                        await user.roles.add(role, args.reason);
                        const warning = new RichEmbed().setTitle("Mute").setDescription(`${user} (${user.user.tag})`).addField("Reason", args.reason);
                        await channel.send({content: user, embed: warning});
                        if (data.logChannel) {
                            (<null|TextChannel>guild.channels.resolve(data.logChannel))?.send(warning.addField("By", member));
                        }
                    } else {
                        channel.send(new RichEmbed().setTitle("Mute").setDescription(`Failed to mute user as \`muterole\` isn't set.`));
                    }
                } else {
                    channel.send(new RichEmbed().setTitle("Mute").setDescription(`Failed to find user for \`${args.user}\``));
                }
            })
    }
}

class UnMute extends CommandTree<ModToolsData> {
    constructor() {
        super("unmute", [], "unmute a user for their good deeds.");
    }

    buildCommandTree() {
        this.then("user", {type: TreeTypes.USER})
            .then("reason", {type: /.+/}, async (args, remainingContent, member, guild, channel, message, handler) => {
                const user = await guild.members.fetch(args.user);
                if (user) {
                    const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                    const role = await guild.roles.fetch(<Snowflake>data.muteRole);
                    if (data.muteRole && role) {
                        await user.roles.remove(role, args.reason);
                        const warning = new RichEmbed().setTitle("UnMute").setDescription(`${user} (${user.user.tag})`).addField("Reason", args.reason);
                        await channel.send({content: user, embed: warning});
                        if (data.logChannel) {
                            (<null|TextChannel>guild.channels.resolve(data.logChannel))?.send(warning.addField("By", member));
                        }
                    } else {
                        channel.send(new RichEmbed().setTitle("UnMute").setDescription(`Failed to unmute user as \`muterole\` isn't set.`));
                    }
                } else {
                    channel.send(new RichEmbed().setTitle("UnMute").setDescription(`Failed to find user for \`${args.user}\``));
                }
            })
    }
}

class Kick extends CommandTree<ModToolsData> {
    constructor() {
        super("kick", [], "yeet a user from the server for their bad deeds.");
    }

    buildCommandTree() {
        this.then("user", {type: TreeTypes.USER})
            .then("reason", {type: /.+/}, async (args, remainingContent, member, guild, channel, message, handler) => {
                const user = await guild.members.fetch(args.user);
                if (user) {
                    const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                    await user.kick(args.reason);
                    const warning = new RichEmbed().setTitle("Kick").setDescription(`${user} (${user.user.tag})`).addField("Reason", args.reason);
                    await user.send({content: user, embed: warning});
                    if (data.logChannel) {
                        (<null|TextChannel>guild.channels.resolve(data.logChannel))?.send(warning.addField("By", member));
                    }
                } else {
                    channel.send(new RichEmbed().setTitle("Kick").setDescription(`Failed to find user for \`${args.user}\``));
                }
            })
    }
}

class Ban extends CommandTree<ModToolsData> {
    constructor() {
        super("ban", [], "permanently yeet a user from the server for their bad deeds.");
    }

    buildCommandTree(): void {
        this.then("user", {type: TreeTypes.USER})
            .then("reason", {type: /.+/}, async (args, remainingContent, member, guild, channel, message, handler) => {
                const user = await guild.members.fetch(args.user);
                if (user) {
                    const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                    await user.ban({reason: args.reason});
                    const warning = new RichEmbed().setTitle("Ban").setDescription(`${user} (${user.user.tag})`).addField("Reason", args.reason);
                    await user.send({content: user, embed: warning});
                    if (data.logChannel) {
                        (<null|TextChannel>guild.channels.resolve(data.logChannel))?.send(warning.addField("By", member));
                    }
                } else {
                    channel.send(new RichEmbed().setTitle("Ban").setDescription(`Failed to find user for \`${args.user}\``));
                }
            }).or("prune_days", {type: TreeTypes.INTEGER})
                .then("reason", {type: /.+/}, async (args, remainingContent, member, guild, channel, message, handler) => {
                    const user = await guild.members.fetch(args.user);
                    if (user) {
                        const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                        await user.ban({reason: args.reason, days: parseInt(args.prune_days)});
                        const warning = new RichEmbed().setTitle("Ban").setDescription(`${user} (${user.user.tag})`).addField("Reason", args.reason);
                        await user.send({content: user, embed: warning});
                        if (data.logChannel) {
                            (<null|TextChannel>guild.channels.resolve(data.logChannel))?.send(warning.addField("By", member));
                        }
                    } else {
                        channel.send(new RichEmbed().setTitle("Ban").setDescription(`Failed to find user for \`${args.user}\``));
                    }
                })
    }

}

class UnBan extends CommandTree<ModToolsData> {
    constructor() {
        super("unban", [], "allow a banned user to come back for their good deeds.");
    }

    buildCommandTree() {
        this.then("user", {type: TreeTypes.USER})
            .then("reason", {type: /.+/}, async (args, remainingContent, member, guild, channel, message, handler) => {
                const user = await guild.members.unban(args.user, args.reason);
                if (user) {
                    const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                    const warning = new RichEmbed().setTitle("UnBan").setDescription(`${user} (${user.tag})`).addField("Reason", args.reason);
                    await channel.send(warning);
                    if (data.logChannel) {
                        (<null|TextChannel>guild.channels.resolve(data.logChannel))?.send(warning.addField("By", member));
                    }
                } else {
                    channel.send(new RichEmbed().setTitle("UnBan").setDescription(`Failed to find user for \`${args.user}\``));
                }
            })
    }
}

class Prune extends CommandTree<ModToolsData> {
    constructor() {
        super("prune", [], "remove messages from a channel.");
    }

    buildCommandTree() {
        this.then("before")
            .then("message_id", {type: TreeTypes.INTEGER})
                .then("count", {type: TreeTypes.INTEGER}, async (args, remainingContent, member, guild, channel, message, handler) => {
                    const msgs = await channel.bulkDelete(await channel.messages.fetch({before: args.message_id, limit: parseInt(args.count)}), true);
                    channel.send(new RichEmbed().setTitle("Prune").setDescription(`Successfully deleted ${msgs.size} messages!`));
                }).or()
            .or()
        .or("after")
            .then("message_id", {type: TreeTypes.INTEGER}, async (args, remainingContent, member, guild, channel, message, handler) => {
                const msgs = await channel.bulkDelete(await channel.messages.fetch({after: args.message_id, limit: 100}), true);
                channel.send(new RichEmbed().setTitle("Prune").setDescription(`Successfully deleted ${msgs.size} messages!`));
            })
                .then("count", {type: TreeTypes.INTEGER}, async (args, remainingContent, member, guild, channel, message, handler) => {
                    const msgs = await channel.bulkDelete(await channel.messages.fetch({after: args.message_id, limit: parseInt(args.count)}), true);
                    channel.send(new RichEmbed().setTitle("Prune").setDescription(`Successfully deleted ${msgs.size} messages!`));
                }).or()
            .or()
        .or("count", {type: TreeTypes.INTEGER}, async (args, remainingContent, member, guild, channel, message, handler) => {
            const msgs = await channel.bulkDelete(parseInt(args.count), true);
            channel.send(new RichEmbed().setTitle("Prune").setDescription(`Successfully deleted ${msgs.size} messages!`));
        })
    }
}

class ModToolsPlugin extends WebPlugin<ModToolsData> {
    registerExtraListeners(handler: Handler) {
        handler.on("messageUpdate", (oldMsg, newMsg) => this.onMessageChange(oldMsg, newMsg, handler));
        handler.on("messageDelete", (oldMsg) => this.onMessageChange(oldMsg, null, handler));
        handler.on("channelCreate", (channel) => this.onChannelCreate(channel, handler))
    }


    private async onMessageChange(oldMsg: Message | PartialMessage, newMsg: Message | PartialMessage | null, handler: Handler) {
        if (oldMsg.guild !== null) {
            const {enabled} = await handler.database.getGuild(oldMsg.guild.id, handler.defaultPrefix);
            if (enabled.includes(this.name)) {
                const data = await handler.database.getGuildPluginData(oldMsg.guild.id, this.name, this.data);
                if (data.logChanges && data.logChannel) {
                    const channel = await oldMsg.guild.channels.resolve(data.logChannel);
                    if (channel && channel.type !== 'voice') {
                        const embed = new RichEmbed().setTitle(newMsg ? "Message Edited" : "Message Deleted")
                            .setAuthor(oldMsg.author?.tag, oldMsg.author?.avatarURL({}) ?? undefined);
                            embed.addField("Channel", oldMsg.channel);
                        if (newMsg) {
                            if (oldMsg.content && oldMsg.content.length > 1000) {
                                embed.addField("From:", `\u200b${oldMsg.content.substring(0, 1000)}`, false);
                                embed.addField("\u200b", `\u200b${oldMsg.content.substring(1000)}`, false);
                            } else {
                                embed.addField("From: ", `\u200b${oldMsg.content}`, false);
                            }
                            if (newMsg.content && newMsg.content.length > 1000) {
                                embed.addField("To:", `\u200b${newMsg.content.substring(0, 1000)}`, false);
                                embed.addField("\u200b", `\u200b${newMsg.content.substring(1000)}`, false);
                            } else {
                                embed.addField("To: ", `\u200b${newMsg.content}`, false);
                            }
                        } else {
                            embed.setDescription(oldMsg.content);
                        }
                        const attachments = Array.from(oldMsg.attachments);
                        // console.log(attachments)
                        if (attachments.length) embed.addField("Attachments: ", attachments.map(e => `[${e[1].name}](${e[1].proxyURL}`).join("\n"));
                        (<TextChannel>channel).send(embed);
                    }
                }
            }
        }
    }

    private async onChannelCreate(channel: Channel, handler: Handler) {
        if (channel instanceof GuildChannel && channel.type !== "voice") {
            const {enabled} = await handler.database.getGuild(channel.guild.id, handler.defaultPrefix);
            if (enabled.includes(this.name)) {
                const data = await handler.database.getGuildPluginData(channel.guild.id, this.name, this.data);
                const role = await channel.guild.roles.fetch(<string>data.muteRole);
                if (data.muteRole && role) {
                    channel.createOverwrite(role, {SEND_MESSAGES: false});
                }
            }
        }
    }
}

export const plugin = new ModToolsPlugin("ModTools", "Moderator commands and stuff", {muteRole: undefined, logChannel: undefined, logChanges: false});
plugin.addCommand(new LogChannel());
plugin.addCommand(new MuteRole());
plugin.addCommand(new Warn());
plugin.addCommand(new Mute());
plugin.addCommand(new UnMute());
plugin.addCommand(new Kick());
plugin.addCommand(new Ban());
plugin.addCommand(new UnBan());
plugin.addCommand(new Prune());
