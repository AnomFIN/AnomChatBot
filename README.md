# AnomChatBot

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

### 🛠 Hallintapaneeli (Telegram)
- `/start` - Käynnistä botti
- `/stop` - Pysäytä botti
- `/restart` - Käynnistä uudelleen
- `/status` - Näytä botin tila ja tilastot
- `/list` - Listaa aktiiviset keskustelut
- `/stats` - Yksityiskohtaiset tilastot
- `/logs` - Viimeisimmät admin-logit
- `/help` - Ohje

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

# Telegram Configuration
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_ADMIN_IDS=123456789,987654321

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

## 📱 Käyttö

### Telegram-hallintapaneeli

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
