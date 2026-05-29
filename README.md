# Tjenamors Musikquiz!

Welcome to Tjenamors Musikquiz! This repository contains everything you need to run the full-stack multiplayer quiz app.

## Hosting with Docker (Recommended)

The easiest way to run the quiz server is using Docker. This ensures a consistent environment and makes deployment a breeze.

1. **Build the image:**
   ```bash
   docker build -t tjenamors-musikquiz .
   ```

2. **Run the container:**
   You should **absolutely never** bake your API keys into the Docker image itself. Instead, pass it at runtime using the `-e` flag.

   ```bash
   docker run -p 3000:3000 -e GEMINI_API_KEY="your_api_key_here" tjenamors-musikquiz
   ```

   **Getting an API Key:**
   To use the AI generation features, you will need a free API Key. You can get one from the API Provider.
   
   *Note: If you don't want to use AI generation for quizzes, you can omit the `-e GEMINI_API_KEY` flag entirely.*

## Playing with Friends (Network Setup)

By default, the server runs on port `3000`. If you just visit `http://localhost:3000`, it will only work on your own machine. For your friends to join the quiz from their phones or other computers, they need to connect to your machine's IP address.

### Option 1: Local Network (Wi-Fi)
If you and your friends are on the same Wi-Fi network:
1. Find your machine's local IPv4 address.
   - **Windows:** Open Command Prompt and type `ipconfig` (look for "IPv4 Address").
   - **Mac/Linux:** Open Terminal and type `ifconfig` or `ip a` (look for `inet` under your Wi-Fi interface, typically starting with `192.168.x.x` or `10.x.x.x`).
2. Share this IP with your friends. They will join by going to: `http://192.168.x.x:3000` (replacing the IP with your actual address).

### Option 2: Over the Internet (Tailscale)
If you want to play with friends who are not on your local network, we highly recommend using **[Tailscale](https://tailscale.com/)** to easily link your devices in a secure, zero-config VPN.

1. **Install Tailscale:** Download and install Tailscale on the machine hosting the Docker container, and have your friends install it on their devices (phones, tablets, or PCs).
2. **Log In:** Everyone logs in to the same Tailscale network (or you can invite their devices to your tailnet).
3. **Find your Tailscale IP:** Open the Tailscale app on your host machine to find its Tailscale IP (typically starting with `100.x.x.x`).
4. **Share the Link:** Have your friends open their browsers and go to `http://100.x.x.x:3000` (replacing the IP with your actual Tailscale IP).

## Local Development Setup

If you wish to modify the code or run it without Docker:

**Prerequisites:** Node.js (v18+)

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file in the root directory and set your API key:
   ```env
   GEMINI_API_KEY="your-api-key"
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```