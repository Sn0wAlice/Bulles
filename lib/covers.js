const https = require('https');
const http = require('http');

function fetch(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'Bulles/1.0' } }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

async function searchGoogleBooks(query) {
  try {
    const encoded = encodeURIComponent(query);
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encoded}&maxResults=5&printType=books`;
    const res = await fetch(url);
    if (res.status !== 200) return null;

    const data = JSON.parse(res.body);
    if (!data.items || data.items.length === 0) return null;

    for (const item of data.items) {
      const images = item.volumeInfo?.imageLinks;
      if (images) {
        // Prefer higher resolution
        const url = images.thumbnail || images.smallThumbnail;
        if (url) return url.replace('http://', 'https://');
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function searchOpenLibrary(query) {
  try {
    const encoded = encodeURIComponent(query);
    const url = `https://openlibrary.org/search.json?q=${encoded}&limit=5`;
    const res = await fetch(url);
    if (res.status !== 200) return null;

    const data = JSON.parse(res.body);
    if (!data.docs || data.docs.length === 0) return null;

    for (const doc of data.docs) {
      if (doc.cover_i) {
        return `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function searchCover(titre, serie) {
  // Build query: try serie + titre first, then titre alone
  const queries = [];
  if (serie && titre) queries.push(`${serie} ${titre}`);
  if (titre) queries.push(titre);
  if (serie) queries.push(serie);

  for (const query of queries) {
    const googleResult = await searchGoogleBooks(query);
    if (googleResult) return googleResult;
  }

  for (const query of queries) {
    const olResult = await searchOpenLibrary(query);
    if (olResult) return olResult;
  }

  return null;
}

module.exports = { searchCover };
