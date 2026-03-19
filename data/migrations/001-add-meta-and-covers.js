module.exports = {
  version: 1,
  up(data) {
    // Add cover_url field to all existing books
    for (const book of data.books) {
      if (book.cover_url === undefined) {
        book.cover_url = '';
      }
    }
    return data;
  },
};
