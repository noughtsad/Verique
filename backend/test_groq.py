import asyncio
import os
from groq import AsyncGroq
from dotenv import load_dotenv

load_dotenv()

async def test_groq():
    client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))
    try:
        response = await client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": "hello"}],
            temperature=0,
            max_tokens=10
        )
        print("Success:", response.choices[0].message.content)
    except Exception as e:
        print("Error:", str(e))

if __name__ == "__main__":
    asyncio.run(test_groq())
