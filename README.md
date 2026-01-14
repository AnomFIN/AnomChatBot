# AnomChatBot

**Trip (350 chars):** Ihmisen ohjaama chatbot-silta, joka yhdistää WhatsAppin, Telegramin ja OpenAI:n. Operaattori hallitsee keskusteluja Telegram-paneelistä, lähettäen ensimmäisen viestin käsin ja aktivoiden tekoälyn tarpeen mukaan. Keskustelukohtaiset asetukset ja täysi viestihistoria. Tuotantovalmis modulaarinen Node.js-järjestelmä automaattisella reconnect-logiikalla ja vikasiedolla.

**Jab Start (500 chars):** Telegram-ohjattu chatbot-alusta WhatsApp-keskusteluihin tekoälyn avulla. Järjestelmä vaatii, että ensimmäinen viesti lähetetään aina manuaalisesti, minkä yhteydessä määritetään tekoälyhahmon persoona system promptilla. Tekoäly esiintyy aitona nuorena henkilönä, ei AI-assistenttina. Tukee kuvia, videoita ja ääniviestejä. Keskustelut ovat täysin hallittavissa Telegram-paneelista komennoin ja asetuksin. Modulaarinen arkkitehtuuri: WhatsApp-silta, Telegram-kontrolleri, AI-moottori, keskustelunhallinta, mediankäsittely. Automaattinen yhteyden palautus ja virheenkäsittely.

## 🎯 Overview

Production-ready chatbot bridge system that connects WhatsApp, Telegram, and OpenAI, controlled by a human operator.

**NEW**: Now includes a beautiful Web GUI that allows you to use the bot without Telegram! See [WEBGUI.md](WEBGUI.md) for details.

### Key Features

- **Web GUI**: Modern web interface for bot control (Telegram now optional!)
- **Human-in-the-loop**: Operator controls AI through Telegram control panel or Web GUI
- **First message manual**: Always requires human to initiate conversation
- **Conversation-specific settings**: Customizable AI personality per chat
- **Full message history**: Complete context for AI responses
- **Media support**: Images, videos, audio messages with AI analysis
- **Production-ready**: Auto-reconnect, error handling, logging
- **Modular architecture**: Clean separation of concerns
- **Real-time Updates**: WebSocket support for instant message notifications

## 🏗️ Architecture

```
WhatsApp ↔ WhatsAppBridge ↔ ConversationManager ↔ TelegramController
                                    ↕
                              AIEngine (OpenAI)
                                    ↕
                              MediaHandler
```

### Modules

- **WhatsAppBridge**: WhatsApp connection and message handling
- **TelegramController**: Operator control panel with commands
- **AIEngine**: OpenAI integration and response generation
- **ConversationManager**: State, history, and settings management
- **MediaHandler**: Media processing and AI analysis
- **Logger**: Centralized logging system

## 📋 Requirements

- **Node.js** 18+ (LTS recommended)
- **npm** 8+
- **Linux** environment (Ubuntu/Debian recommended)
- **Chrome/Chromium** browser (for WhatsApp Web)
- **OpenAI API** key
- **Telegram Bot** token

## 🚀 Installation

### Quick Install (Recommended)
**AI-ohjattu monitasoinen chatbot WhatsApp- ja Telegram-keskusteluihin**

AnomChatBot on ammattimaisesti toteutettu chatbot-järjestelmä, joka yhdistää WhatsApp-viestit, Telegram-hallintapaneelin ja OpenAI:n tekoälyn. Botti vastaa ihmismäisesti viesteihin ja ymmärtää tekstiä, kuvia, videoita ja ääntä.

## ✨ Ominaisuudet

### 🤖 Tekoälyintegraatio
- **OpenAI GPT-4** -pohjainen keskustelukumppani
- Ymmärtää ja analysoi **tekstiä, kuvia, videoita ja ääntä**
- Mukautettu system prompt jokaiselle keskustelulle
- Kontekstin ylläpito keskusteluhistorian avulla

### 💬 Monialustaisuus
- **WhatsApp**-integraatio (WhatsApp Web)
- **Telegram**-integraatio hallintapaneelilla
- Yhtenäinen keskustelunhallinta molemmille alustoille

### 🎯 Keskustelukohtaiset asetukset
- **Ensimmäinen viesti** kirjoitetaan aina käsin
- **Sävy-asetukset**: Professional, Friendly, Casual, Playful
- **Flirtti-taso**: None, Subtle, Moderate, High
- Mukautettu system prompt per keskustelu
- Temperature ja muut AI-parametrit

### 🛠 Hallintapaneeli (Telegram tai Web GUI)

**Telegram-komennot:**
- `/start` - Käynnistä botti
- `/stop` - Pysäytä botti
- `/restart` - Käynnistä uudelleen
- `/status` - Näytä botin tila ja tilastot
- `/list` - Listaa aktiiviset keskustelut
- `/stats` - Yksityiskohtaiset tilastot
- `/logs` - Viimeisimmät admin-logit
- `/help` - Ohje

**Web GUI (Uusi!):**
- Moderni web-käyttöliittymä osoitteessa http://localhost:3001/
- Ei vaadi Telegram-bottia (valinnainen)
- Reaaliaikaiset viestipäivitykset WebSocketin kautta
- Keskustelujen hallinta ja viestien lähetys
- Botin asetusten konfigurointi
- Katso [WEBGUI.md](WEBGUI.md) lisätietoja varten

### 📊 Tietokanta ja historia
- SQLite-tietokanta keskusteluille ja viesteille
- Automaattinen historian tallennus
- Keskustelukohtainen mediakirjasto
- Admin-lokit kaikista toiminnoista

### 🔒 Virheenkäsittely
- Kattava virheenkäsittely kaikissa komponenteissa
- Strukturoitu lokitus (console + tiedosto)
- Automaattinen uudelleenkäynnistys systemd:n kautta

## 📋 Vaatimukset

- **Käyttöjärjestelmä**: Linux (suositeltu), macOS, Windows
- **Python**: 3.8 tai uudempi
- **OpenAI API-avain**
- **Telegram Bot Token**
- **RAM**: Vähintään 1GB vapaata muistia
- **Tallennustila**: Vähintään 500MB vapaata tilaa

## 🚀 Asennus

### 1. Kloonaa repositorio

```bash
git clone https://github.com/AnomFIN/AnomChatBot.git
cd AnomChatBot
```

### 2. Suorita asennusohjelma

```bash
python3 install.py
```

The installation script will:
1. Check system requirements
2. Ask for configuration (API keys, tokens)
3. Create `.env` file
4. Install dependencies
5. Verify installation
6. Optionally start the bot

### Manual Installation

1. **Clone repository**
```bash
git clone https://github.com/AnomFIN/AnomChatBot.git
cd AnomChatBot
```

2. **Install Node.js dependencies**
```bash
npm install
```

3. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your values
```

4. **Required environment variables:**
```env
OPENAI_API_KEY=sk-...
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_ADMIN_ID=123456789
LOG_LEVEL=info
```

## 🎮 Usage

### Starting the Bot

```bash
npm start
# or
npm run dev
# or
node index.js
```

### First Time Setup

1. **Start the bot** - You'll see a QR code in the terminal
2. **Scan QR code** with WhatsApp on your phone
3. **Wait for "ready"** message in terminal and Telegram
4. **Done!** Bot is ready to handle messages

## 📱 Telegram Control Panel

### Basic Commands

- `/start` - Show welcome and command list
- `/status` - System status (connections, errors)
- `/conversations` - List active chats
- `/help` - Detailed help guide

### Working with Conversations

1. **Receive message**: WhatsApp message automatically forwarded to Telegram
2. **Manual response**: Reply to the forwarded message
3. **Enable AI**: Reply with `/ai [system_prompt]`
   ```
   /ai You are a friendly 22-year-old interested in fitness
   ```
4. **AI handles rest**: Subsequent messages answered automatically

### AI Control

```bash
# Enable AI with custom personality
/ai You are a young professional who loves tech and gaming

# Stop AI for current chat
/stop_ai

# Clear conversation history
/clear
```

### Settings (per conversation)

```bash
# Set flirt level (0.1 - 1.0)
/set_flirt 0.7

# Set tone
/set_tone friendly
/set_tone distant
/set_tone playful

# Set response speed
/set_speed fast
/set_speed normal
/set_speed slow
```

## 🧠 How AI Works

### System Prompt
- Set with first AI activation: `/ai [your_prompt]`
- Defines AI personality for the conversation
- Remains active for all subsequent messages
- Example: "You are a 23-year-old software developer who loves gaming and fitness. Chat naturally on WhatsApp."

### Conversation Context
- Full message history maintained
- Last 20 messages sent to AI for context
- Media descriptions included in context
- AI responds based on entire conversation flow

### AI Personality
- **Human-like**: No "AI assistant" behavior
- **Brief responses**: Like real WhatsApp chat
- **Natural language**: No formal structure
- **Context-aware**: Remembers previous messages

## 🖼️ Media Handling

### Supported Media Types

- **Images**: AI can analyze and comment (via GPT-4 Vision)
- **Videos**: Detected and acknowledged
- **Audio**: Voice messages detected
- **Documents**: PDFs and files detected

### AI Media Analysis

When user sends an image:
1. Image downloaded from WhatsApp
2. Sent to GPT-4 Vision for analysis
3. AI generates natural comment
4. Full context maintained for conversation

Example:
```
User: [sends coffee cup image]
AI: "Nice coffee! Espresso or cappuccino?"
```

## 🔧 Configuration

### Conversation Settings

Each conversation has independent settings:

```javascript
{
  flirtLevel: 0.5,        // 0.1 - 1.0
  tone: 'friendly',       // friendly, distant, playful
  responseSpeed: 'normal', // fast, normal, slow
  aiAggressiveness: 0.5   // 0.1 - 1.0
}
```

These affect:
- AI temperature (creativity)
- Response length
- Personality expression

### Logging

Logs stored in `logs/` directory:
- `combined.log` - All logs
- `error.log` - Errors only

Log level configurable in `.env`:
```env
LOG_LEVEL=info  # error, warn, info, debug
```

## 🛡️ Error Handling

### Auto-Reconnect

- **WhatsApp disconnects**: Automatic reconnection with exponential backoff
- **OpenAI errors**: Graceful fallback, operator notification
- **Network issues**: Retry logic with configurable attempts

### Fault Tolerance

- **OpenAI down**: Bot continues, manual responses work
- **WhatsApp down**: Telegram notifications, auto-reconnect
- **Telegram down**: Queued messages, retry on reconnect

### Notifications

Operator receives Telegram notifications for:
- Connection status changes
- AI response failures
- Critical errors
- System restarts

## 📁 Project Structure

```
AnomChatBot/
├── index.js                 # Main application entry
├── package.json            # Dependencies
├── .env.example            # Environment template
├── .gitignore             # Git ignore rules
├── install.py             # Installation script
├── README.md              # This file
├── src/
│   ├── bridges/
│   │   ├── WhatsAppBridge.js      # WhatsApp connection
│   │   └── TelegramController.js  # Telegram bot
│   ├── managers/
│   │   ├── AIEngine.js            # OpenAI integration
│   │   └── ConversationManager.js # State management
│   ├── handlers/
│   │   └── MediaHandler.js        # Media processing
│   └── utils/
│       └── logger.js              # Logging utility
└── logs/                  # Log files (auto-created)
```

## 🔐 Security

### Best Practices

- **No hardcoded keys**: All sensitive data in `.env`
- **Admin-only access**: Telegram commands restricted to admin
- **Secure sessions**: WhatsApp auth stored locally
- **Error handling**: No sensitive data in error messages

### Environment Variables

Never commit `.env` file to version control. Use `.env.example` as template.

## 🐛 Troubleshooting

### WhatsApp won't connect

```bash
# Remove session and restart
rm -rf .wwebjs_auth/
node index.js
```

### Telegram commands not working

Check admin ID:
```bash
# Get your user ID
# Message @userinfobot on Telegram
# Update TELEGRAM_ADMIN_ID in .env
```

### OpenAI API errors

- Check API key is valid
- Verify account has credits
- Check rate limits

### Dependencies issues

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

## 📝 Development

### Running in Development

```bash
npm run dev
```

### Logs

Monitor logs in real-time:
```bash
tail -f logs/combined.log
```

### Testing

Send test message:
1. Send WhatsApp message to connected number
2. Check Telegram for forwarded message
3. Reply in Telegram
4. Verify delivery in WhatsApp

## 🤝 Contributing

This is a production system. Contributions should maintain:
- Code quality and documentation
- Modular architecture
- Error handling
- Security best practices

## 📄 License

MIT License - See LICENSE file

## 👤 Author

**AnomFIN**

## 🙏 Acknowledgments

- **whatsapp-web.js** - WhatsApp Web API
- **node-telegram-bot-api** - Telegram Bot API
- **OpenAI** - GPT-4 and Vision APIs
- **winston** - Logging framework

---

**Note**: This is a human-controlled chatbot system, not an automated spam tool. Always respect privacy and terms of service of all platforms.
Asennusohjelma:
- ✅ Tarkistaa järjestelmävaatimukset
- ✅ Asentaa Python-riippuvuudet
- ✅ Luo tarvittavat hakemistot
- ✅ Kopioi .env-pohjan
- ✅ Luo systemd-service tiedoston
- ✅ Varmistaa asennuksen toimivuuden

### 3. Konfiguroi ympäristö

Muokkaa `.env` tiedostoa ja lisää:

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_MODEL=gpt-4-turbo-preview

# Telegram Configuration (optional if using Web GUI)
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_ADMIN_IDS=123456789,987654321

# Web GUI Configuration (NEW!)
WEB_GUI_ENABLED=true
WEB_GUI_HOST=0.0.0.0
WEB_GUI_PORT=3001
TELEGRAM_ENABLED=false  # Set to false to use Web GUI without Telegram

# Database (default)
DATABASE_URL=sqlite+aiosqlite:///./data/conversations.db
```

#### API-avainten hankkiminen:

**OpenAI API-avain:**
1. Rekisteröidy osoitteessa https://platform.openai.com/
2. Siirry API keys -osioon
3. Luo uusi API-avain

**Telegram Bot Token:**
1. Avaa Telegram ja etsi @BotFather
2. Lähetä komento `/newbot`
3. Seuraa ohjeita ja saat tokenin
4. Hanki oma Telegram ID: @userinfobot

### 4. Käynnistä botti

```bash
python3 main.py
```

Jos Web GUI on käytössä, se on saatavilla osoitteessa: **http://localhost:3001/**

## 📱 Käyttö

### Kaksi käyttötapaa:

#### Tapa 1: Web GUI (Suositeltu uusille käyttäjille!)
1. Aseta `.env` tiedostossa `WEB_GUI_ENABLED=true` ja `TELEGRAM_ENABLED=false`
2. Käynnistä botti: `python3 main.py`
3. Avaa selaimella: http://localhost:3001/
4. Hallitse keskusteluja ja lähetä viestejä web-käyttöliittymän kautta
5. **Ei vaadi Telegram-bottia!**

Katso täydet ohjeet: [WEBGUI.md](WEBGUI.md)

#### Tapa 2: Telegram-hallintapaneeli (Perinteinen tapa)

1. Avaa Telegram ja etsi bottisi
2. Lähetä `/start` käynnistääksesi botin
3. WhatsApp-botti käynnistyy ja odottaa yhteyttä
4. Käytä `/status` tarkistaaksesi yhteyden

### WhatsApp-keskustelut

1. Ensimmäinen viesti **täytyy lähettää käsin**:
   - Määritä keskustelukohtainen system prompt
   - Aseta sävy ja flirtti-taso
   - Lähetä ensimmäinen viesti

2. Tämän jälkeen botti vastaa automaattisesti:
   - Ymmärtää tekstiviestit
   - Analysoi kuvat (GPT-4 Vision)
   - Litteroi ääniviestit (Whisper)
   - Käsittelee videot (frame-analyysi)

### Keskustelun konfigurointi

```python
# Esimerkki: Aseta keskusteluasetukset
await conversation_manager.configure_conversation(
    chat_id="1234567890@c.us",
    system_prompt="Olet avulias IT-tukihenkilö.",
    tone_level=0.0,  # Professional
    flirt_level=0.0,  # None
    temperature=0.7
)
```

## 🏗 Arkkitehtuuri

```
AnomChatBot/
├── main.py                 # Pääsovellus
├── install.py              # Asennusohjelma
├── requirements.txt        # Python-riippuvuudet
├── .env.example           # Ympäristömuuttujien pohja
├── config/
│   └── config.yaml        # Konfiguraatio
├── src/
│   ├── config.py          # Konfiguraationhallinta
│   ├── database.py        # Tietokantahallinta
│   ├── models.py          # Tietokantamallit
│   ├── openai/
│   │   └── openai_manager.py     # OpenAI-integraatio
│   ├── conversation/
│   │   └── conversation_manager.py  # Keskustelunhallinta
│   ├── telegram/
│   │   └── telegram_bot.py       # Telegram-botti
│   └── whatsapp/
│       └── whatsapp_bot.py       # WhatsApp-botti
└── data/
    ├── conversations/     # Keskustelutiedot
    ├── media/            # Mediatiedostot
    ├── logs/             # Lokitiedostot
    └── whatsapp_session/ # WhatsApp-sessio
```

## 🔧 Systemd-palvelu (Linux)

### Asenna palvelu

```bash
sudo cp anomchatbot.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable anomchatbot
```

### Hallitse palvelua

```bash
# Käynnistä
sudo systemctl start anomchatbot

# Pysäytä
sudo systemctl stop anomchatbot

# Tila
sudo systemctl status anomchatbot

# Logit
sudo journalctl -u anomchatbot -f
```

## 📊 Tietokanta

Botti käyttää SQLite-tietokantaa, joka sisältää:

- **conversations**: Keskustelut ja niiden asetukset
- **messages**: Kaikki viestit historioineen
- **bot_status**: Botin tila ja tilastot
- **admin_logs**: Admin-toiminnot

## 🎨 Keskusteluasetusten tasot

### Sävy (tone_level)
- `0.0` - **Professional**: Ammattimainen ja asiallinen
- `0.5` - **Friendly**: Ystävällinen ja lämmin
- `0.8` - **Casual**: Rento ja epämuodollinen
- `1.0` - **Playful**: Leikkisä ja humoristinen

### Flirtti (flirt_level)
- `0.0` - **None**: Ei flirttiä
- `0.3` - **Subtle**: Kevyt flirtti
- `0.6` - **Moderate**: Kohtuullinen flirtti
- `0.9` - **High**: Selvästi flirttaileva

## 🔐 Turvallisuus

- ✅ API-avaimet .env-tiedostossa (ei versionhallinnassa)
- ✅ Admin-oikeudet Telegram ID:llä
- ✅ Virheenkäsittely kaikissa komponenteissa
- ✅ Lokitus kaikista admin-toiminnoista
- ✅ Tietokanta paikallisesti (ei pilvipalveluissa)

## 🐛 Vianmääritys

### Botti ei käynnisty

1. Tarkista `.env`-tiedosto:
   ```bash
   cat .env
   ```

2. Tarkista lokitiedostot:
   ```bash
   cat data/logs/anomchatbot.log
   ```

3. Testaa riippuvuudet:
   ```bash
   python3 -c "import openai, telegram, sqlalchemy; print('OK')"
   ```

### WhatsApp ei yhdistä

1. Tarkista session-hakemisto:
   ```bash
   ls -la data/whatsapp_session/
   ```

2. Poista vanha sessio ja yritä uudelleen:
   ```bash
   rm -rf data/whatsapp_session/*
   ```

### Telegram-komennot eivät toimi

1. Varmista, että Telegram ID on admin-listalla
2. Tarkista bot-token
3. Testaa bottia `/start`-komennolla

## ✅ WhatsApp-integraatio (VALMIS)

WhatsApp Web -integraatio on nyt täysin toimiva!

### Käyttöönotto:

1. **Ensimmäinen käynnistys**:
   ```bash
   python main.py
   ```

2. **QR-koodin skannaus**:
   - QR-koodi tallentuu: `data/qr_code.png`
   - Skannaa WhatsApp-sovelluksella (Asetukset > Yhdistetyt laitteet)

3. **Sessio säilyy**:
   - Seuraavilla kerroilla ei tarvitse skannata uudelleen
   - Sessio tallennetaan: `data/whatsapp_session/`

### Ominaisuudet:

- ✅ Tekstiviestien vastaanotto ja lähetys
- ✅ Kuvien lataus ja analyysi (GPT-4 Vision)
- ✅ Ääniviestien litterointi (Whisper)
- ✅ Videoiden käsittely
- ✅ Automaattinen uudelleenyhdistäminen
- ✅ Ryhmäkeskustelujen suodatus (vastaa vain 1-on-1)

### Android (Termux):

Katso: [TERMUX_GUIDE.md](TERMUX_GUIDE.md)

Pika-asennus:
```bash
python runwithtermux.py install
python runwithtermux.py setup
python runwithtermux.py run
```

### Tekniset yksityiskohdat:

Käyttää `webwhatsapi` + `selenium` -kirjastoja:
- QR-koodin automaattinen tallennus
- Sessiohallinta Chrome-profiililla
- Rate limiting: max 20 viestiä/tunti
- Automaattinen reconnect

### Vianmääritys:

**WhatsApp ei yhdistä:**
```bash
# Poista vanha sessio
rm -rf data/whatsapp_session/*

# Käynnistä uudelleen
python main.py
```

**QR-koodi ei näy:**
- Tarkista: `data/qr_code.png`
- Avaa kuva ja skannaa puhelimella

**Viestit eivät tule perille:**
- Tarkista että botti on käynnissä
- Tarkista lokit: `data/logs/anomchatbot.log`
- Varmista että chat ei ole ryhmä
## 📝 WhatsApp-integraatio

WhatsApp-botti on nyt toteutettu käyttäen **webwhatsapi**-kirjastoa, joka automatisoi WhatsApp Webiä Seleniumin avulla.

### Nykyinen Toteutus

**Kirjasto:** webwhatsapi (Selenium-pohjainen WhatsApp Web -automatisointi)

**Ominaisuudet:**
- ✅ QR-koodin autentikointi sessiotallenuksella
- ✅ Reaaliaikainen viestien kuuntelu
- ✅ Teksti-, kuva-, ääni- ja videoviestien käsittely
- ✅ Median automaattinen lataus ja tallennus
- ✅ Automaattinen uudelleenyhdistäminen
- ✅ Ryhmäviestien suodatus (vain yksityiskeskustelut)

### Käyttöönotto

1. **Asenna riippuvuudet:**
   ```bash
   pip install -r requirements.txt
   # Sisältää: webwhatsapi, selenium, webdriver-manager
   ```

2. **Asenna Chrome-selain:**
   ```bash
   # Ubuntu/Debian
   sudo apt-get update
   sudo apt-get install -y chromium-browser
   
   # macOS
   brew install --cask google-chrome
   
   # Windows: Lataa ja asenna Chrome manuaalisesti
   ```

3. **Ensimmäinen käynnistys:**
   ```bash
   python3 main.py
   ```
   - Botti avaa selaimen ja näyttää QR-koodin
   - Skannaa QR-koodi WhatsApp-mobiilisovelluksella
   - Sessio tallentuu automaattisesti `data/whatsapp_session/` -hakemistoon

4. **Seuraavat käynnistykset:**
   - Botti käyttää tallennettua sessiota
   - Ei tarvitse skannata QR-koodia uudelleen
   - Jos sessio vanhenee, näytetään uusi QR-koodi

### Median tallennus

Ladatut mediatiedostot tallennetaan:
- **Kuvat:** `data/media/images/`
- **Äänet:** `data/media/audio/`
- **Videot:** `data/media/video/`
- **Dokumentit:** `data/media/documents/`

### Rajoitukset

⚠️ **Huomioitavaa:**
- webwhatsapi ei ole aktiivisesti ylläpidetty (viimeisin päivitys 2018)
- Selenium-pohjainen ratkaisu voi rikkoutua WhatsApp Web -päivitysten yhteydessä
- Ei suositella erittäin suurivolyymiseen tuotantokäyttöön
- Saattaa kohdata WhatsAppin anti-bot -toimenpiteitä

### Tuotantokäyttö - Suositukset

Vakavaan tuotantokäyttöön suosittelemme siirtymistä:

1. **Node.js Baileys + Python REST API**
   - Vakain WhatsApp Web API
   - Aktiivinen kehitys ja ylläpito
   - Monilaitteen tuki
   - Täydet ominaisuudet
   
   **Toteutus:**
   ```bash
   # Erillinen Node.js-palvelu
   npm install baileys express
   # Altista REST API Python-integraatiota varten
   pip install whatsapp-api-py
   ```

2. **WhatsApp Business API (Virallinen)**
   - Meta/WhatsAppin virallinen ratkaisu
   - Luotettavin ja yhteensopivin
   - Sovelias yrityskäyttöön
   - Vaatii Facebook Business Manager -tilin
   - Hinnoittelu keskusteluvolyymiin perustuen
   
   **Kirjastot:**
   - `whatsapp-python` (PyPI)
   - `PyWa` framework

3. **Kolmannen osapuolen API-palvelut**
   - **Twilio WhatsApp API**
   - **MessageBird WhatsApp API**
   - **360dialog WhatsApp API**
   
   **Edut:**
   - Hallittu infrastruktuuri
   - Luotettava käyttöaika
   - Tuki sisältyy

### Siirtymäpolku tuotantoon

1. Käytä nykyistä toteutusta testaukseen/kehitykseen
2. Tuotantoon ota käyttöön Baileys Node.js -palvelu
3. Päivitä WhatsAppBot käyttämään REST API:a Seleniumin sijaan
4. Säilytä sama rajapinta jotta ConversationManager-integraatio pysyy muuttumattomana

### Vianmääritys

**QR-koodi ei näy:**
```bash
# Tarkista Chrome-asennus
google-chrome --version
chromium --version

# Tarkista lokitiedostot
tail -f data/logs/anomchatbot.log
```

**Sessio ei tallennu:**
```bash
# Tarkista oikeudet
ls -la data/whatsapp_session/
chmod -R 755 data/whatsapp_session/
```

**Viestejä ei vastaanoteta:**
- Varmista että botti on käynnissä
- Tarkista että WhatsApp Web -yhteys on aktiivinen
- Tarkista lokitiedostoista mahdolliset virheet

Katso lisätietoja ja tuotanto-ohjeita tiedostosta `src/whatsapp/whatsapp_bot.py`.

## 🤝 Kehitys

### Lisää uusi ominaisuus

1. Luo uusi moduuli `src/` hakemistoon
2. Integroi `main.py` tiedostoon
3. Päivitä dokumentaatio

### Testaus

```bash
# Asenna dev-riippuvuudet
pip install pytest pytest-asyncio

# Aja testit (kun toteutettu)
pytest tests/
```

## 📄 Lisenssi

MIT License - Katso [LICENSE](LICENSE) tiedosto

## 🙋 Tuki

Ongelmatilanteissa:
1. Tarkista dokumentaatio
2. Lue lokitiedostot
3. Avaa issue GitHubissa

## 🎯 Tulevat ominaisuudet

- [x] WhatsApp-integraation toteutus (webwhatsapi)
- [ ] Siirtyminen Baileys-pohjaiseen ratkaisuun tuotantoa varten
- [ ] Web-pohjainen hallintapaneeli
- [ ] Monimutkaisemmat keskustelupolut
- [ ] Automaattinen backup
- [ ] Analytiikkadashboard
- [ ] Tuki useammille kielille
- [ ] Voice-viestien generointi
- [ ] Scheduled messages
- [ ] A/B testing keskusteluille

## 👨‍💻 Tekijä

**AnomFIN**

---

**Huom:** Muista noudattaa WhatsAppin ja Telegramin käyttöehtoja käyttäessäsi tätä bottia. Älä lähetä roskapostia tai häiritse käyttäjiä.
