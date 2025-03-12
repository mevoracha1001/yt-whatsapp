# WhatsApp Bot by Rachamim Mevorach

## 🤖 Overview

This WhatsApp bot automates interactions on WhatsApp, providing a range of features to enhance communication and engagement. Developed by Rachamim Mevorach, it offers robust YouTube search and download capabilities.

## ✨ Features

- **YouTube Integration**:
  - Search for YouTube videos using multiple methods for reliable results.
  - Download audio or video from YouTube by URL or search result selection.
  - Retrieve detailed information about YouTube videos and channels.

- **Command Handling**:
  - `!search <query>`: Search for YouTube videos.
  - `!audio <url>` or `!audio <number>`: Download audio from YouTube.
  - `!video <url>` or `!video <number>`: Download video from YouTube.
  - `!details <url>` or `!details <number>`: Get video and channel details.

- **Media Handling**:
  - Send and receive images, videos, and documents.

- **Group Management**:
  - Differentiate between group and individual chats.

## 🛠️ Technologies Used

- **Node.js**: Backend runtime environment.
- **whatsapp-web.js**: Interface for interacting with WhatsApp.
- **Puppeteer**: Headless browser automation.
- **Axios and Cheerio**: HTTP requests and HTML parsing.
- **ytdl-core**: YouTube video downloading.

## 🚀 Getting Started

To set up and run the bot, follow these steps:

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/yourusername/whatsapp-bot.git
   cd whatsapp-bot
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy the example environment file and update it with your credentials.
   ```bash
   cp .env.example .env
   ```

4. **Start the Bot**:
   ```bash
   npm start
   ```

## 📱 Connect With Me

For more information and updates, visit my social hub at [tech.mevcentral.com](https://tech.mevcentral.com).

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgements

Special thanks to the developers of the libraries and tools used in this project.

