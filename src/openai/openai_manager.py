"""
OpenAI integration for AnomChatBot
"""
import asyncio
import base64
from typing import List, Dict, Optional, Tuple
from openai import AsyncOpenAI
from loguru import logger
import tiktoken


class OpenAIManager:
    """Manages OpenAI API interactions"""
    
    def __init__(self, api_key: str, model: str = "gpt-4-turbo-preview"):
        self.client = AsyncOpenAI(api_key=api_key)
        self.model = model
        try:
            # Use tokenizer corresponding to the configured model when possible
            self.encoding = tiktoken.encoding_for_model(self.model)
        except Exception as e:
            logger.warning(
                f"Falling back to cl100k_base tokenizer for model '{self.model}': {e}"
            )
            # Fallback to a generic GPT-4-class tokenizer
            self.encoding = tiktoken.get_encoding("cl100k_base")
    
    def count_tokens(self, text: str) -> int:
        """Count tokens in text"""
        try:
            return len(self.encoding.encode(text))
        except Exception as e:
            logger.warning(f"Error counting tokens: {e}")
            # Rough estimate: ~4 chars per token
            return len(text) // 4
    
    async def generate_response(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 2000,
        system_prompt: Optional[str] = None
    ) -> Tuple[str, int]:
        """
        Generate AI response from messages
        
        Returns:
            Tuple of (response_text, token_count)
        """
        try:
            # Prepare messages
            api_messages = []
            
            # Add system prompt if provided
            if system_prompt:
                api_messages.append({
                    "role": "system",
                    "content": system_prompt
                })
            
            # Add conversation messages
            api_messages.extend(messages)
            
            # Generate response
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=api_messages,
                temperature=temperature,
                max_tokens=max_tokens
            )
            
            # Extract response
            response_text = response.choices[0].message.content
            token_count = response.usage.total_tokens if response.usage else 0
            
            logger.info(f"Generated response with {token_count} tokens")
            
            return response_text, token_count
            
        except Exception as e:
            logger.error(f"Error generating AI response: {e}")
            raise
    
    async def analyze_image(
        self,
        image_path: str,
        prompt: str = "Kuvaile tämä kuva yksityiskohtaisesti suomeksi."
    ) -> str:
        """
        Analyze image using GPT-4 Vision
        
        Args:
            image_path: Path to image file
            prompt: Analysis prompt
            
        Returns:
            Analysis text
        """
        try:
            # Read and encode image
            with open(image_path, 'rb') as image_file:
                image_data = base64.b64encode(image_file.read()).decode('utf-8')
            
            # Determine image format
            ext = image_path.lower().split('.')[-1]
            mime_type = f"image/{ext if ext != 'jpg' else 'jpeg'}"
            
            # Analyze image
            response = await self.client.chat.completions.create(
                model="gpt-4-vision-preview",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{mime_type};base64,{image_data}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=500
            )
            
            analysis = response.choices[0].message.content
            logger.info(f"Analyzed image: {image_path}")
            
            return analysis
            
        except Exception as e:
            logger.error(f"Error analyzing image: {e}")
            return f"En pystynyt analysoimaan kuvaa: {str(e)}"
    
    async def transcribe_audio(
        self,
        audio_path: str,
        language: str = "fi"
    ) -> str:
        """
        Transcribe audio file
        
        Args:
            audio_path: Path to audio file
            language: Language code (e.g., 'fi', 'en')
            
        Returns:
            Transcribed text
        """
        try:
            with open(audio_path, 'rb') as audio_file:
                transcript = await self.client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    language=language
                )
            
            logger.info(f"Transcribed audio: {audio_path}")
            return transcript.text
            
        except Exception as e:
            logger.error(f"Error transcribing audio: {e}")
            return f"En pystynyt litteroimaan ääntä: {str(e)}"
    
    async def analyze_video_frame(
        self,
        frame_path: str,
        prompt: str = "Kuvaile mitä tässä videokuvassa tapahtuu."
    ) -> str:
        """
        Analyze a single video frame
        
        Args:
            frame_path: Path to video frame image
            prompt: Analysis prompt
            
        Returns:
            Analysis text
        """
        return await self.analyze_image(frame_path, prompt)
    
    async def summarize_text(
        self,
        text: str,
        max_length: int = 200
    ) -> str:
        """
        Summarize long text
        
        Args:
            text: Text to summarize
            max_length: Maximum length of summary
            
        Returns:
            Summarized text
        """
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "Olet assistentti joka tiivistää tekstiä suomeksi."
                    },
                    {
                        "role": "user",
                        "content": f"Tiivistä seuraava teksti noin {max_length} merkkiin:\n\n{text}"
                    }
                ],
                max_tokens=max_length
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            logger.error(f"Error summarizing text: {e}")
            return text[:max_length] + "..."
    
    def format_messages_for_api(
        self,
        messages: List[Dict],
        include_media: bool = True
    ) -> List[Dict[str, str]]:
        """
        Format database messages for OpenAI API
        
        Args:
            messages: List of message objects from database
            include_media: Whether to include media descriptions
            
        Returns:
            Formatted messages for API
        """
        formatted = []
        
        for msg in messages:
            content = msg.get('content', '')
            
            # Add media description if available
            if include_media and msg.get('media_metadata'):
                media_desc = msg['media_metadata'].get('description', '')
                if media_desc:
                    content = f"[{msg.get('message_type', 'media').upper()}] {media_desc}\n{content}"
            
            formatted.append({
                "role": msg.get('role', 'user'),
                "content": content
            })
        
        return formatted
    
    async def moderate_content(self, text: str) -> Dict:
        """
        Check content for policy violations
        
        Args:
            text: Text to moderate
            
        Returns:
            Moderation results
        """
        try:
            response = await self.client.moderations.create(input=text)
            result = response.results[0]
            
            return {
                'flagged': result.flagged,
                'categories': result.categories.model_dump() if result.categories else {},
                'category_scores': result.category_scores.model_dump() if result.category_scores else {}
            }
            
        except Exception as e:
            logger.error(f"Error moderating content: {e}")
            return {'flagged': False, 'categories': {}, 'category_scores': {}}
