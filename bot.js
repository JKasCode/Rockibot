// This will check if the node version you are running is the required
// Node version, if it isn't it will throw the following error to inform
// you.
if (Number(process.version.slice(1).split(".")[0]) < 8) throw new Error("Node 8.0.0 or higher is required. Update Node on your system.");

// Load up the discord.js library
const { Client, Collection } = require("discord.js");
// We also load the rest of the things we need in this file:
const { CommandoClient, SQLiteProvider } = require('discord.js-commando');
const { promisify } = require("util");
const readdir = promisify(require("fs").readdir);
const Enmap = require("enmap");
const path = require("path");
const { settings } = require("cluster");
const MongoDBProvider = require('commando-mongodb');
const Canvas = require('canvas');
const mconfig = require("./mconfig.json");
const uri = mconfig.URI;
const MongoClient = require('mongodb').MongoClient;
const Keyv = require('keyv');
const KeyvProvider = require('commando-provider-keyv');
const discord = require('discord.js');
const client4 = new discord.Client()
const client5 = new discord.Client()
const mongoose=require("mongoose");
const {Seller}=require("./commands/pizzatown/models/Sellers")
const client2 = new CommandoClient({
	commandPrefix: '!',
	owner: ['361212545924595712', '742782250848092231'],
	invite: 'https://discord.gg/Ju2gSCY',
	unknownCommandResponse: false,
});
const db = require('quick.db');
const Advertiser = require("./commands/pizzatown/models/Advertiser");
console.log(uri);
mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology:true, useCreateIndex:true });
const leveling = require('discord-leveling');

class GuideBot extends Client {
  constructor(options) {
    super(options);

    // Here we load the config.js file that contains our token and our prefix values.
    this.config = require("./config.js");
    // client.config.token contains the bot's token
    // client.config.prefix contains the message prefix

    // Aliases and commands are put in collections where they can be read from,
    // catalogued, listed, etc.
    this.commands = new Collection();
    this.aliases = new Collection();

    // Now we integrate the use of Evie's awesome Enhanced Map module, which
    // essentially saves a collection to disk. This is great for per-server configs,
    // and makes things extremely easy for this purpose.
    this.settings = new Enmap({ name: "settings", cloneLevel: "deep", fetchAll: false, autoFetch: true });

    //requiring the Logger class for easy console logging
    this.logger = require("./util/logger");

    // Basically just an async shortcut to using a setTimeout. Nothing fancy!
    this.wait = promisify(setTimeout);
  }

  /*
  PERMISSION LEVEL FUNCTION

  This is a very basic permission system for commands which uses "levels"
  "spaces" are intentionally left black so you can add them if you want.
  NEVER GIVE ANYONE BUT OWNER THE LEVEL 10! By default this can run any
  command including the VERY DANGEROUS `eval` command!

  */
  permlevel(message) {
    let permlvl = 0;

    const permOrder = this.config.permLevels.slice(0).sort((p, c) => p.level < c.level ? 1 : -1);

    while (permOrder.length) {
      const currentLevel = permOrder.shift();
      if (message.guild && currentLevel.guildOnly) continue;
      if (currentLevel.check(message)) {
        permlvl = currentLevel.level;
        break;
      }
    }
    return permlvl;
  }

  /* 
  COMMAND LOAD AND UNLOAD
  
  To simplify the loading and unloading of commands from multiple locations
  including the index.js load loop, and the reload function, these 2 ensure
  that unloading happens in a consistent manner across the board.
  */

  loadCommand(commandPath, commandName) {
    try {
      const props = new (require(`${commandPath}${path.sep}${commandName}`))(this);
      this.logger.log(`Loading Command: ${props.help.name}. 👌`, "log");
      props.conf.location = commandPath;
      if (props.init) {
        props.init(this);
      }
      this.commands.set(props.help.name, props);
      props.conf.aliases.forEach(alias => {
        this.aliases.set(alias, props.help.name);
      });
      return false;
    } catch (e) {
      return `Unable to load command ${commandName}: ${e}`;
    }
  }

  async unloadCommand(commandPath, commandName) {
    let command;
    if (this.commands.has(commandName)) {
      command = this.commands.get(commandName);
    } else if (this.aliases.has(commandName)) {
      command = this.commands.get(this.aliases.get(commandName));
    }
    if (!command) return `The command \`${commandName}\` doesn"t seem to exist, nor is it an alias. Try again!`;

    if (command.shutdown) {
      await command.shutdown(this);
    }
    delete require.cache[require.resolve(`${commandPath}${path.sep}${commandName}.js`)];
    return false;
  }

  /*
  MESSAGE CLEAN FUNCTION
  "Clean" removes @everyone pings, as well as tokens, and makes code blocks
  escaped so they're shown more easily. As a bonus it resolves promises
  and stringifies objects!
  This is mostly only used by the Eval and Exec commands.
  */
  async clean(text) {
    if (text && text.constructor.name == "Promise")
      text = await text;
    if (typeof text !== "string")
      text = require("util").inspect(text, { depth: 1 });

    text = text
      .replace(/`/g, "`" + String.fromCharCode(8203))
      .replace(/@/g, "@" + String.fromCharCode(8203))
      .replace(this.token, "mfa.VkO_2G4Qv3T--NO--lWetW_tjND--TOKEN--QFTm6YGtzq9PH--4U--tG0");

    return text;
  }

  /* SETTINGS FUNCTIONS
  These functions are used by any and all location in the bot that wants to either
  read the current *complete* guild settings (default + overrides, merged) or that
  wants to change settings for a specific guild.
  */

  // getSettings merges the client defaults with the guild settings. guild settings in
  // enmap should only have *unique* overrides that are different from defaults.
  getSettings(guildid) {
    return {
      ...(client.config.defaultSettings || {}),
      ...(client.settings.get(guildid) || {}),
      ...(console.log(client.settings.get(guildid)))
    };
  }

  // writeSettings overrides, or adds, any configuration item that is different
  // than the defaults. This ensures less storage wasted and to detect overrides.
  writeSettings(id, newSettings) {
    const defaults = this.settings.get("default");
    let settings = this.settings.get(id);
    if (typeof settings != "object") settings = {};
    for (const key in newSettings) {
      if (defaults[key] !== newSettings[key]) {
        settings[key] = newSettings[key];
      } else {
        delete settings[key];
      }
    }
    this.settings.set(id, settings);
  }

  /*
  SINGLE-LINE AWAITMESSAGE
  A simple way to grab a single reply, from the user that initiated
  the command. Useful to get "precisions" on certain things...
  USAGE
  const response = await client.awaitReply(msg, "Favourite Color?");
  msg.reply(`Oh, I really love ${response} too!`);
  */
  async awaitReply(msg, question, limit = 60000) {
    const filter = m => m.author.id === msg.author.id;
    await msg.channel.send(question);
    try {
      const collected = await msg.channel.awaitMessages(filter, { max: 1, time: limit, errors: ["time"] });
      return collected.first().content;
    } catch (e) {
      return false;
    }
  }
}

// This is your client. Some people call it `bot`, some people call it `self`,
// some might call it `cootchie`. Either way, when you see `client.something`,
// or `bot.something`, this is what we're refering to. Your client.
const client = new GuideBot();

// We're doing real fancy node 8 async/await stuff here, and to do that
// we need to wrap stuff in an anonymous function. It's annoying but it works.

const init = async () => {

  // Here we load **commands** into memory, as a collection, so they're accessible
  // here and everywhere else.

  // Then we load events, which will include our message and ready event.
  const evtFiles = await readdir("./events/");
  client.logger.log(`Loading a total of ${evtFiles.length} events.`, "log");
  evtFiles.forEach(file => {
    const eventName = file.split(".")[0];
    client.logger.log(`Loading Event: ${eventName}`);
    const event = new (require(`./events/${file}`))(client);
    // This line is awesome by the way. Just sayin'.
    client.on(eventName, (...args) => event.run(...args));
    delete require.cache[require.resolve(`./events/${file}`)];
  });

  client.levelCache = {};
  for (let i = 0; i < client.config.permLevels.length; i++) {
    const thisLevel = client.config.permLevels[i];
    client.levelCache[thisLevel.name] = thisLevel.level;
  }

  client.login(client.config.token);
  
  client2.registry
    .registerDefaultTypes()
	  .registerGroups([
		  ['first', 'Testing Commands'],
      ['miscellaneous', 'Basic Commands'],
      ['moderation', 'Moderation Commands'],
      ['suggestions', 'Suggestions Commands'],
      ['music', 'Music Commands'],
	  ['pizzatown', "PizzaTown Commands"],
	  ])
	  .registerDefaultGroups()
	  .registerDefaultCommands({help: false, unknownCommand: false})	
    .registerCommandsIn(path.join(__dirname, 'commands'));

client2.on("message", async (message) => {
    const gdb = db.get(`guildsettings_${message.guild.id}`);
    client.logger.log(`Message send in ${message.guild.name} (${message.guild.id}) has the modules ${gdb}`);
    if(message.channel.id==="789430243643359232") message.react("✅")
    if (gdb === 'moderation') {
      message.guild.setGroupEnabled("suggestions", false);
      message.guild.setGroupEnabled("music", false);
      message.guild.setGroupEnabled("pizzatown", false);
      message.guild.setGroupEnabled("moderation", true);
    }
    if (gdb === null) {
      message.guild.setGroupEnabled("suggestions", true);
      message.guild.setGroupEnabled("music", true);
      message.guild.setGroupEnabled("pizza", true);
    }
    if (gdb === 'suggestions') {
      message.guild.setGroupEnabled("moderation", false);
      message.guild.setGroupEnabled("music", false);
      message.guild.setGroupEnabled("pizzatown", false);
      message.guild.setGroupEnabled("suggestions", true);
    }
    if (gdb === 'music') {
      message.guild.setGroupEnabled("moderation", false);
      message.guild.setGroupEnabled("suggestions", false);
      message.guild.setGroupEnabled("pizzatown", false);
      message.guild.setGroupEnabled("music", true);
    }
    if (gdb === 'pizzatown') {
      message.guild.setGroupEnabled("moderation", false);
      message.guild.setGroupEnabled("suggestions", false);
      message.guild.setGroupEnabled("music", false);
      message.guild.setGroupEnabled("pizzatown", true);
    }
    if (gdb === 'moderation, suggestions') {
      message.guild.setGroupEnabled("suggestions", true);
      message.guild.setGroupEnabled("music", false);
      message.guild.setGroupEnabled("pizzatown", false);
      message.guild.setGroupEnabled("moderation", true);
    }
    if (gdb === 'moderation, music') {
      message.guild.setGroupEnabled("suggestions", false);
      message.guild.setGroupEnabled("pizzatown", false);
      message.guild.setGroupEnabled("music", true);
      message.guild.setGroupEnabled("moderation", true);
    }
    if (gdb === 'moderation, pizzatown') {
      message.guild.setGroupEnabled("suggestions", false);
      message.guild.setGroupEnabled("pizzatown", true);
      message.guild.setGroupEnabled("music", false);
      message.guild.setGroupEnabled("moderation", true);
    }
    if (gdb === 'suggestions, music') {
      message.guild.setGroupEnabled("suggestions", true);
      message.guild.setGroupEnabled("moderation", false);
      message.guild.setGroupEnabled("pizzatown", false);
      message.guild.setGroupEnabled("music", true);
    }
    if (gdb === 'suggestions, pizzatown') {
      message.guild.setGroupEnabled("suggestions", true);
      message.guild.setGroupEnabled("moderation", false);
      message.guild.setGroupEnabled("pizzatown", true);
      message.guild.setGroupEnabled("music", false);
    }
    if (gdb === 'pizzatown, music') {
      message.guild.setGroupEnabled("suggestions", false);
      message.guild.setGroupEnabled("moderation", false);
      message.guild.setGroupEnabled("pizzatown", true);
      message.guild.setGroupEnabled("music", true);
    }
    if (gdb === 'moderation, suggestions, music') {
      message.guild.setGroupEnabled("suggestions", true);
      message.guild.setGroupEnabled("music", true);
      message.guild.setGroupEnabled("pizzatown", false);
    }
    if (gdb === 'moderation, suggestions, music, pizzatown') {
      message.guild.setGroupEnabled("suggestions", true);
      message.guild.setGroupEnabled("music", true);
      message.guild.setGroupEnabled("pizzatown", true);
      message.guild.setGroupEnabled("moderation", true);
    }
  });
client2.on('messageDelete', async (message) => {
if (message.channel.id === "787909827988946977") {
return;
}
	if (message.channel.id === '787909827988946977') {
        return;
        };
	// create a client to mongodb
	const MongoClient = require('mongodb').MongoClient;
	const client3 = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology:true }, {server: {poolSize: 1}});
	async function findListingsWithMinimumBedroomsBathroomsAndMostRecentReviews(client, {
		minimumNumberOfBedrooms = 0
	} = {}) {
		const cursor = client.db("Rockibot-DB").collection("modlogs")
			.find({
				guildname: { $gte: minimumNumberOfBedrooms }
			});
	
		const results = await cursor.toArray();
	
		if (results.length > 0) {
			const embed = new discord.MessageEmbed()
			.setColor('#ff2050')
			.setAuthor(message.author.tag, message.author.avatarURL())
			.addField(`Message Deleted in #${message.channel.name}`, message.content)
			.setTimestamp();
			console.log(`Found document with guild id ${minimumNumberOfBedrooms}:`);
			results.forEach((result, i) => {
				console.log(`   _id: ${result._id}`);
				console.log(`   guildid: ${result.guildname}`);
				console.log(` 	channel name: ${result.channel}`)
				const logs = result.channel;
				try {
          const sChannel = message.guild.channels.cache.find(c => c.name === logs);
          sChannel.send(embed);
}
catch(err) {
const sChannel = message.guild.channels.cache.find(c => c.id === logs);
if (!sChannel) return;
          sChannel.send(embed);
}
			});
			cursor.close();
		} else {
			console.log(`No Document has ${minimumNumberOfBedrooms} in it.`);
		}
	}
	client3.connect(async err => {
		if (err) throw err.then(
	webhookClient.send(`🔴 MongoDB Connection to Shard ${client.shard.ids[0]} Reached 500. Restarting....`, {
        username: 'Rockibot Shard Logging',
      }),
	client.shard.send(`restart ${client.shard.ids[0]}`)
);
		// db pointing to newdb
		console.log("Switched to "+client3.databaseName+" database");
		// insert document to 'users' collection using insertOne
		client3.db("Rockibot-DB").collection("modlogs").find({ guildname: message.guild.id }, async function(err, res) {
			   if (err) throw err;
			   console.log("Document found");
			   await findListingsWithMinimumBedroomsBathroomsAndMostRecentReviews(client3, {
				minimumNumberOfBedrooms: message.guild.id
			});
			// close the connection to db when you are done with it
			client3.close();
		}); 
	});
});
client2.on('messageUpdate', async (oldMessage, newMessage) => {
	if (oldMessage.channel.id === "787909827988946977") {
return;
}
	// create a client to mongodb
	const MongoClient = require('mongodb').MongoClient;
	const client3 = new MongoClient(uri, { useNewUrlParser: true }, {server: {poolSize: 1}});
	async function findListingsWithMinimumBedroomsBathroomsAndMostRecentReviews(client, {
		minimumNumberOfBedrooms = 0
	} = {}) {
		const cursor = client.db("Rockibot-DB").collection("modlogs")
			.find({
				guildname: { $gte: minimumNumberOfBedrooms }
			});
	
		const results = await cursor.toArray();
	
		if (results.length > 0) {
			const embed = new discord.MessageEmbed()
			.setColor('#ff2050')
			.setAuthor(oldMessage.author.tag, oldMessage.author.avatarURL())
			.setDescription(`**Message edited in #${oldMessage.channel.name}**`)
			.addField('Before:', oldMessage.content, true)
			.addField('After:', newMessage.content, true)
			.setTimestamp();

			console.log(`Found document with guild id ${minimumNumberOfBedrooms}:`);
			results.forEach((result, i) => {
				console.log(`   _id: ${result._id}`);
				console.log(`   guildid: ${result.guildname}`);
				console.log(` 	channel name: ${result.channel}`)
				const logs = result.channel;
try {
          const sChannel = oldMessage.guild.channels.cache.find(c => c.name === logs);
          sChannel.send(embed);
}
catch(err) {
const sChannel = oldMessage.guild.channels.cache.find(c => c.id === logs);
if (!sChannel) return;
          sChannel.send(embed);
}
				cursor.close();
			});
		} else {
			console.log(`No Document has ${minimumNumberOfBedrooms} in it.`);
		}
	}
	client3.connect(async err => {
		if (err) throw err.then(
webhookClient.send(`🔴 MongoDB Connection to Shard ${client.shard.ids[0]} Reached 500. Restarting....`, {
        username: 'Rockibot Shard Logging',
      }),
client.shard.send(`restart ${client.shard.ids[0]}`)
);
		// db pointing to newdb
		console.log("Switched to "+client3.databaseName+" database");
		// insert document to 'users' collection using insertOne
		client3.db("Rockibot-DB").collection("modlogs").find({ guildname: oldMessage.guild.id }, async function(err, res) {
			   if (err) throw err;
			   console.log("Document found");
			   await findListingsWithMinimumBedroomsBathroomsAndMostRecentReviews(client3, {
				minimumNumberOfBedrooms: oldMessage.guild.id
			});
			// close the connection to db when you are done with it
			client3.close();
		}); 
	});
});

client2.setProvider(new KeyvProvider(new Keyv('sqlite://./databases/prefix.sqlite')));

client2.once('ready', () => {
	client.logger.log(`Logged in as ${client2.user.tag}! (${client2.user.id})`, "ready");
  client2.user.setActivity('with !help | rockibot.ml | discord.gg/Ju2gSCY');
webhookClient.send(`🟢 Shard ${client.shard.ids[0]} online!`, {
    username: 'Rockibot Shard Logging',
  })
const DBL = require("dblapi.js");
const dbl = new DBL(client.config.topgg, client);

// Optional events
dbl.on('posted', () => {
  console.log('Server count posted!');
})

dbl.on('error', e => {
 console.log(`Oops! ${e}`);
})
});

const webhookClient = new discord.WebhookClient(client.config.webID, client.config.webToken);
  // Here we login the client.
  client2.login(client.config.token);
  // End top-level async/await function.
};

init();

client2.on("disconnect", () => client.logger.warn("Bot is disconnecting..."))
  .on("reconnecting", () => client.logger.log("Bot reconnecting...", "log"))
  .on("error", e => client.logger.error(e))
  .on("warn", info => client.logger.warn(info));

/* MISCELANEOUS NON-CRITICAL FUNCTIONS */

// EXTENDING NATIVE TYPES IS BAD PRACTICE. Why? Because if JavaScript adds this
// later, this conflicts with native code. Also, if some other lib you use does
// this, a conflict also occurs. KNOWING THIS however, the following methods
// are, we feel, very useful in code. So let's just Carpe Diem.

// <String>.toPropercase() returns a proper-cased string such as: 
// "Mary had a little lamb".toProperCase() returns "Mary Had A Little Lamb"
String.prototype.toProperCase = function() {
  return this.replace(/([^\W_]+[^\s-]*) */g, function(txt) {return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
};
// <Array>.random() returns a single random element from an array
// [1, 2, 3, 4, 5].random() can return 1, 2, 3, 4 or 5.
Array.prototype.random = function() {
  return this[Math.floor(Math.random() * this.length)];
};

// These 2 process methods will catch exceptions and give *more details* about the error and stack trace.
process.on("uncaughtException", (err) => {
  const errorMsg = err.stack.replace(new RegExp(`${__dirname}/`, "g"), "./");
  console.error("Uncaught Exception: ", errorMsg);
  // Always best practice to let the code crash on uncaught exceptions. 
  // Because you should be catching them anyway.
  process.exit(1);
});

process.on("unhandledRejection", err => {
  console.error("Uncaught Promise Error: ", err);
});

setInterval(async () => {
client.users.cache.get("742782250848092231").send("Hourly income given out")
  let users = await Seller.find()
  await Advertiser.find().then(async advertisers => {
    advertisers.forEach(async advertiser => {
      advertiser.sellers.forEach(async seller => {
        seller.pizzaTokens += (advertiser.sellers.length *  1000)
        await seller.save()
      })
    })
  })
  users.forEach(async user => {
    let uprofit = 0;
			user.menu.forEach(pizza => {
				user.stores.forEach(store => {
					if(store.profitmultiplier===2){
						for(let i = 0; i < 2; i++){
							if(Math.round(Math.random()*100) >= pizza.cost - user.reviewScore){
								if(pizza.cost / pizza.production < 3) uprofit += pizza.cost - pizza.production
							}
						}
					}
					if(store.profitmultiplier===3){
						for(let i = 0; i < 3; i++){
							if(Math.round(Math.random()*100) >= pizza.cost - user.reviewScore){
								if(pizza.cost / pizza.production < 3) uprofit += pizza.cost - pizza.production
							}
						}
					}
					if(store.profitmultiplier===5){
						for(let i = 0; i < 5; i++){
							if(Math.round(Math.random()*100) <= pizza.cost - user.reviewScore){
								if(pizza.cost / pizza.production < 3) uprofit += pizza.cost - pizza.production
							}
						}
					}
				})
			})
			uprofit+=15*user.bathrooms + 15
			uprofit+=5*user.sodaMachine + 5
			uprofit+=10*user.toppingBar + 10
			uprofit+=15*user.playPlace + 15
    user.pizzaTokens += uprofit;
    console.log(user.menu, user.name)
    user.reviewScore = user.menu[Math.floor(Math.random() * user.menu.length)].production
      user.pizzaTokens += uprofit;
    await user.save()
  })
  await (await Advertiser.find()).forEach(async advertiser => {
    let uprofit = 0;
    uprofit+=15*advertiser.offices + 15
    uprofit+=5*advertiser.airTime + 5
    uprofit+=10*advertiser.tvChannels + 10
    uprofit+=15*advertiser.employeeProduction + 15
    advertiser.pizzaTokens += uprofit
    await advertiser.save()
  })
  client2.channels.cache.get("787909827988946977").messages.fetch({ limit: 1 }).then(async messages => {
    const lastMessage = messages.first();
    const users=[]
    await (await Seller.find()).forEach(seller => {
      users.push({name:seller.name, pizzaTokens:seller.pizzaTokens})
    })
    await (await Advertiser.find()).forEach(seller => {
      users.push({name:seller.name, pizzaTokens:seller.pizzaTokens})
    })
    users.sort(function(a, b){return b.pizzaTokens - a.pizzaTokens});
    const top10 = users.slice(0, 10)
    var stringarray = [];
    var i = 0;
   await top10.forEach(c => {
      i++;
      stringarray.push(`**${i}.** **${c.name}** - ${c.pizzaTokens.toString()} PizzaTokens`);
    });
    var string = stringarray.join("\n\n");
    var leader = new discord.MessageEmbed()
  .setColor('#f400f0')
  .setAuthor("Richest Players")
  .setDescription(`\n${string}`)

  lastMessage.edit({embed: leader});
  });
}, 1000 * 60 * 60);


setInterval(() => {
  const pizzas = Math.round(Math.random() * 100)
  client4.channels.cache.get("781214583393615903").send(`Hey! I want to buy ${pizzas} pizzas costing ${pizzas * 12} PizzaTokens! I will buy from the person who gives me the highest discount! Auction time!`).then(botMessage => {
    const discount = {user:null, money:0};
    const filter = m => !isNaN(m.content)
    const collector = botMessage.channel.createMessageCollector(filter, { time:120000 })

    collector.on("collect", async m => {
        const seller = await Seller.findOne({discord_id:m.author.id})
        console.log(Number(m.content), m.author.id, seller)
        if(!await Seller.findOne({discord_id:m.author.id})){
            m.reply("You are not a seller!")
        }
        else if(Number(m.content)<=discount.money){
            m.reply("You must bid higher than "+discount.money+"!")
        }
        else if(Number(m.content)>seller.pizzaTokens){
            m.reply("You don't have more than "+m.content+" PizzaTokens!")
        }
        else if(discount.user===m.author.id){
            m.reply("You already have the highest bid!")
        }
        else if(Number(m.content)>=pizzas * 12){
            m.reply("You must bid lower than "+pizzas * 12+"!")
        }
        else{
            discount.money = Number(m.content)
            discount.user = m.author.id
            m.reply("The highest bid is now "+discount.money+" from "+client4.users.cache.get(discount.user).tag+"!")
        }
    })

    collector.on("end", async () => {
        if(discount.user===null){
            client4.channels.cache.get("781214583393615903").send(`Looks like there were no bidders, that is quite sad.`)
        }
        else{
            client4.channels.cache.get("781214583393615903").send(`The auction is over! The winner was ${client4.users.cache.get(discount.user).tag} selling ${pizzas} pizzas with a ${discount.money} discount earning ${pizzas * 12 - discount.money}!`)
            const seller = await Seller.findOne({discord_id:discount.user});
            seller.pizzaTokens += pizzas * 12 - discount.money;
            await seller.save()
        }
    })
})
const amount = Math.round(Math.random() * 10)
const baseBid = amount * 500
        client5.channels.cache.get("790205618731352085").send(`Hey! I am selling ${amount} offices with a base bid of ${baseBid} PizzaTokens! I will buy from the person who gives me the highest discount! Auction time!`).then(botMessage => {
            const bid = {user:null, money:baseBid};
            const filter = m => !isNaN(m.content)
            const collector = botMessage.channel.createMessageCollector(filter, { time:120000 })

            collector.on("collect", async m => {
                const advertiser = await Advertiser.findOne({discord_id:m.author.id})
                if(!await Advertiser.findOne({discord_id:m.author.id})){
                    m.reply("You are not an advertiser!")
                }
                else if(Number(m.content)<=bid.money){
                    m.reply("You must bid higher than "+bid.money+"!")
                }
                else if(Number(m.content)>advertiser.pizzaTokens){
                    m.reply("You don't have more than "+m.content+" PizzaTokens!")
                }
                else if(bid.user===m.author.id){
                    m.reply("You already have the highest bid!")
                }
                else{
                    bid.money = Number(m.content)
                    bid.user = m.author.id
                    m.reply("The highest bid is now "+bid.money+" from "+client5.users.cache.get(bid.user).tag+"!")
                }
            })

            collector.on("end", async () => {
                if(bid.user===null){
                    client5.channels.cache.get("790205618731352085").send(`Looks like there were no bidders, that is quite sad.`)
                }
                else{
                    client5.channels.cache.get("790205618731352085").send(`The auction is over! The winner was ${client5.users.cache.get(bid.user).tag} buying ${amount} offices for ${bid.money}!`)
                    const advertiser = await Advertiser.findOne({discord_id:discount.user});
                    advertiser.offices2 += amount;
                    await advertiser.save()
                }
            })
        })
}, 1000 * 60 * 10)

client4.login(require("./config").ptoken)
client5.login(require("./config").otoken)
