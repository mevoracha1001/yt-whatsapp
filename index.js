const { Client, LocalAuth, Buttons, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const moment = require('moment-timezone');
const colors = require('colors');
const fs = require('fs');
const ytdl = require('@distube/ytdl-core');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

const client = new Client({ 
    restartOnAuthFail: true,
    puppeteer: {
        headless: true,
        args: [ '--no-sandbox', '--disable-setuid-sandbox' ]
    },
    authStrategy: new LocalAuth({ clientId: "client" })
});
const config = require('./src/config/config.json');

const userSearchResults = {};
let browser;

// Helper function for timeouts (compatible with older Puppeteer)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

client.on('qr', (qr) => {
    console.log(`[${moment().tz(config.timezone).format('HH:mm:ss')}] Scan the QR below : `);
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    console.clear();
    browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const consoleText = './src/config/console.txt';
    fs.readFile(consoleText, 'utf-8', (err, data) => {
        if (err) {
            console.log(`[${moment().tz(config.timezone).format('HH:mm:ss')}] Console Text not found!`.yellow);
            console.log(`[${moment().tz(config.timezone).format('HH:mm:ss')}] ${config.name} is Already!`.green);
        } else {
            console.log(data.green);
            console.log(`[${moment().tz(config.timezone).format('HH:mm:ss')}] ${config.name} is Already!`.green);
        }
    });
});

client.on('message', async (message) => {
    let commandArgs = message.body.split(' ');
    let command = commandArgs[0];
    let isGroups = message.from.endsWith('@g.us') ? true : false;

    // More robust YouTube search using multiple methods
    async function searchYouTube(query, maxResults = 5) {
        client.sendMessage(message.from, '[⏳] Searching YouTube...');
        
        try {
            // Method 1: Try using YouTube's search page (most direct)
            const results = await searchMethod1(query, maxResults);
            if (results && results.length > 0) {
                return processSearchResults(results, query);
            }
            
            // Method 2: Try using a more resilient approach with YouTube API-like URL
            const results2 = await searchMethod2(query, maxResults);
            if (results2 && results2.length > 0) {
                return processSearchResults(results2, query);
            }
            
            // Method 3: Fallback to Google search
            const results3 = await searchMethod3(query, maxResults);
            if (results3 && results3.length > 0) {
                return processSearchResults(results3, query);
            }
            
            // If all methods fail
            return client.sendMessage(message.from, '*[❎]* Failed to search YouTube. Please try again later or try a different search term.');
        } catch (err) {
            console.log("Search error:", err);
            return client.sendMessage(message.from, '*[❎]* An error occurred while searching. Please try again later.');
        }
    }
    
    // Method 1: Parse YouTube search page directly
    async function searchMethod1(query, maxResults) {
        try {
            console.log(`Attempting Method 1 search for: ${query}`);
            
            const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
            
            const response = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': 'https://www.youtube.com/'
                }
            });
            
            // YouTube stores its data in a variable called ytInitialData
            const dataMatch = response.data.match(/var ytInitialData = ({.*?});/);
            if (!dataMatch) {
                console.log("Could not find ytInitialData in the response");
                return null;
            }
            
            try {
                // Parse the JSON data
                const ytData = JSON.parse(dataMatch[1]);
                
                // Navigate through the nested structure
                const contents = ytData.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
                
                if (!contents) {
                    console.log("Could not find contents in ytData");
                    return null;
                }
                
                // Find the item list renderer which contains search results
                const itemSectionRenderer = contents.find(item => item.itemSectionRenderer)?.itemSectionRenderer;
                
                if (!itemSectionRenderer || !itemSectionRenderer.contents) {
                    console.log("Could not find itemSectionRenderer");
                    return null;
                }
                
                // Extract video results
                const videos = [];
                
                itemSectionRenderer.contents.forEach(item => {
                    if (item.videoRenderer) {
                        const videoId = item.videoRenderer.videoId;
                        const title = item.videoRenderer.title?.runs?.[0]?.text;
                        const channelName = item.videoRenderer.ownerText?.runs?.[0]?.text;
                        
                        if (videoId && title) {
                            videos.push({
                                index: videos.length + 1,
                                title: title,
                                channelName: channelName || 'Unknown Channel',
                                videoId: videoId,
                                url: `https://youtu.be/${videoId}`
                            });
                        }
                    }
                });
                
                return videos.slice(0, maxResults);
            } catch (e) {
                console.log("Error parsing YouTube data:", e);
                return null;
            }
        } catch (error) {
            console.log("Method 1 error:", error);
            return null;
        }
    }
    // Handle play command
if (message.body.startsWith(`${config.prefix}play`)) {
    const query = message.body.substring(`${config.prefix}play`.length).trim();
    return handlePlayCommand(query);
}
    // Handle play command - search and download the top result directly
async function handlePlayCommand(query) {
    if (!query) {
        return client.sendMessage(message.from, '*[❎]* Please provide a search query. Example: !play lofi music');
    }
    
    client.sendMessage(message.from, '[⏳] Searching for your request...');
    
    try {
        // Use existing search functions to find videos
        const results = await searchMethod1(query, 1) || 
                         await searchMethod2(query, 1) || 
                         await searchMethod3(query, 1);
        
        if (!results || results.length === 0) {
            return client.sendMessage(message.from, '*[❎]* Could not find any results for your query. Please try a different search term.');
        }
        
        // Get the top result
        const topResult = results[0];
        
        // Send status message with video info
        await client.sendMessage(
            message.from, 
            `*Downloading:* ${topResult.title}\n*Channel:* ${topResult.channelName}\n\nThis may take a minute...`
        );
        
        // Download and send the audio
        return downloadYouTube(topResult.url, 'mp3', 'audioonly');
        
    } catch (err) {
        console.log("Play command error:", err);
        return client.sendMessage(message.from, '*[❎]* An error occurred while processing your request. Please try again later.');
    }
}
    // Method 2: Try an alternative extraction method
    async function searchMethod2(query, maxResults) {
        try {
            console.log(`Attempting Method 2 search for: ${query}`);
            
            const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
            
            const response = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            
            // Try multiple regex patterns to find video data
            const videoRegexPatterns = [
                /"videoRenderer":{"videoId":"([^"]+)","thumbnail".+?"title":{"runs":\[{"text":"([^"]+)"\}\]},"longBylineText":{"runs":\[{"text":"([^"]+)".*?\}\]/g,
                /"videoRenderer":{"videoId":"([^"]+)".*?"title":{"runs":\[{"text":"([^"]+)"\}\]}/g,
                /"videoId":"([^"]+)".*?"title":{"runs":\[{"text":"([^"]+)"\}\]}/g
            ];
            
            for (const pattern of videoRegexPatterns) {
                const matches = [...response.data.matchAll(pattern)];
                if (matches.length > 0) {
                    console.log(`Found ${matches.length} videos with pattern ${pattern}`);
                    
                    // Process matches based on the pattern
                    const videos = [];
                    matches.forEach((match, index) => {
                        if (pattern === videoRegexPatterns[0] && match.length >= 4) {
                            // First pattern with channel info
                            videos.push({
                                index: index + 1,
                                title: match[2],
                                channelName: match[3] || 'Unknown Channel',
                                videoId: match[1],
                                url: `https://youtu.be/${match[1]}`
                            });
                        } else if (match.length >= 3) {
                            // Other patterns without channel info
                            videos.push({
                                index: index + 1,
                                title: match[2],
                                channelName: 'Unknown Channel',
                                videoId: match[1],
                                url: `https://youtu.be/${match[1]}`
                            });
                        }
                    });
                    
                    if (videos.length > 0) {
                        return videos.slice(0, maxResults);
                    }
                }
            }
            
            // Try Cheerio parsing as a last resort for Method 2
            const $ = cheerio.load(response.data);
            const videos = [];
            
            $('a#video-title, a.yt-simple-endpoint').each((i, el) => {
                const $el = $(el);
                const href = $el.attr('href');
                
                if (href && href.includes('/watch?v=')) {
                    const videoId = href.split('v=')[1]?.split('&')[0];
                    const title = $el.text().trim();
                    
                    if (videoId && title && !videos.some(v => v.videoId === videoId)) {
                        videos.push({
                            index: videos.length + 1,
                            title: title,
                            channelName: 'Unknown Channel',
                            videoId: videoId,
                            url: `https://youtu.be/${videoId}`
                        });
                    }
                }
            });
            
            return videos.slice(0, maxResults);
        } catch (error) {
            console.log("Method 2 error:", error);
            return null;
        }
    }
    
    // Method 3: Google search fallback
    async function searchMethod3(query, maxResults) {
        try {
            console.log(`Attempting Method 3 search for: ${query}`);
            
            // Use a simple search engine approach
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query + ' site:youtube.com')}`;
            
            const response = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            
            const $ = cheerio.load(response.data);
            
            // Extract YouTube links from search results
            const results = [];
            $('a').each((i, element) => {
                const href = $(element).attr('href') || '';
                const title = $(element).text().trim();
                
                if (href.includes('/url?') && href.includes('youtube.com/watch')) {
                    let url = href;
                    
                    // Extract the actual URL from Google's redirect URL
                    const urlMatch = href.match(/\/url\?q=(https:\/\/www\.youtube\.com\/watch[^&]+)/);
                    if (urlMatch && urlMatch[1]) {
                        url = decodeURIComponent(urlMatch[1]);
                    }
                    
                    // Extract video ID
                    const videoIdMatch = url.match(/(?:v=|youtu.be\/)([^&?]+)/);
                    if (videoIdMatch && videoIdMatch[1]) {
                        const videoId = videoIdMatch[1];
                        
                        // Avoid duplicates
                        if (!results.some(r => r.videoId === videoId)) {
                            results.push({
                                index: results.length + 1,
                                title: title || 'Unknown Title',
                                channelName: 'Unknown Channel',
                                videoId: videoId,
                                url: `https://youtu.be/${videoId}`
                            });
                        }
                    }
                }
            });
            
            return results.slice(0, maxResults);
        } catch (error) {
            console.log("Method 3 error:", error);
            return null;
        }
    }
    
    // Process and display search results
    async function processSearchResults(results, query) {
        // Save search results for this user
        userSearchResults[message.from] = {
            query: query,
            results: results,
            timestamp: Date.now(),
            messageId: null
        };
        
        // Create the results message
        let resultMessage = '*YouTube Search Results*\n\n';
        results.forEach(result => {
            resultMessage += `*${result.index}. ${result.title}*\n`;
            resultMessage += `Channel: ${result.channelName}\n`;
            resultMessage += `Link: ${result.url}\n\n`;
        });
        
        resultMessage += `Reply with *${config.prefix}audio <number>*, *${config.prefix}video <number>*, or *${config.prefix}details <number>* to get info.`;
        
        // Send the message and store its ID for reference
        const sentMsg = await client.sendMessage(message.from, resultMessage);
        userSearchResults[message.from].messageId = sentMsg.id._serialized;
        
        return client.sendMessage(message.from, '*[✅]* Search completed successfully!');
    }

    async function detailYouTube(url) {
        client.sendMessage(message.from, '[⏳] Loading...');
        try {
            ytdl.getInfo(url).then((info) => {
                let data = {
                    "channel": {
                        "name": info.videoDetails.author.name,
                        "user": info.videoDetails.author.user,
                        "channelUrl": info.videoDetails.author.channel_url,
                        "userUrl": info.videoDetails.author.user_url,
                        "verified": info.videoDetails.author.verified,
                        "subscriber": info.videoDetails.author.subscriber_count
                    },
                    "video": {
                        "title": info.videoDetails.title,
                        "description": info.videoDetails.description,
                        "lengthSeconds": info.videoDetails.lengthSeconds,
                        "videoUrl": info.videoDetails.video_url,
                        "publishDate": info.videoDetails.publishDate,
                        "viewCount": info.videoDetails.viewCount
                    }
                }
                client.sendMessage(message.from, `*CHANNEL DETAILS*\n• Name : *${data.channel.name}*\n• User : *${data.channel.user}*\n• Verified : *${data.channel.verified}*\n• Channel : *${data.channel.channelUrl}*\n• Subscriber : *${data.channel.subscriber}*`);
                client.sendMessage(message.from, `*VIDEO DETAILS*\n• Title : *${data.video.title}*\n• Seconds : *${data.video.lengthSeconds}*\n• VideoURL : *${data.video.videoUrl}*\n• Publish : *${data.video.publishDate}*\n• Viewers : *${data.video.viewCount}*`)
                client.sendMessage(message.from, '*[✅]* Successfully!');
            });
        } catch (err) {
            console.log(err);
            client.sendMessage(message.from, '*[❎]* Failed!');
        }
    }

    async function downloadYouTube(url, format, filter) {
        client.sendMessage(message.from, '[⏳] Loading..');
        let timeStart = Date.now();
        try {
            let info = await ytdl.getInfo(url);
            let data = {
                "channel": {
                    "name": info.videoDetails.author.name,
                    "user": info.videoDetails.author.user,
                    "channelUrl": info.videoDetails.author.channel_url,
                    "userUrl": info.videoDetails.author.user_url,
                    "verified": info.videoDetails.author.verified,
                    "subscriber": info.videoDetails.author.subscriber_count
                },
                "video": {
                    "title": info.videoDetails.title,
                    "description": info.videoDetails.description,
                    "lengthSeconds": info.videoDetails.lengthSeconds,
                    "videoUrl": info.videoDetails.video_url,
                    "publishDate": info.videoDetails.publishDate,
                    "viewCount": info.videoDetails.viewCount
                }
            }
            ytdl(url, { filter: filter, format: format, quality: 'highest' }).pipe(fs.createWriteStream(`./src/database/download.${format}`)).on('finish', async () => {
                const media = await MessageMedia.fromFilePath(`./src/database/download.${format}`);
                let timestamp = Date.now() - timeStart;
                media.filename = `${config.filename.mp3}.${format}`;
                await client.sendMessage(message.from, media, { sendMediaAsDocument: true });
                client.sendMessage(message.from, `• Title : *${data.video.title}*\n• Channel : *${data.channel.user}*\n• View Count : *${data.video.viewCount}*\n• TimeStamp : *${timestamp / 1000} seconds*`);
                client.sendMessage(message.from, '*[✅]* Successfully!');
            });
        } catch (err) {
            console.log(err);
            client.sendMessage(message.from, '*[❎]* Failed!');
        }
    }
    // Handle details by number
    async function handleNumberedDetails() {
        // Number format: !details 2
        const number = parseInt(commandArgs[1]);
        
        // Check if the number is valid
        if (isNaN(number) || number < 1) {
            return client.sendMessage(message.from, `*[❎]* Please provide a valid number. Example: ${config.prefix}details 1`);
        }
        
        // Check if we have search results for this user
        if (!userSearchResults[message.from] || !userSearchResults[message.from].results) {
            return client.sendMessage(message.from, '*[❎]* No recent search results found. Please search first using !search');
        }
        
        // Check if the number is in range
        const searchResults = userSearchResults[message.from].results;
        if (number > searchResults.length) {
            return client.sendMessage(message.from, `*[❎]* Invalid number. Please choose between 1 and ${searchResults.length}`);
        }
        
        // Get the video URL and get details
        const selectedVideo = searchResults[number - 1];
        return detailYouTube(selectedVideo.url);
    }

    // Handle reply-based details
    async function handleReplyDetails() {
        try {
            // Get the quoted message
            const quotedMsg = await message.getQuotedMessage();
            
            // Check if we have a stored message ID matching this one
            if (!userSearchResults[message.from] || userSearchResults[message.from].messageId !== quotedMsg.id._serialized) {
                return client.sendMessage(message.from, '*[❎]* Could not find search results for this message. Please try a new search.');
            }
            
            // Number from command: !details 2
            const number = parseInt(commandArgs[1]);
            
            // Check if the number is valid
            if (isNaN(number) || number < 1) {
                return client.sendMessage(message.from, `*[❎]* Please provide a valid number. Example: ${config.prefix}details 1`);
            }
            
            // Check if the number is in range
            const searchResults = userSearchResults[message.from].results;
            if (number > searchResults.length) {
                return client.sendMessage(message.from, `*[❎]* Invalid number. Please choose between 1 and ${searchResults.length}`);
            }
            
            // Get the video URL and get details
            const selectedVideo = searchResults[number - 1];
            return detailYouTube(selectedVideo.url);
            
        } catch (err) {
            console.log(err);
            return client.sendMessage(message.from, '*[❎]* Failed to process your request. Please try again.');
        }
    }

    // Handle downloading by number
    async function handleNumberedDownload(format, filter) {
        // Number format: !audio 2 or !video 3
        const number = parseInt(commandArgs[1]);
        
        // Check if the number is valid
        if (isNaN(number) || number < 1) {
            return client.sendMessage(message.from, `*[❎]* Please provide a valid number. Example: ${config.prefix}${format} 1`);
        }
        
        // Check if we have search results for this user
        if (!userSearchResults[message.from] || !userSearchResults[message.from].results) {
            return client.sendMessage(message.from, '*[❎]* No recent search results found. Please search first using !search');
        }
        
        // Check if the number is in range
        const searchResults = userSearchResults[message.from].results;
        if (number > searchResults.length) {
            return client.sendMessage(message.from, `*[❎]* Invalid number. Please choose between 1 and ${searchResults.length}`);
        }
        
        // Get the video URL and download
        const selectedVideo = searchResults[number - 1];
        return downloadYouTube(selectedVideo.url, format, filter);
    }

    // Handle reply-based download
    async function handleReplyDownload(format, filter) {
        try {
            // Get the quoted message
            const quotedMsg = await message.getQuotedMessage();
            
            // Check if we have a stored message ID matching this one
            if (!userSearchResults[message.from] || userSearchResults[message.from].messageId !== quotedMsg.id._serialized) {
                return client.sendMessage(message.from, '*[❎]* Could not find search results for this message. Please try a new search.');
            }
            
            // Number from command: !audio 2 or !video 3
            const number = parseInt(commandArgs[1]);
            
            // Check if the number is valid
            if (isNaN(number) || number < 1) {
                return client.sendMessage(message.from, `*[❎]* Please provide a valid number. Example: ${config.prefix}${format} 1`);
            }
            
            // Check if the number is in range
            const searchResults = userSearchResults[message.from].results;
            if (number > searchResults.length) {
                return client.sendMessage(message.from, `*[❎]* Invalid number. Please choose between 1 and ${searchResults.length}`);
            }
            
            // Get the video URL and download
            const selectedVideo = searchResults[number - 1];
            return downloadYouTube(selectedVideo.url, format, filter);
            
        } catch (err) {
            console.log(err);
            return client.sendMessage(message.from, '*[❎]* Failed to process your request. Please try again.');
        }
    }

    // Check if this is a reply to a previous message
    const isReply = message.hasQuotedMsg;
    
    if ((isGroups && config.groups) || isGroups) return;

    // Handle commands
    if (message.body === `${config.prefix}help`) {
        return client.sendMessage(message.from, 
            `*${config.name}* - YouTube Downloader\n\n` +
            `*Available Commands:*\n\n` +
            `*${config.prefix}search <query>*\n` +
            `Search for videos on YouTube\n\n` +
            `*${config.prefix}audio <url>* or *<number>*\n` +
            `Download audio from YouTube\n\n` +
            `*${config.prefix}video <url>* or *<number>*\n` +
            `Download video from YouTube\n\n` +
            `*${config.prefix}details <url>* or *<number>*\n` +
            `Get video & channel details\n\n` +
            `*How to use:*\n` +
            `1. Search YouTube: *${config.prefix}search lofi music*\n` +
            `2. Download/Get details: *${config.prefix}audio 1* or *${config.prefix}details 2*`
        );
    }

    // Handle search command
    if (message.body.startsWith(`${config.prefix}search`)) {
        const searchQuery = message.body.substring(`${config.prefix}search`.length).trim();
        if (!searchQuery) {
            return client.sendMessage(message.from, '*[❎]* Please provide a search query. Example: !search lofi music');
        }
        
        try {
            return await searchYouTube(searchQuery);
        } catch (err) {
            console.log("Search failed completely");
            console.log(err);
            return client.sendMessage(message.from, '*[❎]* Failed to search YouTube. Please try again later.');
        }
    }

    // Process audio/video/details commands with numbers
    if (message.body.startsWith(`${config.prefix}audio `) && commandArgs.length === 2) {
        if (isReply) {
            return await handleReplyDownload('mp3', 'audioonly');
        } else {
            return await handleNumberedDownload('mp3', 'audioonly');
        }
    }
    
    if (message.body.startsWith(`${config.prefix}video `) && commandArgs.length === 2) {
        if (isReply) {
            return await handleReplyDownload('mp4', 'audioandvideo');
        } else {
            return await handleNumberedDownload('mp4', 'audioandvideo');
        }
    }
    
    if (message.body.startsWith(`${config.prefix}details `) && commandArgs.length === 2) {
        if (isReply) {
            return await handleReplyDetails();
        } else {
            return await handleNumberedDetails();
        }
    }

    // Handle existing URL-based commands
    let url = commandArgs[1];
    if (url == undefined) return;
    
    if ((message.body.startsWith(`${config.prefix}audio`) || message.body.startsWith(`${config.prefix}video`) || message.body.startsWith(`${config.prefix}detail`)) && !ytdl.validateURL(url)) {
        return client.sendMessage(message.from, '*[❎]* Failed!, Invalid YouTube URL');
    }
    
    if (message.body.startsWith(`${config.prefix}audio`)) {
        downloadYouTube(url, 'mp3', 'audioonly');
    } else if (message.body.startsWith(`${config.prefix}video`)) {
        downloadYouTube(url, 'mp4', 'audioandvideo');
    } else if (message.body.startsWith(`${config.prefix}detail`)) {
        detailYouTube(url);
    }
});

client.initialize();
process.on('exit', async () => {
    if (browser) await browser.close();
});