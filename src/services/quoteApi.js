const QUOTE_API_URL = 'https://dummyjson.com/quotes/random';

export async function getRandomQuote() {
  const response = await fetch(QUOTE_API_URL);
  if (!response.ok) throw new Error(`Quotes API request failed (${response.status})`);
  return response.json();
}
