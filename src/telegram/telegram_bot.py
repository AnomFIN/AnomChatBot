"""
Telegram bot with admin panel for AnomChatBot
"""
import asyncio
from typing import Optional
from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
    MessageHandler,
    ContextTypes,
    filters
)
from loguru import logger

from src.config import Config
from src.database import DatabaseManager
from src.conversation.conversation_manager import ConversationManager


class TelegramBot:
    """Telegram bot for admin panel and conversations"""
    
    def __init__(
        self,
        config: Config,
        db_manager: DatabaseManager,
        conversation_manager: ConversationManager,
        whatsapp_bot=None
    ):
        self.config = config
        self.db = db_manager
        self.conversation_manager = conversation_manager
        self.whatsapp_bot = whatsapp_bot
        
        # Bot application
        self.application: Optional[Application] = None
        self.is_running = False
    
    async def initialize(self):
        """Initialize Telegram bot"""
        try:
            self.application = Application.builder().token(
                self.config.telegram_bot_token
            ).build()
            
            # Add command handlers
            self.application.add_handler(CommandHandler("start", self.cmd_start))
            self.application.add_handler(CommandHandler("stop", self.cmd_stop))
            self.application.add_handler(CommandHandler("restart", self.cmd_restart))
            self.application.add_handler(CommandHandler("status", self.cmd_status))
            self.application.add_handler(CommandHandler("list", self.cmd_list))
            self.application.add_handler(CommandHandler("configure", self.cmd_configure))
            self.application.add_handler(CommandHandler("help", self.cmd_help))
            self.application.add_handler(CommandHandler("stats", self.cmd_stats))
            self.application.add_handler(CommandHandler("logs", self.cmd_logs))
            
            # Add callback query handler for buttons
            self.application.add_handler(CallbackQueryHandler(self.handle_callback))
            
            logger.info("Telegram bot initialized")
            
        except Exception as e:
            logger.error(f"Failed to initialize Telegram bot: {e}")
            raise
    
    async def start(self):
        """Start the Telegram bot"""
        try:
            await self.application.initialize()
            await self.application.start()
            await self.application.updater.start_polling()
            self.is_running = True
            
            # Update bot status
            await self.db.update_bot_status(telegram_connected=True)
            
            logger.info("Telegram bot started")
            
        except Exception as e:
            logger.error(f"Failed to start Telegram bot: {e}")
            raise
    
    async def stop(self):
        """Stop the Telegram bot"""
        try:
            if self.application and self.is_running:
                await self.application.updater.stop()
                await self.application.stop()
                await self.application.shutdown()
                self.is_running = False
                
                # Update bot status
                await self.db.update_bot_status(telegram_connected=False)
                
            logger.info("Telegram bot stopped")
            
        except Exception as e:
            logger.error(f"Error stopping Telegram bot: {e}")
    
    def _is_admin(self, user_id: int) -> bool:
        """Check if user is admin"""
        return user_id in self.config.telegram_admin_ids
    
    async def _check_admin(self, update: Update) -> bool:
        """Check if user is admin and send error if not"""
        if not self._is_admin(update.effective_user.id):
            await update.message.reply_text(
                "❌ Sinulla ei ole oikeuksia käyttää tätä komentoa."
            )
            return False
        return True
    
    # Command handlers
    async def cmd_start(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /start command"""
        if not await self._check_admin(update):
            return
        
        try:
            # Start WhatsApp bot if not running
            if self.whatsapp_bot and not self.whatsapp_bot.is_running:
                await self.whatsapp_bot.start()
            
            # Update status
            await self.db.update_bot_status(is_running=True)
            
            # Log action
            await self.db.add_admin_log(
                admin_id=str(update.effective_user.id),
                admin_username=update.effective_user.username,
                action="start",
                description="Started bot"
            )
            
            await update.message.reply_text(
                "✅ Botti käynnistetty!\n\n"
                "Käytä /status nähdäksesi tilanteen."
            )
            
        except Exception as e:
            logger.error(f"Error starting bot: {e}")
            await update.message.reply_text(f"❌ Virhe käynnistettäessä: {e}")
    
    async def cmd_stop(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /stop command"""
        if not await self._check_admin(update):
            return
        
        try:
            # Stop WhatsApp bot
            if self.whatsapp_bot and self.whatsapp_bot.is_running:
                await self.whatsapp_bot.stop()
            
            # Update status
            await self.db.update_bot_status(
                is_running=False,
                whatsapp_connected=False
            )
            
            # Log action
            await self.db.add_admin_log(
                admin_id=str(update.effective_user.id),
                admin_username=update.effective_user.username,
                action="stop",
                description="Stopped bot"
            )
            
            await update.message.reply_text("✅ Botti pysäytetty.")
            
        except Exception as e:
            logger.error(f"Error stopping bot: {e}")
            await update.message.reply_text(f"❌ Virhe pysäytettäessä: {e}")
    
    async def cmd_restart(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /restart command"""
        if not await self._check_admin(update):
            return
        
        try:
            await update.message.reply_text("🔄 Käynnistetään uudelleen...")
            
            # Stop
            if self.whatsapp_bot and self.whatsapp_bot.is_running:
                await self.whatsapp_bot.stop()
            
            # Wait a bit
            await asyncio.sleep(2)
            
            # Start
            if self.whatsapp_bot:
                await self.whatsapp_bot.start()
            
            # Update status
            await self.db.update_bot_status(is_running=True)
            
            # Log action
            await self.db.add_admin_log(
                admin_id=str(update.effective_user.id),
                admin_username=update.effective_user.username,
                action="restart",
                description="Restarted bot"
            )
            
            await update.message.reply_text("✅ Botti käynnistetty uudelleen!")
            
        except Exception as e:
            logger.error(f"Error restarting bot: {e}")
            await update.message.reply_text(f"❌ Virhe uudelleenkäynnistettäessä: {e}")
    
    async def cmd_status(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /status command"""
        if not await self._check_admin(update):
            return
        
        try:
            # Get bot status
            status = await self.db.get_bot_status()
            stats = await self.db.get_statistics()
            
            # Format status message
            status_text = "📊 **Botin tila**\n\n"
            
            if status:
                status_text += f"🤖 Toiminnassa: {'✅ Kyllä' if status.is_running else '❌ Ei'}\n"
                status_text += f"📱 WhatsApp: {'✅ Yhdistetty' if status.whatsapp_connected else '❌ Ei yhdistetty'}\n"
                status_text += f"💬 Telegram: {'✅ Yhdistetty' if status.telegram_connected else '❌ Ei yhdistetty'}\n\n"
                
                if status.started_at:
                    status_text += f"⏰ Käynnistetty: {status.started_at.strftime('%Y-%m-%d %H:%M:%S')}\n\n"
            
            status_text += "📈 **Tilastot**\n\n"
            status_text += f"💬 Keskustelut yhteensä: {stats['total_conversations']}\n"
            status_text += f"✅ Aktiiviset keskustelut: {stats['active_conversations']}\n"
            status_text += f"📝 Viestit yhteensä: {stats['total_messages']}\n"
            status_text += f"🕐 Viestit (24h): {stats['messages_last_24h']}\n"
            
            await update.message.reply_text(
                status_text,
                parse_mode='Markdown'
            )
            
        except Exception as e:
            logger.error(f"Error getting status: {e}")
            await update.message.reply_text(f"❌ Virhe haettaessa tilaa: {e}")
    
    async def cmd_list(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /list command - list active conversations"""
        if not await self._check_admin(update):
            return
        
        try:
            conversations = await self.conversation_manager.get_active_conversations()
            
            if not conversations:
                await update.message.reply_text("Ei aktiivisia keskusteluja.")
                return
            
            text = "💬 **Aktiiviset keskustelut**\n\n"
            
            for i, conv in enumerate(conversations[:10], 1):
                name = conv.get('contact_name', 'Tuntematon')
                platform = conv.get('platform', '').upper()
                last_msg = conv.get('last_message_at', 'Ei viestiä')
                
                text += f"{i}. {name} ({platform})\n"
                text += f"   Viimeisin: {last_msg}\n\n"
            
            if len(conversations) > 10:
                text += f"\n... ja {len(conversations) - 10} muuta"
            
            await update.message.reply_text(text, parse_mode='Markdown')
            
        except Exception as e:
            logger.error(f"Error listing conversations: {e}")
            await update.message.reply_text(f"❌ Virhe: {e}")
    
    async def cmd_configure(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /configure command"""
        if not await self._check_admin(update):
            return
        
        await update.message.reply_text(
            "⚙️ **Konfigurointi**\n\n"
            "Keskustelujen konfigurointi tapahtuu ensimmäisen viestin yhteydessä.\n\n"
            "Voit asettaa:\n"
            "- 🎭 Sävy (professional/friendly/casual/playful)\n"
            "- 💕 Flirtti-taso (none/subtle/moderate/high)\n"
            "- 📝 Mukautettu system prompt\n"
            "- 🌡️ Temperature (0.0-1.0)\n\n"
            "Käytä WhatsApp-rajapintaa lähettääksesi ensimmäisen viestin.",
            parse_mode='Markdown'
        )
    
    async def cmd_help(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /help command"""
        if not await self._check_admin(update):
            return
        
        help_text = """
🤖 **AnomChatBot - Ohjeet**

**Komennot:**
/start - Käynnistä botti
/stop - Pysäytä botti
/restart - Käynnistä uudelleen
/status - Näytä botin tila
/list - Listaa aktiiviset keskustelut
/stats - Näytä tilastot
/logs - Näytä viimeisimmät logit
/configure - Konfigurointiohjeet
/help - Näytä tämä ohje

**Käyttö:**
1. Käynnistä botti /start-komennolla
2. Odota WhatsApp-yhteys
3. Lähetä ensimmäinen viesti WhatsApp-keskusteluun
4. Botti vastaa automaattisesti seuraaviin viesteihin

**Tuki:**
Ongelmatilanteissa tarkista /status ja /logs
        """
        
        await update.message.reply_text(help_text, parse_mode='Markdown')
    
    async def cmd_stats(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /stats command - detailed statistics"""
        if not await self._check_admin(update):
            return
        
        try:
            stats = await self.db.get_statistics()
            
            text = "📊 **Yksityiskohtaiset tilastot**\n\n"
            text += f"💬 Keskustelut:\n"
            text += f"   • Yhteensä: {stats['total_conversations']}\n"
            text += f"   • Aktiiviset: {stats['active_conversations']}\n\n"
            text += f"📝 Viestit:\n"
            text += f"   • Yhteensä: {stats['total_messages']}\n"
            text += f"   • Viimeisen 24h: {stats['messages_last_24h']}\n"
            
            await update.message.reply_text(text, parse_mode='Markdown')
            
        except Exception as e:
            logger.error(f"Error getting stats: {e}")
            await update.message.reply_text(f"❌ Virhe: {e}")
    
    async def cmd_logs(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /logs command - show recent admin logs"""
        if not await self._check_admin(update):
            return
        
        try:
            logs = await self.db.get_admin_logs(limit=10)
            
            if not logs:
                await update.message.reply_text("Ei lokitietoja.")
                return
            
            text = "📋 **Viimeisimmät toiminnot**\n\n"
            
            for log in logs:
                timestamp = log.created_at.strftime('%Y-%m-%d %H:%M:%S')
                status = "✅" if log.success else "❌"
                text += f"{status} {timestamp}\n"
                text += f"   {log.action} - {log.admin_username or 'Admin'}\n"
                if log.description:
                    text += f"   {log.description}\n"
                text += "\n"
            
            await update.message.reply_text(text, parse_mode='Markdown')
            
        except Exception as e:
            logger.error(f"Error getting logs: {e}")
            await update.message.reply_text(f"❌ Virhe: {e}")
    
    async def handle_callback(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle callback queries from inline keyboards"""
        query = update.callback_query
        await query.answer()
        
        # Handle different callback actions
        # This can be extended based on needs
        
        logger.info(f"Callback query: {query.data}")
