# AnomChatBot - Pika-aloitusohje

## 1. Asennus (3 minuuttia)

```bash
# Kloonaa repo
git clone https://github.com/AnomFIN/AnomChatBot.git
cd AnomChatBot

# Asenna
python3 install.py
```

## 2. Konfigurointi (2 minuuttia)

Muokkaa `.env` tiedostoa:

```bash
nano .env
```

Lisää vähintään nämä:

```
OPENAI_API_KEY=sk-your-openai-key-here
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_ADMIN_IDS=your-telegram-user-id
```

### Mistä saan avaimet?

**OpenAI:**
- https://platform.openai.com/api-keys
- Luo uusi avain → Kopioi

**Telegram Bot:**
1. Avaa @BotFather Telegramissa
2. `/newbot` → Seuraa ohjeita
3. Kopioi token

**Telegram ID:**
1. Avaa @userinfobot Telegramissa
2. `/start`
3. Kopioi ID-numero

## 3. Käynnistys

```bash
python3 main.py
```

Näet:
```
✅ All components initialized successfully!
✅ Telegram bot started
ℹ WhatsApp bot ready (use /start in Telegram to activate)
✅ AnomChatBot is running!
```

## 4. Käyttö

### Telegram:

1. Etsi bottisi Telegramissa (käytä @BotFather:lta saamaasi username)
2. Lähetä: `/start`
3. Lähetä: `/status` - Tarkista että kaikki OK
4. Lähetä: `/help` - Näe kaikki komennot

### WhatsApp (kun integroitu):

1. Lähetä ensimmäinen viesti WhatsApp-kontaktille
2. Botti vastaa automaattisesti seuraaviin

## 5. Testaus ilman WhatsApp-integraatiota

Jos haluat testata Telegram-osiota ennen WhatsApp-integraatiota:

```bash
# Käynnistä botti
python3 main.py
```

Telegram-komennot toimivat heti:
- `/status` - Näytä tila
- `/stats` - Tilastot
- `/help` - Ohje
- `/list` - Keskustelut (tyhjä jos ei WhatsApp-yhteyksiä)

## 6. Ongelmat?

### Virhe: "Configuration validation failed"
→ Tarkista että `.env` tiedostossa on kaikki avaimet

### Virhe: "Failed to initialize database"
→ Varmista että `data/` hakemisto on olemassa
→ Aja: `mkdir -p data/{conversations,media,logs,whatsapp_session}`

### Virhe: "Unauthorized" (Telegram)
→ Tarkista TELEGRAM_BOT_TOKEN

### Virhe: "Not admin" (Telegram)
→ Tarkista TELEGRAM_ADMIN_IDS

## 7. Systemd (valinnainen)

Linux-palvelimella käynnistys automaattisesti:

```bash
sudo cp anomchatbot.service /etc/systemd/system/
sudo systemctl enable anomchatbot
sudo systemctl start anomchatbot
```

Tarkista:
```bash
sudo systemctl status anomchatbot
```

## 8. Pysäytys

Paina `Ctrl+C` terminaalissa

Tai Telegram:ssa: `/stop`

---

## Seuraavat askeleet

1. **WhatsApp-integraatio**: Katso `README.md` → WhatsApp-osio
2. **Keskustelujen konfigurointi**: Sävy, flirtti-taso, system prompt
3. **Seuranta**: `/status` ja lokit `data/logs/anomchatbot.log`

## Tuki

Ongelmissa: Lue `README.md` → Vianmääritys
