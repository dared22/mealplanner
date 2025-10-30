from openai import OpenAI
import os

client = OpenAI()

response =  client.responses.create(
    model="gpt-5-nano",
    input="generate a 5 day meal plan for me."
)

print(response.output_text)